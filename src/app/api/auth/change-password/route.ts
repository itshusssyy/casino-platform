import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSession, getCurrentUser } from "@/lib/session";

// Logged-in user changes their own password. Other devices are logged out.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in" }, { status: 401 });
  if (!rateLimit(`pw:${user.id}:${clientIp(req)}`, 5, 15 * 60 * 1000))
    return Response.json({ error: "Too many attempts, wait 15 minutes" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (next.length < 8 || next.length > 100) return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row.passwordHash || !(await bcrypt.compare(current, row.passwordHash)))
    return Response.json({ error: "Current password is wrong" }, { status: 400 });

  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await createSession(user.id, updated.sessionVersion); // keep this device logged in
  return Response.json({ ok: true });
}
