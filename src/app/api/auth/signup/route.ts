import bcrypt from "bcryptjs";
import { z } from "zod";
import { toE164 } from "@/lib/countries";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findReferrer, generateReferralCode } from "@/lib/referrals";
import { findLinkedAccounts, flagLinkedAccounts, getClientInfo, logDevice, raiseFlag } from "@/lib/risk";
import { createSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { usdToCoins } from "@/lib/settings-shared";
import { creditBonus } from "@/lib/wallet";

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(40, `${label} is too long`)
    .regex(/^[\p{L}][\p{L}' .-]*$/u, `${label} can only contain letters`);

const schema = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  country: z.string().length(2, "Choose your country code"),
  phone: z.string().trim().min(4, "Enter your phone number").max(20),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  ageConfirmed: z.literal(true, { message: "You must confirm you are 18 or older" }),
  ref: z.string().trim().max(16).optional(),
  fp: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000))
    return Response.json({ error: "Too many signups, try again later" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { firstName, lastName, country, email, password, ref } = parsed.data;
  const phone = toE164(country, parsed.data.phone);
  if (!phone) return Response.json({ error: "Enter a valid phone number" }, { status: 400 });

  const existing = await db.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (existing)
    return Response.json({ error: existing.email === email ? "Email already registered" : "Phone number already registered" }, { status: 409 });

  const referrer = ref ? await findReferrer(ref) : null;
  if (ref && (!referrer || referrer.status === "FROZEN")) return Response.json({ error: "Invalid referral code" }, { status: 400 });

  const settings = await getSettings();
  const client = await getClientInfo(parsed.data.fp);
  const passwordHash = await bcrypt.hash(password, 12);
  const { user, bonusHeld } = await db.$transaction(async (tx) => {
    // Who else has used this device / browser / network?
    const linked = await findLinkedAccounts(tx, client);
    const strongMatch = linked.byDevice.length > 0 || linked.byFingerprint.some((id) => linked.byIp.includes(id));
    const hold = settings.signupBonusUsd > 0 && ((settings.bonus.holdOnSharedDevice && strongMatch) || (settings.bonus.holdOnSharedIp && linked.byIp.length > 0));

    const u = await tx.user.create({
      data: {
        firstName, lastName, phone, email, passwordHash,
        referralCode: generateReferralCode(), referredById: referrer?.id,
        signupIp: client.ip, signupDeviceId: client.deviceId, signupBonusHeld: hold,
      },
    });
    await logDevice(tx, u.id, "SIGNUP", client);
    await flagLinkedAccounts(tx, u.id, linked, "Signed up");
    if (referrer && [...linked.byDevice, ...linked.byFingerprint, ...linked.byIp].includes(referrer.id))
      await raiseFlag(tx, u.id, "REFERRAL_SELF", "HIGH", "Signed up with a referral code from an account on the same device or network.", [referrer.id]);

    if (hold) {
      await raiseFlag(tx, u.id, "BONUS_HELD", "MEDIUM", `$${settings.signupBonusUsd} signup credit held: device/network already used by another account.`, [...linked.byDevice, ...linked.byIp]);
    } else {
      await creditBonus(tx, settings, u.id, usdToCoins(settings, settings.signupBonusUsd), "SIGNUP_BONUS", `$${settings.signupBonusUsd} welcome credit`);
    }
    return { user: u, bonusHeld: hold };
  });
  await createSession(user.id, user.sessionVersion);
  return Response.json({ ok: true, bonusHeld });
}
