import { redirect } from "next/navigation";
import { BuyCoins, WithdrawForm } from "@/components/PaymentForms";
import { config, whatsappLink } from "@/lib/config";
import { db } from "@/lib/db";
import { gameBySlug } from "@/lib/games/tables";
import { CoinGuide } from "@/components/CoinGuide";
import { ReferralPanel } from "@/components/ReferralPanel";
import { METHOD_INFO } from "@/lib/payments";
import { ensureReferralCode } from "@/lib/referrals";
import { displayName, getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { withdrawableCoins } from "@/lib/wallet";
import { activeMethods, coinPackages, coinsToUsdLabel, usdToCoins } from "@/lib/settings-shared";

export const metadata = { title: "Wallet" };

const TX_LABELS: Record<string, string> = {
  SIGNUP_BONUS: "Welcome bonus", BET: "Bet", WIN: "Win", REFUND: "Refund",
  ADMIN_CREDIT: "Added by support", ADMIN_DEBIT: "Removed by support", DEPOSIT: "Coin purchase", WITHDRAWAL: "Withdrawal", PROMO_BONUS: "Deposit cashback", REFERRAL_BONUS: "Referral reward",
};

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");

  const settings = await getSettings();
  const packages = coinPackages(settings);
  const referralCode = await ensureReferralCode(user.id);
  const [transactions, bets, requests, referredCount, rewards] = await Promise.all([
    db.transaction.findMany({ where: { userId: user.id, type: { notIn: ["BET", "WIN"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.bet.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.paymentRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.user.count({ where: { referredById: user.id } }),
    db.referralReward.findMany({ where: { referrerId: user.id }, orderBy: { createdAt: "desc" }, take: 30, include: { referredUser: { select: { firstName: true, username: true, email: true } } } }),
  ]);

  const toClient = (m: { id: keyof typeof METHOD_INFO }) => ({ id: m.id, name: METHOD_INFO[m.id].name, color: METHOD_INFO[m.id].color, payoutLabel: METHOD_INFO[m.id].payoutLabel });
  const depositMethods = activeMethods(settings, "deposit").map(toClient);
  const withdrawMethods = activeMethods(settings, "withdrawal").map(toClient);
  const canBuy = config.paymentsEnabled && depositMethods.length > 0;
  const canWithdraw = config.withdrawalsEnabled && withdrawMethods.length > 0;
  const support = whatsappLink(`Hi, I need help with my account (${displayName(user)}, ${user.email})`);
  const lock = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { balance: true, bonusCoins: true, bonusWagerLeft: true, depositWagerLeft: true, signupBonusHeld: true },
  });
  const usd = (c: number) => coinsToUsdLabel(c, settings.coinsPerDollar);
  const withdrawable = withdrawableCoins(lock);
  const lockedBonus = lock.balance - withdrawable;

  return (
    <div className="space-y-6">
      <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <div className="flex-1">
          <div className="label">Your balance</div>
          <div className="font-mono text-3xl font-black text-gold sm:text-4xl">🪙 {user.balance.toLocaleString()}</div>
          <div className="text-sm text-muted">= {coinsToUsdLabel(user.balance, settings.coinsPerDollar)}</div>
        </div>
        <div className="space-y-2 text-sm sm:w-80">
          <div className="flex justify-between rounded-xl bg-panel-2 px-3 py-2">
            <span className="text-muted">Withdrawable</span>
            <b className="font-mono">🪙 {withdrawable.toLocaleString()} <span className="font-normal text-muted">({usd(withdrawable)})</span></b>
          </div>
          {lockedBonus > 0 && (
            <div className="rounded-xl bg-panel-2 px-3 py-2">
              <div className="flex justify-between">
                <span className="text-muted">Bonus (locked)</span>
                <b className="font-mono text-amber-300">🪙 {lockedBonus.toLocaleString()}</b>
              </div>
              <p className="mt-1 text-xs text-muted">Bet 🪙 {lock.bonusWagerLeft.toLocaleString()} more ({usd(lock.bonusWagerLeft)}) to unlock it.</p>
            </div>
          )}
          {lock.depositWagerLeft > 0 && (
            <p className="rounded-xl bg-panel-2 px-3 py-2 text-xs text-muted">
              Deposit play-through: bet 🪙 {lock.depositWagerLeft.toLocaleString()} more ({usd(lock.depositWagerLeft)}) before withdrawing.
            </p>
          )}
          {lock.signupBonusHeld && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Your welcome credit is being reviewed by our team.{support ? " Message support on WhatsApp if you have questions." : ""}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel space-y-4 p-6">
          <h2 className="text-lg font-bold">Get more coins</h2>
          <CoinGuide s={settings} compact />
          <a href="/coins" className="block text-xs text-gold underline">Full guide: how coins work</a>
          {settings.depositPromo.enabled && settings.depositPromo.bonusUsd > 0 && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
              🎁 <b>Promo:</b> buy ${settings.depositPromo.minDepositUsd}+ in one go and get <b className="text-gold">${settings.depositPromo.bonusUsd} cashback</b> ({usdToCoins(settings, settings.depositPromo.bonusUsd).toLocaleString()} bonus coins).
            </div>
          )}
          {canBuy ? (
            <BuyCoins packages={packages} methods={depositMethods} whatsappNumber={config.whatsappNumber} account={user.email} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {packages.map((p) => (
                  <div key={p.id} className="relative rounded-xl border border-line bg-panel-2 p-3 text-center">
                    {p.bonusPct > 0 && <span className="absolute -top-2 right-2 rounded-full bg-win px-1.5 text-[10px] font-bold text-black">+{p.bonusPct}%</span>}
                    <div className="font-mono font-bold text-gold">🪙 {p.coins.toLocaleString()}</div>
                    <div className="text-sm font-semibold">${p.priceUsd}</div>
                    <div className="text-[10px] text-muted">Coming soon</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="label">Payment methods</div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(METHOD_INFO).map((m) => (
                    <div key={m.name} className="rounded-xl border border-line bg-panel-2 px-2 py-2.5 text-center text-sm font-bold opacity-70" style={{ color: m.color }}>
                      {m.name}
                      <div className="text-[10px] font-normal text-muted">Coming soon</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                <b className="text-text">How buying coins will work:</b>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                  <li>Choose a coin package and Cash App, Zelle or Chime.</li>
                  <li>Send the payment to the account shown, with your reference in the note.</li>
                  <li>Send a screenshot of the payment to us on WhatsApp.</li>
                  <li>We add your coins as soon as we confirm the payment.</li>
                </ol>
              </div>
              <p className="text-sm text-muted">
                Coin purchases aren&apos;t available yet.{support ? " Message support on WhatsApp for help." : ""}
              </p>
              {support && <a href={support} target="_blank" rel="noopener noreferrer" className="btn w-full bg-[#25D366] text-black">💬 WhatsApp support</a>}
            </>
          )}
        </section>

        <section className="panel space-y-4 p-6">
          <h2 className="text-lg font-bold">Withdraw</h2>
          {canWithdraw ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-panel-2 p-2"><div className="text-xs text-muted">Minimum</div><b>{"$"}{settings.withdrawal.minUsd}</b></div>
                <div className="rounded-xl bg-panel-2 p-2"><div className="text-xs text-muted">Max per request</div><b>{"$"}{settings.withdrawal.maxPerRequestUsd}</b></div>
                <div className="rounded-xl bg-panel-2 p-2"><div className="text-xs text-muted">Max per 24h</div><b>{"$"}{settings.withdrawal.maxPerDayUsd}</b></div>
              </div>
              <p className="text-xs text-muted">Withdrawals are reviewed and paid manually by our team to your Cash App, Zelle or Chime account.</p>
              <WithdrawForm methods={withdrawMethods} minUsd={settings.withdrawal.minUsd} maxUsd={settings.withdrawal.maxPerRequestUsd} coinsPerDollar={settings.coinsPerDollar} />
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              Coins are for entertainment only and can&apos;t be withdrawn or exchanged for cash.
            </p>
          )}
          {requests.length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="label">Your requests</div>
              {requests.map((r) => (
                <div key={r.id} className="flex justify-between rounded-lg bg-panel-2 px-3 py-2">
                  <span>
                    {r.kind === "DEPOSIT" ? "Purchase" : "Withdrawal"} · {"$"}{(r.amountCents / 100).toFixed(2)} via {METHOD_INFO[r.provider as keyof typeof METHOD_INFO]?.name ?? r.provider}
                    {r.kind === "DEPOSIT" && r.reference ? <span className="text-muted"> · Ref {r.reference}</span> : null}
                  </span>
                  <span className={r.status === "APPROVED" ? "text-win" : r.status === "REJECTED" ? "text-red-300" : "text-gold"}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {settings.referral.enabled && (
        <section className="panel space-y-4 p-6">
          <div>
            <h2 className="text-lg font-bold">Invite friends, earn cashback</h2>
            <p className="text-sm text-muted">
              {settings.referral.tiers.map((t) => `$${t.rewardUsd} when they reach $${t.depositUsd} in purchases`).join(" · ")}. Claim rewards below; our team reviews and credits them.
            </p>
          </div>
          <ReferralPanel
            link={`${config.appUrl}/signup?ref=${referralCode}`}
            code={referralCode}
            referredCount={referredCount}
            supportLink={whatsappLink(`Hi, I claimed a referral reward (${displayName(user)})`)}
            rewards={rewards.map((r) => ({
              id: r.id,
              referred: r.referredUser.firstName ?? r.referredUser.username ?? r.referredUser.email.split("@")[0],
              tierUsd: r.tierCents / 100,
              rewardUsd: r.rewardCents / 100,
              coins: r.coins,
              status: r.status,
            }))}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-3 text-lg font-bold">Recent bets</h2>
          {bets.length === 0 ? <p className="text-sm text-muted">No bets yet.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="pb-2">Game</th><th>Bet</th><th>Multi</th><th className="text-right">Payout</th></tr></thead>
              <tbody>
                {bets.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="py-1.5">{gameBySlug(b.game)?.emoji} {gameBySlug(b.game)?.name ?? b.game}</td>
                    <td className="font-mono">{b.amount.toLocaleString()}</td>
                    <td className="font-mono">{b.multiplier.toFixed(2)}×</td>
                    <td className={`text-right font-mono ${b.payout > b.amount ? "text-win" : b.payout === 0 ? "text-red-300" : ""}`}>{b.payout.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel p-6">
          <h2 className="mb-3 text-lg font-bold">Bonuses & adjustments</h2>
          {transactions.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-line first:border-0">
                    <td className="py-1.5">{TX_LABELS[t.type] ?? t.type}{t.note && (t.type.startsWith("ADMIN") || t.type.endsWith("_BONUS")) ? <span className="text-muted"> — {t.note}</span> : null}</td>
                    <td className="text-xs text-muted">{t.createdAt.toLocaleDateString()}</td>
                    <td className={`text-right font-mono ${t.amount > 0 ? "text-win" : "text-red-300"}`}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
