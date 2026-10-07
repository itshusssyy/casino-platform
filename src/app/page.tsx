import Link from "next/link";
import { GameIcon } from "@/components/GameIcon";
import { getSettings } from "@/lib/settings";
import { isGameEnabled, rtpLabel, usdToCoins } from "@/lib/settings-shared";
import { GAMES } from "@/lib/games/tables";
import { displayName, getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  const s = await getSettings();
  const games = GAMES.filter((g) => isGameEnabled(s, g.slug));

  return (
    <div className="space-y-8">
      {user ? (
        <section className="panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-black">Welcome back, {displayName(user)} 👋</h1>
            <p className="text-muted">Pick a game and good luck!</p>
          </div>
          <Link href="/wallet" className="btn-gold">🎁 Promotions & referrals</Link>
        </section>
      ) : (
        <section className="panel relative overflow-hidden p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-10 -top-10 text-[180px] opacity-10">🎰</div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
            {games.length} casino games.<br />
            <span className="bg-gradient-to-r from-gold to-amber-200 bg-clip-text text-transparent">${s.signupBonusUsd} free credit</span> on signup.
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Slots, Blackjack, Roulette, Crash, Mines, Plinko and more. Sign up in seconds and get {usdToCoins(s, s.signupBonusUsd).toLocaleString()} coins to play with.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-gold px-6 py-3 text-lg">Play now — it&apos;s free</Link>
            <Link href="/login" className="btn-ghost px-6 py-3 text-lg">I have an account</Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-bold">All games</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {games.map((g) => (
            <Link
              key={g.slug}
              href={user ? `/games/${g.slug}` : "/signup"}
              className={`@container group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${g.color} p-4 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl`}
            >
              {/* soft glow behind the icon */}
              <span className="pointer-events-none absolute left-1/2 top-[38%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 blur-2xl" />
              <span className="relative flex flex-1 items-center justify-center">
                <GameIcon slug={g.slug} size="58cqw" className="drop-shadow-[0_10px_18px_rgba(0,0,0,.45)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-110" />
              </span>
              <span className="relative text-lg font-black leading-tight text-white drop-shadow">{g.name}</span>
              <span className="relative text-xs text-white/80">{g.tagline}</span>
              <span className="relative mt-2 w-fit rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white/90">RTP {rtpLabel(s, g.slug)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
