import "server-only";
import { GameError } from "../errors";
import type { Tx } from "../wallet";

export type Session<S> = { id: string; bet: number; state: S; raw: string };

export async function getActive<S>(tx: Tx, userId: string, game: string): Promise<Session<S> | null> {
  const s = await tx.gameSession.findFirst({
    where: { userId, game, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return s ? { id: s.id, bet: s.bet, state: JSON.parse(s.state) as S, raw: s.state } : null;
}

export async function requireActive<S>(tx: Tx, userId: string, game: string) {
  const s = await getActive<S>(tx, userId, game);
  if (!s) throw new GameError("No active round — place a bet first");
  return s;
}

export async function createSession<S>(tx: Tx, userId: string, game: string, bet: number, state: S) {
  const s = await tx.gameSession.create({ data: { userId, game, bet, state: JSON.stringify(state) } });
  return { id: s.id, bet, state, raw: s.state } as Session<S>;
}

/**
 * Compare-and-swap update: only succeeds if nobody changed the round since we read it.
 * Prevents double cash-outs from parallel requests.
 */
export async function saveSession<S>(tx: Tx, s: Session<S>, state: S, opts: { finish?: boolean; bet?: number } = {}) {
  const res = await tx.gameSession.updateMany({
    where: { id: s.id, status: "ACTIVE", state: s.raw },
    data: {
      state: JSON.stringify(state),
      status: opts.finish ? "FINISHED" : "ACTIVE",
      ...(opts.bet !== undefined ? { bet: opts.bet } : {}),
    },
  });
  if (res.count === 0) throw new GameError("Round already updated, please retry", 409);
}
