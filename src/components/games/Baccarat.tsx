"use client";

import { useState } from "react";
import type { Card } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, PlayingCard, ResultBanner, sleep, useGame } from "./kit";

type Side = "player" | "banker" | "tie";
type Result = { player: Card[]; banker: Card[]; playerTotal: number; bankerTotal: number; winner: Side; payout: number };

function Hand({ title, cards, total, win }: { title: string; cards: Card[]; total?: number; win: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl p-4 ${win ? "bg-win/10 ring-2 ring-win" : ""}`}>
      <div className="text-sm font-bold uppercase tracking-widest text-muted">{title} {total !== undefined && <span className="ml-1 text-xl text-text">{total}</span>}</div>
      <div className="flex min-h-32 gap-2">{cards.map((c, i) => <PlayingCard key={i} card={c} />)}</div>
    </div>
  );
}

export default function Baccarat() {
  const { call, busy, error } = useGame("baccarat");
  const [bet, setBet] = useState(100);
  const [side, setSide] = useState<Side>("player");
  const [player, setPlayer] = useState<Card[]>([]);
  const [banker, setBanker] = useState<Card[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [dealing, setDealing] = useState(false);

  const deal = async () => {
    setResult(null);
    setPlayer([]);
    setBanker([]);
    const r = await call<Result>("deal", { bet, side });
    if (!r) return;
    setDealing(true);
    // Deal order: P, B, P, B, then third cards
    const order: ["p" | "b", Card][] = [["p", r.player[0]], ["b", r.banker[0]], ["p", r.player[1]], ["b", r.banker[1]]];
    if (r.player[2]) order.push(["p", r.player[2]]);
    if (r.banker[2]) order.push(["b", r.banker[2]]);
    for (const [who, c] of order) {
      await sleep(400);
      (who === "p" ? setPlayer : setBanker)((h) => [...h, c]);
    }
    await sleep(300);
    setDealing(false);
    setResult(r);
  };

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || dealing} />
          <div>
            <label className="label">Bet on</label>
            <div className="grid grid-cols-3 gap-2">
              {(["player", "tie", "banker"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className={`${side === s ? "btn-gold" : "btn-ghost"} flex-col py-2 capitalize`}>
                  {s}<span className="text-[10px] opacity-70">{s === "player" ? "1:1" : s === "banker" ? "0.95:1" : "8:1"}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || dealing} onClick={deal}>Deal</button>
          <ErrorText error={error} />
          <p className="text-xs text-muted">Standard punto banco third-card rules, 8 decks. Player/Banker bets push on a tie.</p>
        </>
      }
    >
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Hand title="Player" cards={player} total={result?.playerTotal} win={result?.winner === "player"} />
        <Hand title="Banker" cards={banker} total={result?.bankerTotal} win={result?.winner === "banker"} />
      </div>
      {result && <div className="text-2xl font-black uppercase">{result.winner === "tie" ? "Tie!" : `${result.winner} wins`}</div>}
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
