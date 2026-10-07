"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("next") !== f.get("confirm")) return setMsg({ ok: false, text: "New passwords don't match" });
    setBusy(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: f.get("current"), next: f.get("next") }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Failed" });
    form.reset();
    setMsg({ ok: true, text: "Password changed. Other devices have been logged out." });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label">Current password</label><input name="current" type="password" required className="input" autoComplete="current-password" /></div>
      <div><label className="label">New password</label><input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" /></div>
      <div><label className="label">Confirm new password</label><input name="confirm" type="password" required minLength={8} className="input" autoComplete="new-password" /></div>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-win/15 text-green-200" : "bg-lose/15 text-red-300"}`}>{msg.text}</p>}
      <button className="btn-gold w-full" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}
