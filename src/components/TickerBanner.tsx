"use client";

import { useEffect, useState } from "react";

type Feed = { promos: string[]; winners: string[] };

/** Scrolling banner under the header: promotions interleaved with real recent big wins. */
export function TickerBanner() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ticker");
        if (!res.ok) return;
        const feed: Feed = await res.json();
        const mixed: string[] = [];
        const max = Math.max(feed.promos.length, feed.winners.length);
        for (let i = 0; i < max; i++) {
          if (feed.promos[i]) mixed.push(feed.promos[i]);
          if (feed.winners[i]) mixed.push(feed.winners[i]);
        }
        if (alive) setItems(mixed);
      } catch {
        /* banner is decorative; ignore network errors */
      }
    };
    load();
    const t = setInterval(load, 45_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (items.length === 0) return null;
  // Speed scales with content length so it reads at a steady pace.
  const duration = Math.max(25, items.join("").length / 6);

  return (
    <div className="group relative overflow-hidden border-b border-line bg-gradient-to-r from-purple-950/80 via-bg to-purple-950/80 py-1.5 text-sm">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap group-hover:[animation-play-state:paused]" style={{ animationDuration: `${duration}s` }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} className={t.startsWith("🏆") ? "text-win" : "text-gold"} aria-hidden={i >= items.length}>{t}</span>
        ))}
      </div>
    </div>
  );
}
