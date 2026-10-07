import { db } from "@/lib/db";
import { getCurrentUser, PAUSED_MESSAGE } from "@/lib/session";

// The referrer asks for an earned reward to be paid. An admin approves it in /admin.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in" }, { status: 401 });
  if (user.status === "PAUSED") return Response.json({ error: PAUSED_MESSAGE }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const res = await db.referralReward.updateMany({
    where: { id: String(body.id ?? ""), referrerId: user.id, status: "AVAILABLE" },
    data: { status: "CLAIM_REQUESTED", claimedAt: new Date() },
  });
  if (res.count === 0) return Response.json({ error: "Reward not available" }, { status: 400 });
  return Response.json({ ok: true });
}
