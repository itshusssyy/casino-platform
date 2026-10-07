import { randomInt } from "node:crypto";

// All randomness comes from the OS CSPRNG on the server. Never trust the client.

/** Integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return randomInt(min, max + 1);
}

/** Float in [0, 1) with 48 bits of precision. */
export function randFloat(): number {
  return randomInt(0, 2 ** 48 - 1) / 2 ** 48;
}

export function pickWeighted<T>(items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((a, i) => a + i.weight, 0);
  let r = randFloat() * total;
  for (const item of items) {
    r -= item.weight;
    if (r < 0) return item.value;
  }
  return items[items.length - 1].value;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
