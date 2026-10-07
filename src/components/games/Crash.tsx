"use client";

import { useEffect, useRef, useState } from "react";
import { crashMultiplierAt } from "@/lib/games/tables";
import { useUsd } from "@/components/BalanceProvider";
import { BetInput, ErrorText, GameLayout, ResultBanner, useGame } from "./kit";

type Status =
  | { status: "idle" }
  | { status: "running"; elapsed: number; bet: number; autoCashout: number | null }
  | { status: "crashed"; crashPoint: number; payout: number }
  | { status: "cashed"; multiplier: number; crashPoint: number; payout: number };

export default function Crash() {
  const usd = useUsd();
  const { call, busy, error } = useGame("crash");
  const [bet, setBet] = useState(100);
  const [auto, setAuto] = useState("");
  const [state, setState] = useState<Status>({ status: "idle" });
  const [mult, setMult] = useState(1);
  const [history, setHistory] = useState<number[]>([]);
  const startRef = useRef(0); // local timestamp matching server elapsed=0
  const [points, setPoints] = useState<number[]>([]);

  const running = state.status === "running";

  // Animate locally, poll the server for the authoritative result.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const m = crashMultiplierAt(performance.now() - startRef.current);
      setMult(m);
      setPoints((p) => (p.length > 2000 ? [...p.filter((_, i) => i % 2 === 0), m] : [...p, m]));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const poll = setInterval(async () => {
      const s = await call<Status>("status", {}, { quiet: true });
      if (!s) return;
      if (s.status === "running") startRef.current = performance.now() - s.elapsed;
      else finish(s);
    }, 250);
    return () => { cancelAnimationFrame(raf); clearInterval(poll); };
  }, [running, call]);

  // Resume a round after page refresh.
  useEffect(() => {
    call<Status>("status", {}, { quiet: true }).then((s) => {
      if (s?.status === "running") { startRef.current = performance.now() - s.elapsed; setPoints([]); setState(s); }
    });
  }, [call]);

  function finish(s: Status) {
    if (s.status === "crashed" || s.status === "cashed") {
      setState(s);
      setMult(s.status === "crashed" ? s.crashPoint : s.multiplier);
      setHistory((h) => [s.crashPoint, ...h].slice(0, 14));
    }
  }

  const start = async () => {
    const s = await call<Status>("start", { bet, autoCashout: auto ? Number(auto) : null });
    if (s?.status === "running") {
      startRef.current = performance.now();
      setPoints([]);
      setMult(1);
      setState(s);
    }
  };

  const cashout = async () => {
    const s = await call<Status>("cashout");
    if (s) finish(s);
  };

  // Chart path
  const pts = points;
  const maxM = Math.max(2, ...pts.slice(-1), mult);
  const path = pts.length > 1
    ? pts.map((m, i) => `${(i / (pts.length - 1)) * 100},${100 - ((m - 1) / (maxM - 1)) * 90}`).join(" ")
    : "";
  const crashed = state.status === "crashed";
  const cashed = state.status === "cashed";

  return (
    <GameLayout
      controls={
        <>
          <BetInput value={bet} onChange={setBet} disabled={busy || running} />
          <div>
            <label className="label">Auto cash-out (optional)</label>
            <input className="input font-mono" placeholder="e.g. 2.00" type="number" step="0.01" min="1.01" value={auto} disabled={running} onChange={(e) => setAuto(e.target.value)} />
          </div>
          {running ? (
            <button className="btn-green w-full py-4 text-lg" onClick={cashout}>
              Cash out 🪙 {Math.floor(bet * mult).toLocaleString()} ({usd(Math.floor(bet * mult))})
            </button>
          ) : (
            <button className="btn-gold w-full py-4 text-lg" disabled={busy} onClick={start}>Place bet</button>
          )}
          <ErrorText error={error} />
          <div className="flex flex-wrap gap-1">
            {history.map((h, i) => (
              <span key={i} className={`chip font-mono ${h >= 2 ? "text-win" : "text-red-300"}`}>{h.toFixed(2)}×</span>
            ))}
          </div>
        </>
      }
    >
      <div className="relative h-72 w-full max-w-2xl overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-bg sm:h-80">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {path && <polyline points={path} fill="none" stroke={crashed ? "#ef4444" : "#f5c542"} strokeWidth="1.2" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-6xl font-black tabular-nums sm:text-7xl ${crashed ? "text-lose" : cashed ? "text-win" : "text-text"}`}>
            {mult.toFixed(2)}×
          </div>
          {crashed && <div className="animate-pop mt-2 text-xl font-bold text-lose">💥 CRASHED</div>}
          {cashed && <div className="animate-pop mt-2 text-lg font-bold text-win">Cashed out at {state.multiplier}× (crashed at {state.crashPoint}×)</div>}
          {running && <div className="mt-2 text-4xl">🚀</div>}
        </div>
      </div>
      <ResultBanner show={crashed || cashed} payout={crashed || cashed ? state.payout : 0} bet={bet} />
    </GameLayout>
  );
}
