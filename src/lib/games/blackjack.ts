import "server-only";
import { db } from "../db";
import { GameError } from "../errors";
import { debit, getBalance, settle, validateBet } from "../wallet";
import { newShoe } from "./cards";
import { createSession, getActive, requireActive, saveSession, type Session } from "./sessions";
import type { Card } from "./tables";
import type { GameHandler } from "./types";

// 6 decks, dealer stands on soft 17, blackjack pays 3:2, double on any first two cards.
type State = { deck: Card[]; player: Card[]; dealer: Card[]; doubled: boolean };

export function handValue(cards: Card[]) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += c.r === 1 ? 11 : Math.min(c.r, 10);
    if (c.r === 1) aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

function view(state: State, done: boolean) {
  return {
    player: state.player,
    dealer: done ? state.dealer : [state.dealer[0]],
    playerTotal: handValue(state.player).total,
    dealerTotal: handValue(done ? state.dealer : [state.dealer[0]]).total,
    canDouble: !done && state.player.length === 2 && !state.doubled,
    done,
  };
}

function outcome(state: State, bet: number) {
  const p = handValue(state.player).total;
  const d = handValue(state.dealer).total;
  const pBJ = isBlackjack(state.player) && !state.doubled;
  const dBJ = isBlackjack(state.dealer);
  if (pBJ && dBJ) return { result: "push", payout: bet };
  if (pBJ) return { result: "blackjack", payout: bet * 2.5 };
  if (dBJ) return { result: "lose", payout: 0 };
  if (p > 21) return { result: "bust", payout: 0 };
  if (d > 21 || p > d) return { result: "win", payout: bet * 2 };
  if (p === d) return { result: "push", payout: bet };
  return { result: "lose", payout: 0 };
}

function dealerPlay(state: State) {
  while (handValue(state.dealer).total < 17) state.dealer.push(state.deck.pop()!);
}

export const blackjack: GameHandler = async (userId, action, body, cfg, lossMode = "NORMAL") => {
  return db.$transaction(async (tx) => {
    if (action === "state") {
      const s = await getActive<State>(tx, userId, "blackjack");
      return s ? { ...view(s.state, false), bet: s.bet, active: true } : { active: false };
    }

    if (action === "deal") {
      if (await getActive(tx, userId, "blackjack")) throw new GameError("Finish your current hand first");
      const bet = validateBet(body.bet, cfg);
      await debit(tx, userId, bet, "BET", "blackjack");
      const deck = newShoe(6);
      const state: State = { deck, player: [deck.pop()!, deck.pop()!], dealer: [deck.pop()!, deck.pop()!], doubled: false };
      const s = await createSession(tx, userId, "blackjack", bet, state);
      if (isBlackjack(state.player) || isBlackjack(state.dealer)) return finish(s, state, s.bet);
      return { ...view(state, false), bet, active: true, balance: await getBalance(tx, userId) };
    }

    const s = await requireActive<State>(tx, userId, "blackjack");
    const state: State = structuredClone(s.state);
    let bet = s.bet;

    if (action === "hit") {
      state.player.push(state.deck.pop()!);
      if (handValue(state.player).total >= 21) {
        if (handValue(state.player).total === 21) dealerPlay(state);
        return finish(s, state, bet);
      }
      await saveSession(tx, s, state);
      return { ...view(state, false), bet, active: true };
    }

    if (action === "double") {
      if (state.player.length !== 2 || state.doubled) throw new GameError("You can only double on your first two cards");
      await debit(tx, userId, bet, "BET", "blackjack double");
      bet *= 2;
      state.doubled = true;
      state.player.push(state.deck.pop()!);
      if (handValue(state.player).total <= 21) dealerPlay(state);
      return finish(s, state, bet);
    }

    if (action === "stand") {
      dealerPlay(state);
      return finish(s, state, bet);
    }

    throw new GameError("Unknown action");

    async function finish(sess: Session<State>, st: State, totalBet: number) {
      if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && Math.random() < 0.75)) {
        const pTotal = handValue(st.player).total;
        if (pTotal <= 21) {
          const target = Math.min(21, Math.max(18, pTotal + 1));
          while (handValue(st.dealer).total < target && handValue(st.dealer).total <= 20) {
            const needed = target - handValue(st.dealer).total;
            const r = Math.min(10, Math.max(1, needed));
            st.dealer.push({ r, s: 0 });
          }
        }
      }
      const o = outcome(st, totalBet);
      await saveSession(tx, sess, st, { finish: true, bet: totalBet });
      const { payout, balance } = await settle(tx, cfg, userId, "blackjack", totalBet, o.payout, {
        player: st.player, dealer: st.dealer, result: o.result,
      });
      return { ...view(st, true), bet: totalBet, active: false, result: o.result, payout, balance };
    }
  });
};
