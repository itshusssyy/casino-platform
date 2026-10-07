"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useBalance, useUsd } from "@/components/BalanceProvider";
import { RANKS, SUITS, type Card } from "@/lib/games/tables";

/** Calls /api/games/{slug}; keeps the header balance in sync and exposes loading/error state. */
export function useGame(slug: string) {
  const { balance, setBalance } = useBalance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async <T = any,>(action: string, body: Record<string, unknown> = {}, opts: { quiet?: boolean } = {}): Promise<T | null> => {
      if (!opts.quiet) setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/games/${slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Request failed");
          return null;
        }
        if (typeof data.balance === "number") setBalance(data.balance);
        return data as T;
      } catch {
        setError("Network error");
        return null;
      } finally {
        if (!opts.quiet) setBusy(false);
      }
    },
    [slug, setBalance],
  );

  return { call, busy, error, setError, balance, setBalance };
}

export function BetInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const { balance, coinsPerDollar } = useBalance();
  const usd = useUsd();
  const set = (v: number) => onChange(Math.max(1, Math.min(Math.floor(v) || 1, 1_000_000)));
  const presets = [1, 5, 10, 25];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label">Bet amount</label>
        <span className="text-xs font-semibold text-gold">= {usd(value)}</span>
      </div>
      <div className="flex overflow-hidden rounded-xl border border-line bg-bg/70 focus-within:border-gold">
        <span className="flex items-center pl-3">🪙</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          className="w-full min-w-0 bg-transparent px-2 py-3 font-mono text-base outline-none"
          value={value}
          disabled={disabled}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button type="button" disabled={disabled} className="border-l border-line px-3.5 text-sm hover:bg-panel-2" onClick={() => set(value / 2)}>½</button>
        <button type="button" disabled={disabled} className="border-l border-line px-3.5 text-sm hover:bg-panel-2" onClick={() => set(value * 2)}>2×</button>
        <button type="button" disabled={disabled} className="border-l border-line px-3.5 text-sm hover:bg-panel-2" onClick={() => set(balance)}>Max</button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {presets.map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => set(d * coinsPerDollar)}
            className={`rounded-lg border py-1.5 text-xs font-semibold ${value === d * coinsPerDollar ? "border-gold bg-gold/15 text-gold" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
            ${d}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Game board first on phones (controls underneath); side-by-side on large screens. */
export function GameLayout({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel order-2 space-y-4 p-3 sm:p-4 lg:order-1">{controls}</aside>
      <section className="panel order-1 flex min-h-[300px] flex-col items-center justify-center gap-4 overflow-hidden p-3 sm:min-h-[420px] sm:gap-6 sm:p-6 lg:order-2">
        {children}
      </section>
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="rounded-lg bg-lose/15 px-3 py-2 text-sm text-red-300">{error}</p>;
}

export function ResultBanner({ payout, bet, show, label }: { payout: number; bet: number; show: boolean; label?: string }) {
  const usd = useUsd();
  if (!show) return null;
  const win = payout > 0;
  const push = payout === bet && bet > 0;
  return (
    <div
      className={`animate-pop rounded-2xl px-5 py-3 text-center text-base font-bold sm:px-6 sm:text-lg ${
        push ? "bg-panel-2 text-text" : win ? "bg-win/20 text-win" : "bg-lose/15 text-red-300"
      }`}
    >
      {label ? <div className="text-sm font-medium opacity-80">{label}</div> : null}
      {push
        ? `Push: 🪙 ${payout.toLocaleString()} (${usd(payout)}) returned`
        : win
          ? `You won 🪙 ${payout.toLocaleString()} (${usd(payout)})`
          : "No win this time"}
    </div>
  );
}

export function PlayingCard({ card, hidden, small, held, onClick }: { card?: Card; hidden?: boolean; small?: boolean; held?: boolean; onClick?: () => void }) {
  const size = small ? "h-16 w-11 text-xs sm:h-20 sm:w-14 sm:text-base" : "h-20 w-[3.4rem] text-sm sm:h-32 sm:w-24 sm:text-xl";
  if (hidden || !card)
    return (
      <div className={`${size} animate-flipin rounded-xl border-2 border-white/20 bg-[repeating-linear-gradient(45deg,#3b1d6e,#3b1d6e_6px,#2a1450_6px,#2a1450_12px)] shadow-lg`} />
    );
  const red = card.s === 1 || card.s === 2;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${size} animate-flipin relative flex flex-col justify-between rounded-xl bg-white p-1.5 font-bold shadow-lg transition ${red ? "text-red-600" : "text-slate-900"} ${
        held ? "-translate-y-3 ring-4 ring-gold" : ""
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <span className="text-left leading-none">{RANKS[card.r]}<br />{SUITS[card.s]}</span>
      <span className="self-center text-xl leading-none sm:text-3xl">{SUITS[card.s]}</span>
      <span className="rotate-180 text-left leading-none">{RANKS[card.r]}<br />{SUITS[card.s]}</span>
      {held && <span className="absolute -bottom-6 left-0 right-0 text-center text-xs text-gold">HELD</span>}
    </button>
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
