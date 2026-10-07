"use client";

import { useState } from "react";

export function ForgotPasswordForm({ whatsappNumber }: { whatsappNumber: string }) {
  const [email, setEmail] = useState("");

  if (!whatsappNumber) {
    return <p className="rounded-lg bg-panel-2 p-3 text-sm text-muted">Please contact our support team to reset your password.</p>;
  }

  const text = `Hi, I forgot my password. My account email is: ${email}`;
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Account email</label>
        <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <a
        href={email.includes("@") ? href : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!email.includes("@")}
        className={`btn w-full bg-[#25D366] text-black ${email.includes("@") ? "" : "pointer-events-none opacity-50"}`}
      >
        💬 Request reset on WhatsApp
      </a>
    </div>
  );
}
