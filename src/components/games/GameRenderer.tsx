"use client";

import type { ComponentType } from "react";
import type { GameClientSettings } from "@/lib/settings-shared";
import Baccarat from "./Baccarat";
import Blackjack from "./Blackjack";
import CoinFlip from "./CoinFlip";
import Crash from "./Crash";
import Dice from "./Dice";
import HiLo from "./HiLo";
import Keno from "./Keno";
import Limbo from "./Limbo";
import Mines from "./Mines";
import Plinko from "./Plinko";
import Roulette from "./Roulette";
import Scratch from "./Scratch";
import Slots from "./Slots";
import VideoPoker from "./VideoPoker";
import Wheel from "./Wheel";

const COMPONENTS: Record<string, ComponentType<{ cfg: GameClientSettings }>> = {
  slots: Slots,
  blackjack: Blackjack,
  roulette: Roulette,
  crash: Crash,
  mines: Mines,
  plinko: Plinko,
  dice: Dice,
  keno: Keno,
  baccarat: Baccarat,
  "video-poker": VideoPoker,
  hilo: HiLo,
  wheel: Wheel,
  coinflip: CoinFlip,
  limbo: Limbo,
  scratch: Scratch,
};

export function GameRenderer({ slug, cfg }: { slug: string; cfg: GameClientSettings }) {
  const Game = COMPONENTS[slug];
  return Game ? <Game cfg={cfg} /> : null;
}
