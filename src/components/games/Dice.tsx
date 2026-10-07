"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { BetInput, ErrorText, GameLayout, ResultBanner, useGame } from "./kit";

type Result = { roll: number; win: boolean; payout: number };

export default function Dice({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("dice");
  const [bet, setBet] = useState(100);
  const [target, setTarget] = useState(50);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const chance = over ? 100 - target : target;
  const multiplier = Math.floor(((cfg.rtp * 100) / chance) * 10000) / 10000;

  const roll = async () => {
    const r = await call<Result>("roll", { bet, target, over });
    if (r) setResult(r);
  };

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy} />
          <div className="grid grid-cols-2 gap-2">
            <button className={over ? "btn-ghost" : "btn-gold"} onClick={() => setOver(false)}>Roll Under</button>
            <button className={over ? "btn-gold" : "btn-ghost"} onClick={() => setOver(true)}>Roll Over</button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-panel-2 p-2"><div className="text-muted text-xs">Target</div><b>{over ? ">" : "<"} {target}</b></div>
            <div className="rounded-xl bg-panel-2 p-2"><div className="text-muted text-xs">Chance</div><b>{chance}%</b></div>
            <div className="rounded-xl bg-panel-2 p-2"><div className="text-muted text-xs">Payout</div><b>{multiplier}×</b></div>
          </div>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={roll}>Roll Dice</button>
          <ErrorText error={error} />
        </>
      }
    >
      <div className="text-7xl font-black tabular-nums sm:text-8xl">
        <span className={result ? (result.win ? "text-win" : "text-lose") : "text-muted"}>{result ? result.roll.toFixed(2) : "--.--"}</span>
      </div>
      <div className="w-full max-w-xl px-2">
        <div className="relative h-4 rounded-full" style={{
          background: over
            ? `linear-gradient(90deg, var(--lose) ${target}%, var(--win) ${target}%)`
            : `linear-gradient(90deg, var(--win) ${target}%, var(--lose) ${target}%)`,
        }}>
          {result && (
            <div className="absolute -top-8 -translate-x-1/2 transition-all duration-500" style={{ left: `${result.roll}%` }}>
              <div className="animate-pop rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-black">{result.roll.toFixed(2)}</div>
            </div>
          )}
        </div>
        <input type="range" min={2} max={98} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="mt-4 w-full accent-[var(--gold)]" />
        <div className="flex justify-between text-xs text-muted"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      </div>
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
