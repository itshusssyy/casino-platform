import "server-only";
import { GameError } from "../errors";
import { pickWeighted, randFloat, randInt, shuffle } from "../rng";
import { playInstant, validateBet } from "../wallet";
import { newShoe } from "./cards";
import { gameRtp } from "../settings-shared";
import {
  BACCARAT_PAYS, PLINKO_ROWS, ROULETTE_PAYS, ROULETTE_RED, SLOT_LINES,
  kenoTable, plinkoTable, scratchPrizes, slotPaytable, wheelSegments,
  type Card, type PlinkoRisk, type RouletteBetType,
} from "./tables";
import type { GameHandler } from "./types";

const floor2 = (n: number) => Math.floor(n * 100) / 100;
const floor4 = (n: number) => Math.floor(n * 10000) / 10000;

function expect(action: string, wanted: string) {
  if (action !== wanted) throw new GameError("Unknown action");
}

// ---------------- Dice ----------------
export const dice: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "roll");
  const bet = validateBet(body.bet, s);
  const target = Number(body.target);
  if (!Number.isInteger(target) || target < 2 || target > 98) throw new GameError("Target must be 2–98");
  const over = body.over === true;
  const chance = over ? (100 - target) / 100 : target / 100;
  const multiplier = floor4(gameRtp(s, "dice")! / chance);
  return playInstant(s, userId, "dice", bet, () => {
    let roll = randInt(0, 9999); // 0.00 – 99.99
    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      roll = over ? randInt(0, Math.max(0, target * 100 - 1)) : randInt(Math.min(9999, target * 100), 9999);
    }
    const win = over ? roll >= target * 100 : roll < target * 100;
    return { roll: roll / 100, target, over, win, multiplier, payout: win ? bet * multiplier : 0 };
  });
};

// ---------------- Limbo ----------------
export const limbo: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "play");
  const bet = validateBet(body.bet, s);
  const target = floor2(Number(body.target));
  if (!(target >= 1.01 && target <= 1000)) throw new GameError("Target must be 1.01×–1000×");
  const rtp = gameRtp(s, "limbo")!;
  return playInstant(s, userId, "limbo", bet, () => {
    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      return { result: 1.00, target, win: false, payout: 0 };
    }
    // P(result >= t) = rtp / t  →  house edge = 1 - rtp
    const raw = rtp / (1 - randFloat());
    const result = Math.min(1_000_000, Math.max(1, floor2(raw)));
    const win = result >= target;
    return { result, target, win, payout: win ? bet * target : 0 };
  });
};

// ---------------- Coin flip ----------------
export const coinflip: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "flip");
  const bet = validateBet(body.bet, s);
  const side = body.side === "tails" ? "tails" : "heads";
  const multiplier = floor2(2 * gameRtp(s, "coinflip")!);
  return playInstant(s, userId, "coinflip", bet, () => {
    let result = randInt(0, 1) === 0 ? "heads" : "tails";
    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      result = side === "heads" ? "tails" : "heads";
    }
    const win = result === side;
    return { side, result, win, multiplier, payout: win ? bet * multiplier : 0 };
  });
};

// ---------------- Roulette (European) ----------------
type RouletteBet = { type: RouletteBetType; value?: number; amount: number };

function rouletteWins(b: RouletteBet, n: number): boolean {
  if (b.type === "straight") return n === b.value;
  if (n === 0) return false;
  switch (b.type) {
    case "red": return ROULETTE_RED.includes(n);
    case "black": return !ROULETTE_RED.includes(n);
    case "odd": return n % 2 === 1;
    case "even": return n % 2 === 0;
    case "low": return n <= 18;
    case "high": return n >= 19;
    case "dozen": return Math.ceil(n / 12) === b.value;
    case "column": return ((n - 1) % 3) + 1 === b.value;
  }
}

export const roulette: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "spin");
  if (!Array.isArray(body.bets) || body.bets.length === 0 || body.bets.length > 60) throw new GameError("Place at least one bet");
  const bets: RouletteBet[] = body.bets.map((raw: unknown) => {
    const b = raw as Partial<RouletteBet>;
    if (!b.type || !(b.type in ROULETTE_PAYS)) throw new GameError("Invalid bet type");
    const amount = Number(b.amount);
    if (!Number.isInteger(amount) || amount < 1) throw new GameError("Invalid bet amount");
    const value = b.value === undefined ? undefined : Number(b.value);
    if (b.type === "straight" && !(Number.isInteger(value) && value! >= 0 && value! <= 36)) throw new GameError("Invalid number");
    if ((b.type === "dozen" || b.type === "column") && ![1, 2, 3].includes(value!)) throw new GameError("Invalid dozen/column");
    return { type: b.type, value, amount };
  });
  const total = validateBet(bets.reduce((a, b) => a + b.amount, 0), s);
  return playInstant(s, userId, "roulette", total, () => {
    let number = randInt(0, 36);
    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      const losingNumbers: number[] = [];
      for (let n = 0; n <= 36; n++) {
        const p = bets.reduce((a, b) => a + (rouletteWins(b, n) ? b.amount * ROULETTE_PAYS[b.type] : 0), 0);
        if (p === 0) losingNumbers.push(n);
      }
      if (losingNumbers.length > 0) {
        number = losingNumbers[randInt(0, losingNumbers.length - 1)];
      }
    }
    const payout = bets.reduce((a, b) => a + (rouletteWins(b, number) ? b.amount * ROULETTE_PAYS[b.type] : 0), 0);
    return { number, color: number === 0 ? "green" : ROULETTE_RED.includes(number) ? "red" : "black", bets, payout };
  });
};

