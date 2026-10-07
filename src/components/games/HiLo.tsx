"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/games/tables";
import { useUsd } from "@/components/BalanceProvider";
import { BetInput, ErrorText, GameLayout, PlayingCard, ResultBanner, useGame } from "./kit";

type View = {
  active: boolean;
  current?: Card;
  multiplier?: number;
  history?: Card[];
  higherMult?: number;
  lowerMult?: number;
  higherChance?: number;
  lowerChance?: number;
  bet?: number;
  lost?: boolean;
  payout?: number;
};

const pct = (p?: number) => `${((p ?? 0) * 100).toFixed(1)}%`;

export default function HiLo() {
  const usd = useUsd();
  const { call, busy, error } = useGame("hilo");
  const [bet, setBet] = useState(100);
  const [view, setView] = useState<View>({ active: false });

  useEffect(() => {
    call<View>("state", {}, { quiet: true }).then((v) => v?.active && setView(v));
  }, [call]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    const v = await call<View>(action, body);
    if (v) setView(v);
  };

  const ended = !view.active && view.payout !== undefined;

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || view.active} />
          {view.active ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-green flex-col py-3" disabled={busy || (view.higherChance ?? 0) >= 1} onClick={() => act("guess", { dir: "higher" })}>
                  ⬆ Higher or same<span className="text-xs opacity-80">{view.higherMult}× · {pct(view.higherChance)}</span>
                </button>
                <button className="btn-red flex-col py-3" disabled={busy || (view.lowerChance ?? 0) >= 1} onClick={() => act("guess", { dir: "lower" })}>
                  ⬇ Lower or same<span className="text-xs opacity-80">{view.lowerMult}× · {pct(view.lowerChance)}</span>
                </button>
              </div>
              <button className="btn-ghost w-full" disabled={busy} onClick={() => act("skip")}>Skip card</button>
              <button className="btn-gold w-full py-3" disabled={busy || (view.multiplier ?? 1) <= 1} onClick={() => act("cashout")}>
                Cash out 🪙 {Math.floor((view.bet ?? 0) * (view.multiplier ?? 1)).toLocaleString()} ({usd(Math.floor((view.bet ?? 0) * (view.multiplier ?? 1)))})
              </button>
            </>
          ) : (
            <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={() => act("start", { bet })}>Start</button>
          )}
          <ErrorText error={error} />
        </>
      }
    >
      <div className="text-4xl font-black text-gold">{view.multiplier ?? 1}×</div>
      <div className="flex items-center gap-6">
        {view.current ? <PlayingCard card={view.current} key={JSON.stringify(view.current) + (view.history?.length ?? 0)} /> : <PlayingCard hidden />}
      </div>
      {view.history && view.history.length > 0 && (
        <div className="flex max-w-full gap-1 overflow-x-auto pb-2">
          {view.history.slice(-10).map((c, i) => <PlayingCard key={i} card={c} small />)}
        </div>
      )}
      {view.lost && <div className="text-xl font-bold text-lose">Wrong guess!</div>}
      <ResultBanner show={ended} payout={view.payout ?? 0} bet={view.bet ?? 0} />
    </GameLayout>
  );
}
