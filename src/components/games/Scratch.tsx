"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { scratchPrizes } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, ResultBanner, useGame } from "./kit";

type Result = { cells: string[]; prize: { icon: string; mult: number } | null; payout: number };

export default function Scratch({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("scratch");
  const [bet, setBet] = useState(100);
  const [card, setCard] = useState<Result | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));

  const done = card !== null && revealed.every(Boolean);

  const buy = async () => {
    const r = await call<Result>("buy", { bet });
    if (!r) return;
    setCard(r);
    setRevealed(Array(9).fill(false));
  };

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || (card !== null && !done)} />
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || (card !== null && !done)} onClick={buy}>
            Buy card
          </button>
          {card && !done && <button className="btn-ghost w-full" onClick={() => setRevealed(Array(9).fill(true))}>Reveal all</button>}
          <ErrorText error={error} />
          <div>
            <label className="label">Match 3 to win</label>
            <div className="space-y-1 text-sm">
              {scratchPrizes(cfg.rtp).map((p) => (
                <div key={p.icon} className="flex justify-between rounded-lg bg-panel-2 px-3 py-1"><span>{p.icon}{p.icon}{p.icon}</span><b>{p.mult}×</b></div>
              ))}
            </div>
          </div>
        </>
      }
    >
      <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-pink-800 p-4 shadow-2xl">
        <div className="mb-3 text-center font-black tracking-widest text-white">💰 LUCKY SCRATCH 💰</div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, i) => {
            const open = card && revealed[i];
            const winning = done && card?.prize && card.cells[i] === card.prize.icon;
            return (
              <button
                key={i}
                disabled={!card || revealed[i]}
                onClick={() => setRevealed((r) => r.map((v, j) => (j === i ? true : v)))}
                className={`flex h-20 w-20 items-center justify-center rounded-xl text-4xl transition sm:h-24 sm:w-24 ${
                  open ? `animate-pop bg-white ${winning ? "ring-4 ring-gold" : ""}` : "bg-gradient-to-br from-zinc-300 to-zinc-500 hover:brightness-110"
                }`}
              >
                {open ? card!.cells[i] : card ? "?" : ""}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-white/80">{card ? (done ? "" : "Tap to scratch") : "Buy a card to play"}</p>
      </div>
      <ResultBanner show={done} payout={card?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
