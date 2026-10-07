import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import type { Tx } from "./wallet";

// ─────────────────────────────────────────────────────────────────────────────
//  Risk & multi-account detection
//  Signals: a device-ID cookie, a browser fingerprint, and the IP address.
//  None is perfect on its own (cookies can be cleared, identical phones share
//  fingerprints, families share IPs), so they raise flags of different severity
//  for an admin to review on /admin/risk.
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_COOKIE = "rs_did";
const IP_WINDOW_DAYS = 30;

export type ClientInfo = { deviceId: string; fingerprint: string | null; ip: string | null; userAgent: string | null };

/** Reads (or creates) the device-ID cookie and collects IP / user agent / fingerprint. */
export async function getClientInfo(fingerprint?: unknown): Promise<ClientInfo> {
  const jar = await cookies();
  let deviceId = jar.get(DEVICE_COOKIE)?.value;
  if (!deviceId || !/^[a-f0-9-]{36}$/.test(deviceId)) {
    deviceId = randomUUID();
    jar.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const fp = typeof fingerprint === "string" && /^[a-f0-9]{16,64}$/.test(fingerprint) ? fingerprint : null;
  return { deviceId, fingerprint: fp, ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function logDevice(tx: Tx, userId: string, event: "SIGNUP" | "LOGIN", c: ClientInfo) {
  await tx.deviceLog.create({ data: { userId, event, deviceId: c.deviceId, fingerprint: c.fingerprint, ip: c.ip, userAgent: c.userAgent } });
}

/** Other accounts seen on the same device cookie, fingerprint or IP (IP: last 30 days). */
export async function findLinkedAccounts(tx: Tx, c: ClientInfo, excludeUserId?: string) {
  const since = new Date(Date.now() - IP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const logs = await tx.deviceLog.findMany({
    where: {
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      OR: [
        { deviceId: c.deviceId },
        ...(c.fingerprint ? [{ fingerprint: c.fingerprint }] : []),
        ...(c.ip ? [{ ip: c.ip, createdAt: { gte: since } }] : []),
      ],
    },
    select: { userId: true, deviceId: true, fingerprint: true, ip: true },
    take: 200,
  });
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    byDevice: uniq(logs.filter((l) => l.deviceId === c.deviceId).map((l) => l.userId)),
    byFingerprint: uniq(logs.filter((l) => c.fingerprint && l.fingerprint === c.fingerprint).map((l) => l.userId)),
    byIp: uniq(logs.filter((l) => c.ip && l.ip === c.ip).map((l) => l.userId)),
  };
}

export type FlagType =
  | "SHARED_DEVICE" | "SHARED_FINGERPRINT" | "SHARED_IP" | "SHARED_PAYOUT" | "REFERRAL_SELF"
  | "BIG_WIN" | "HIGH_PROFIT" | "NO_PLAY_WITHDRAW" | "BONUS_HELD";

export const FLAG_INFO: Record<FlagType, { label: string; help: string }> = {
  SHARED_DEVICE: { label: "Same device as another account", help: "Same browser cookie as another account. Strong sign of multiple accounts." },
  SHARED_FINGERPRINT: { label: "Same browser fingerprint", help: "Identical browser/screen traits. Can be a coincidence on identical phones; stronger together with the same IP." },
  SHARED_IP: { label: "Same IP as another account", help: "Same network in the last 30 days. Common for families, offices and mobile networks." },
  SHARED_PAYOUT: { label: "Payout account used by another user", help: "The same Cash App / Zelle / Chime account was given by a different user." },
  REFERRAL_SELF: { label: "Referred by own device", help: "The referred account shares a device or network with the referrer. Likely self-referral." },
  BIG_WIN: { label: "Big single win", help: "One payout above the big-win threshold." },
  HIGH_PROFIT: { label: "High 24h profit", help: "The player is up more than the daily profit threshold in the last 24 hours." },
  NO_PLAY_WITHDRAW: { label: "Withdraw with little play", help: "Withdrawal requested with very few bets since the last deposit." },
  BONUS_HELD: { label: "Signup credit held", help: "Signup credit was held because the device was used by another account. Grant it or dismiss." },
};

/** Creates a flag unless the same open flag for this user already exists in the last 24h. */
export async function raiseFlag(
  tx: Tx,
  userId: string,
  type: FlagType,
  severity: "LOW" | "MEDIUM" | "HIGH",
  details: string,
  relatedUsers: string[] = [],
) {
  const recent = await tx.riskFlag.findFirst({
    where: { userId, type, status: "OPEN", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  if (recent) return;
  await tx.riskFlag.create({
    data: { userId, type, severity, details: details.slice(0, 500), relatedUsers: relatedUsers.length ? JSON.stringify(relatedUsers.slice(0, 20)) : null },
  });
}

/** Flags multi-account signals for a user, given who else was seen on the same device/network. */
export async function flagLinkedAccounts(tx: Tx, userId: string, linked: Awaited<ReturnType<typeof findLinkedAccounts>>, event: string) {
  if (linked.byDevice.length)
    await raiseFlag(tx, userId, "SHARED_DEVICE", "HIGH", `${event} from a device already used by ${linked.byDevice.length} other account(s).`, linked.byDevice);
  const fpAndIp = linked.byFingerprint.filter((id) => linked.byIp.includes(id) && !linked.byDevice.includes(id));
  if (fpAndIp.length)
    await raiseFlag(tx, userId, "SHARED_FINGERPRINT", "HIGH", `${event} with the same browser fingerprint AND network as ${fpAndIp.length} other account(s).`, fpAndIp);
  else if (linked.byFingerprint.length && !linked.byDevice.length)
    await raiseFlag(tx, userId, "SHARED_FINGERPRINT", "LOW", `${event} with the same browser fingerprint as ${linked.byFingerprint.length} other account(s).`, linked.byFingerprint);
  const ipOnly = linked.byIp.filter((id) => !linked.byDevice.includes(id) && !fpAndIp.includes(id));
  if (ipOnly.length)
    await raiseFlag(tx, userId, "SHARED_IP", "LOW", `${event} from the same IP as ${ipOnly.length} other account(s) in the last 30 days.`, ipOnly);
}

/** Open flag counts per user (for showing warnings next to payment requests). */
export async function openFlagCounts(userIds: string[]) {
  if (!userIds.length) return new Map<string, { total: number; high: number }>();
  const rows = await db.riskFlag.groupBy({ by: ["userId", "severity"], where: { userId: { in: userIds }, status: "OPEN" }, _count: true });
  const map = new Map<string, { total: number; high: number }>();
  for (const r of rows) {
    const m = map.get(r.userId) ?? { total: 0, high: 0 };
    m.total += r._count;
    if (r.severity === "HIGH") m.high += r._count;
    map.set(r.userId, m);
  }
  return map;
}
