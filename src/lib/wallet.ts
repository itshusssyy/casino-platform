import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { Settings } from "./settings-shared";
import { GameError } from "./errors";
import { raiseFlag } from "./risk";

export type Tx = Prisma.TransactionClient;

export function validateBet(raw: unknown, s: Settings): number {
  const bet = Number(raw);
  if (!Number.isInteger(bet)) throw new GameError("Bet must be a whole number of coins");
  if (bet < s.minBet) throw new GameError(`Minimum bet is ${s.minBet}`);
  if (bet > s.maxBet) throw new GameError(`Maximum bet is ${s.maxBet.toLocaleString()}`);
  return bet;
}

export async function getBalance(tx: Tx, userId: string) {
  return (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } })).balance;
}

/**
 * Atomically removes coins; fails if the balance is too low. Returns the new balance.
 * Bets (type "BET") also count toward unlocking bonus coins and deposit play-through.
 * One SQL statement, so it's a single round trip to the database.
 */
export async function debit(tx: Tx, userId: string, amount: number, type: string, note?: string, createdBy?: string) {
  if (amount <= 0) return getBalance(tx, userId);
  const isBet = type === "BET";
  const rows = await tx.$queryRaw<{ balance: number }[]>`
    UPDATE "User" SET
      balance = balance - ${amount},
      "bonusCoins" = CASE WHEN ${isBet} AND "bonusWagerLeft" <= ${amount} THEN 0 ELSE "bonusCoins" END,
      "bonusWagerLeft" = CASE WHEN ${isBet} THEN GREATEST(0, "bonusWagerLeft" - ${amount}) ELSE "bonusWagerLeft" END,
      "depositWagerLeft" = CASE WHEN ${isBet} THEN GREATEST(0, "depositWagerLeft" - ${amount}) ELSE "depositWagerLeft" END,
      "totalWagered" = "totalWagered" + CASE WHEN ${isBet} THEN ${amount} ELSE 0 END,
      "updatedAt" = NOW()
    WHERE id = ${userId} AND balance >= ${amount}
    RETURNING balance`;
  if (rows.length === 0) throw new GameError("Not enough coins");
  const balance = Number(rows[0].balance);
  await tx.transaction.create({ data: { userId, type, amount: -amount, balanceAfter: balance, note, createdBy } });
  return balance;
}

/** Adds coins. Returns the new balance. */
export async function credit(tx: Tx, userId: string, amount: number, type: string, note?: string, createdBy?: string) {
  if (amount <= 0) return getBalance(tx, userId);
  const { balance } = await tx.user.update({
    where: { id: userId },
    data: { balance: { increment: amount } },
    select: { balance: true },
  });
  await tx.transaction.create({ data: { userId, type, amount, balanceAfter: balance, note, createdBy } });
  return balance;
}

/**
 * Credits bonus coins (signup credit, cashback, referral reward). They're locked until the user
 * has bet amount × bonus.wagerMultiplier more, then they become normal withdrawable coins.
 */
export async function creditBonus(tx: Tx, s: Settings, userId: string, amount: number, type: string, note?: string, createdBy?: string) {
  if (amount <= 0) return getBalance(tx, userId);
  const { balance } = await tx.user.update({
    where: { id: userId },
    data: {
      balance: { increment: amount },
      bonusCoins: { increment: amount },
      bonusWagerLeft: { increment: Math.ceil(amount * s.bonus.wagerMultiplier) },
    },
    select: { balance: true },
  });
  await tx.transaction.create({ data: { userId, type, amount, balanceAfter: balance, note, createdBy } });
  return balance;
}

/** How much of the balance can be withdrawn right now (locked bonus excluded). */
export function withdrawableCoins(u: { balance: number; bonusCoins: number; bonusWagerLeft: number }) {
  const locked = u.bonusWagerLeft > 0 ? Math.min(u.bonusCoins, u.balance) : 0;
  return Math.max(0, u.balance - locked);
}

export async function recordBet(tx: Tx, userId: string, game: string, amount: number, payout: number, details: unknown) {
  await tx.bet.create({
    data: {
      userId,
      game,
      amount,
      payout,
      multiplier: amount > 0 ? Math.round((payout / amount) * 10000) / 10000 : 0,
      details: JSON.stringify(details),
    },
  });
}

/** Pays out (if any, capped at the max win per bet), records the bet, and returns the new balance. */
export async function settle(tx: Tx, s: Settings, userId: string, game: string, bet: number, payout: number, details: unknown) {
  payout = Math.min(Math.max(0, Math.floor(payout)), s.maxWinPerBet);
  const balance = payout > 0 ? await credit(tx, userId, payout, "WIN", game) : await getBalance(tx, userId);
  await recordBet(tx, userId, game, bet, payout, details);
  const winUsd = (payout - bet) / s.coinsPerDollar;
  if (s.risk.bigWinUsd > 0 && winUsd >= s.risk.bigWinUsd) {
    await raiseFlag(tx, userId, "BIG_WIN", "MEDIUM", `Won $${winUsd.toFixed(2)} on ${game} (bet ${bet.toLocaleString()} coins, paid ${payout.toLocaleString()}).`);
  }
  return { payout, balance };
}

/**
 * One-shot round: take the bet, compute the outcome, pay out, log — all in one DB transaction.
 * `play` must be pure (no DB access) and return the payout in coins.
 */
export async function playInstant<R extends { payout: number }>(
  s: Settings,
  userId: string,
  game: string,
  bet: number,
  play: () => R,
): Promise<R & { balance: number }> {
  return db.$transaction(async (tx) => {
    await debit(tx, userId, bet, "BET", game);
    const result = play();
    const { payout, balance } = await settle(tx, s, userId, game, bet, result.payout, result);
    return { ...result, payout, balance };
  });
}
