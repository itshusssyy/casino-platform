import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { errorResponse, GameError } from "@/lib/errors";
import { applyApprovedDeposit } from "@/lib/referrals";
import { getSettings } from "@/lib/settings";
import { credit } from "@/lib/wallet";

// Approve / reject a PaymentRequest (placeholder flow — see src/lib/payments/README.md).
export async function POST(req: Request, ctx: RouteContext<"/api/admin/payments/[id]">) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "approve" ? "APPROVED" : body.decision === "reject" ? "REJECTED" : null;
  if (!decision) return Response.json({ error: "Invalid decision" }, { status: 400 });

  const settings = await getSettings();
  try {
    await db.$transaction(async (tx) => {
      // Only PENDING requests can be decided, and only once.
      const res = await tx.paymentRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: decision, reviewedBy: admin.id, reviewedAt: new Date(), note: String(body.note ?? "").slice(0, 200) || null },
      });
      if (res.count === 0) throw new GameError("Request already handled", 409);
      const r = await tx.paymentRequest.findUniqueOrThrow({ where: { id } });
      if (r.kind === "DEPOSIT" && decision === "APPROVED") await applyApprovedDeposit(tx, settings, r, admin.id);
      if (r.kind === "WITHDRAWAL" && decision === "REJECTED")
        await credit(tx, r.userId, r.coins, "REFUND", `Withdrawal ${r.id} rejected`, admin.id);
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
