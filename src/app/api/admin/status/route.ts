import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const STATUSES = ["ACTIVE", "PAUSED", "FROZEN"] as const;

// Set a user's account status. Same effect as editing users.status in Supabase.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const status = String(body.status ?? "");
  if (!userId || userId === admin.id) return Response.json({ error: "Invalid user" }, { status: 400 });
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return Response.json({ error: "Invalid status" }, { status: 400 });

  await db.user.update({
    where: { id: userId },
    data: { status, statusNote: status === "ACTIVE" ? null : String(body.note ?? "").slice(0, 200) || null },
  });
  return Response.json({ ok: true });
}
