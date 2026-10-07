import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const MODES = ["NORMAL", "TIGHT", "FORCE_LOSS"] as const;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const lossMode = String(body.lossMode ?? "");
  if (!userId) return Response.json({ error: "Invalid user" }, { status: 400 });
  if (!MODES.includes(lossMode as (typeof MODES)[number])) {
    return Response.json({ error: "Invalid loss mode" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { lossMode },
  });

  return Response.json({ ok: true, lossMode });
}
