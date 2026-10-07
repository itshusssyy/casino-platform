"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Stats = {
  updatedAt: string;
  last24h: { rounds: number; wageredUsd: number; paidOutUsd: number; houseResultUsd: number; actualRtp: number | null; signups: number; depositsUsd: number; depositsCount: number; withdrawalsUsd: number; withdrawalsCount: number };
  lastHour: { rounds: number; houseResultUsd: number };
  activePlayers15m: number;
  liability: { users: number; totalBalanceUsd: number; lockedBonusUsd: number; withdrawableUsd: number };
  pending: { withdrawalsCount: number; withdrawalsUsd: number; depositsCount: number; depositsUsd: number };
  flags: { HIGH: number; MEDIUM: number; LOW: number };
  heldSignupBonuses: number;
  topWinners: { userId: string; name: string; netUsd: number }[];
  bigWins: { name: string; game: string; betUsd: number; payoutUsd: number; multiplier: number; at: string }[];
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-win" : tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-text";
  return (
    <div className="panel p-3 sm:p-4">
      <div className="label">{label}</div>
      <div className={`font-mono text-xl font-black sm:text-2xl ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Live company risk numbers, refreshed every 30 seconds. */
export function RiskDashboard() {
  const router = useRouter();
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/risk/stats", { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
        const data = await res.json();
        if (alive) { setS(data); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    load();
    const t = setInterval(() => { load(); router.refresh(); }, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [router]);

  if (error && !s) return <p className="rounded-lg bg-lose/15 px-3 py-2 text-sm text-red-300">{error}</p>;
  if (!s) return <div className="panel p-6 text-sm text-muted">Loading live numbers…</div>;

  const h = s.last24h;
  // Can the company cover every pending withdrawal + everything players could withdraw?
  const exposure = s.pending.withdrawalsUsd + s.liability.withdrawableUsd;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Live · refreshes every 30s</span>
        <span>Updated {new Date(s.updatedAt).toLocaleTimeString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="House result (24h)" value={signed(h.houseResultUsd)} tone={h.houseResultUsd >= 0 ? "good" : "bad"}
          sub={`Wagered ${money(h.wageredUsd)} · paid ${money(h.paidOutUsd)}`} />
        <Tile label="Last hour" value={signed(s.lastHour.houseResultUsd)} tone={s.lastHour.houseResultUsd >= 0 ? "good" : "bad"} sub={`${s.lastHour.rounds.toLocaleString()} rounds`} />
        <Tile label="Actual RTP (24h)" value={h.actualRtp === null ? "—" : `${(h.actualRtp * 100).toFixed(1)}%`}
          tone={h.actualRtp !== null && h.actualRtp > 1 ? "bad" : undefined} sub={`${h.rounds.toLocaleString()} rounds`} />
        <Tile label="Active players" value={String(s.activePlayers15m)} sub={`last 15 min · ${h.signups} signups (24h)`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Pending withdrawals" value={money(s.pending.withdrawalsUsd)} tone={s.pending.withdrawalsCount ? "warn" : undefined} sub={`${s.pending.withdrawalsCount} request(s)`} />
        <Tile label="Pending deposits" value={money(s.pending.depositsUsd)} sub={`${s.pending.depositsCount} request(s)`} />
        <Tile label="Deposits / withdrawals (24h)" value={`${money(h.depositsUsd)} / ${money(h.withdrawalsUsd)}`} sub={`${h.depositsCount} in · ${h.withdrawalsCount} out`} />
        <Tile label="Open risk flags" value={`${s.flags.HIGH} high`} tone={s.flags.HIGH ? "bad" : undefined}
          sub={`${s.flags.MEDIUM} medium · ${s.flags.LOW} low · ${s.heldSignupBonuses} held credits`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Player balances (liability)" value={money(s.liability.totalBalanceUsd)} sub={`${s.liability.users} accounts`} />
        <Tile label="Locked bonus" value={money(s.liability.lockedBonusUsd)} sub="Not withdrawable yet" />
        <Tile label="Max exposure" value={money(exposure)} tone="warn" sub="Pending + withdrawable balances" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h3 className="mb-2 font-bold">Top winners (24h)</h3>
          {s.topWinners.length === 0 ? <p className="text-sm text-muted">No winning players in the last 24h.</p> : (
            <ol className="space-y-1 text-sm">
              {s.topWinners.map((w, i) => (
                <li key={w.userId} className="flex justify-between rounded-lg bg-panel-2 px-3 py-1.5">
                  <a href={`/admin?q=${encodeURIComponent(w.userId)}`} className="truncate hover:text-gold">{i + 1}. {w.name}</a>
                  <b className="font-mono text-red-300">{signed(w.netUsd)}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="panel p-4">
          <h3 className="mb-2 font-bold">Biggest wins (24h)</h3>
          {s.bigWins.length === 0 ? <p className="text-sm text-muted">No wins yet.</p> : (
            <ul className="space-y-1 text-sm">
              {s.bigWins.map((b, i) => (
                <li key={i} className="flex justify-between gap-2 rounded-lg bg-panel-2 px-3 py-1.5">
                  <span className="truncate">{b.name} · {b.game} · {b.multiplier.toFixed(2)}×</span>
                  <b className="shrink-0 font-mono">{money(b.payoutUsd)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function FlagActions({ id, type }: { id: string; type: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (action: string, confirmText: string) => {
    if (!confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/risk/flags/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) alert(data.error ?? "Failed");
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {type === "BONUS_HELD" && (
        <button className="btn-green px-3 py-1 text-xs" disabled={busy} onClick={() => act("grant_bonus", "Give this user the signup credit?")}>Grant credit</button>
      )}
      <button className="btn-ghost px-3 py-1 text-xs" disabled={busy}
        onClick={() => act("dismiss", type === "BONUS_HELD" ? "Dismiss? The user will NOT get the signup credit." : "Dismiss this flag?")}>Dismiss</button>
      <button className="btn-ghost px-3 py-1 text-xs text-amber-300" disabled={busy} onClick={() => act("pause", "Pause this account? They can log in but not play or withdraw.")}>Pause user</button>
      <button className="btn-red px-3 py-1 text-xs" disabled={busy} onClick={() => act("freeze", "Freeze this account? They are logged out and cannot log in.")}>Freeze user</button>
    </div>
  );
}
