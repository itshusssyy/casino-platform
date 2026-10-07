import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { errorResponse, GameError } from "@/lib/errors";
import { METHOD_INFO } from "@/lib/payments";
import { raiseFlag } from "@/lib/risk";
import { getCurrentUser, PAUSED_MESSAGE } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { activeMethods, coinsToUsdLabel } from "@/lib/settings-shared";
import { debit, withdrawableCoins } from "@/lib/wallet";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const normalizeHandle = (h: string) => h.toLowerCase().replace(/[\s$()+-]/g, "");

// Customer requests a payout. Coins are held; you send the money manually via the chosen
// method, then Approve in /admin (Reject refunds the coins). Off unless WITHDRAWALS_ENABLED=true.
export async function POST(req: Request) {
  if (!config.withdrawalsEnabled) return Response.json({ error: "Withdrawals are not available" }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in" }, { status: 401 });
  if (user.status === "PAUSED") return Response.json({ error: PAUSED_MESSAGE }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  const method = activeMethods(settings, "withdrawal").find((m) => m.id === body.method);
  const coins = Number(body.coins);
  const handle = String(body.payoutHandle ?? "").trim().slice(0, 100);
  if (!method) return Response.json({ error: "Payout method not available" }, { status: 400 });
  if (handle.length < 3) return Response.json({ error: `Enter ${METHOD_INFO[method.id].payoutLabel.toLowerCase()}` }, { status: 400 });
  if (!Number.isInteger(coins) || coins <= 0) return Response.json({ error: "Enter a whole number of coins" }, { status: 400 });

  const { coinsPerDollar, withdrawal: w } = settings;
  const usd = (c: number) => coinsToUsdLabel(c, coinsPerDollar);
  const amountCents = Math.floor((coins / coinsPerDollar) * 100);
  if (amountCents < w.minUsd * 100) return Response.json({ error: `Minimum withdrawal is $${w.minUsd}` }, { status: 400 });
  if (amountCents > w.maxPerRequestUsd * 100) return Response.json({ error: `Maximum per withdrawal is $${w.maxPerRequestUsd}` }, { status: 400 });

  try {
    const request = await db.$transaction(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { balance: true, bonusCoins: true, bonusWagerLeft: true, depositWagerLeft: true, totalDepositCents: true, createdAt: true },
      });

      // ── Eligibility ──────────────────────────────────────────────
      const ageHours = (Date.now() - u.createdAt.getTime()) / HOUR;
      if (ageHours < w.newAccountHours)
        throw new GameError(`New accounts can withdraw after ${w.newAccountHours} hours. Please try again in ${Math.ceil(w.newAccountHours - ageHours)}h.`);
      if (w.requireDeposit && u.totalDepositCents <= 0)
        throw new GameError("Make at least one deposit before your first withdrawal. Bonus credit can be played but not withdrawn on its own.");
      if (u.depositWagerLeft > 0)
        throw new GameError(`Play through your deposit first: bet ${u.depositWagerLeft.toLocaleString()} more coins (${usd(u.depositWagerLeft)}) to unlock withdrawals.`);
      const available = withdrawableCoins(u);
      if (coins > available) {
        const locked = u.balance - available;
        throw new GameError(
          locked > 0
            ? `You can withdraw up to ${available.toLocaleString()} coins (${usd(available)}). ${locked.toLocaleString()} bonus coins unlock after you bet ${u.bonusWagerLeft.toLocaleString()} more coins.`
            : "Not enough coins",
        );
      }

      // ── Velocity limits (all non-rejected requests count) ────────
      const sumSince = async (ms: number) => {
        const r = await tx.paymentRequest.aggregate({
          where: { userId: user.id, kind: "WITHDRAWAL", status: { not: "REJECTED" }, createdAt: { gte: new Date(Date.now() - ms) } },
          _sum: { amountCents: true },
          _count: true,
        });
        return { cents: r._sum.amountCents ?? 0, count: r._count };
      };
      const day = await sumSince(DAY);
      const week = await sumSince(7 * DAY);
      const month = await sumSince(30 * DAY);
      if (day.count >= w.maxRequestsPerDay) throw new GameError(`You can make ${w.maxRequestsPerDay} withdrawal request(s) per day.`);
      const left = (limitUsd: number, usedCents: number) => Math.max(0, (limitUsd * 100 - usedCents) / 100).toFixed(2);
      if (day.cents + amountCents > w.maxPerDayUsd * 100) throw new GameError(`Daily withdrawal limit is $${w.maxPerDayUsd}. You can still withdraw $${left(w.maxPerDayUsd, day.cents)} today.`);
      if (week.cents + amountCents > w.maxPerWeekUsd * 100) throw new GameError(`Weekly withdrawal limit is $${w.maxPerWeekUsd}. You can still withdraw $${left(w.maxPerWeekUsd, week.cents)} this week.`);
      if (month.cents + amountCents > w.maxPerMonthUsd * 100) throw new GameError(`Monthly withdrawal limit is $${w.maxPerMonthUsd}. You can still withdraw $${left(w.maxPerMonthUsd, month.cents)} this month.`);

      const r = await tx.paymentRequest.create({
        data: { userId: user.id, kind: "WITHDRAWAL", provider: method.id, coins, amountCents, reference: handle },
      });
      // Coins are held immediately; refunded if the admin rejects.
      await debit(tx, user.id, coins, "WITHDRAWAL", `Withdrawal request ${r.id}`);

      // ── Suspicious patterns → flags for /admin/risk ──────────────
      const others = await tx.paymentRequest.findMany({
        where: { kind: "WITHDRAWAL", userId: { not: user.id }, provider: method.id },
        select: { userId: true, reference: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      });
      const sameHandle = [...new Set(others.filter((o) => o.reference && normalizeHandle(o.reference) === normalizeHandle(handle)).map((o) => o.userId))];
      if (sameHandle.length)
        await raiseFlag(tx, user.id, "SHARED_PAYOUT", "HIGH", `${METHOD_INFO[method.id].name} payout account "${handle}" was also used by ${sameHandle.length} other account(s).`, sameHandle);

      const lastDeposit = await tx.paymentRequest.findFirst({
        where: { userId: user.id, kind: "DEPOSIT", status: "APPROVED" },
        orderBy: { reviewedAt: "desc" },
        select: { reviewedAt: true },
      });
      const betsSince = await tx.bet.count({ where: { userId: user.id, createdAt: { gte: lastDeposit?.reviewedAt ?? new Date(0) } } });
      if (betsSince < 10) await raiseFlag(tx, user.id, "NO_PLAY_WITHDRAW", "MEDIUM", `Withdrawal of ${usd(coins)} with only ${betsSince} bet(s) since the last deposit.`);

      const profit = await tx.bet.aggregate({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - DAY) } }, _sum: { amount: true, payout: true } });
      const netUsd = ((profit._sum.payout ?? 0) - (profit._sum.amount ?? 0)) / coinsPerDollar;
      if (settings.risk.dailyProfitUsd > 0 && netUsd >= settings.risk.dailyProfitUsd)
        await raiseFlag(tx, user.id, "HIGH_PROFIT", "MEDIUM", `Up $${netUsd.toFixed(2)} in the last 24 hours, requesting ${usd(coins)}.`);
      return r;
    });
    return Response.json({ id: request.id });
  } catch (err) {
    return errorResponse(err);
  }
}