// ---------------- Slots ----------------
export const slots: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "spin");
  const bet = validateBet(body.bet, s);
  const table = slotPaytable(gameRtp(s, "slots")!);
  const slotPool = table.symbols.map((sym) => ({ value: sym, weight: sym.weight }));
  return playInstant(s, userId, "slots", bet, () => {
    const checkWins = (g: (typeof table.symbols[number])[][]) => {
      const w: { line: number; symbol: string; mult: number }[] = [];
      SLOT_LINES.forEach((rows, line) => {
        const [a, b, c] = rows.map((row, col) => g[row][col]);
        if (a.id === b.id && b.id === c.id) w.push({ line, symbol: a.icon, mult: a.pay });
        else if (a.id === "cherry" && b.id === "cherry") w.push({ line, symbol: a.icon, mult: table.twoCherry });
      });
      return w;
    };

    let grid = [0, 1, 2].map(() => [0, 1, 2].map(() => pickWeighted(slotPool)));
    let wins = checkWins(grid);

    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      let attempts = 0;
      while (wins.length > 0 && attempts++ < 20) {
        grid = [0, 1, 2].map(() => [0, 1, 2].map(() => pickWeighted(slotPool)));
        wins = checkWins(grid);
      }
      if (wins.length > 0) {
        const nonCherry = table.symbols.filter((sym) => sym.id !== "cherry");
        grid[0][1] = nonCherry[0];
        grid[1][1] = nonCherry[1];
        grid[2][1] = nonCherry[2];
        wins = checkWins(grid);
      }
    }

    const totalMult = wins.reduce((sum, w) => sum + w.mult, 0);
    return { grid: grid.map((r) => r.map((sym) => sym.icon)), wins, payout: (bet * totalMult) / SLOT_LINES.length };
  });
};

// ---------------- Plinko ----------------
export const plinko: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "drop");
  const bet = validateBet(body.bet, s);
  const risk = (["low", "medium", "high"].includes(String(body.risk)) ? body.risk : "medium") as PlinkoRisk;
  const table = plinkoTable(risk, gameRtp(s, "plinko")!);
  return playInstant(s, userId, "plinko", bet, () => {
    let path = Array.from({ length: PLINKO_ROWS }, () => randInt(0, 1)); // 1 = right
    let bucket = path.reduce((a, b) => a + b, 0);

    if (lossMode === "FORCE_LOSS") {
      let minMult = Infinity;
      let minIdx = 6;
      table.forEach((m, i) => {
        if (m < minMult) { minMult = m; minIdx = i; }
      });
      path = shuffle(Array.from({ length: PLINKO_ROWS }, (_, i) => (i < minIdx ? 1 : 0)));
      bucket = path.reduce((a, b) => a + b, 0);
    } else if (lossMode === "TIGHT" && randFloat() < 0.8) {
      const lowBuckets: number[] = [];
      table.forEach((m, i) => {
        if (m <= 0.7) lowBuckets.push(i);
      });
      if (lowBuckets.length > 0) {
        const targetB = lowBuckets[randInt(0, lowBuckets.length - 1)];
        path = shuffle(Array.from({ length: PLINKO_ROWS }, (_, i) => (i < targetB ? 1 : 0)));
        bucket = path.reduce((a, b) => a + b, 0);
      }
    }

    const multiplier = table[bucket];
    return { path, bucket, multiplier, risk, payout: bet * multiplier };
  });
};

