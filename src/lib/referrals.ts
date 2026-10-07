import "server-only";
import { randomInt } from "node:crypto";
import type { PaymentRequest } from "@prisma/client";
import { db } from "./db";
import type { Settings } from "./settings-shared";
import { usdToCoins } from "./settings-shared";
import { credit, creditBonus, type Tx } from "./wallet";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateReferralCode() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
}

/** Returns the user's referral code, creating one for older accounts that don't have it yet. */
export async function ensureReferralCode(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (u.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    const res = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } }).catch(() => null);
    if (res) {
      const fresh = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
      if (fresh.referralCode) return fresh.referralCode;
    }
  }
  throw new Error("Could not create referral code");
}

/** Finds the referrer for a code typed at signup (case-insensitive). */
export async function findReferrer(code: unknown) {
  if (typeof code !== "string" || !code.trim()) return null;
  return db.user.findUnique({ where: { referralCode: code.trim().toUpperCase() }, select: { id: true, status: true } });
}

/**
 * Runs when an admin approves a deposit request:
 *  1. credits the purchased coins
 *  2. applies the deposit cashback promotion (e.g. $500+ deposit → $100 bonus)
 *  3. updates the user's lifetime deposit total and unlocks referral rewards for whoever referred them
 */
export async function applyApprovedDeposit(tx: Tx, s: Settings, r: PaymentRequest, adminId: string) {
  await credit(tx, r.userId, r.coins, "DEPOSIT", `Deposit ${r.id}`, adminId);
  // Deposit play-through: the deposit must be bet (× multiplier) before any withdrawal.
  if (s.withdrawal.depositWagerMultiplier > 0)
    await tx.user.update({ where: { id: r.userId }, data: { depositWagerLeft: { increment: Math.ceil(r.coins * s.withdrawal.depositWagerMultiplier) } } });

  const promo = s.depositPromo;
  if (promo.enabled && promo.bonusUsd > 0 && r.amountCents >= Math.round(promo.minDepositUsd * 100)) {
    await creditBonus(tx, s, r.userId, usdToCoins(s, promo.bonusUsd), "PROMO_BONUS", `$${promo.bonusUsd} cashback on $${(r.amountCents / 100).toFixed(2)} deposit`, adminId);
  }

  const before = await tx.user.findUniqueOrThrow({ where: { id: r.userId }, select: { totalDepositCents: true, referredById: true } });
  const after = before.totalDepositCents + r.amountCents;
  await tx.user.update({ where: { id: r.userId }, data: { totalDepositCents: after } });

  if (!s.referral.enabled || !before.referredById) return;
  for (const tier of s.referral.tiers) {
    const tierCents = Math.round(tier.depositUsd * 100);
    if (tier.rewardUsd <= 0 || before.totalDepositCents >= tierCents || after < tierCents) continue;
    // @@unique([referredUserId, tierCents]) guarantees each tier pays only once per referred user.
    await tx.referralReward.upsert({
      where: { referredUserId_tierCents: { referredUserId: r.userId, tierCents } },
      create: {
        referrerId: before.referredById,
        referredUserId: r.userId,
        tierCents,
        rewardCents: Math.round(tier.rewardUsd * 100),
        coins: usdToCoins(s, tier.rewardUsd),
      },
      update: {},
    });
  }
}
