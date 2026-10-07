import "server-only";
import { blackjack } from "./blackjack";
import { crash } from "./crash";
import { hilo } from "./hilo";
import { baccarat, coinflip, dice, keno, limbo, plinko, roulette, scratch, slots, wheel } from "./instant";
import { mines } from "./mines";
import type { GameHandler } from "./types";
import { videoPoker } from "./video-poker";

export const gameHandlers: Record<string, GameHandler> = {
  slots,
  blackjack,
  roulette,
  crash,
  mines,
  plinko,
  dice,
  keno,
  baccarat,
  "video-poker": videoPoker,
  hilo,
  wheel,
  coinflip,
  limbo,
  scratch,
};
