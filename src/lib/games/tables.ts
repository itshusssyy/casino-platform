// Paytables shared by server (logic) and client (display).
// Each table's RTP (return to player) is noted. House edge = 1 - RTP.

export type GameMeta = {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  color: string; // tailwind gradient classes
};

export const GAMES: GameMeta[] = [
  { slug: "slots", name: "Lucky Slots", emoji: "🎰", tagline: "3×3 reels, 5 paylines", color: "from-fuchsia-600 to-purple-800" },
  { slug: "blackjack", name: "Blackjack", emoji: "🃏", tagline: "Beat the dealer to 21", color: "from-emerald-600 to-emerald-900" },
  { slug: "roulette", name: "Roulette", emoji: "🎡", tagline: "European single zero", color: "from-red-600 to-rose-900" },
  { slug: "crash", name: "Crash", emoji: "🚀", tagline: "Cash out before it crashes", color: "from-orange-500 to-red-700" },
  { slug: "mines", name: "Mines", emoji: "💣", tagline: "Find gems, dodge mines", color: "from-sky-600 to-indigo-900" },
  { slug: "plinko", name: "Plinko", emoji: "🔻", tagline: "Drop the ball, chase 170×", color: "from-pink-500 to-fuchsia-800" },
  { slug: "dice", name: "Dice", emoji: "🎲", tagline: "Roll over or under", color: "from-lime-500 to-green-800" },
  { slug: "keno", name: "Keno", emoji: "🔢", tagline: "Pick up to 10 numbers", color: "from-cyan-500 to-blue-800" },
  { slug: "baccarat", name: "Baccarat", emoji: "👑", tagline: "Player, Banker or Tie", color: "from-amber-500 to-yellow-800" },
  { slug: "video-poker", name: "Video Poker", emoji: "♠️", tagline: "Jacks or Better 9/6", color: "from-blue-600 to-slate-900" },
  { slug: "hilo", name: "Hi-Lo", emoji: "⬆️", tagline: "Higher or lower?", color: "from-violet-500 to-purple-900" },
  { slug: "wheel", name: "Fortune Wheel", emoji: "🎯", tagline: "Spin for up to 5×", color: "from-yellow-500 to-orange-800" },
  { slug: "coinflip", name: "Coin Flip", emoji: "🪙", tagline: "Heads or tails, 1.96×", color: "from-stone-500 to-stone-800" },
  { slug: "limbo", name: "Limbo", emoji: "📈", tagline: "Set your target multiplier", color: "from-teal-500 to-emerald-900" },
  { slug: "scratch", name: "Scratch Card", emoji: "🎟️", tagline: "Match 3 to win up to 100×", color: "from-rose-500 to-pink-900" },
];

export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug);

const comb = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

// ---------- Slots (base RTP 95.24%, verified analytically) ----------
export const SLOT_SYMBOLS = [
  { id: "cherry", icon: "🍒", weight: 30, pay: 10 },
  { id: "lemon", icon: "🍋", weight: 25, pay: 20 },
  { id: "orange", icon: "🍊", weight: 20, pay: 30 },
  { id: "grape", icon: "🍇", weight: 15, pay: 50 },
  { id: "bell", icon: "🔔", weight: 10, pay: 100 },
  { id: "star", icon: "⭐", weight: 6, pay: 200 },
  { id: "diamond", icon: "💎", weight: 3, pay: 750 },
  { id: "seven", icon: "7️⃣", weight: 1, pay: 5000 },
] as const;
export const SLOT_TWO_CHERRY_PAY = 1.5; // first two reels cherry, third not
const SLOT_TOTAL_W = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
const SLOT_P_CHERRY = SLOT_SYMBOLS[0].weight / SLOT_TOTAL_W;
/** RTP of one payline with the base paytable (all cells independent, so it equals the game RTP). */
export const SLOT_BASE_RTP =
  SLOT_SYMBOLS.reduce((e, s) => e + (s.weight / SLOT_TOTAL_W) ** 3 * s.pay, 0) +
  SLOT_P_CHERRY ** 2 * (1 - SLOT_P_CHERRY) * SLOT_TWO_CHERRY_PAY;
const floor2 = (n: number) => Math.floor(n * 100) / 100;
export function slotPaytable(rtp: number) {
  const k = rtp / SLOT_BASE_RTP;
  return {
    // Whole numbers for big pays (4987× not 4987.18×); always rounded down so RTP never exceeds the target.
    symbols: SLOT_SYMBOLS.map((s) => ({ ...s, pay: s.pay * k >= 10 ? Math.floor(s.pay * k) : floor2(s.pay * k) })),
    twoCherry: floor2(SLOT_TWO_CHERRY_PAY * k),
  };
}
// Row index for each of the 3 columns
export const SLOT_LINES = [
  [1, 1, 1],
  [0, 0, 0],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
] as const;

