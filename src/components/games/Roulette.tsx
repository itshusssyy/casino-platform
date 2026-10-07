"use client";

import { useState } from "react";
import { ROULETTE_RED, ROULETTE_WHEEL_ORDER, type RouletteBetType } from "@/lib/games/tables";
import { useUsd } from "@/components/BalanceProvider";
import { ErrorText, GameLayout, ResultBanner, sleep, useGame } from "./kit";
import { MobileBar } from "./MobileBar";

type Bet = { type: RouletteBetType; value?: number; amount: number };
type Result = { number: number; color: string; payout: number };

const key = (b: { type: string; value?: number }) => `${b.type}:${b.value ?? ""}`;
const colorOf = (n: number) => (n === 0 ? "bg-emerald-600" : ROULETTE_RED.includes(n) ? "bg-red-600" : "bg-zinc-900");
const CHIPS = [10, 50, 100, 500, 1000, 5000];
const SEG = 360 / 37;

type CellProps = { type: RouletteBetType; value?: number; label: string; className?: string; amount?: number; highlight?: boolean; onPlace: (t: RouletteBetType, v?: number) => void };

function Cell({ type, value, label, className = "", amount, highlight, onPlace }: CellProps) {
  return (
    <button
      onClick={() => onPlace(type, value)}
      className={`relative flex min-h-10 items-center justify-center rounded-md border border-white/10 text-xs font-bold text-white hover:brightness-125 sm:text-sm ${className} ${highlight ? "ring-2 ring-gold" : ""}`}
    >
      {label}
      {amount ? <span className="absolute -right-1 -top-1 z-10 rounded-full bg-gold px-1.5 text-[10px] font-black text-black shadow">{amount}</span> : null}
    </button>
  );
}

