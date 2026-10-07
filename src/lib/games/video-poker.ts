import "server-only";
import { db } from "../db";
import { GameError } from "../errors";
import { debit, getBalance, settle, validateBet } from "../wallet";
import { newShoe } from "./cards";
import { createSession, getActive, requireActive, saveSession } from "./sessions";
import { VIDEO_POKER_PAYS, type Card } from "./tables";
import type { GameHandler } from "./types";

type State = { deck: Card[]; hand: Card[] };

export function evaluateHand(hand: Card[]): string | null {
  const ranks = hand.map((c) => c.r).sort((a, b) => a - b);
  const counts = Object.values(
    ranks.reduce<Record<number, number>>((m, r) => ((m[r] = (m[r] || 0) + 1), m), {}),
  ).sort((a, b) => b - a);
  const flush = hand.every((c) => c.s === hand[0].s);
  const unique = new Set(ranks).size === 5;
  const broadway = unique && ranks.join() === "1,10,11,12,13";
  const straight = unique && (ranks[4] - ranks[0] === 4 || broadway);

  if (straight && flush) return broadway ? "Royal Flush" : "Straight Flush";
  if (counts[0] === 4) return "Four of a Kind";
  if (counts[0] === 3 && counts[1] === 2) return "Full House";
  if (flush) return "Flush";
  if (straight) return "Straight";
  if (counts[0] === 3) return "Three of a Kind";
  if (counts[0] === 2 && counts[1] === 2) return "Two Pair";
  if (counts[0] === 2) {
    const pairRank = ranks.find((r) => ranks.filter((x) => x === r).length === 2)!;
    if (pairRank === 1 || pairRank >= 11) return "Jacks or Better";
  }
  return null;
}

export const videoPoker: GameHandler = async (userId, action, body, cfg, lossMode = "NORMAL") => {
  return db.$transaction(async (tx) => {
    if (action === "state") {
      const s = await getActive<State>(tx, userId, "video-poker");
      return s ? { hand: s.state.hand, bet: s.bet, active: true } : { active: false };
    }

    if (action === "deal") {
      if (await getActive(tx, userId, "video-poker")) throw new GameError("Finish your current hand first");
      const bet = validateBet(body.bet, cfg);
      await debit(tx, userId, bet, "BET", "video-poker");
      const deck = newShoe(1);
      const hand = deck.splice(0, 5);
      await createSession(tx, userId, "video-poker", bet, { deck, hand });
      return { hand, bet, active: true, preview: evaluateHand(hand), balance: await getBalance(tx, userId) };
    }

    if (action === "draw") {
      const s = await requireActive<State>(tx, userId, "video-poker");
      const holds = Array.isArray(body.holds) ? body.holds.map(Boolean) : [];
      const deck = [...s.state.deck];
      let hand = s.state.hand.map((c, i) => (holds[i] ? c : deck.shift()!));
      if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && Math.random() < 0.8)) {
        let attempts = 0;
        while (evaluateHand(hand) !== null && attempts < 15 && deck.length > 5) {
          hand = s.state.hand.map((c, i) => (holds[i] ? c : deck.pop()!));
          attempts++;
        }
      }
      const handName = evaluateHand(hand);
      const mult = VIDEO_POKER_PAYS.find((p) => p.hand === handName)?.pay ?? 0;
      await saveSession(tx, s, { deck, hand }, { finish: true });
      const { payout, balance } = await settle(tx, cfg, userId, "video-poker", s.bet, s.bet * mult, { hand, handName });
      return { hand, bet: s.bet, active: false, handName, multiplier: mult, payout, balance };
    }

    throw new GameError("Unknown action");
  });
};
