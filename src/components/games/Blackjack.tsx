"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/games/tables";
import { BetInput, ErrorText, GameLayout, PlayingCard, ResultBanner, useGame } from "./kit";

type View = {
  active: boolean;
  player?: Card[];
  dealer?: Card[];
  playerTotal?: number;
  dealerTotal?: number;
  canDouble?: boolean;
  bet?: number;
  result?: string;
  payout?: number;
};

const LABELS: Record<string, string> = { blackjack: "Blackjack! 🎉", win: "You win!", push: "Push", lose: "Dealer wins", bust: "Bust!" };

export default function Blackjack() {
  const { call, busy, error } = useGame("blackjack");
  const [bet, setBet] = useState(100);
  const [view, setView] = useState<View>({ active: false });

  useEffect(() => {
    call<View>("state", {}, { quiet: true }).then((v) => v?.active && setView(v));
  }, [call]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    const v = await call<View>(action, body);
    if (v) setView(v);
  };

  const finished = !view.active && view.result;

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || view.active} />
          {view.active ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-green py-3" disabled={busy} onClick={() => act("hit")}>Hit</button>
              <button className="btn-red py-3" disabled={busy} onClick={() => act("stand")}>Stand</button>
              <button className="btn-ghost col-span-2" disabled={busy || !view.canDouble} onClick={() => act("double")}>Double (×2 bet)</button>
            </div>
          ) : (
            <button className="btn-gold w-full py-3 text-lg" disabled={busy} onClick={() => act("deal", { bet })}>Deal</button>
          )}
          <ErrorText error={error} />
          <p className="text-xs text-muted">Blackjack pays 3:2 · Dealer stands on soft 17 · 6 decks</p>
        </>
      }
    >
      <div className="flex w-full flex-col items-center gap-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,#14532d,#052e16)] px-4 py-8 shadow-inner">
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-200/70">Dealer {view.dealer && <span className="ml-1 text-lg text-white">{view.dealerTotal}</span>}</div>
          <div className="flex min-h-32 gap-2">
            {view.dealer?.map((c, i) => <PlayingCard key={i} card={c} />)}
            {view.active && <PlayingCard hidden />}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex min-h-32 gap-2">{view.player?.map((c, i) => <PlayingCard key={i} card={c} />)}</div>
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-200/70">You {view.player && <span className="ml-1 text-lg text-white">{view.playerTotal}</span>}</div>
        </div>
        {!view.player && <div className="text-emerald-200/70">Place your bet and deal</div>}
      </div>
      <ResultBanner show={!!finished} payout={view.payout ?? 0} bet={view.bet ?? 0} label={view.result ? LABELS[view.result] : undefined} />
    </GameLayout>
  );
}
