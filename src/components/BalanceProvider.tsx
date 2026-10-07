"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { coinsToUsdLabel } from "@/lib/settings-shared";

type Ctx = { balance: number; setBalance: (b: number) => void; coinsPerDollar: number };
const BalanceContext = createContext<Ctx | null>(null);

export function BalanceProvider({ initial, coinsPerDollar, children }: { initial: number; coinsPerDollar: number; children: ReactNode }) {
  const [balance, setBalance] = useState(initial);
  return <BalanceContext value={{ balance, setBalance, coinsPerDollar }}>{children}</BalanceContext>;
}

export function useBalance() {
  const ctx = useContext(BalanceContext);
  if (!ctx) throw new Error("useBalance must be used inside BalanceProvider");
  return ctx;
}

/** Formats coins as dollars at the site's current rate. */
export function useUsd() {
  const { coinsPerDollar } = useBalance();
  return (coins: number) => coinsToUsdLabel(coins, coinsPerDollar);
}

export function BalanceBadge() {
  const { balance } = useBalance();
  const usd = useUsd();
  return (
    <span className="flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono font-bold text-gold sm:px-3 sm:py-1.5">
      <span>🪙</span>
      <span className="flex flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
        <span className="text-sm">{balance.toLocaleString()}</span>
        <span className="text-[11px] font-semibold text-gold/70 sm:text-xs">{usd(balance)}</span>
      </span>
    </span>
  );
}
