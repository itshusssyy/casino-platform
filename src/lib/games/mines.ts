import "server-only";
import { db } from "../db";
import { GameError } from "../errors";
import { randFloat, shuffle } from "../rng";
import { debit, getBalance, settle, validateBet } from "../wallet";
import { gameRtp } from "../settings-shared";
import { createSession, getActive, requireActive, saveSession } from "./sessions";
import { minesMultiplier } from "./tables";
import type { GameHandler } from "./types";

type State = { mines: number[]; count: number; revealed: number[]; rtp?: number };

const view = (st: State, bet: number) => ({
  revealed: st.revealed,
  mineCount: st.count,
  multiplier: minesMultiplier(st.count, st.revealed.length, st.rtp),
  nextMultiplier: minesMultiplier(st.count, st.revealed.length + 1, st.rtp),
  bet,
});

export const mines: GameHandler = async (userId, action, body, cfg, lossMode = "NORMAL") => {
  return db.$transaction(async (tx) => {
    if (action === "state") {
      const s = await getActive<State>(tx, userId, "mines");
      return s ? { ...view(s.state, s.bet), active: true } : { active: false };
    }

    if (action === "start") {
      if (await getActive(tx, userId, "mines")) throw new GameError("Finish your current round first");
      const bet = validateBet(body.bet, cfg);
      const count = Number(body.mines);
      if (!Number.isInteger(count) || count < 1 || count > 24) throw new GameError("Mines must be 1–24");
      await debit(tx, userId, bet, "BET", "mines");
      const positions = shuffle(Array.from({ length: 25 }, (_, i) => i)).slice(0, count);
      const state: State = { mines: positions, count, revealed: [], rtp: gameRtp(cfg, "mines")! };
      await createSession(tx, userId, "mines", bet, state);
      return { ...view(state, bet), active: true, balance: await getBalance(tx, userId) };
    }

    const s = await requireActive<State>(tx, userId, "mines");
    const st: State = structuredClone(s.state);

    if (action === "reveal") {
      const idx = Number(body.index);
      if (!Number.isInteger(idx) || idx < 0 || idx > 24) throw new GameError("Invalid tile");
      if (st.revealed.includes(idx)) throw new GameError("Tile already revealed");
      st.revealed.push(idx);

      // FORCE_LOSS or TIGHT trap
      if (!st.mines.includes(idx)) {
        if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && (st.revealed.length >= 2 || randFloat() < 0.75))) {
          const nonRevealedMineIdx = st.mines.findIndex((m) => !st.revealed.includes(m));
          if (nonRevealedMineIdx >= 0) st.mines[nonRevealedMineIdx] = idx;
          else st.mines.push(idx);
        }
      }

      if (st.mines.includes(idx)) {
        await saveSession(tx, s, st, { finish: true });
        const { balance } = await settle(tx, cfg, userId, "mines", s.bet, 0, { ...st, hit: idx });
        return { ...view(st, s.bet), active: false, hitMine: idx, mines: st.mines, payout: 0, balance };
      }
      if (st.revealed.length === 25 - st.count) return cashout(st);
      await saveSession(tx, s, st);
      return { ...view(st, s.bet), active: true };
    }

    if (action === "cashout") {
      if (st.revealed.length === 0) throw new GameError("Reveal at least one tile first");
      return cashout(st);
    }

    throw new GameError("Unknown action");

    async function cashout(state: State) {
      const multiplier = minesMultiplier(state.count, state.revealed.length, state.rtp);
      await saveSession(tx, s, state, { finish: true });
      const { payout, balance } = await settle(tx, cfg, userId, "mines", s.bet, s.bet * multiplier, state);
      return { ...view(state, s.bet), active: false, mines: state.mines, payout, balance };
    }
  });
};
