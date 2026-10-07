"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { WHEEL_SEGMENTS, wheelSegments } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, ResultBanner, sleep, useGame } from "./kit";

type Result = { index: number; multiplier: number; payout: number };

// Colours keyed by the base multiplier so they stay stable when the RTP changes.
const COLORS: Record<string, string> = { "0": "#2a2a45", "1.2": "#3b82f6", "1.5": "#22c55e", "2": "#a855f7", "3": "#f97316", "5": "#f5c542" };
const LEGEND = [0, 1.2, 1.5, 2, 3, 5];
const N = WHEEL_SEGMENTS.length;
const SEG = 360 / N;

export default function Wheel({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("wheel");
  const [bet, setBet] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const scaled = wheelSegments(cfg.rtp);
  const scale = (m: number) => scaled[WHEEL_SEGMENTS.indexOf(m)];
  const gradient = `conic-gradient(${WHEEL_SEGMENTS.map((m, i) => `${COLORS[String(m)]} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(",")})`;

  const spin = async () => {
    setResult(null);
    const r = await call<Result>("spin", { bet });
    if (!r) return;
    setSpinning(true);
    // Land the centre of segment `index` under the top pointer.
    const target = 360 - (r.index * SEG + SEG / 2);
    setRotation((prev) => prev - (prev % 360) + 360 * 6 + target);
    await sleep(4200);
    setSpinning(false);
    setResult(r);
  };

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || spinning} />
          <div className="flex flex-wrap gap-2">
            {LEGEND.map((m) => (
              <span key={m} className="chip flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS[String(m)] }} /> {scale(m)}×
              </span>
            ))}
          </div>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || spinning} onClick={spin}>Spin</button>
          <ErrorText error={error} />
        </>
      }
    >
      <div className="relative">
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-3xl drop-shadow">🔻</div>
        <div
          className="relative h-72 w-72 rounded-full border-8 border-panel-2 shadow-[0_0_50px_-10px_rgba(245,197,66,.5)] sm:h-80 sm:w-80"
          style={{ background: gradient, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(.15,.85,.25,1)" : "none" }}
        >
          {WHEEL_SEGMENTS.map((m, i) => (
            <span key={i} className="absolute left-1/2 top-1/2 origin-left text-[10px] font-bold text-white/90"
              style={{ transform: `rotate(${i * SEG + SEG / 2 - 90}deg) translateX(105px)` }}>{scaled[i]}×</span>
          ))}
          <div className="absolute inset-1/3 rounded-full border-4 border-panel-2 bg-bg" />
        </div>
      </div>
      {result && <div className="text-3xl font-black">{result.multiplier}×</div>}
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
