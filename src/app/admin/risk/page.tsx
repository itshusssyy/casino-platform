import Link from "next/link";
import { notFound } from "next/navigation";
import { FlagActions, RiskDashboard } from "@/components/RiskDashboard";
import { UserRiskControl } from "@/components/AdminControls";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { FLAG_INFO, type FlagType } from "@/lib/risk";

export const metadata = { title: "Risk" };

const SEVERITY_STYLE: Record<string, string> = {
  HIGH: "bg-lose/20 text-red-300 border-lose/40",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  LOW: "bg-panel-2 text-muted border-line",
};
const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export default async function RiskPage({ searchParams }: PageProps<"/admin/risk">) {
  if (!(await requireAdmin())) notFound();
  const { show } = await searchParams;
  const status = show === "closed" ? { not: "OPEN" } : "OPEN";

  const flags = await db.riskFlag.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, lossMode: true, balance: true, totalDepositCents: true } } },
  });
  flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.createdAt.getTime() - a.createdAt.getTime());

  // Names for "related accounts" links.
  const relatedIds = [...new Set(flags.flatMap((f) => (f.relatedUsers ? (JSON.parse(f.relatedUsers) as string[]) : [])))];
  const related = new Map(
    (await db.user.findMany({ where: { id: { in: relatedIds } }, select: { id: true, firstName: true, lastName: true, email: true } })).map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm text-muted hover:text-text">← Admin</Link>
        <h1 className="text-2xl font-black">Risk</h1>
      </div>

      <RiskDashboard />

      <section className="panel p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{show === "closed" ? "Reviewed flags" : `Open flags (${flags.length})`}</h2>
          <Link href={show === "closed" ? "/admin/risk" : "/admin/risk?show=closed"} className="text-sm text-gold underline">
            {show === "closed" ? "Show open flags" : "Show reviewed flags"}
          </Link>
        </div>
        {flags.length === 0 ? (
          <p className="text-sm text-muted">Nothing to review. 🎉</p>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => {
              const info = FLAG_INFO[f.type as FlagType];
              const rel = f.relatedUsers ? (JSON.parse(f.relatedUsers) as string[]) : [];
              const name = [f.user.firstName, f.user.lastName].filter(Boolean).join(" ") || f.user.email;
              return (
                <div key={f.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
                      <b className="text-sm">{info?.label ?? f.type}</b>
                      <span className="text-xs text-muted">{f.createdAt.toLocaleString()}</span>
                      {f.status !== "OPEN" && <span className="chip">{f.status}</span>}
                    </div>
                    <div className="text-sm">
                      <Link href={`/admin?q=${encodeURIComponent(f.user.id)}`} className="font-semibold hover:text-gold">{name}</Link>
                      <span className="text-muted"> · {f.user.email}{f.user.phone ? ` · ${f.user.phone}` : ""} · {f.user.status} · deposits ${(f.user.totalDepositCents / 100).toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-muted">{f.details}</p>
                    {rel.length > 0 && (
                      <p className="text-xs text-muted">
                        Linked accounts:{" "}
                        {rel.map((id, i) => (
                          <span key={id}>{i > 0 && ", "}<Link href={`/admin?q=${encodeURIComponent(id)}`} className="text-gold underline">{related.get(id) ?? id}</Link></span>
                        ))}
                      </p>
                    )}
                    {info && <p className="text-[11px] text-muted/70">{info.help}</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <UserRiskControl userId={f.user.id} initialMode={f.user.lossMode} />
                    {f.status === "OPEN" && <FlagActions id={f.id} type={f.type} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
