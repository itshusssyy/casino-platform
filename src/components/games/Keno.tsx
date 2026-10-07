"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { kenoTable } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, ResultBanner, sleep, useGame } from "./kit";

type Result = { drawn: number[]; hits: number[]; multiplier: number; payout: number };

export default function Keno({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("keno");
  const [bet, setBet] = useState(100);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [drawing, setDrawing] = useState(false);

  const toggle = (n: number) => {
    if (drawing) return;
    setResult(null);
    setDrawn([]);
    setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < 10 ? [...p, n] : p));
  };

  const autoPick = () => {
    const all = Array.from({ length: 40 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    setPicks(all.slice(0, 10));
    setResult(null);
    setDrawn([]);
  };

  const play = async () => {
    setResult(null);
    setDrawn([]);
    const r = await call<Result>("play", { bet, picks });
    if (!r) return;
    setDrawing(true);
    for (const n of r.drawn) {
      await sleep(140);
      setDrawn((d) => [...d, n]);
    }
    setDrawing(false);
    setResult(r);
  };

  const table = picks.length ? kenoTable(picks.length, cfg.rtp) : [];

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || drawing} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" disabled={drawing} onClick={autoPick}>Auto pick</button>
            <button className="btn-ghost" disabled={drawing} onClick={() => { setPicks([]); setDrawn([]); setResult(null); }}>Clear</button>
          </div>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || drawing || picks.length === 0} onClick={play}>
            Play ({picks.length}/10)
          </button>
          <ErrorText error={error} />
          {table.length > 0 && (
            <div>
              <label className="label">Payouts for {picks.length} picks</label>
              <div className="grid grid-cols-4 gap-1 text-xs">
                {table.map((m, hits) => m > 0 && (
                  <div key={hits} className={`rounded-md px-2 py-1 text-center ${result?.hits.length === hits ? "bg-gold text-black" : "bg-panel-2"}`}>
                    {hits} hit<br /><b>{m}×</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      }
    >
      <div className="grid w-full max-w-xl grid-cols-8 gap-1.5 sm:gap-2">
        {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
          const picked = picks.includes(n);
          const isDrawn = drawn.includes(n);
          const cls = picked && isDrawn ? "bg-win text-black animate-pop" : isDrawn ? "bg-lose/70 text-white" : picked ? "bg-gold text-black" : "bg-panel-2 hover:bg-line";
          return (
            <button key={n} onClick={() => toggle(n)} className={`aspect-square rounded-lg text-sm font-bold transition sm:text-base ${cls}`}>
              {picked && isDrawn ? "💎" : n}
            </button>
          );
        })}
      </div>
      {result && <div className="text-muted">Hits: <b className="text-text">{result.hits.length}</b> · {result.multiplier}×</div>}
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
