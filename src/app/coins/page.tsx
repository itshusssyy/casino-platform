import Link from "next/link";
import { CoinGuide } from "@/components/CoinGuide";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "How coins work" };

export default async function CoinsPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="panel space-y-4 p-5 sm:p-8">
        <h1 className="text-2xl font-black">How coins work</h1>
        <p className="text-sm text-muted">
          All games are played with coins. Every bet, win and balance on the site also shows its dollar value, so you always know what you&apos;re playing with.
        </p>
        <CoinGuide s={s} />
      </section>
      <div className="flex gap-3">
        <Link href="/" className="btn-gold flex-1">Play now</Link>
        <Link href="/wallet" className="btn-ghost flex-1">Wallet</Link>
      </div>
    </div>
  );
}
