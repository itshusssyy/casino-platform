"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryByCode } from "@/lib/countries";

// Flag images live in /public/flags (from the MIT-licensed country-flag-icons package),
// because Windows doesn't render flag emojis.
function Flag({ code, className = "" }: { code: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/flags/${code.toLowerCase()}.svg`} alt="" width={24} height={16} className={`h-4 w-6 shrink-0 rounded-[3px] object-cover shadow ${className}`} />;
}

/** Country dial-code picker with flags and search. */
export function CountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = countryByCode(value) ?? COUNTRIES[0];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.dial.startsWith(q));
  }, [query]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${selected.name} +${selected.dial}`}
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="flex h-full items-center gap-2 rounded-xl border border-line bg-bg/70 px-3 py-2.5 hover:border-gold/60 focus:border-gold focus:outline-none"
      >
        <Flag code={selected.code} />
        <span className="font-mono text-sm">+{selected.dial}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} fill="currentColor" aria-hidden>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/60">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              className="input py-2 text-sm"
              placeholder="Search country or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && list[0]) { e.preventDefault(); onChange(list[0].code); setOpen(false); }
              }}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {list.map((c) => (
              <li key={c.code} role="option" aria-selected={c.code === value}>
                <button
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-panel-2 ${c.code === value ? "bg-gold/10 text-gold" : ""}`}
                >
                  <Flag code={c.code} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-muted">+{c.dial}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-3 text-sm text-muted">No match</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
