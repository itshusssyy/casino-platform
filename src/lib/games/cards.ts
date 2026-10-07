import { randInt, shuffle } from "../rng";
import type { Card } from "./tables";

export function newShoe(decks = 1): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++)
    for (let s = 0; s < 4; s++)
      for (let r = 1; r <= 13; r++) cards.push({ r, s });
  return shuffle(cards);
}

/** A random card from an infinite deck (used by Hi-Lo). */
export function randomCard(): Card {
  return { r: randInt(1, 13), s: randInt(0, 3) };
}
