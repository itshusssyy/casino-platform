"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GAMES } from "@/lib/games/tables";
import { METHOD_INFO } from "@/lib/payments";
import {
  ADJUSTABLE_RTP_DEFAULTS, FIXED_RTP_LABELS, RTP_MAX, RTP_MIN, coinPackages, usdToCoins, type Settings,
} from "@/lib/settings-shared";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Num({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" step={step} className="input font-mono" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
      {label}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));
  const coins = (usd: number) => usdToCoins(s, usd).toLocaleString();

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error });
    setS(data);
    setMsg({ ok: true, text: "Saved. Changes are live within a few seconds." });
    router.refresh();
  };

  const setGame = (slug: string, patch: { enabled?: boolean; rtp?: number }) =>
    set({ games: { ...s.games, [slug]: { ...s.games[slug], enabled: s.games[slug]?.enabled ?? true, ...patch } } });

  return (
    <div className="space-y-6">
      <Section title="Coin pricing & bonuses" hint="All dollar amounts are converted to coins with this rate.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="Coins per $1" value={s.coinsPerDollar} onChange={(v) => set({ coinsPerDollar: v })} />
          <Num label="Signup credit ($)" value={s.signupBonusUsd} step={0.5} onChange={(v) => set({ signupBonusUsd: v })} suffix={`= ${coins(s.signupBonusUsd)} coins`} />
        </div>
      </Section>

      <Section title="Coin packages" hint="Shown on the wallet page. Bonus % adds extra coins on top of the base price.">
        <div className="space-y-2">
          {s.packages.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3">
              <div className="w-32"><Num label="Price ($)" value={p.priceUsd} step={0.5} onChange={(v) => set({ packages: s.packages.map((x, j) => (j === i ? { ...x, priceUsd: v } : x)) })} /></div>
              <div className="w-32"><Num label="Bonus %" value={p.bonusPct} onChange={(v) => set({ packages: s.packages.map((x, j) => (j === i ? { ...x, bonusPct: v } : x)) })} /></div>
              <div className="pb-3 font-mono text-gold">🪙 {coinPackages(s)[i]?.coins.toLocaleString()}</div>
              <button className="btn-ghost ml-auto py-2 text-sm" onClick={() => set({ packages: s.packages.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost text-sm" disabled={s.packages.length >= 12} onClick={() => set({ packages: [...s.packages, { priceUsd: 20, bonusPct: 0 }] })}>+ Add package</button>
        </div>
      </Section>

      <Section title="Deposit cashback promotion" hint="Paid automatically when you approve a deposit at or above the minimum.">
        <Toggle checked={s.depositPromo.enabled} onChange={(v) => set({ depositPromo: { ...s.depositPromo, enabled: v } })} label="Promotion active" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="Minimum single deposit ($)" value={s.depositPromo.minDepositUsd} onChange={(v) => set({ depositPromo: { ...s.depositPromo, minDepositUsd: v } })} />
          <Num label="Cashback ($)" value={s.depositPromo.bonusUsd} onChange={(v) => set({ depositPromo: { ...s.depositPromo, bonusUsd: v } })} suffix={`= ${coins(s.depositPromo.bonusUsd)} coins`} />
        </div>
      </Section>

      <Section title="Referral rewards" hint="When a referred user's total approved deposits reach a tier, their referrer earns that reward once. The referrer claims it and you approve it in the admin panel.">
        <Toggle checked={s.referral.enabled} onChange={(v) => set({ referral: { ...s.referral, enabled: v } })} label="Referral program active" />
        <div className="space-y-2">
          {s.referral.tiers.map((t, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3">
              <div className="w-44"><Num label="Referred user deposits ($)" value={t.depositUsd} onChange={(v) => set({ referral: { ...s.referral, tiers: s.referral.tiers.map((x, j) => (j === i ? { ...x, depositUsd: v } : x)) } })} /></div>
              <div className="w-36"><Num label="Referrer gets ($)" value={t.rewardUsd} onChange={(v) => set({ referral: { ...s.referral, tiers: s.referral.tiers.map((x, j) => (j === i ? { ...x, rewardUsd: v } : x)) } })} /></div>
              <div className="pb-3 font-mono text-gold">🪙 {coins(t.rewardUsd)}</div>
              <button className="btn-ghost ml-auto py-2 text-sm" onClick={() => set({ referral: { ...s.referral, tiers: s.referral.tiers.filter((_, j) => j !== i) } })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost text-sm" disabled={s.referral.tiers.length >= 10} onClick={() => set({ referral: { ...s.referral, tiers: [...s.referral.tiers, { depositUsd: 1000, rewardUsd: 50 }] } })}>+ Add tier</button>
        </div>
      </Section>

      <Section
        title="Payment methods (Cash App / Zelle / Chime)"
        hint="Customers send money to the details you enter here, then send the screenshot on WhatsApp. You approve deposits and pay withdrawals manually in /admin. Methods only appear once PAYMENTS_ENABLED / WITHDRAWALS_ENABLED are true in .env and the method is enabled here."
      >
        <div className="space-y-3">
          {s.paymentMethods.map((m, i) => {
            const info = METHOD_INFO[m.id];
            const update = (patch: Partial<typeof m>) => set({ paymentMethods: s.paymentMethods.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={m.id} className="space-y-3 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <b style={{ color: info.color }}>{info.name}</b>
                  <Toggle checked={m.enabled} onChange={(v) => update({ enabled: v })} label="Enabled" />
                  <Toggle checked={m.deposit} onChange={(v) => update({ deposit: v })} label="Deposits" />
                  <Toggle checked={m.withdrawal} onChange={(v) => update({ withdrawal: v })} label="Withdrawals" />
                </div>
                <div>
                  <label className="label">{info.detailsLabel} (shown to customers)</label>
                  <input className="input" maxLength={200} placeholder={info.detailsExample} value={m.details} onChange={(e) => update({ details: e.target.value })} />
                  {m.enabled && m.deposit && !m.details.trim() && <p className="mt-1 text-xs text-amber-300">Add your details. Deposits stay hidden for this method until you do.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Withdrawal limits & rules" hint="Withdrawals are processed manually by you. These are checked automatically on every request.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Minimum ($)" value={s.withdrawal.minUsd} onChange={(v) => set({ withdrawal: { ...s.withdrawal, minUsd: v } })} />
          <Num label="Max per request ($)" value={s.withdrawal.maxPerRequestUsd} onChange={(v) => set({ withdrawal: { ...s.withdrawal, maxPerRequestUsd: v } })} />
          <Num label="Max requests per day" value={s.withdrawal.maxRequestsPerDay} onChange={(v) => set({ withdrawal: { ...s.withdrawal, maxRequestsPerDay: v } })} />
          <Num label="Max per 24 hours ($)" value={s.withdrawal.maxPerDayUsd} onChange={(v) => set({ withdrawal: { ...s.withdrawal, maxPerDayUsd: v } })} />
          <Num label="Max per 7 days ($)" value={s.withdrawal.maxPerWeekUsd} onChange={(v) => set({ withdrawal: { ...s.withdrawal, maxPerWeekUsd: v } })} />
          <Num label="Max per 30 days ($)" value={s.withdrawal.maxPerMonthUsd} onChange={(v) => set({ withdrawal: { ...s.withdrawal, maxPerMonthUsd: v } })} />
          <Num label="New account wait (hours)" value={s.withdrawal.newAccountHours} onChange={(v) => set({ withdrawal: { ...s.withdrawal, newAccountHours: v } })} />
          <Num label="Deposit play-through (× deposit)" step={0.5} value={s.withdrawal.depositWagerMultiplier} onChange={(v) => set({ withdrawal: { ...s.withdrawal, depositWagerMultiplier: v } })} />
        </div>
        <Toggle checked={s.withdrawal.requireDeposit} onChange={(v) => set({ withdrawal: { ...s.withdrawal, requireDeposit: v } })}
          label="Require at least one approved deposit before the first withdrawal (stops bonus-only cash-outs)" />
        <p className="text-xs text-muted">Play-through 1× means a customer who deposits $100 must bet $100 before withdrawing. This stops people using the site to pass money through without playing.</p>
      </Section>

      <Section title="Bonus lock" hint="Applies to signup credit, deposit cashback and referral rewards.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Wagering requirement (× bonus)" step={1} value={s.bonus.wagerMultiplier} onChange={(v) => set({ bonus: { ...s.bonus, wagerMultiplier: v } })} />
        </div>
        <p className="text-xs text-muted">
          {s.bonus.wagerMultiplier}× means a {"$"}{s.signupBonusUsd} credit must be bet {"$"}{(s.signupBonusUsd * s.bonus.wagerMultiplier).toLocaleString()} in total before the bonus (and anything won with it) can be withdrawn.
        </p>
        <Toggle checked={s.bonus.holdOnSharedDevice} onChange={(v) => set({ bonus: { ...s.bonus, holdOnSharedDevice: v } })}
          label="Hold the signup credit for review when the device was already used by another account (recommended)" />
        <Toggle checked={s.bonus.holdOnSharedIp} onChange={(v) => set({ bonus: { ...s.bonus, holdOnSharedIp: v } })}
          label="Also hold it when only the IP address matches (stricter; families and mobile networks share IPs)" />
      </Section>

      <Section title="Deposit limits" hint="Per customer. Pending and approved requests both count.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Max per 24 hours ($)" value={s.deposit.maxPerDayUsd} onChange={(v) => set({ deposit: { ...s.deposit, maxPerDayUsd: v } })} />
          <Num label="Max per 7 days ($)" value={s.deposit.maxPerWeekUsd} onChange={(v) => set({ deposit: { ...s.deposit, maxPerWeekUsd: v } })} />
          <Num label="Max pending requests" value={s.deposit.maxPending} onChange={(v) => set({ deposit: { ...s.deposit, maxPending: v } })} />
        </div>
      </Section>

      <Section title="Risk alerts" hint="Raise a flag on /admin/risk when a player crosses these. Set 0 to turn off.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Big single win ($)" value={s.risk.bigWinUsd} onChange={(v) => set({ risk: { ...s.risk, bigWinUsd: v } })} />
          <Num label="Profit in 24 hours ($)" value={s.risk.dailyProfitUsd} onChange={(v) => set({ risk: { ...s.risk, dailyProfitUsd: v } })} />
        </div>
      </Section>

      <Section title="Header banner messages" hint="Extra lines for the scrolling banner. Active promotions and real recent big wins are added automatically.">
        <div className="space-y-2">
          {s.announcements.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" maxLength={140} value={a} onChange={(e) => set({ announcements: s.announcements.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button className="btn-ghost shrink-0 py-2 text-sm" onClick={() => set({ announcements: s.announcements.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost text-sm" disabled={s.announcements.length >= 10} onClick={() => set({ announcements: [...s.announcements, "New message"] })}>+ Add message</button>
        </div>
      </Section>

      <Section title="Betting limits" hint="Max win per bet caps any single payout. This protects you from one huge hit.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Min bet (coins)" value={s.minBet} onChange={(v) => set({ minBet: v })} />
          <Num label="Max bet (coins)" value={s.maxBet} onChange={(v) => set({ maxBet: v })} />
          <Num label="Max win per bet (coins)" value={s.maxWinPerBet} onChange={(v) => set({ maxWinPerBet: v })} />
        </div>
      </Section>

      <Section title="Games: RTP & availability" hint={`RTP = % of wagers paid back to players over the long run; house edge = 100% − RTP. Allowed ${RTP_MIN * 100}–${RTP_MAX * 100}%. Players see the RTP you set, and payout tables update to match. Table games have fixed rules.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="pb-2">Game</th><th>Enabled</th><th>RTP %</th><th>House edge</th></tr></thead>
            <tbody>
              {GAMES.map((g) => {
                const adjustable = ADJUSTABLE_RTP_DEFAULTS[g.slug] !== undefined;
                const rtp = s.games[g.slug]?.rtp ?? ADJUSTABLE_RTP_DEFAULTS[g.slug];
                return (
                  <tr key={g.slug} className="border-t border-line">
                    <td className="py-2">{g.emoji} {g.name}</td>
                    <td><input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={s.games[g.slug]?.enabled !== false} onChange={(e) => setGame(g.slug, { enabled: e.target.checked })} /></td>
                    <td>
                      {adjustable ? (
                        <input type="number" step={0.5} min={RTP_MIN * 100} max={RTP_MAX * 100} className="input w-24 py-1.5 font-mono"
                          value={Math.round(rtp * 1000) / 10}
                          onChange={(e) => setGame(g.slug, { rtp: Number(e.target.value) / 100 })} />
                      ) : <span className="text-muted">{FIXED_RTP_LABELS[g.slug]} (fixed)</span>}
                    </td>
                    <td className="font-mono">{adjustable ? `${(100 - rtp * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="sticky bottom-4 flex items-center gap-3">
        <button className="btn-gold px-8 py-3" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
        {msg && <span className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-win/15 text-green-200" : "bg-lose/15 text-red-300"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
