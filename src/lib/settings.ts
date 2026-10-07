import "server-only";
import { db } from "./db";
import { DEFAULT_SETTINGS, settingsSchema, withDefaults, type Settings } from "./settings-shared";

const KEY = "site";
const TTL_MS = 5_000;
let cache: { value: Settings; at: number } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await db.setting.findUnique({ where: { key: KEY } });
  let value = DEFAULT_SETTINGS;
  if (row) {
    try {
      value = withDefaults(JSON.parse(row.value));
    } catch {
      console.error("Invalid settings JSON in DB, using defaults");
    }
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(input: unknown, adminId: string) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false as const, error: `${issue.path.join(".")}: ${issue.message}` };
  }
  const s = parsed.data;
  if (s.minBet > s.maxBet) return { ok: false as const, error: "Min bet must be ≤ max bet" };
  if (s.maxWinPerBet < s.maxBet) return { ok: false as const, error: "Max win per bet must be ≥ max bet" };
  const w = s.withdrawal;
  if (w.minUsd > w.maxPerRequestUsd || w.maxPerRequestUsd > w.maxPerDayUsd || w.maxPerDayUsd > w.maxPerWeekUsd || w.maxPerWeekUsd > w.maxPerMonthUsd)
    return { ok: false as const, error: "Withdrawal limits must be: minimum ≤ per request ≤ per day ≤ per week ≤ per month" };
  if (s.deposit.maxPerDayUsd > s.deposit.maxPerWeekUsd) return { ok: false as const, error: "Deposit limit per day must be ≤ per week" };
  s.referral.tiers.sort((a, b) => a.depositUsd - b.depositUsd);
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(s), updatedBy: adminId },
    update: { value: JSON.stringify(s), updatedBy: adminId },
  });
  cache = null;
  return { ok: true as const, settings: s };
}
