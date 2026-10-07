"use client";

// Rendered only when PAYMENTS_ENABLED / WITHDRAWALS_ENABLED are on and a method is enabled in /admin/settings.

import { useState } from "react";
import { useBalance } from "./BalanceProvider";

type Method = { id: string; name: string; color: string; payoutLabel: string };
type Package = { id: string; priceUsd: number; coins: number; bonusPct: number };
type Order = { id: string; reference: string; method: string; details: string; amountUsd: number; coins: number; instructions: string[] };

export function BuyCoins({ packages, methods, whatsappNumber, account }: { packages: Package[]; methods: Method[]; whatsappNumber: string; account: string }) {
  const [pkg, setPkg] = useState(packages[0]?.id);
  const [method, setMethod] = useState(methods[0]?.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payments/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: pkg, method }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setOrder(data);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  if (order) {
    const msg = `Hi! I paid $${order.amountUsd.toFixed(2)} via ${order.method} for ${order.coins.toLocaleString()} coins. Reference: ${order.reference}. Account: ${account}. Screenshot attached.`;
    const wa = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}` : null;
    return (
      <div className="space-y-4 rounded-2xl border border-gold/40 bg-gold/5 p-4">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-muted">Send exactly</div>
          <div className="text-3xl font-black text-gold">${order.amountUsd.toFixed(2)}</div>
          <div className="text-sm text-muted">via {order.method}</div>
        </div>
        <div className="space-y-2 text-sm">
          <Row label={`${order.method} account`} value={order.details} onCopy={copy} copied={copied} />
          <Row label="Reference (put this in the payment note)" value={order.reference} onCopy={copy} copied={copied} mono />
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          {order.instructions.map((t) => <li key={t}>{t}</li>)}
        </ol>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn w-full bg-[#25D366] py-3 text-black">💬 Send payment screenshot on WhatsApp</a>
        ) : (
          <p className="rounded-lg bg-panel-2 p-3 text-sm text-muted">Send your payment screenshot to our support team.</p>
        )}
        <button className="btn-ghost w-full text-sm" onClick={() => setOrder(null)}>Back to packages</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {packages.map((p) => (
          <button key={p.id} onClick={() => setPkg(p.id)} className={`relative rounded-xl border p-3 text-center ${pkg === p.id ? "border-gold bg-gold/10" : "border-line bg-panel-2"}`}>
            {p.bonusPct > 0 && <span className="absolute -top-2 right-2 rounded-full bg-win px-1.5 text-[10px] font-bold text-black">+{p.bonusPct}%</span>}
            <div className="font-mono font-bold text-gold">🪙 {p.coins.toLocaleString()}</div>
            <div className="text-sm font-semibold">${p.priceUsd}</div>
          </button>
        ))}
      </div>
      <div>
        <label className="label">Pay with</label>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-bold ${method === m.id ? "border-gold bg-gold/10" : "border-line bg-panel-2"}`}
              style={{ color: m.color }}>
              {m.name}
            </button>
          ))}
        </div>
      </div>
      <button className="btn-gold w-full py-3" disabled={busy} onClick={submit}>{busy ? "Please wait…" : "Continue to payment"}</button>
      {error && <p className="rounded-lg bg-lose/15 px-3 py-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function Row({ label, value, onCopy, copied, mono }: { label: string; value: string; onCopy: (v: string) => void; copied: string | null; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-panel-2 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
        <div className={`truncate font-bold ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <button className="btn-ghost shrink-0 px-3 py-1 text-xs" onClick={() => onCopy(value)}>{copied === value ? "Copied ✓" : "Copy"}</button>
    </div>
  );
}

export function WithdrawForm({ methods, minUsd, maxUsd, coinsPerDollar }: { methods: Method[]; minUsd: number; maxUsd: number; coinsPerDollar: number }) {
  const { balance, setBalance } = useBalance();
  const [usd, setUsd] = useState(minUsd);
  const [method, setMethod] = useState(methods[0]?.id);
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const coins = Math.round(usd * coinsPerDollar);
  const current = methods.find((m) => m.id === method);

  const submit = async () => {
    setBusy(true);
    const res = await fetch("/api/payments/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coins, method, payoutHandle: handle }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setBalance(balance - coins);
      setMsg({ ok: true, text: "Withdrawal request received. We process withdrawals manually and will send the money to your account soon. The coins are on hold until then." });
    } else setMsg({ ok: false, text: data.error });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Amount (USD)</label>
        <input type="number" className="input font-mono" min={minUsd} max={maxUsd} step={1} value={usd} onChange={(e) => setUsd(Number(e.target.value))} />
        <p className="mt-1 text-xs text-muted">= 🪙 {coins.toLocaleString()} coins · Your balance: 🪙 {balance.toLocaleString()}</p>
      </div>
      <div>
        <label className="label">Receive with</label>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-bold ${method === m.id ? "border-gold bg-gold/10" : "border-line bg-panel-2"}`}
              style={{ color: m.color }}>
              {m.name}
            </button>
          ))}
        </div>
      </div>
      <div><label className="label">{current?.payoutLabel ?? "Payout account"}</label><input className="input" maxLength={100} value={handle} onChange={(e) => setHandle(e.target.value)} /></div>
      <button className="btn-gold w-full" disabled={busy} onClick={submit}>{busy ? "Please wait…" : "Request withdrawal"}</button>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-win/15 text-green-200" : "bg-lose/15 text-red-300"}`}>{msg.text}</p>}
    </div>
  );
}
