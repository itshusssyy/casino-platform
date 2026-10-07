"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { PLINKO_ROWS, plinkoTable, type PlinkoRisk } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, sleep, useGame } from "./kit";

type Result = { path: number[]; bucket: number; multiplier: number; payout: number };
type Ball = { id: number; x: number; y: number; done: boolean };

const W = 420, H = 400, TOP = 30, GAP_Y = (H - 80) / PLINKO_ROWS, GAP_X = W / (PLINKO_ROWS + 2);

const bucketColor = (m: number) => (m >= 10 ? "bg-red-500" : m >= 2 ? "bg-orange-500" : m >= 1 ? "bg-amber-400" : "bg-yellow-200");

export default function Plinko({ cfg }: { cfg: GameClientSettings }) {
  const { call, error } = useGame("plinko");
  const [bet, setBet] = useState(100);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [balls, setBalls] = useState<Ball[]>([]);
  const [recent, setRecent] = useState<{ id: number; m: number; payout: number }[]>([]);
  const [hit, setHit] = useState<number | null>(null);

  const drop = async () => {
    const r = await call<Result>("drop", { bet, risk }, { quiet: true });
    if (!r) return;
    const id = Date.now() + Math.random();
    // Animate the ball peg by peg along the server-decided path.
    let x = W / 2, y = TOP - 15;
    setBalls((b) => [...b, { id, x, y, done: false }]);
    for (let row = 0; row < PLINKO_ROWS; row++) {
      await sleep(110);
      x += (r.path[row] ? 1 : -1) * (GAP_X / 2);
      y = TOP + row * GAP_Y + GAP_Y / 2;
      setBalls((b) => b.map((ball) => (ball.id === id ? { ...ball, x, y } : ball)));
    }
    await sleep(110);
    setBalls((b) => b.map((ball) => (ball.id === id ? { ...ball, y: H - 30, done: true } : ball)));
    setHit(r.bucket);
    setRecent((rc) => [{ id, m: r.multiplier, payout: r.payout }, ...rc].slice(0, 8));
    await sleep(400);
    setBalls((b) => b.filter((ball) => ball.id !== id));
    setHit(null);
  };

  const table = plinkoTable(risk, cfg.rtp);

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} />
          <div>
            <label className="label">Risk</label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as const).map((r) => (
                <button key={r} disabled={balls.length > 0} onClick={() => setRisk(r)} className={`${risk === r ? "btn-gold" : "btn-ghost"} py-2 capitalize`}>{r}</button>
              ))}
            </div>
          </div>
          <button className="btn-gold w-full py-3 text-lg" onClick={drop}>Drop Ball</button>
          <ErrorText error={error} />
          <div className="space-y-1">
            {recent.map((r) => (
              <div key={r.id} className="flex justify-between rounded-lg bg-panel-2 px-3 py-1 text-sm">
                <span>{r.m}×</span><span className={r.payout >= bet ? "text-win" : "text-muted"}>🪙 {r.payout.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="relative w-full max-w-[420px]" style={{ aspectRatio: `${W}/${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
          {Array.from({ length: PLINKO_ROWS }, (_, row) =>
            Array.from({ length: row + 3 }, (_, i) => {
              const cx = W / 2 + (i - (row + 2) / 2) * GAP_X;
              return <circle key={`${row}-${i}`} cx={cx} cy={TOP + row * GAP_Y} r={3.5} fill="#cfd0ff" opacity={0.8} />;
            }),
          )}
          {balls.map((b) => (
            <circle key={b.id} cx={b.x} cy={b.y} r={7} fill="#f5c542" style={{ transition: "cx .1s linear, cy .1s ease-in" }} />
          ))}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-[2px] px-[3.57%]">
          {table.map((m, i) => (
            <div key={i} className={`flex-1 rounded-md py-1.5 text-center text-[9px] font-bold text-black sm:text-[11px] ${bucketColor(m)} ${hit === i ? "animate-pop -translate-y-1" : ""}`}>
              {m}×
            </div>
          ))}
        </div>
      </div>
    </GameLayout>
  );
}
