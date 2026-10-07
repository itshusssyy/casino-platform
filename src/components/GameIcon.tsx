import { gameBySlug } from "@/lib/games/tables";

// Most games use their emoji; a few get a drawn icon because no emoji fits well.

function PlinkoIcon() {
  const rows = [3, 4, 5, 6];
  const buckets = ["#ef4444", "#f97316", "#facc15", "#f97316", "#ef4444"];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,.45)]" aria-hidden>
      <defs>
        <radialGradient id="pk-ball" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff7c2" />
          <stop offset="55%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#b7791f" />
        </radialGradient>
      </defs>
      <path d="M50 6 L94 86 H6 Z" fill="rgba(0,0,0,.28)" />
      {rows.map((n, r) =>
        Array.from({ length: n }, (_, i) => (
          <circle key={`${r}-${i}`} cx={50 + (i - (n - 1) / 2) * 13} cy={28 + r * 14} r={3.2} fill="#ffffff" opacity={0.92} />
        )),
      )}
      <path d="M50 14 Q56 30 46.5 40 T53 63" fill="none" stroke="#f5c542" strokeWidth={1.6} strokeDasharray="2 3" opacity={0.7} />
      <circle cx={53} cy={64} r={6.5} fill="url(#pk-ball)" />
      {buckets.map((c, i) => (
        <rect key={i} x={13 + i * 15} y={84} width={13} height={9} rx={2.5} fill={c} />
      ))}
    </svg>
  );
}

function HiLoIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,.45)]" aria-hidden>
      <g transform="rotate(-12 38 55)">
        <rect x="16" y="22" width="44" height="62" rx="7" fill="#fff" />
        <text x="24" y="40" fontSize="15" fontWeight="800" fill="#111827" fontFamily="system-ui, sans-serif">K</text>
        <text x="38" y="66" fontSize="26" fill="#111827" fontFamily="system-ui, sans-serif">♠</text>
      </g>
      <g transform="rotate(10 62 50)">
        <rect x="42" y="16" width="44" height="62" rx="7" fill="#fff" />
        <text x="50" y="34" fontSize="15" fontWeight="800" fill="#dc2626" fontFamily="system-ui, sans-serif">A</text>
        <text x="62" y="60" fontSize="26" fill="#dc2626" fontFamily="system-ui, sans-serif">♥</text>
      </g>
      <circle cx="80" cy="22" r="13" fill="#22c55e" stroke="#fff" strokeWidth="2.5" />
      <path d="M80 15 L86 24 H74 Z" fill="#fff" />
      <circle cx="22" cy="82" r="13" fill="#ef4444" stroke="#fff" strokeWidth="2.5" />
      <path d="M22 89 L28 80 H16 Z" fill="#fff" />
    </svg>
  );
}

const DRAWN: Record<string, () => React.JSX.Element> = { plinko: PlinkoIcon, hilo: HiLoIcon };

/** `size` is the icon box: px number or any CSS length (e.g. "60cqw"). Emoji are scaled to fill it. */
export function GameIcon({ slug, size = 24, className = "" }: { slug: string; size?: number | string; className?: string }) {
  const box = typeof size === "number" ? `${size}px` : size;
  const Drawn = DRAWN[slug];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} style={{ width: box, height: box }} aria-hidden>
      {Drawn ? <Drawn /> : <span style={{ fontSize: `calc(${box} * 0.86)` }}>{gameBySlug(slug)?.emoji}</span>}
    </span>
  );
}
