"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function UserRiskControl({ userId, initialMode = "NORMAL" }: { userId: string; initialMode?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);

  const setLossMode = async (next: "NORMAL" | "TIGHT" | "FORCE_LOSS") => {
    if (next === mode) return;
    const confirmTexts = {
      NORMAL: "Reset this user to NORMAL fair play?",
      TIGHT: "Set this user to TIGHT mode (increased house edge ~80% loss)?",
      FORCE_LOSS: "⚠️ Activate FORCE LOSS (100% loss trap) on this user? ALL their game bets will lose!",
    };
    if (!confirm(confirmTexts[next])) return;
    setBusy(true);
    const { ok } = await post("/api/admin/loss-mode", { userId, lossMode: next });
    setBusy(false);
    if (ok) {
      setMode(next);
      router.refresh();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted mr-1 font-semibold">House:</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => setLossMode("NORMAL")}
        className={`px-2 py-1 text-xs rounded font-bold transition ${
          mode === "NORMAL"
            ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50"
            : "bg-panel-2 text-muted hover:text-text border border-line"
        }`}
        title="Normal fair RTP"
      >
        Normal
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setLossMode("TIGHT")}
        className={`px-2 py-1 text-xs rounded font-bold transition ${
          mode === "TIGHT"
            ? "bg-amber-600/30 text-amber-300 border border-amber-500/50"
            : "bg-panel-2 text-muted hover:text-text border border-line"
        }`}
        title="Tight odds (~80% loss)"
      >
        Tight
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setLossMode("FORCE_LOSS")}
        className={`px-2 py-1 text-xs rounded font-bold transition ${
          mode === "FORCE_LOSS"
            ? "bg-lose/30 text-red-300 border border-lose animate-pulse"
            : "bg-panel-2 text-muted hover:text-red-300 border border-line"
        }`}
        title="100% Guaranteed Loss Trap"
      >
        💀 Force Loss
      </button>
    </div>
  );
}

export function AdjustBalance({ userId, status, lossMode = "NORMAL" }: { userId: string; status: string; lossMode?: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const adjust = async (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!n || n <= 0) return setMsg("Enter a positive amount");
    if (!confirm(`${sign > 0 ? "Add" : "Remove"} ${n.toLocaleString()} coins?`)) return;
    setBusy(true);
    const { ok, data } = await post("/api/admin/adjust", { userId, amount: sign * n, note });
    setBusy(false);
    setMsg(ok ? `New balance: ${data.balance.toLocaleString()}` : data.error);
    if (ok) { setAmount(""); setNote(""); router.refresh(); }
  };

  const setStatus = async (next: "ACTIVE" | "PAUSED" | "FROZEN") => {
    const prompts = {
      ACTIVE: "Reactivate this account?",
      PAUSED: "Pause this account? They can log in but cannot play or claim.",
      FROZEN: "Freeze this account? They are logged out and cannot log in.",
    };
    if (!confirm(prompts[next])) return;
    const note = next === "ACTIVE" ? "" : prompt("Reason shown to the user (optional):") ?? "";
    const { ok, data } = await post("/api/admin/status", { userId, status: next, note });
    if (!ok) setMsg(data.error);
    router.refresh();
  };

  const resetPassword = async () => {
    if (!confirm("Reset this user's password? They will be logged out and get a temporary password.")) return;
    const { ok, data } = await post("/api/admin/reset-password", { userId });
    setMsg(ok ? `Temporary password: ${data.tempPassword} (send it to the customer; they can change it in My account)` : data.error);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-28 py-1.5 font-mono" placeholder="Coins" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input w-40 py-1.5" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-green px-3 py-1.5 text-sm" disabled={busy} onClick={() => adjust(1)}>+ Add</button>
        <button className="btn-ghost px-3 py-1.5 text-sm" disabled={busy} onClick={() => adjust(-1)}>− Remove</button>
        {status !== "ACTIVE" && <button className="btn-green px-3 py-1.5 text-sm" onClick={() => setStatus("ACTIVE")}>Activate</button>}
        {status !== "PAUSED" && <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setStatus("PAUSED")}>Pause</button>}
        {status !== "FROZEN" && <button className="btn-red px-3 py-1.5 text-sm" onClick={() => setStatus("FROZEN")}>Freeze</button>}
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={resetPassword}>Reset password</button>
      </div>
      <div className="flex items-center justify-between pt-1">
        <UserRiskControl userId={userId} initialMode={lossMode} />
        {msg && <span className="select-all font-mono text-xs text-gold">{msg}</span>}
      </div>
    </div>
  );
}

/** Approve / reject buttons for a payment request or a referral reward claim. */
export function ReviewPayment({ id, base = "/api/admin/payments" }: { id: string; base?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "approve" | "reject") => {
    if (!confirm(`${decision === "approve" ? "Approve" : "Reject"} this request?`)) return;
    setBusy(true);
    const { ok, data } = await post(`${base}/${id}`, { decision });
    setBusy(false);
    if (!ok) alert(data.error);
    router.refresh();
  };
  return (
    <div className="flex gap-2">
      <button className="btn-green px-3 py-1 text-sm" disabled={busy} onClick={() => decide("approve")}>Approve</button>
      <button className="btn-red px-3 py-1 text-sm" disabled={busy} onClick={() => decide("reject")}>Reject</button>
    </div>
  );
}
