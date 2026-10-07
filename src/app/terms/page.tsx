import { config } from "@/lib/config";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  const realMoney = config.paymentsEnabled || config.withdrawalsEnabled;
  return (
    <article className="panel mx-auto max-w-3xl space-y-4 p-6 text-sm leading-relaxed text-muted sm:p-8">
      <h1 className="text-2xl font-black text-text">Terms of use</h1>
      {realMoney ? (
        <p>
          <b className="text-text">Purchases & withdrawals.</b> Coins are bought through the payment methods shown in your wallet. Purchases are credited
          after we manually confirm your payment. Withdrawals are reviewed and paid manually, subject to the limits shown in your wallet. We may ask
          for identity verification before processing any withdrawal.
        </p>
      ) : (
        <p>
          <b className="text-text">Entertainment only.</b> {config.siteName} is a social casino. Coins are virtual, have no monetary value, and cannot be
          exchanged, sold, transferred or redeemed for cash or prizes.
        </p>
      )}
      <p><b className="text-text">Age.</b> You must be 18 or older (or the age of majority where you live) to use this site.</p>
      <p><b className="text-text">Fair play.</b> All game outcomes are generated on our servers with a cryptographically secure random number generator. Each game shows its return-to-player (RTP).</p>
      <p><b className="text-text">Accounts.</b> One account per person. We may pause or close accounts that abuse bonuses or referrals, use automation, or exploit bugs.</p>
      <p><b className="text-text">Play responsibly.</b> Only play with what you can afford to lose. If gaming stops being fun, take a break or contact support to pause your account.</p>
      <p className="text-xs">Replace this page with terms reviewed by a lawyer before launch.</p>
    </article>
  );
}
