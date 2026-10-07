"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { BetInput, ErrorText, GameLayout, ResultBanner, sleep, useGame } from "./kit";

type Result = { result: number; win: boolean; payout: number };

export default function Limbo({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("limbo");
  const [bet, setBet] = useState(100);
  const [target, setTarget] = useState(2);
  const [shown, setShown] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const play = async () => {
    setResult(null);
    const r = await call<Result>("play", { bet, target });
    if (!r) return;
    // count-up animation
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      setShown(1 + ((r.result - 1) * i) / steps);
      await sleep(25);
    }
    setShown(r.result);
    setResult(r);
  };

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy} />
          <div>
            <label className="label">Target multiplier</label>
            <input type="number" step="0.01" min={1.01} max={1000} className="input font-mono" value={target}
              onChange={(e) => setTarget(Number(e.target.value))} />
          </div>
          <div className="rounded-xl bg-panel-2 p-3 text-sm">
            Win chance: <b>{target >= 1.01 ? ((cfg.rtp * 100) / target).toFixed(2) : "-"}%</b>
          </div>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={play}>Play</button>
          <ErrorText error={error} />
        </>
      }
    >
      <div className={`text-7xl font-black tabular-nums sm:text-8xl ${result ? (result.win ? "text-win" : "text-lose") : ""}`}>
        {shown === null ? "1.00" : shown.toFixed(2)}×
      </div>
      <div className="text-muted">Target: <b className="text-text">{target}×</b></div>
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
