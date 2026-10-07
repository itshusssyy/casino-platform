"use client";

import Link from "next/link";
import { useState } from "react";
import { CountryPicker } from "./CountryPicker";

/** Hash of stable browser/screen traits; helps spot one person opening many accounts. */
async function browserFingerprint(): Promise<string | undefined> {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    let canvasData = "";
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(10, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("RoyalSpin✓", 2, 15);
      canvasData = c.toDataURL();
    }
    const raw = [
      nav.userAgent, nav.language, nav.languages?.join(","), Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen.width, screen.height, screen.colorDepth, devicePixelRatio, nav.hardwareConcurrency, nav.deviceMemory, nav.maxTouchPoints, canvasData,
    ].join("|");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  } catch {
    return undefined;
  }
}

export function AuthForm({ mode, next, referralCode, signupBonus }: { mode: "login" | "signup"; next?: string; referralCode?: string; signupBonus?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState("US");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const body =
      mode === "signup"
        ? {
            firstName: f.get("firstName"),
            lastName: f.get("lastName"),
            country,
            phone: f.get("phone"),
            email: f.get("email"),
            password: f.get("password"),
            ageConfirmed: f.get("age") === "on",
            ref: f.get("ref") || undefined,
          }
        : { identifier: f.get("identifier"), password: f.get("password") };
    if (mode === "signup" && f.get("password") !== f.get("confirm")) {
      setBusy(false);
      return setError("Passwords don't match");
    }
    const fp = await browserFingerprint();
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, fp }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong");
    // Full reload so the header picks up the session + balance.
    window.location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="panel space-y-5 p-6 sm:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-black">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          {mode === "signup" && signupBonus && <p className="text-sm text-gold">Get {signupBonus} free credit on signup 🎁</p>}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">First name</label><input name="firstName" required maxLength={40} className="input" autoComplete="given-name" /></div>
                <div><label className="label">Last name</label><input name="lastName" required maxLength={40} className="input" autoComplete="family-name" /></div>
              </div>
              <div>
                <label className="label">Phone number</label>
                <div className="flex gap-2">
                  <CountryPicker value={country} onChange={setCountry} />
                  <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-bg/70 focus-within:border-gold">
                    <input name="phone" type="tel" required inputMode="tel" maxLength={20} className="w-full min-w-0 bg-transparent px-3 py-2.5 outline-none" autoComplete="tel-national" placeholder={country === "US" || country === "CA" ? "(555) 123-4567" : "Phone number"} />
                  </div>
                </div>
              </div>
              <div><label className="label">Email</label><input name="email" type="email" required className="input" autoComplete="email" /></div>
            </>
          ) : (
            <div><label className="label">Email or phone</label><input name="identifier" required className="input" autoComplete="username" placeholder="you@example.com or +15551234567" /></div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              {mode === "login" && <Link href="/forgot-password" className="mb-1 text-xs text-gold hover:underline">Forgot password?</Link>}
            </div>
            <input name="password" type="password" required minLength={mode === "signup" ? 8 : 1} className="input" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          {mode === "signup" && (
            <>
              <div><label className="label">Confirm password</label><input name="confirm" type="password" required minLength={8} className="input" autoComplete="new-password" /></div>
              <div>
                <label className="label">Referral code (optional)</label>
                <input name="ref" defaultValue={referralCode} maxLength={16} className="input font-mono uppercase" />
              </div>
              <label className="flex items-start gap-2 text-sm text-muted">
                <input name="age" type="checkbox" required className="mt-1 accent-[var(--gold)]" />
                <span>I am 18 or older and agree to the <Link href="/terms" className="underline">terms</Link>.</span>
              </label>
            </>
          )}
          {error && <p className="rounded-lg bg-lose/15 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button className="btn-gold w-full py-3" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Sign up" : "Log in"}</button>
        </form>

        <p className="text-center text-sm text-muted">
          {mode === "signup" ? <>Already have an account? <Link href="/login" className="text-gold">Log in</Link></> : <>New here? <Link href="/signup" className="text-gold">Create an account</Link></>}
        </p>
      </div>
    </div>
  );
}
