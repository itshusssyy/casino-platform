import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { errorResponse, GameError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { usdToCoins } from "@/lib/settings-shared";
import { creditBonus } from "@/lib/wallet";

// Act on a risk flag: dismiss it, pause/freeze the user, or (for BONUS_HELD) grant the signup credit.
export async function POST(req: Request, ctx: RouteContext<"/api/admin/risk/flags/[id]">) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (!["dismiss", "pause", "freeze", "grant_bonus"].includes(action)) return Response.json({ error: "Invalid action" }, { status: 400 });
  const settings = await getSettings();

  try {
    await db.$transaction(async (tx) => {
      const flag = await tx.riskFlag.findUnique({ where: { id } });
      if (!flag) throw new GameError("Flag not found", 404);
      const close = () =>
        tx.riskFlag.update({ where: { id }, data: { status: action === "dismiss" ? "DISMISSED" : "ACTIONED", reviewedBy: admin.id, reviewedAt: new Date() } });

      if (action === "pause" || action === "freeze") {
        if (flag.userId === admin.id) throw new GameError("You can't pause or freeze yourself");
        await tx.user.update({
          where: { id: flag.userId },
          data: { status: action === "pause" ? "PAUSED" : "FROZEN", statusNote: action === "pause" ? "Account under review" : "Account under review" },
        });
      }

      if (action === "grant_bonus") {
        // Atomic: only grants once even if clicked twice.
        const res = await tx.user.updateMany({ where: { id: flag.userId, signupBonusHeld: true }, data: { signupBonusHeld: false } });
        if (res.count === 0) throw new GameError("Signup credit was already granted or not held");
        await creditBonus(tx, settings, flag.userId, usdToCoins(settings, settings.signupBonusUsd), "SIGNUP_BONUS", `$${settings.signupBonusUsd} welcome credit (released after review)`, admin.id);
      }
      if (action === "dismiss" && flag.type === "BONUS_HELD") {
        // Dismissing a held bonus = the user doesn't get it.
        await tx.user.update({ where: { id: flag.userId }, data: { signupBonusHeld: false } });
      }
      await close();
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
