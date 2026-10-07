import type { Settings } from "@/lib/settings-shared";
import { coinsToUsdLabel, usdToCoins } from "@/lib/settings-shared";

/** Dollar ↔ coin rate guide shown on /coins and the wallet page. */
export function CoinGuide({ s, compact = false }: { s: Settings; compact?: boolean }) {
  const rows = [1, 5, 10, 25, 50, 100, 500];
  const usd = (coins: number) => coinsToUsdLabel(coins, s.coinsPerDollar);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
        <span className="text-2xl font-black text-text sm:text-3xl">$1</span>
        <span className="text-xl text-muted">=</span>
        <span className="text-2xl font-black text-gold sm:text-3xl">🪙 {s.coinsPerDollar.toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.slice(0, compact ? 4 : rows.length).map((d) => (
          <div key={d} className="rounded-xl bg-panel-2 px-3 py-2 text-center">
            <div className="text-sm font-bold">${d}</div>
            <div className="font-mono text-sm text-gold">🪙 {usdToCoins(s, d).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {!compact && (
        <ul className="space-y-1.5 text-sm text-muted">
          {s.signupBonusUsd > 0 && (
            <li>🎁 <b className="text-text">Signup credit:</b> ${s.signupBonusUsd} = 🪙 {usdToCoins(s, s.signupBonusUsd).toLocaleString()} coins</li>
          )}
          <li>🎲 <b className="text-text">Bets:</b> from 🪙 {s.minBet.toLocaleString()} ({usd(s.minBet)}) up to 🪙 {s.maxBet.toLocaleString()} ({usd(s.maxBet)}) per round</li>
          <li>🏆 <b className="text-text">Max win per round:</b> 🪙 {s.maxWinPerBet.toLocaleString()} ({usd(s.maxWinPerBet)})</li>
          <li>📈 <b className="text-text">Example:</b> a 🪙 {usdToCoins(s, 1).toLocaleString()} ({usd(usdToCoins(s, 1))}) bet that wins 2× pays 🪙 {usdToCoins(s, 2).toLocaleString()} ({usd(usdToCoins(s, 2))})</li>
          {s.depositPromo.enabled && s.depositPromo.bonusUsd > 0 && (
            <li>💰 <b className="text-text">Cashback:</b> buy ${s.depositPromo.minDepositUsd}+ and get ${s.depositPromo.bonusUsd} = 🪙 {usdToCoins(s, s.depositPromo.bonusUsd).toLocaleString()} extra</li>
          )}
          <li>💵 <b className="text-text">Withdrawals:</b> ${s.withdrawal.minUsd} to ${s.withdrawal.maxPerRequestUsd} per request (max ${s.withdrawal.maxPerDayUsd} per day), when available</li>
        </ul>
      )}
    </div>
  );
}
