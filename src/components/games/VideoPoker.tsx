"use client";

import { useEffect, useState } from "react";
import { VIDEO_POKER_PAYS, type Card } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, PlayingCard, ResultBanner, useGame } from "./kit";

type View = { active: boolean; hand?: Card[]; bet?: number; preview?: string | null; handName?: string | null; payout?: number };

export default function VideoPoker() {
  const { call, busy, error } = useGame("video-poker");
  const [bet, setBet] = useState(100);
  const [view, setView] = useState<View>({ active: false });
  const [holds, setHolds] = useState([false, false, false, false, false]);

  useEffect(() => {
    call<View>("state", {}, { quiet: true }).then((v) => v?.active && setView(v));
  }, [call]);

  const deal = async () => {
    const v = await call<View>("deal", { bet });
    if (v) { setView(v); setHolds([false, false, false, false, false]); }
  };
  const draw = async () => {
    const v = await call<View>("draw", { holds });
    if (v) setView(v);
  };

  const ended = !view.active && view.payout !== undefined;
  const highlight = ended ? view.handName : view.preview;

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || view.active} />
          {view.active ? (
            <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={draw}>Draw</button>
          ) : (
            <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={deal}>Deal</button>
          )}
          <ErrorText error={error} />
          <div className="space-y-1 text-sm">
            {VIDEO_POKER_PAYS.map((p) => (
              <div key={p.hand} className={`flex justify-between rounded-lg px-3 py-1 ${highlight === p.hand ? "bg-gold text-black" : "bg-panel-2"}`}>
                <span>{p.hand}</span><b>{p.pay}×</b>
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="rounded-[2rem] bg-gradient-to-b from-blue-900 to-slate-950 px-2 py-8 sm:px-4 sm:py-10">
        <div className="flex gap-1.5 sm:gap-3">
          {view.hand
            ? view.hand.map((c, i) => (
                <PlayingCard key={`${c.r}-${c.s}`} card={c} held={view.active && holds[i]}
                  onClick={view.active ? () => setHolds((h) => h.map((v, j) => (j === i ? !v : v))) : undefined} />
              ))
            : Array.from({ length: 5 }, (_, i) => <PlayingCard key={i} hidden />)}
        </div>
      </div>
      {view.active && <p className="text-sm text-muted">Tap cards to hold, then draw.</p>}
      {ended && <div className="text-2xl font-black">{view.handName ?? "No winning hand"}</div>}
      <ResultBanner show={ended} payout={view.payout ?? 0} bet={view.bet ?? 0} />
    </GameLayout>
  );
}
