"use client";

import { useEffect, useState } from "react";
import { useUsd } from "@/components/BalanceProvider";
import { BetInput, ErrorText, GameLayout, ResultBanner, useGame } from "./kit";

type View = {
  active: boolean;
  revealed?: number[];
  mineCount?: number;
  multiplier?: number;
  nextMultiplier?: number;
  bet?: number;
  mines?: number[];
  hitMine?: number;
  payout?: number;
};

export default function Mines() {
  const usd = useUsd();
  const { call, busy, error } = useGame("mines");
  const [bet, setBet] = useState(100);
  const [mineCount, setMineCount] = useState(3);
  const [view, setView] = useState<View>({ active: false });

  useEffect(() => {
    call<View>("state", {}, { quiet: true }).then((v) => v?.active && setView(v));
  }, [call]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    const v = await call<View>(action, body);
    if (v) setView(v);
  };

  const ended = !view.active && view.payout !== undefined;
  const revealed = new Set(view.revealed ?? []);
  const mines = new Set(view.mines ?? []);

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || view.active} />
          <div>
            <label className="label">Mines</label>
            <select className="input" value={mineCount} disabled={view.active} onChange={(e) => setMineCount(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {view.active ? (
            <button className="btn-green w-full py-3 text-lg" disabled={busy || !view.revealed?.length} onClick={() => act("cashout")}>
              Cash out 🪙 {Math.floor((view.bet ?? 0) * (view.multiplier ?? 1)).toLocaleString()} ({usd(Math.floor((view.bet ?? 0) * (view.multiplier ?? 1)))})
            </button>
          ) : (
            <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={() => act("start", { bet, mines: mineCount })}>Start</button>
          )}
          {view.active && (
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-xl bg-panel-2 p-2"><div className="text-xs text-muted">Current</div><b>{view.multiplier}×</b></div>
              <div className="rounded-xl bg-panel-2 p-2"><div className="text-xs text-muted">Next tile</div><b>{view.nextMultiplier}×</b></div>
            </div>
          )}
          <ErrorText error={error} />
        </>
      }
    >
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 25 }, (_, i) => {
          const isRevealed = revealed.has(i);
          const isMine = mines.has(i);
          const showGem = isRevealed && !isMine;
          const showMine = (ended && isMine) || view.hitMine === i;
          return (
            <button
              key={i}
              disabled={!view.active || isRevealed || busy}
              onClick={() => act("reveal", { index: i })}
              className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl transition sm:h-20 sm:w-20 ${
                showGem ? "animate-pop bg-emerald-500/20 ring-2 ring-emerald-400"
                  : showMine ? `animate-pop ${view.hitMine === i ? "bg-lose" : "bg-lose/25"}`
                  : ended ? "bg-panel-2 opacity-60"
                  : "bg-panel-2 hover:-translate-y-0.5 hover:bg-line"
              }`}
            >
              {showGem ? "💎" : showMine ? "💣" : ""}
            </button>
          );
        })}
      </div>
      <ResultBanner show={ended} payout={view.payout ?? 0} bet={view.bet ?? 0} />
    </GameLayout>
  );
}
