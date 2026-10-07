// Settings types, defaults and helpers that are safe to use on the client too.
import { z } from "zod";
import { PAYMENT_METHOD_IDS, type PaymentMethodConfig, type PaymentMethodId } from "./payments";

// Games whose RTP (return to player) the admin can tune. Payouts scale so the
// published RTP stays true. Table games keep their rule-defined RTP.
export const ADJUSTABLE_RTP_DEFAULTS: Record<string, number> = {
  dice: 0.94,
  limbo: 0.94,
  coinflip: 0.95,
  crash: 0.92,
  mines: 0.92,
  hilo: 0.94,
  plinko: 0.92,
  keno: 0.90,
  slots: 0.90,
  wheel: 0.92,
  scratch: 0.90,
};
export const FIXED_RTP_LABELS: Record<string, string> = {
  blackjack: "≈99%",
  roulette: "97.3%",
  baccarat: "≈98.9%",
  "video-poker": "99.5%",
};
export const RTP_MIN = 0.7;
export const RTP_MAX = 0.99;

const usd = z.number().min(0).max(100_000);

export const settingsSchema = z.object({
  coinsPerDollar: z.number().int().min(1).max(1_000_000),
  signupBonusUsd: usd,
  packages: z.array(z.object({ priceUsd: z.number().min(0.5).max(100_000), bonusPct: z.number().min(0).max(500) })).max(12),
  depositPromo: z.object({ enabled: z.boolean(), minDepositUsd: usd, bonusUsd: usd }),
  referral: z.object({
    enabled: z.boolean(),
    tiers: z.array(z.object({ depositUsd: usd.min(1), rewardUsd: usd })).max(10),
  }),
  withdrawal: z.object({
    minUsd: usd,
    maxPerRequestUsd: usd,
    maxPerDayUsd: usd,
    maxPerWeekUsd: usd,
    maxPerMonthUsd: usd,
    maxRequestsPerDay: z.number().int().min(1).max(50),
    requireDeposit: z.boolean(),
    depositWagerMultiplier: z.number().min(0).max(50),
    newAccountHours: z.number().int().min(0).max(24 * 30),
  }),
  deposit: z.object({ maxPerDayUsd: usd, maxPerWeekUsd: usd, maxPending: z.number().int().min(1).max(20) }),
  bonus: z.object({
    wagerMultiplier: z.number().min(0).max(100),
    holdOnSharedDevice: z.boolean(),
    holdOnSharedIp: z.boolean(),
  }),
  risk: z.object({ bigWinUsd: usd, dailyProfitUsd: usd }),
  paymentMethods: z
    .array(
      z.object({
        id: z.enum(PAYMENT_METHOD_IDS),
        enabled: z.boolean(),
        details: z.string().trim().max(200),
        deposit: z.boolean(),
        withdrawal: z.boolean(),
      }),
    )
    .max(PAYMENT_METHOD_IDS.length),
  announcements: z.array(z.string().trim().min(1).max(140)).max(10),
  minBet: z.number().int().min(1),
  maxBet: z.number().int().min(1),
  maxWinPerBet: z.number().int().min(1),
  games: z.record(z.string(), z.object({ enabled: z.boolean(), rtp: z.number().min(RTP_MIN).max(RTP_MAX).optional() })),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  coinsPerDollar: 100, // $1 = 100 coins, $10 = 1,000 coins
  signupBonusUsd: 10, // $10 free credit on signup = 1,000 coins
  packages: [
    { priceUsd: 5, bonusPct: 0 },
    { priceUsd: 10, bonusPct: 5 },
    { priceUsd: 25, bonusPct: 10 },
    { priceUsd: 50, bonusPct: 15 },
    { priceUsd: 100, bonusPct: 20 },
    { priceUsd: 250, bonusPct: 20 },
    { priceUsd: 500, bonusPct: 25 },
  ],
  depositPromo: { enabled: true, minDepositUsd: 500, bonusUsd: 100 }, // $500 deposit → $100 cashback
  referral: {
    enabled: true,
    // Each tier pays once per referred user, when their total deposits reach it.
    tiers: [
      { depositUsd: 250, rewardUsd: 25 },
      { depositUsd: 500, rewardUsd: 25 },
    ],
  },
  // Only used if withdrawals are ever enabled (licensed). Max per day counts all non-rejected requests in 24h.
  withdrawal: {
    minUsd: 20,
    maxPerRequestUsd: 500,
    maxPerDayUsd: 500,
    maxPerWeekUsd: 2000,
    maxPerMonthUsd: 5000,
    maxRequestsPerDay: 2,
    requireDeposit: true, // no withdrawals from bonus-only accounts
    depositWagerMultiplier: 1, // each deposit must be bet 1× before withdrawing (stops deposit → withdraw laundering)
    newAccountHours: 24, // no withdrawals in an account's first 24 hours
  },
  deposit: { maxPerDayUsd: 2000, maxPerWeekUsd: 5000, maxPending: 3 },
  bonus: {
    wagerMultiplier: 10, // bonus coins must be bet 10× before they (and their winnings) can be withdrawn
    holdOnSharedDevice: true, // signup credit waits for review if the device was used by another account
    holdOnSharedIp: false, // shared IPs are common (families, mobile networks), so only flag by default
  },
  risk: { bigWinUsd: 500, dailyProfitUsd: 1000 }, // flag single wins / 24h profit above these
  // Fill in your details in /admin/settings once approved; disabled methods show as "Coming soon".
  paymentMethods: PAYMENT_METHOD_IDS.map((id) => ({ id, enabled: false, details: "", deposit: true, withdrawal: true })),
  // Extra lines for the header banner (promotions are added automatically from the settings above).
  announcements: ["🎰 15 games, new winners every minute!"],
  minBet: 10, // $0.10
  maxBet: 10_000, // $100
  maxWinPerBet: 1_000_000, // $10,000
  games: {},
};

/** Merge stored (possibly partial / older) settings over the defaults. */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(stored ?? {}) } as Settings;
  s.depositPromo = { ...DEFAULT_SETTINGS.depositPromo, ...(stored?.depositPromo ?? {}) };
  s.referral = { ...DEFAULT_SETTINGS.referral, ...(stored?.referral ?? {}) };
  s.withdrawal = { ...DEFAULT_SETTINGS.withdrawal, ...(stored?.withdrawal ?? {}) };
  s.deposit = { ...DEFAULT_SETTINGS.deposit, ...(stored?.deposit ?? {}) };
  s.bonus = { ...DEFAULT_SETTINGS.bonus, ...(stored?.bonus ?? {}) };
  s.risk = { ...DEFAULT_SETTINGS.risk, ...(stored?.risk ?? {}) };
  // Always list every known method, keeping stored values where present.
  s.paymentMethods = DEFAULT_SETTINGS.paymentMethods.map((d) => ({ ...d, ...(stored?.paymentMethods?.find((m) => m.id === d.id) ?? {}) }));
  s.games = { ...(stored?.games ?? {}) };
  return s;
}

