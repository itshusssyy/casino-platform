"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { BetInput, ErrorText, GameLayout, ResultBanner, sleep, useGame } from "./kit";

type Result = { result: "heads" | "tails"; win: boolean; payout: number };

export default function CoinFlip({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("coinflip");
  const [bet, setBet] = useState(100);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [key, setKey] = useState(0);

  const flip = async () => {
    setResult(null);
    const r = await call<Result>("flip", { bet, side });
    if (!r) return;
    setFlipping(true);
    setKey((k) => k + 1);
    await sleep(1200);
    setFlipping(false);
    setResult(r);
  };

  const face = result?.result ?? side;

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || flipping} />
          <div className="grid grid-cols-2 gap-2">
            <button className={side === "heads" ? "btn-gold" : "btn-ghost"} onClick={() => setSide("heads")}>👑 Heads</button>
            <button className={side === "tails" ? "btn-gold" : "btn-ghost"} onClick={() => setSide("tails")}>🦅 Tails</button>
          </div>
          <p className="text-sm text-muted">Pays {Math.floor(cfg.rtp * 200) / 100}× your bet.</p>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || flipping} onClick={flip}>Flip Coin</button>
          <ErrorText error={error} />
        </>
      }
    >
      <div key={key} className={`flex h-44 w-44 items-center justify-center rounded-full border-8 border-amber-300 bg-gradient-to-br from-gold to-amber-700 text-7xl shadow-[0_0_60px_-10px_rgba(245,197,66,.7)] ${flipping ? "animate-coin" : ""}`}>
        {flipping ? "🪙" : face === "heads" ? "👑" : "🦅"}
      </div>
      {result && <div className="text-2xl font-bold capitalize">{result.result}!</div>}
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
