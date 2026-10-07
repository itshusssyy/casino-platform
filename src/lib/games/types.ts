import type { Settings } from "../settings-shared";

export type GameBody = Record<string, unknown>;
export type GameHandler = (userId: string, action: string, body: GameBody, s: Settings, lossMode?: string) => Promise<unknown>;
