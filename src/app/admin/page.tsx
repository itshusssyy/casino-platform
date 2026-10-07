import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustBalance, ReviewPayment } from "@/components/AdminControls";
import { requireAdmin } from "@/lib/admin";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { gameBySlug } from "@/lib/games/tables";
import { METHOD_INFO } from "@/lib/payments";
import { openFlagCounts } from "@/lib/risk";
import { getSettings } from "@/lib/settings";
import { coinsToUsdLabel } from "@/lib/settings-shared";

export const metadata = { title: "Admin" };

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="panel p-4"><div className="label">{label}</div><div className="font-mono text-2xl font-black">{value}</div></div>;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const since = hoursAgo(24);

  const [userCount, coins, bets24, users, pending, perGame, recentAdmin, referralClaims] = await Promise.all([
    db.user.count(),
    db.user.aggregate({ _sum: { balance: true } }),
    db.bet.aggregate({ where: { createdAt: { gte: since } }, _sum: { amount: true, payout: true }, _count: true }),
    db.user.findMany({
      where: query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { username: { contains: query, mode: "insensitive" } }, { firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }, { phone: { contains: query.replace(/[^\d+]/g, "") || query } }, { id: query }, { referralCode: query.toUpperCase() }] } : undefined,
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.paymentRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { user: { select: { email: true, username: true, firstName: true, lastName: true, phone: true } } } }),
    db.bet.groupBy({ by: ["game"], where: { createdAt: { gte: since } }, _sum: { amount: true, payout: true }, _count: true }),
    db.transaction.findMany({ where: { type: { startsWith: "ADMIN" } }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { email: true } } } }),
    db.referralReward.findMany({
      where: { status: "CLAIM_REQUESTED" },
      orderBy: { claimedAt: "asc" },
      include: { referrer: { select: { email: true, username: true, firstName: true } }, referredUser: { select: { email: true, username: true, firstName: true, totalDepositCents: true } } },
    }),
  ]);

  const wagered = bets24._sum.amount ?? 0;
  const houseProfit = wagered - (bets24._sum.payout ?? 0);
  const settings = await getSettings();
  const usd = (coins: number) => coinsToUsdLabel(coins, settings.coinsPerDollar);
  const [flagCounts, openFlags] = await Promise.all([
    openFlagCounts([...new Set([...pending.map((r) => r.userId), ...users.map((u) => u.id)])]),
    db.riskFlag.groupBy({ by: ["severity"], where: { status: "OPEN" }, _count: true }),
  ]);
  const highFlags = openFlags.find((f) => f.severity === "HIGH")?._count ?? 0;
  const totalFlags = openFlags.reduce((a, f) => a + f._count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Admin panel</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/risk" className={highFlags ? "btn-red" : "btn-ghost"}>🛡️ Risk dashboard{totalFlags ? ` (${totalFlags} flag${totalFlags > 1 ? "s" : ""})` : ""}</Link>
          <Link href="/admin/settings" className="btn-gold">⚙️ Settings</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Users" value={userCount.toLocaleString()} />
        <Stat label="Player balances" value={usd(coins._sum.balance ?? 0)} />
        <Stat label="Bets (24h)" value={bets24._count.toLocaleString()} />
        <Stat label="Wagered (24h)" value={usd(wagered)} />
        <Stat label="House result (24h)" value={usd(houseProfit)} />
      </div>

      <section className="panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Users</h2>
          <form className="flex gap-2">
            <input name="q" defaultValue={query} placeholder="Search name / email / phone / ID" className="input w-64 py-2" />
            <button className="btn-ghost py-2">Search</button>
          </form>
        </div>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className={`flex flex-col gap-2 rounded-xl border border-line p-3 lg:flex-row lg:items-center ${u.status !== "ACTIVE" ? "opacity-70" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—"} {u.role === "ADMIN" && <span className="chip ml-1 text-gold">ADMIN</span>} {u.status !== "ACTIVE" && <span className={`chip ml-1 ${u.status === "FROZEN" ? "text-red-300" : "text-amber-300"}`}>{u.status}</span>}
                </div>
                <div className="truncate text-xs text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""} · joined {u.createdAt.toLocaleDateString()} · <span className="font-mono">{u.id}</span></div>
              </div>
              <div className="lg:w-44 lg:text-right">
                <div className="font-mono text-lg font-bold text-gold">🪙 {u.balance.toLocaleString()}</div>
                <div className="text-xs text-muted">
                  {usd(u.balance)}
                  {u.bonusWagerLeft > 0 && u.bonusCoins > 0 ? ` · ${Math.min(u.bonusCoins, u.balance).toLocaleString()} bonus locked` : ""}
                  {u.signupBonusHeld ? " · credit held" : ""}
                </div>
                {flagCounts.get(u.id) && (
                  <Link href="/admin/risk" className={`text-xs font-semibold ${flagCounts.get(u.id)!.high ? "text-red-300" : "text-amber-300"}`}>
                    ⚠ {flagCounts.get(u.id)!.total} risk flag(s)
                  </Link>
                )}
              </div>
              <AdjustBalance userId={u.id} status={u.status} lossMode={u.lossMode} />
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-muted">No users found.</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-1 text-lg font-bold">Payment requests</h2>
          <p className="mb-3 text-xs text-muted">
            Purchases: {config.paymentsEnabled ? "ON" : "OFF"} · Withdrawals: {config.withdrawalsEnabled ? "ON" : "OFF"} (see src/lib/payments/README.md)
          </p>
          {pending.length === 0 ? <p className="text-sm text-muted">No pending requests.</p> : (
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                  <div>
                    <b className={r.kind === "DEPOSIT" ? "text-win" : "text-amber-300"}>{r.kind === "DEPOSIT" ? "Deposit" : "Withdrawal"}</b> · <b>${(r.amountCents / 100).toFixed(2)}</b> via {METHOD_INFO[r.provider as keyof typeof METHOD_INFO]?.name ?? r.provider} · 🪙 {r.coins.toLocaleString()}
                    <div className="text-xs text-muted">
                      {[r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || r.user.username} · {r.user.email}{r.user.phone ? ` · ${r.user.phone}` : ""}
                    </div>
                    {flagCounts.get(r.userId) && (
                      <Link href="/admin/risk" className={`mt-1 block text-xs font-bold ${flagCounts.get(r.userId)!.high ? "text-red-300" : "text-amber-300"}`}>
                        ⚠ This user has {flagCounts.get(r.userId)!.total} open risk flag(s){flagCounts.get(r.userId)!.high ? ` (${flagCounts.get(r.userId)!.high} high)` : ""}. Review before approving.
                      </Link>
                    )}
                    <div className="text-xs">
                      {r.kind === "DEPOSIT"
                        ? <>Payment note reference: <b className="font-mono text-gold">{r.reference}</b>. Check the WhatsApp screenshot before approving.</>
                        : <>Send the money to: <b className="font-mono text-gold">{r.reference}</b>, then Approve (Reject refunds the coins).</>}
                    </div>
                  </div>
                  <ReviewPayment id={r.id} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="mb-3 text-lg font-bold">Games (24h)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="pb-2">Game</th><th>Rounds</th><th>Wagered</th><th className="text-right">House</th></tr></thead>
            <tbody>
              {perGame.map((g) => {
                const house = (g._sum.amount ?? 0) - (g._sum.payout ?? 0);
                return (
                  <tr key={g.game} className="border-t border-line">
                    <td className="py-1.5">{gameBySlug(g.game)?.emoji} {gameBySlug(g.game)?.name ?? g.game}</td>
                    <td className="font-mono">{g._count}</td>
                    <td className="font-mono">{(g._sum.amount ?? 0).toLocaleString()}</td>
                    <td className={`text-right font-mono ${house >= 0 ? "text-win" : "text-red-300"}`}>{house.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {perGame.length === 0 && <p className="text-sm text-muted">No bets in the last 24h.</p>}
        </section>
      </div>

      <section className="panel p-6">
        <h2 className="mb-1 text-lg font-bold">Referral reward claims</h2>
        <p className="mb-3 text-xs text-muted">Approving credits the coins to the referrer.</p>
        {referralClaims.length === 0 ? <p className="text-sm text-muted">No claims waiting.</p> : (
          <div className="space-y-2">
            {referralClaims.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                <div>
                  <b>{r.referrer.firstName ?? r.referrer.username ?? r.referrer.email}</b> referred <b>{r.referredUser.firstName ?? r.referredUser.username ?? r.referredUser.email}</b>
                  <div className="text-xs text-muted">
                    Tier ${r.tierCents / 100} reached (total deposits ${(r.referredUser.totalDepositCents / 100).toFixed(2)}) · reward ${(r.rewardCents / 100).toFixed(2)} = 🪙 {r.coins.toLocaleString()}
                  </div>
                </div>
                <ReviewPayment id={r.id} base="/api/admin/referrals" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="mb-3 text-lg font-bold">Recent manual adjustments</h2>
        {recentAdmin.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {recentAdmin.map((t) => (
                <tr key={t.id} className="border-t border-line first:border-0">
                  <td className="py-1.5">{t.user.email}</td>
                  <td className="text-muted">{t.note ?? ""}</td>
                  <td className="text-xs text-muted">{t.createdAt.toLocaleString()}</td>
                  <td className={`text-right font-mono ${t.amount > 0 ? "text-win" : "text-red-300"}`}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