// ---------------- Keno ----------------
export const keno: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "play");
  const bet = validateBet(body.bet, s);
  const picks = Array.isArray(body.picks) ? [...new Set(body.picks.map(Number))] : [];
  if (picks.length < 1 || picks.length > 10 || picks.some((n) => !Number.isInteger(n) || n < 1 || n > 40))
    throw new GameError("Pick 1–10 numbers between 1 and 40");
  const table = kenoTable(picks.length, gameRtp(s, "keno")!);
  return playInstant(s, userId, "keno", bet, () => {
    let drawn = shuffle(Array.from({ length: 40 }, (_, i) => i + 1)).slice(0, 10);
    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      const nonPicks = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => !picks.includes(n));
      drawn = shuffle(nonPicks).slice(0, 10);
    }
    const hits = picks.filter((n) => drawn.includes(n));
    const multiplier = table[hits.length] ?? 0;
    return { picks, drawn, hits, multiplier, payout: bet * multiplier };
  });
};

// ---------------- Wheel ----------------
export const wheel: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "spin");
  const bet = validateBet(body.bet, s);
  const segments = wheelSegments(gameRtp(s, "wheel")!);
  return playInstant(s, userId, "wheel", bet, () => {
    let index = randInt(0, segments.length - 1);
    if (lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) {
      const zeroIdxs = segments.map((m, i) => (m === 0 ? i : -1)).filter((i) => i >= 0);
      if (zeroIdxs.length > 0) index = zeroIdxs[randInt(0, zeroIdxs.length - 1)];
    }
    const multiplier = segments[index];
    return { index, multiplier, payout: bet * multiplier };
  });
};

// ---------------- Baccarat (punto banco, 8 decks) ----------------
const bacVal = (c: Card) => (c.r >= 10 ? 0 : c.r);
const bacTotal = (cards: Card[]) => cards.reduce((a, c) => a + bacVal(c), 0) % 10;

function bankerDraws(bankerTotal: number, playerThird: Card | undefined): boolean {
  if (!playerThird) return bankerTotal <= 5;
  const p = bacVal(playerThird);
  switch (bankerTotal) {
    case 0: case 1: case 2: return true;
    case 3: return p !== 8;
    case 4: return p >= 2 && p <= 7;
    case 5: return p >= 4 && p <= 7;
    case 6: return p === 6 || p === 7;
    default: return false;
  }
}

export const baccarat: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "deal");
  const bet = validateBet(body.bet, s);
  const side = (["player", "banker", "tie"].includes(String(body.side)) ? body.side : "player") as keyof typeof BACCARAT_PAYS;
  return playInstant(s, userId, "baccarat", bet, () => {
    let round: { side: string; player: Card[]; banker: Card[]; playerTotal: number; bankerTotal: number; winner: string; payout: number } = {
      side, player: [], banker: [], playerTotal: 0, bankerTotal: 0, winner: "tie", payout: 0,
    };
    let attempts = 0;
    do {
      const shoe = newShoe(8);
      const player = [shoe.pop()!, shoe.pop()!];
      const banker = [shoe.pop()!, shoe.pop()!];
      const natural = bacTotal(player) >= 8 || bacTotal(banker) >= 8;
      let playerThird: Card | undefined;
      if (!natural) {
        if (bacTotal(player) <= 5) {
          playerThird = shoe.pop()!;
          player.push(playerThird);
        }
        if (bankerDraws(bacTotal(banker), playerThird)) banker.push(shoe.pop()!);
      }
      const pt = bacTotal(player), bt = bacTotal(banker);
      const winner = pt > bt ? "player" : bt > pt ? "banker" : "tie";
      let payout = 0;
      if (winner === side) payout = bet * BACCARAT_PAYS[side];
      else if (winner === "tie") payout = bet;
      round = { side, player, banker, playerTotal: pt, bankerTotal: bt, winner, payout };
      attempts++;
    } while ((lossMode === "FORCE_LOSS" || (lossMode === "TIGHT" && randFloat() < 0.8)) && round.payout > 0 && attempts < 25);
    return round;
  });
};

// ---------------- Scratch card ----------------
export const scratch: GameHandler = async (userId, action, body, s, lossMode = "NORMAL") => {
  expect(action, "buy");
  const bet = validateBet(body.bet, s);
  const prizes = scratchPrizes(gameRtp(s, "scratch")!);
  return playInstant(s, userId, "scratch", bet, () => {
    let r = randFloat();
    let prize: (typeof prizes)[number] | null = null;
    if (lossMode !== "FORCE_LOSS" && !(lossMode === "TIGHT" && randFloat() < 0.85)) {
      for (const p of prizes) {
        if (r < p.prob) { prize = p; break; }
        r -= p.prob;
      }
    }
    const others = prizes.filter((p) => p !== prize).flatMap((p) => [p.icon, p.icon]);
    const cells = prize ? [prize.icon, prize.icon, prize.icon, ...shuffle(others).slice(0, 6)] : shuffle(others).slice(0, 9);
    return { cells: shuffle(cells), prize: prize ? { icon: prize.icon, mult: prize.mult } : null, payout: prize ? bet * prize.mult : 0 };
  });
};
