import "server-only";
import { db } from "../db";
import { GameError } from "../errors";
import { debit, getBalance, settle, validateBet } from "../wallet";
import { randomCard } from "./cards";
import { gameRtp } from "../settings-shared";
import { createSession, getActive, requireActive, saveSession } from "./sessions";
import type { Card } from "./tables";
import type { GameHandler } from "./types";

// Infinite deck. "Higher" means higher-or-same, "Lower" means lower-or-same. Edge per guess = 1 - rtp.
type State = { current: Card; multiplier: number; history: Card[]; rtp?: number; wins?: number };

const pHigher = (r: number) => (14 - r) / 13;
const pLower = (r: number) => r / 13;
const stepMult = (p: number, rtp = 0.99) => Math.floor((rtp / p) * 10000) / 10000;

const view = (st: State, bet: number) => ({
  current: st.current,
  multiplier: st.multiplier,
  history: st.history,
  higherMult: stepMult(pHigher(st.current.r), st.rtp),
  lowerMult: stepMult(pLower(st.current.r), st.rtp),
  higherChance: pHigher(st.current.r),
  lowerChance: pLower(st.current.r),
  bet,
});

export const hilo: GameHandler = async (userId, action, body, cfg, lossMode = "NORMAL") => {
  return db.$transaction(async (tx) => {
    if (action === "state") {
      const s = await getActive<State>(tx, userId, "hilo");
      return s ? { ...view(s.state, s.bet), active: true } : { active: false };
    }

    if (action === "start") {
      if (await getActive(tx, userId, "hilo")) throw new GameError("Finish your current round first");
      const bet = validateBet(body.bet, cfg);
      await debit(tx, userId, bet, "BET", "hilo");
      const state: State = { current: randomCard(), multiplier: 1, history: [], rtp: gameRtp(cfg, "hilo")! };
      await createSession(tx, userId, "hilo", bet, state);
      return { ...view(state, bet), active: true, balance: await getBalance(tx, userId) };
    }

    const s = await requireActive<State>(tx, userId, "hilo");
    const st: State = structuredClone(s.state);

    if (action === "skip") {
      st.history.push(st.current);
      st.current = randomCard();
      await saveSession(tx, s, st);
      return { ...view(st, s.bet), active: true };
    }

    if (action === "guess") {
      const dir = body.dir === "lower" ? "lower" : "higher";
      const p = dir === "higher" ? pHigher(st.current.r) : pLower(st.current.r);
      if (p >= 1) throw new GameError("That guess can't lose. Pick the other side or skip the card");
      let next = randomCard();
      if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && Math.random() < 0.8)) {
        const targetR = dir === "higher" ? Math.max(1, st.current.r - 1) : Math.min(13, st.current.r + 1);
        next = { r: targetR, s: next.s };
      }
      const win = dir === "higher" ? next.r >= st.current.r : next.r <= st.current.r;
      st.history.push(st.current);
      st.current = next;
      if (!win) {
        await saveSession(tx, s, st, { finish: true });
        const { balance } = await settle(tx, cfg, userId, "hilo", s.bet, 0, st);
        return { ...view(st, s.bet), active: false, lost: true, payout: 0, balance };
      }
      st.multiplier = Math.floor(st.multiplier * stepMult(p, st.rtp) * 10000) / 10000;
      st.wins = (st.wins ?? 0) + 1;
      await saveSession(tx, s, st);
      return { ...view(st, s.bet), active: true };
    }

    if (action === "cashout") {
      if (!st.wins) throw new GameError("Make at least one correct guess first");
      await saveSession(tx, s, st, { finish: true });
      const { payout, balance } = await settle(tx, cfg, userId, "hilo", s.bet, s.bet * st.multiplier, st);
      return { ...view(st, s.bet), active: false, payout, balance };
    }

    throw new GameError("Unknown action");
  });
};