/** Methods customers can actually use right now for deposits or withdrawals. */
export function activeMethods(s: Settings, kind: "deposit" | "withdrawal"): PaymentMethodConfig[] {
  return s.paymentMethods.filter((m) => m.enabled && m[kind] && (kind === "withdrawal" || m.details.trim() !== ""));
}
export const methodById = (s: Settings, id: string) => s.paymentMethods.find((m) => m.id === (id as PaymentMethodId));

export const isGameEnabled = (s: Settings, slug: string) => s.games[slug]?.enabled !== false;

/** RTP for adjustable games (0.8–0.99), or null for fixed-rule table games. */
export function gameRtp(s: Settings, slug: string): number | null {
  const def = ADJUSTABLE_RTP_DEFAULTS[slug];
  if (def === undefined) return null;
  const v = s.games[slug]?.rtp ?? def;
  return Math.min(RTP_MAX, Math.max(RTP_MIN, v));
}

export function rtpLabel(s: Settings, slug: string) {
  const r = gameRtp(s, slug);
  return r === null ? FIXED_RTP_LABELS[slug] ?? "" : `${(r * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

export const usdToCoins = (s: Pick<Settings, "coinsPerDollar">, usd: number) => Math.round(usd * s.coinsPerDollar);

/** "$12.50" for a coin amount at the given rate (coins per $1). */
export function coinsToUsdLabel(coins: number, coinsPerDollar: number) {
  const usd = coins / coinsPerDollar;
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function coinPackages(s: Settings) {
  return s.packages.map((p, i) => {
    const base = usdToCoins(s, p.priceUsd);
    return { id: `pkg${i}`, priceUsd: p.priceUsd, priceCents: Math.round(p.priceUsd * 100), bonusPct: p.bonusPct, coins: Math.floor(base * (1 + p.bonusPct / 100)) };
  });
}

/** What the client needs to render a game. */
export type GameClientSettings = { rtp: number; minBet: number; maxBet: number; maxWinPerBet: number };
