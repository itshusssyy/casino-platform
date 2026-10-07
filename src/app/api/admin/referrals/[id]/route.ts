import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { errorResponse, GameError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { creditBonus } from "@/lib/wallet";

// Approve (credit coins) or reject a referral reward the referrer has claimed.
export async function POST(req: Request, ctx: RouteContext<"/api/admin/referrals/[id]">) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "approve" ? "PAID" : body.decision === "reject" ? "REJECTED" : null;
  if (!decision) return Response.json({ error: "Invalid decision" }, { status: 400 });

  const settings = await getSettings();
  try {
    await db.$transaction(async (tx) => {
      const res = await tx.referralReward.updateMany({
        where: { id, status: "CLAIM_REQUESTED" },
        data: { status: decision, reviewedBy: admin.id, reviewedAt: new Date() },
      });
      if (res.count === 0) throw new GameError("Reward already handled", 409);
      if (decision === "PAID") {
        const r = await tx.referralReward.findUniqueOrThrow({ where: { id }, include: { referredUser: { select: { firstName: true, username: true, email: true } } } });
        await creditBonus(tx, settings, r.referrerId, r.coins, "REFERRAL_BONUS",
          `Referral reward: ${r.referredUser.firstName ?? r.referredUser.username ?? r.referredUser.email} reached $${r.tierCents / 100}`, admin.id);
      }
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
