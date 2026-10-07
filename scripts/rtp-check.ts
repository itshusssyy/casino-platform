// Verifies that paytables really pay back the configured RTP (analytic expectation, no sampling).
// Usage: npx tsx scripts/rtp-check.ts
import {
  PLINKO_ROWS, SCRATCH_PRIZES, SLOT_SYMBOLS, kenoTable, plinkoTable, scratchPrizes, slotPaytable, wheelSegments,
} from "../src/lib/games/tables";

const comb = (n: number, k: number) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return k < 0 || k > n ? 0 : r;
};
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

function slotsRtp(rtp: number) {
  const t = slotPaytable(rtp);
  const W = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
  const pc = SLOT_SYMBOLS[0].weight / W;
  return t.symbols.reduce((e, s) => e + (s.weight / W) ** 3 * s.pay, 0) + pc * pc * (1 - pc) * t.twoCherry;
}
const plinkoRtp = (risk: "low" | "medium" | "high", rtp: number) =>
  plinkoTable(risk, rtp).reduce((e, m, i) => e + (m * comb(PLINKO_ROWS, i)) / 2 ** PLINKO_ROWS, 0);
const kenoRtp = (picks: number, rtp: number) =>
  kenoTable(picks, rtp).reduce((e, m, h) => e + (m * comb(10, h) * comb(30, picks - h)) / comb(40, picks), 0);
const wheelRtp = (rtp: number) => { const s = wheelSegments(rtp); return s.reduce((a, b) => a + b, 0) / s.length; };
const scratchRtp = (rtp: number) => scratchPrizes(rtp).reduce((e, p, i) => e + p.mult * SCRATCH_PRIZES[i].prob, 0);

let worst = 0;
for (const target of [0.99, 0.95, 0.9, 0.85, 0.8]) {
  const rows: [string, number][] = [
    ["slots", slotsRtp(target)],
    ["plinko low", plinkoRtp("low", target)],
    ["plinko med", plinkoRtp("medium", target)],
    ["plinko high", plinkoRtp("high", target)],
    ...[1, 3, 5, 8, 10].map((n) => [`keno ${n}`, kenoRtp(n, target)] as [string, number]),
    ["wheel", wheelRtp(target)],
    ["scratch", scratchRtp(target)],
  ];
  console.log(`\nTarget RTP ${pct(target)}`);
  for (const [name, r] of rows) {
    const diff = r - target;
    worst = Math.max(worst, diff);
    console.log(`  ${name.padEnd(12)} ${pct(r)}  (${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(2)} pts)`);
  }
}
// Rounding is always down, so actual RTP should never exceed the target by more than a hair.
console.log(worst <= 0.002 ? "\n✔ No game pays more than its configured RTP" : `\n✗ Some game exceeds target by ${(worst * 100).toFixed(2)} pts`);
process.exit(worst <= 0.002 ? 0 : 1);
