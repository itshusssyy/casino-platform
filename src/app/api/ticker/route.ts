import { db } from "@/lib/db";
import { gameBySlug } from "@/lib/games/tables";
import { getSettings } from "@/lib/settings";
import { coinsToUsdLabel, usdToCoins } from "@/lib/settings-shared";

// Public feed for the header banner: active promotions + real recent big wins (names masked).
const mask = (name: string) => (name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}${"*".repeat(Math.min(4, name.length - 2))}`);

// Shared by every visitor; rebuilt at most every 30s so the banner costs ~1 DB query per 30s.
let cached: { at: number; body: { promos: string[]; winners: string[] } } | null = null;
const TTL = 30_000;

export async function GET() {
  if (cached && Date.now() - cached.at < TTL) return reply(cached.body);
  const s = await getSettings();
  const promos: string[] = [];
  if (s.signupBonusUsd > 0) promos.push(`🎁 Sign up and get $${s.signupBonusUsd} free credit (${usdToCoins(s, s.signupBonusUsd).toLocaleString()} coins)`);
  if (s.depositPromo.enabled && s.depositPromo.bonusUsd > 0)
    promos.push(`💰 Buy $${s.depositPromo.minDepositUsd}+ in coins and get $${s.depositPromo.bonusUsd} cashback`);
  const refTotal = s.referral.tiers.reduce((a, t) => a + t.rewardUsd, 0);
  if (s.referral.enabled && refTotal > 0) promos.push(`👥 Invite friends and earn up to $${refTotal} per friend`);
  promos.push(`🪙 $1 = ${s.coinsPerDollar.toLocaleString()} coins`);
  promos.push(...s.announcements);

  const bets = await db.bet.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, payout: { gte: 1000 } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { game: true, amount: true, payout: true, multiplier: true, user: { select: { firstName: true, username: true, email: true } } },
  });
  const winners = bets
    .filter((b) => b.multiplier >= 3)
    .slice(0, 15)
    .map((b) => {
      const g = gameBySlug(b.game);
      return `🏆 ${mask(b.user.firstName ?? b.user.username ?? b.user.email.split("@")[0])} won ${coinsToUsdLabel(b.payout, s.coinsPerDollar)} on ${g?.name ?? b.game} (${b.multiplier.toFixed(2)}×)`;
    });

  cached = { at: Date.now(), body: { promos, winners } };
  return reply(cached.body);
}

const reply = (body: { promos: string[]; winners: string[] }) =>
  Response.json(body, { headers: { "Cache-Control": "public, max-age=30" } });
