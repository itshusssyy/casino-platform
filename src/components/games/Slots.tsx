"use client";

import type { GameClientSettings } from "@/lib/settings-shared";
import { useState } from "react";
import { SLOT_LINES, SLOT_SYMBOLS, slotPaytable } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, ResultBanner, sleep, useGame } from "./kit";

type Result = { grid: string[][]; wins: { line: number; symbol: string; mult: number }[]; payout: number };

const START = [["🍒", "🍋", "🍊"], ["💎", "7️⃣", "⭐"], ["🔔", "🍇", "🍒"]];

export default function Slots({ cfg }: { cfg: GameClientSettings }) {
  const { call, busy, error } = useGame("slots");
  const [bet, setBet] = useState(100);
  const [grid, setGrid] = useState<string[][]>(START);
  const [spinningCols, setSpinningCols] = useState([false, false, false]);
  const [result, setResult] = useState<Result | null>(null);

  const table = slotPaytable(cfg.rtp);
  const spinning = spinningCols.some(Boolean);
  const winCells = new Set(result?.wins.flatMap((w) => SLOT_LINES[w.line].map((row, col) => `${row}-${col}`)) ?? []);

  const spin = async () => {
    setResult(null);
    setSpinningCols([true, true, true]);
    const r = await call<Result>("spin", { bet });
    if (!r) return setSpinningCols([false, false, false]);
    for (let col = 0; col < 3; col++) {
      await sleep(350);
      setGrid((g) => g.map((row, ri) => row.map((s, ci) => (ci === col ? r.grid[ri][ci] : s))));
      setSpinningCols((c) => c.map((v, i) => (i === col ? false : v)));
    }
    setResult(r);
  };

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || spinning} />
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || spinning} onClick={spin}>🎰 Spin</button>
          <p className="text-xs text-muted">Bet is split across 5 paylines. Paytable (× line bet):</p>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {table.symbols.slice().reverse().map((s) => (
              <div key={s.id} className="flex justify-between rounded-lg bg-panel-2 px-2 py-1"><span>{s.icon}{s.icon}{s.icon}</span><b>{s.pay}×</b></div>
            ))}
            <div className="col-span-2 flex justify-between rounded-lg bg-panel-2 px-2 py-1"><span>🍒🍒 (first two)</span><b>{table.twoCherry}×</b></div>
          </div>
          <ErrorText error={error} />
        </>
      }
    >
      <div className="rounded-3xl border-4 border-gold/70 bg-gradient-to-b from-purple-950 to-black p-3 shadow-[0_0_60px_-15px_rgba(245,197,66,.6)]">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((col) => (
            <div key={col} className="overflow-hidden rounded-xl bg-white/95">
              {[0, 1, 2].map((row) => (
                <div key={row} className={`flex h-20 w-20 items-center justify-center text-5xl sm:h-24 sm:w-24 ${winCells.has(`${row}-${col}`) ? "animate-pop bg-gold/50" : ""}`}>
                  <span className={spinningCols[col] ? "animate-reel" : ""}>
                    {spinningCols[col] ? SLOT_SYMBOLS[(row * 3 + col * 2) % SLOT_SYMBOLS.length].icon : grid[row][col]}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {result && result.wins.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          {result.wins.map((w) => <span key={w.line} className="chip">Line {w.line + 1}: {w.symbol} {w.mult}×</span>)}
        </div>
      )}
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={bet} />
    </GameLayout>
  );
}
