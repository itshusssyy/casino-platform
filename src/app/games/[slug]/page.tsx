import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GameIcon } from "@/components/GameIcon";
import { GameRenderer } from "@/components/games/GameRenderer";
import { gameBySlug, GAMES } from "@/lib/games/tables";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { coinsToUsdLabel, gameRtp, isGameEnabled, rtpLabel } from "@/lib/settings-shared";

export async function generateMetadata({ params }: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  return { title: gameBySlug(slug)?.name ?? "Game" };
}

export default async function GamePage({ params }: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = gameBySlug(slug);
  if (!game) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/games/${slug}`);
  const s = await getSettings();
  const enabled = isGameEnabled(s, slug);
  const usd = (coins: number) => coinsToUsdLabel(coins, s.coinsPerDollar);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Link href="/" className="text-sm text-muted hover:text-text">← Lobby</Link>
        <h1 className="flex items-center gap-2 text-2xl font-black"><GameIcon slug={slug} size={34} /> {game.name}</h1>
        <span className="chip">RTP {rtpLabel(s, slug)}</span>
        <span className="chip">Bet {usd(s.minBet)}–{usd(s.maxBet)}</span>
        <span className="chip">Max win {usd(s.maxWinPerBet)}</span>
        <Link href="/coins" className="chip text-gold">$1 = 🪙 {s.coinsPerDollar.toLocaleString()}</Link>
      </div>
      {enabled ? (
        <GameRenderer slug={slug} cfg={{ rtp: gameRtp(s, slug) ?? 0.99, minBet: s.minBet, maxBet: s.maxBet, maxWinPerBet: s.maxWinPerBet }} />
      ) : (
        <div className="panel p-10 text-center text-muted">This game is temporarily unavailable. Please try another one.</div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2 pt-4">
        {GAMES.filter((g) => g.slug !== slug && isGameEnabled(s, g.slug)).map((g) => (
          <Link key={g.slug} href={`/games/${g.slug}`} className="chip flex shrink-0 items-center gap-1.5 whitespace-nowrap hover:border-gold"><GameIcon slug={g.slug} size={16} /> {g.name}</Link>
        ))}
      </div>
    </div>
  );
}
