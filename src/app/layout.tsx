import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BalanceBadge, BalanceProvider } from "@/components/BalanceProvider";
import { LogoutButton } from "@/components/LogoutButton";
import { TickerBanner } from "@/components/TickerBanner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { config } from "@/lib/config";
import { displayName, getCurrentUser, PAUSED_MESSAGE } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: config.siteName,
  description: "Play 15 casino games. $10 free credit on signup.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BalanceProvider initial={user?.balance ?? 0} coinsPerDollar={settings.coinsPerDollar}>
          <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
              <Link href="/" className="flex min-w-0 items-center gap-1.5 text-[15px] font-black leading-tight tracking-tight sm:gap-2 sm:text-lg">
                <span className="text-xl sm:text-2xl">👑</span>
                <span className="bg-gradient-to-r from-gold to-amber-200 bg-clip-text text-transparent">{config.siteName}</span>
              </Link>
              {user && (
                <nav className="hidden gap-4 text-sm text-muted md:flex">
                  <Link href="/" className="hover:text-text">Games</Link>
                  <Link href="/wallet" className="hover:text-text">Wallet</Link>
                  <Link href="/account" className="hover:text-text">Account</Link>
                  {user.role === "ADMIN" && <Link href="/admin" className="text-gold hover:text-amber-200">Admin</Link>}
                </nav>
              )}
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                {user ? (
                  <>
                    <Link href="/wallet"><BalanceBadge /></Link>
                    <Link href="/account" className="hidden text-sm hover:text-gold sm:inline">{displayName(user)}</Link>
                    <LogoutButton />
                  </>
                ) : (
                  <>
                    <Link href="/login" className="btn-ghost whitespace-nowrap px-3 py-2 text-sm">Log in</Link>
                    <Link href="/signup" className="btn-gold whitespace-nowrap px-3 py-2 text-sm">Sign up</Link>
                  </>
                )}
              </div>
            </div>
            {user && (
              <nav className="flex justify-around border-t border-line py-2 text-sm text-muted md:hidden">
                <Link href="/">Games</Link>
                <Link href="/wallet">Wallet</Link>
                <Link href="/account">Account</Link>
                {user.role === "ADMIN" && <Link href="/admin" className="text-gold">Admin</Link>}
              </nav>
            )}
            <TickerBanner />
          </header>
          {user?.status === "PAUSED" && (
            <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200">
              ⏸ {PAUSED_MESSAGE}{user.statusNote ? ` Reason: ${user.statusNote}` : ""}
            </div>
          )}

          <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6">{children}</main>

          <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
            <p>
              {config.siteName} · 18+ only · Play responsibly.{config.withdrawalsEnabled ? " " : " Coins are for entertainment only. "}
              <Link href="/coins" className="underline">How coins work</Link> · <Link href="/terms" className="underline">Terms</Link>
            </p>
          </footer>
          <WhatsAppButton />
        </BalanceProvider>
      </body>
    </html>
  );
}
