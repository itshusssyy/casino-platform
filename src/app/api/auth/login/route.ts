import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findLinkedAccounts, flagLinkedAccounts, getClientInfo, logDevice } from "@/lib/risk";
import { createSession } from "@/lib/session";

// Log in with email, phone (+15551234567) or (for older accounts) username.
export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000))
    return Response.json({ error: "Too many attempts, wait 15 minutes" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const raw = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!raw || !password) return Response.json({ error: "Enter your email or phone and password" }, { status: 400 });

  const phone = /^\+?[\d\s()-]{7,}$/.test(raw) ? `+${raw.replace(/\D/g, "")}` : null;
  const user = await db.user.findFirst({
    where: { OR: [{ email: raw.toLowerCase() }, { username: raw }, ...(phone ? [{ phone }] : [])] },
  });
  const ok = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) return Response.json({ error: "Wrong email/phone or password" }, { status: 401 });
  if (user.status === "FROZEN")
    return Response.json({ error: user.statusNote ? `Account frozen: ${user.statusNote}` : "This account is frozen. Contact support." }, { status: 403 });

  const client = await getClientInfo(body.fp);
  await db.$transaction(async (tx) => {
    const linked = await findLinkedAccounts(tx, client, user.id);
    await logDevice(tx, user.id, "LOGIN", client);
    await flagLinkedAccounts(tx, user.id, linked, "Logged in");
  });
  await createSession(user.id, user.sessionVersion);
  return Response.json({ ok: true });
}