export default function Roulette() {
  const usd = useUsd();
  const { call, busy, error } = useGame("roulette");
  const [chip, setChip] = useState(100);
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lastBets, setLastBets] = useState<Record<string, Bet>>({});
  const [history, setHistory] = useState<number[]>([]);

  const total = Object.values(bets).reduce((a, b) => a + b.amount, 0);
  const place = (type: RouletteBetType, value?: number) => {
    if (spinning) return;
    setBets((prev) => {
      const k = key({ type, value });
      return { ...prev, [k]: { type, value, amount: (prev[k]?.amount ?? 0) + chip } };
    });
  };
  const cp = (type: RouletteBetType, value?: number) => ({
    type, value, onPlace: place,
    amount: bets[key({ type, value })]?.amount,
    highlight: !!result && type === "straight" && value === result.number,
  });

  const spin = async () => {
    setResult(null);
    const list = Object.values(bets);
    const r = await call<Result>("spin", { bets: list });
    if (!r) return;
    setSpinning(true);
    const idx = ROULETTE_WHEEL_ORDER.indexOf(r.number);
    setRotation((prev) => prev - (prev % 360) + 360 * 5 + (360 - idx * SEG - SEG / 2));
    await sleep(4200);
    setSpinning(false);
    setResult(r);
    setHistory((h) => [r.number, ...h].slice(0, 12));
    setLastBets(bets);
    setBets({});
  };

  const wheelGradient = `conic-gradient(${ROULETTE_WHEEL_ORDER.map((n, i) => {
    const c = n === 0 ? "#059669" : ROULETTE_RED.includes(n) ? "#dc2626" : "#18181b";
    return `${c} ${i * SEG}deg ${(i + 1) * SEG}deg`;
  }).join(",")})`;

  return (
    <GameLayout
      controls={
        <>
          <div>
            <label className="label">Chip value</label>
            <div className="grid grid-cols-3 gap-2">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => setChip(c)} className={`${chip === c ? "btn-gold" : "btn-ghost"} flex-col gap-0 py-1.5`}>
                  <span>{c.toLocaleString()}</span><span className="text-[10px] opacity-70">{usd(c)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-panel-2 p-3 text-sm">Total bet: <b className="text-gold">🪙 {total.toLocaleString()}</b> <span className="text-muted">({usd(total)})</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" disabled={spinning} onClick={() => setBets({})}>Clear</button>
            <button className="btn-ghost" disabled={spinning || !Object.keys(lastBets).length} onClick={() => setBets(lastBets)}>Rebet</button>
          </div>
          <button className="btn-gold w-full py-3 text-lg" disabled={busy || spinning || total === 0} onClick={spin}>Spin</button>
          <ErrorText error={error} />
          <p className="text-xs text-muted">Straight 35:1 · Dozen/Column 2:1 · Red/Black/Odd/Even/1-18/19-36 1:1</p>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-8">
        <div className="relative">
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-2xl">🔻</div>
          <div className="relative h-52 w-52 rounded-full border-[10px] border-amber-900 shadow-2xl"
            style={{ background: wheelGradient, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(.15,.85,.25,1)" : "none" }}>
            <div className="absolute inset-[30%] rounded-full border-4 border-amber-700 bg-gradient-to-br from-amber-800 to-amber-950" />
          </div>
        </div>
        <div className="text-center">
          {result ? (
            <div className={`animate-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black text-white ${colorOf(result.number)}`}>{result.number}</div>
          ) : <div className="text-muted">Place your chips</div>}
          <div className="mt-3 flex max-w-[220px] flex-wrap justify-center gap-1">
            {history.map((n, i) => <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${colorOf(n)}`}>{n}</span>)}
          </div>
        </div>
      </div>

      {/* Phones: vertical table (0 on top, 12 rows of 3) so nothing needs sideways scrolling. */}
      <div className="w-full space-y-1 sm:hidden">
        <div className="grid grid-cols-3 gap-1">
          <Cell {...cp("straight", 0)} label="0" className="col-span-3 bg-emerald-600" />
          {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
            <Cell key={n} {...cp("straight", n)} label={String(n)} className={colorOf(n)} />
          ))}
          {[1, 2, 3].map((c) => <Cell key={`c${c}`} {...cp("column", c)} label="2:1" className="bg-panel-2" />)}
          {[1, 2, 3].map((d) => <Cell key={`d${d}`} {...cp("dozen", d)} label={`${d === 1 ? "1st" : d === 2 ? "2nd" : "3rd"} 12`} className="bg-panel-2" />)}
          <Cell {...cp("low")} label="1-18" className="bg-panel-2" />
          <Cell {...cp("even")} label="EVEN" className="bg-panel-2" />
          <Cell {...cp("red")} label="RED" className="bg-red-600" />
          <Cell {...cp("black")} label="BLACK" className="bg-zinc-900" />
          <Cell {...cp("odd")} label="ODD" className="bg-panel-2" />
          <Cell {...cp("high")} label="19-36" className="bg-panel-2" />
        </div>
      </div>

      <div className="hidden w-full max-w-3xl overflow-x-auto sm:block">
        <div className="min-w-[560px] space-y-1">
          <div className="grid grid-cols-[40px_repeat(12,1fr)_44px] gap-1">
            <Cell {...cp("straight", 0)} label="0" className="row-span-3 bg-emerald-600" />
            {[3, 2, 1].map((rowStart) => (
              <div key={rowStart} className="contents">
                {Array.from({ length: 12 }, (_, i) => rowStart + i * 3).map((n) => (
                  <Cell key={n} {...cp("straight", n)} label={String(n)} className={colorOf(n)} />
                ))}
                <Cell {...cp("column", rowStart)} label="2:1" className="bg-panel-2" />
              </div>
            ))}
          </div>
          <div className="ml-[44px] mr-[48px] grid grid-cols-3 gap-1">
            {[1, 2, 3].map((d) => <Cell key={d} {...cp("dozen", d)} label={`${d === 1 ? "1st" : d === 2 ? "2nd" : "3rd"} 12`} className="bg-panel-2" />)}
          </div>
          <div className="ml-[44px] mr-[48px] grid grid-cols-6 gap-1">
            <Cell {...cp("low")} label="1-18" className="bg-panel-2" />
            <Cell {...cp("even")} label="EVEN" className="bg-panel-2" />
            <Cell {...cp("red")} label="RED" className="bg-red-600" />
            <Cell {...cp("black")} label="BLACK" className="bg-zinc-900" />
            <Cell {...cp("odd")} label="ODD" className="bg-panel-2" />
            <Cell {...cp("high")} label="19-36" className="bg-panel-2" />
          </div>
        </div>
      </div>
      <ResultBanner show={!!result} payout={result?.payout ?? 0} bet={-1} />

      {/* Phones: chips + Spin always in reach at the bottom of the screen. */}
      <MobileBar>
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setChip(c)}
              className={`flex shrink-0 flex-col items-center rounded-full border px-3 py-1 text-xs font-bold ${chip === c ? "border-gold bg-gold text-black" : "border-line bg-panel-2 text-text"}`}>
              {c.toLocaleString()}<span className="text-[9px] font-semibold opacity-70">{usd(c)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 text-xs leading-tight">
            <div className="text-muted">Total bet</div>
            <div className="truncate font-bold text-gold">🪙 {total.toLocaleString()} <span className="font-normal text-muted">({usd(total)})</span></div>
          </div>
          <button className="btn-ghost px-3 py-2 text-sm" disabled={spinning || total === 0} onClick={() => setBets({})}>Clear</button>
          <button className="btn-ghost px-3 py-2 text-sm" disabled={spinning || !Object.keys(lastBets).length} onClick={() => setBets(lastBets)}>Rebet</button>
          <button className="btn-gold px-5 py-2.5" disabled={busy || spinning || total === 0} onClick={spin}>Spin</button>
        </div>
      </MobileBar>
    </GameLayout>
  );
}