// ---------- Plinko, 12 rows (RTP ≈ 99%) ----------
export const PLINKO_ROWS = 12;
export const PLINKO_TABLES = {
  low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
  medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
  high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
} as const;
export type PlinkoRisk = keyof typeof PLINKO_TABLES;
const plinkoBaseRtp = (risk: PlinkoRisk) =>
  PLINKO_TABLES[risk].reduce((e, m, i) => e + (m * comb(PLINKO_ROWS, i)) / 2 ** PLINKO_ROWS, 0);
export function plinkoTable(risk: PlinkoRisk, rtp: number) {
  const k = rtp / plinkoBaseRtp(risk);
  return PLINKO_TABLES[risk].map((m) => floor2(m * k));
}

// ---------- Keno: 40 numbers, 10 drawn (each row is normalised to the configured RTP) ----------
const KENO_BASE: Record<number, number[]> = {
  1: [0, 3.8],
  2: [0, 1.8, 4.5],
  3: [0, 1, 2.5, 25],
  4: [0, 0.5, 2, 6, 100],
  5: [0, 0.5, 1.5, 3, 15, 300],
  6: [0, 0, 1, 3, 10, 70, 700],
  7: [0, 0, 1, 2, 6, 20, 200, 2000],
  8: [0, 0, 1, 2, 4, 10, 50, 500, 5000],
  9: [0, 0, 0.5, 1.5, 3, 7, 20, 120, 1200, 8000],
  10: [0, 0, 0.5, 1.5, 2.5, 4, 12, 60, 600, 3000, 10000],
};
export function kenoTable(picks: number, rtp: number): number[] {
  const row = KENO_BASE[picks] ?? [];
  const base = row.reduce((e, m, h) => e + (m * comb(10, h) * comb(30, picks - h)) / comb(40, picks), 0);
  return row.map((m) => floor2((m * rtp) / base));
}

// ---------- Fortune wheel, 30 segments (base RTP 97%) ----------
// 13×0, 8×1.2, 5×1.5, 2×2, 1×3, 1×5
export const WHEEL_SEGMENTS = [
  1.5, 0, 1.2, 0, 2, 0, 1.2, 0, 1.5, 0, 5, 0, 1.2, 0, 1.5,
  0, 1.2, 0, 3, 0, 1.2, 1.5, 0, 1.2, 0, 2, 0, 1.2, 1.5, 1.2,
];
export const wheelSegments = (rtp: number) => WHEEL_SEGMENTS.map((m) => floor2((m * rtp) / 0.97));

// ---------- Roulette ----------
export const ROULETTE_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
// Total return (stake included) per bet type
export const ROULETTE_PAYS = {
  straight: 36,
  red: 2, black: 2, odd: 2, even: 2, low: 2, high: 2,
  dozen: 3, column: 3,
} as const;
export type RouletteBetType = keyof typeof ROULETTE_PAYS;

// ---------- Video poker, Jacks or Better 9/6 (RTP 99.54% with optimal play) ----------
export const VIDEO_POKER_PAYS = [
  { hand: "Royal Flush", pay: 800 },
  { hand: "Straight Flush", pay: 50 },
  { hand: "Four of a Kind", pay: 25 },
  { hand: "Full House", pay: 9 },
  { hand: "Flush", pay: 6 },
  { hand: "Straight", pay: 4 },
  { hand: "Three of a Kind", pay: 3 },
  { hand: "Two Pair", pay: 2 },
  { hand: "Jacks or Better", pay: 1 },
] as const;

// ---------- Scratch card (base RTP 94%) ----------
export const SCRATCH_PRIZES = [
  { icon: "👑", mult: 100, prob: 0.001 },
  { icon: "💎", mult: 20, prob: 0.01 },
  { icon: "⭐", mult: 5, prob: 0.04 },
  { icon: "🔔", mult: 2, prob: 0.12 },
  { icon: "🍀", mult: 1, prob: 0.2 },
] as const;
export const scratchPrizes = (rtp: number) => SCRATCH_PRIZES.map((p) => ({ ...p, mult: floor2((p.mult * rtp) / 0.94) }));

// ---------- Baccarat (total return incl. stake) ----------
export const BACCARAT_PAYS = { player: 2, banker: 1.95, tie: 9 } as const;

// ---------- Crash ----------
export const CRASH_GROWTH = 0.00006; // multiplier = e^(GROWTH * ms)
export const crashMultiplierAt = (ms: number) => Math.floor(Math.exp(CRASH_GROWTH * Math.max(0, ms)) * 100) / 100;

// ---------- Mines ----------
export const minesMultiplier = (mines: number, revealed: number, rtp = 0.99) =>
  revealed === 0 ? 1 : Math.floor(rtp * (comb(25, revealed) / comb(25 - mines, revealed)) * 10000) / 10000;

// ---------- Cards ----------
export type Card = { r: number; s: number }; // r: 1(A)..13(K), s: 0..3
export const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["♠", "♥", "♦", "♣"];
