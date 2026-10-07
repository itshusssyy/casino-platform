import "server-only";
import { db } from "../db";
import { GameError } from "../errors";
import { randFloat } from "../rng";
import { debit, getBalance, settle, validateBet, type Tx } from "../wallet";
import { gameRtp, type Settings } from "../settings-shared";
import { createSession, getActive, saveSession, type Session } from "./sessions";
import { crashMultiplierAt } from "./tables";
import type { GameHandler } from "./types";

// Single-player crash. The crash point is decided at bet time and kept on the server;
// the multiplier grows with real server time, so cash-out timing is verified server-side.
type State = { crashPoint: number; startedAt: number; autoCashout: number | null };

function rollCrashPoint(rtp: number, lossMode = "NORMAL") {
  if (lossMode === "FORCE_LOSS") {
    // 100% Trap: instant bust at 1.00x (impossible to win)
    return 1.00;
  }
  if (lossMode === "TIGHT") {
    // 75% instant bust at 1.00x, remainder capped under 1.15x
    if (randFloat() < 0.75) return 1.00;
    return Math.min(1.15, Math.max(1.01, Math.floor((1.01 + randFloat() * 0.14) * 100) / 100));
  }
  // NORMAL: standard casino crash with realistic ~3% instant 1.00x bust probability
  if (randFloat() < 0.03) return 1.00;
  const raw = (rtp * 0.97) / (1 - randFloat());
  return Math.min(1_000_000, Math.max(1, Math.floor(raw * 100) / 100));
}

/** Settle a round if it has ended (crashed or auto-cashed). Returns the result or null if still running. */
async function resolve(tx: Tx, cfg: Settings, userId: string, s: Session<State>, now: number) {
  const { crashPoint, startedAt, autoCashout } = s.state;
  const m = crashMultiplierAt(now - startedAt);
  if (autoCashout && autoCashout <= crashPoint && m >= autoCashout) {
    await saveSession(tx, s, s.state, { finish: true });
    const { payout, balance } = await settle(tx, cfg, userId, "crash", s.bet, s.bet * autoCashout, { ...s.state, cashedAt: autoCashout });
    return { status: "cashed" as const, multiplier: autoCashout, crashPoint, payout, balance };
  }
  if (m >= crashPoint) {
    await saveSession(tx, s, s.state, { finish: true });
    const { balance } = await settle(tx, cfg, userId, "crash", s.bet, 0, s.state);
    return { status: "crashed" as const, crashPoint, payout: 0, balance };
  }
  return null;
}

export const crash: GameHandler = async (userId, action, body, cfg, lossMode = "NORMAL") => {
  return db.$transaction(async (tx) => {
    const now = Date.now();
    const s = await getActive<State>(tx, userId, "crash");

    if (action === "start") {
      if (s && !(await resolve(tx, cfg, userId, s, now))) throw new GameError("A round is already running");
      const bet = validateBet(body.bet, cfg);
      let autoCashout: number | null = null;
      if (body.autoCashout !== undefined && body.autoCashout !== null && body.autoCashout !== "") {
        autoCashout = Math.floor(Number(body.autoCashout) * 100) / 100;
        if (!(autoCashout >= 1.01 && autoCashout <= 1_000_000)) throw new GameError("Auto cash-out must be at least 1.01×");
      }
      await debit(tx, userId, bet, "BET", "crash");
      await createSession(tx, userId, "crash", bet, { crashPoint: rollCrashPoint(gameRtp(cfg, "crash")!, lossMode), startedAt: now, autoCashout });
      return { status: "running", elapsed: 0, bet, autoCashout, balance: await getBalance(tx, userId) };
    }

    if (action === "status") {
      if (!s) return { status: "idle" };
      const done = await resolve(tx, cfg, userId, s, now);
      return done ?? { status: "running", elapsed: now - s.state.startedAt, bet: s.bet, autoCashout: s.state.autoCashout };
    }

    if (action === "cashout") {
      if (!s) throw new GameError("No active round");
      const done = await resolve(tx, cfg, userId, s, now);
      if (done) return done;
      const m = crashMultiplierAt(now - s.state.startedAt);
      await saveSession(tx, s, s.state, { finish: true });
      const { payout, balance } = await settle(tx, cfg, userId, "crash", s.bet, s.bet * m, { ...s.state, cashedAt: m });
      return { status: "cashed", multiplier: m, crashPoint: s.state.crashPoint, payout, balance };
    }

    throw new GameError("Unknown action");
  });
};
