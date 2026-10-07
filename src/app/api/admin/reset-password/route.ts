import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// Admin sets a temporary password for a customer who forgot theirs and logs them out everywhere.
// The temporary password is returned once so the admin can send it to the customer (e.g. on WhatsApp).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  if (!userId) return Response.json({ error: "Invalid user" }, { status: 400 });

  const temp = Array.from({ length: 10 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(temp, 12), sessionVersion: { increment: 1 } },
  });
  return Response.json({ tempPassword: temp });
}
