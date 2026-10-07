import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { gameBySlug } from "@/lib/games/tables";
import { getSettings } from "@/lib/settings";

const MIN = 60_000;

// Live numbers for the risk dashboard (polled every 30s by /admin/risk).
export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  const s = await getSettings();
  const now = Date.now();
  const d1 = new Date(now - 24 * 60 * MIN);
  const h1 = new Date(now - 60 * MIN);

  const [bets24, bets1h, active, liability, pendingW, pendingD, approvedD, approvedW, topWinners, bigWins, flags, signups, held] = await Promise.all([
    db.bet.aggregate({ where: { createdAt: { gte: d1 } }, _sum: { amount: true, payout: true }, _count: true }),
    db.bet.aggregate({ where: { createdAt: { gte: h1 } }, _sum: { amount: true, payout: true }, _count: true }),
    db.bet.findMany({ where: { createdAt: { gte: new Date(now - 15 * MIN) } }, distinct: ["userId"], select: { userId: true } }),
    db.$queryRaw<{ total: bigint | null; locked: bigint | null; users: bigint }[]>`
      SELECT SUM(balance) AS total,
             SUM(CASE WHEN "bonusWagerLeft" > 0 THEN LEAST("bonusCoins", balance) ELSE 0 END) AS locked,
             COUNT(*) AS users
      FROM "User"`,
    db.paymentRequest.aggregate({ where: { kind: "WITHDRAWAL", status: "PENDING" }, _sum: { amountCents: true }, _count: true }),
    db.paymentRequest.aggregate({ where: { kind: "DEPOSIT", status: "PENDING" }, _sum: { amountCents: true }, _count: true }),
    db.paymentRequest.aggregate({ where: { kind: "DEPOSIT", status: "APPROVED", reviewedAt: { gte: d1 } }, _sum: { amountCents: true }, _count: true }),
    db.paymentRequest.aggregate({ where: { kind: "WITHDRAWAL", status: "APPROVED", reviewedAt: { gte: d1 } }, _sum: { amountCents: true }, _count: true }),
    db.$queryRaw<{ userId: string; net: bigint; first: string | null; last: string | null; email: string }[]>`
      SELECT b."userId", SUM(b.payout - b.amount) AS net, u."firstName" AS first, u."lastName" AS last, u.email
      FROM "Bet" b JOIN "User" u ON u.id = b."userId"
      WHERE b."createdAt" >= ${d1}
      GROUP BY b."userId", u."firstName", u."lastName", u.email
      HAVING SUM(b.payout - b.amount) > 0
      ORDER BY net DESC LIMIT 5`,
    db.bet.findMany({
      where: { createdAt: { gte: d1 }, payout: { gt: 0 } },
      orderBy: { payout: "desc" },
      take: 5,
      select: { game: true, amount: true, payout: true, multiplier: true, createdAt: true, user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    db.riskFlag.groupBy({ by: ["severity"], where: { status: "OPEN" }, _count: true }),
    db.user.count({ where: { createdAt: { gte: d1 } } }),
    db.user.count({ where: { signupBonusHeld: true } }),
  ]);

  const usd = (coins: number) => coins / s.coinsPerDollar;
  const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
  const total = Number(liability[0]?.total ?? 0);
  const locked = Number(liability[0]?.locked ?? 0);
  const wager24 = bets24._sum.amount ?? 0;
  const paid24 = bets24._sum.payout ?? 0;

  return Response.json({
    updatedAt: new Date().toISOString(),
    last24h: {
      rounds: bets24._count,
      wageredUsd: usd(wager24),
      paidOutUsd: usd(paid24),
      houseResultUsd: usd(wager24 - paid24),
      actualRtp: wager24 ? paid24 / wager24 : null,
      signups,
      depositsUsd: (approvedD._sum.amountCents ?? 0) / 100,
      depositsCount: approvedD._count,
      withdrawalsUsd: (approvedW._sum.amountCents ?? 0) / 100,
      withdrawalsCount: approvedW._count,
    },
    lastHour: { rounds: bets1h._count, houseResultUsd: usd((bets1h._sum.amount ?? 0) - (bets1h._sum.payout ?? 0)) },
    activePlayers15m: active.length,
    liability: {
      users: Number(liability[0]?.users ?? 0),
      totalBalanceUsd: usd(total),
      lockedBonusUsd: usd(locked),
      withdrawableUsd: usd(total - locked),
    },
    pending: {
      withdrawalsCount: pendingW._count,
      withdrawalsUsd: (pendingW._sum.amountCents ?? 0) / 100,
      depositsCount: pendingD._count,
      depositsUsd: (pendingD._sum.amountCents ?? 0) / 100,
    },
    flags: { HIGH: 0, MEDIUM: 0, LOW: 0, ...Object.fromEntries(flags.map((f) => [f.severity, f._count])) },
    heldSignupBonuses: held,
    topWinners: topWinners.map((w) => ({ userId: w.userId, name: [w.first, w.last].filter(Boolean).join(" ") || w.email, netUsd: usd(Number(w.net)) })),
    bigWins: bigWins.map((b) => ({ name: name(b.user), game: gameBySlug(b.game)?.name ?? b.game, betUsd: usd(b.amount), payoutUsd: usd(b.payout), multiplier: b.multiplier, at: b.createdAt })),
  });
}
