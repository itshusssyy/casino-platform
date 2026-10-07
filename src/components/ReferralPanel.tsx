"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Reward = { id: string; referred: string; tierUsd: number; rewardUsd: number; coins: number; status: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: "Ready to claim", cls: "text-gold" },
  CLAIM_REQUESTED: { label: "Claim pending review", cls: "text-sky-300" },
  PAID: { label: "Paid", cls: "text-win" },
  REJECTED: { label: "Rejected", cls: "text-red-300" },
};

export function ReferralPanel({ link, code, referredCount, rewards, supportLink }: { link: string; code: string; referredCount: number; rewards: Reward[]; supportLink: string | null }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed. Select the link manually.");
    }
  };

  const claim = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/referrals/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Claim failed");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Your referral link</label>
        <div className="flex gap-2">
          <input readOnly value={link} className="input font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn-gold shrink-0" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
        <p className="mt-1 text-xs text-muted">Code: <b className="font-mono text-text">{code}</b> · Friends joined: <b className="text-text">{referredCount}</b></p>
      </div>
      {error && <p className="rounded-lg bg-lose/15 px-3 py-2 text-sm text-red-300">{error}</p>}
      {rewards.length > 0 ? (
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
              <div>
                <b>{r.referred}</b> deposited ${r.tierUsd}+ → <b className="text-gold">${r.rewardUsd}</b> <span className="text-muted">(🪙 {r.coins.toLocaleString()})</span>
                <div className={`text-xs ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label ?? r.status}</div>
              </div>
              {r.status === "AVAILABLE" && (
                <button className="btn-green py-1.5 text-sm" disabled={busy === r.id} onClick={() => claim(r.id)}>Claim</button>
              )}
              {r.status === "CLAIM_REQUESTED" && supportLink && (
                <a href={supportLink} target="_blank" rel="noopener noreferrer" className="btn-ghost py-1.5 text-sm">Message support</a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No rewards yet. Share your link to start earning.</p>
      )}
    </div>
  );
}
