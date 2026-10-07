import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { depositInstructions, METHOD_INFO, paymentReference } from "@/lib/payments";
import { getCurrentUser, PAUSED_MESSAGE } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { activeMethods, coinPackages } from "@/lib/settings-shared";

// Customer starts a coin purchase. They pay you manually (Cash App / Zelle / Chime), send the
// screenshot on WhatsApp, and you approve the request in /admin → coins (+ promos) are credited.
export async function POST(req: Request) {
  if (!config.paymentsEnabled) return Response.json({ error: "Coin purchases are not available yet" }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in" }, { status: 401 });
  if (user.status === "PAUSED") return Response.json({ error: PAUSED_MESSAGE }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  const method = activeMethods(settings, "deposit").find((m) => m.id === body.method);
  const pkg = coinPackages(settings).find((p) => p.id === body.packageId);
  if (!method) return Response.json({ error: "Payment method not available" }, { status: 400 });
  if (!pkg) return Response.json({ error: "Invalid package" }, { status: 400 });

  // Velocity limits: pending requests, and $ per day / week (pending + approved).
  const dep = settings.deposit;
  const pending = await db.paymentRequest.count({ where: { userId: user.id, status: "PENDING", kind: "DEPOSIT" } });
  if (pending >= dep.maxPending)
    return Response.json({ error: `You already have ${pending} pending purchase(s). Please wait until they are confirmed.` }, { status: 400 });
  const sumSince = async (days: number) =>
    (await db.paymentRequest.aggregate({
      where: { userId: user.id, kind: "DEPOSIT", status: { not: "REJECTED" }, createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
      _sum: { amountCents: true },
    }))._sum.amountCents ?? 0;
  const [dayCents, weekCents] = await Promise.all([sumSince(1), sumSince(7)]);
  if (dayCents + pkg.priceCents > dep.maxPerDayUsd * 100)
    return Response.json({ error: `Daily purchase limit is $${dep.maxPerDayUsd}. You can still buy $${Math.max(0, dep.maxPerDayUsd - dayCents / 100).toFixed(2)} today.` }, { status: 400 });
  if (weekCents + pkg.priceCents > dep.maxPerWeekUsd * 100)
    return Response.json({ error: `Weekly purchase limit is $${dep.maxPerWeekUsd}. You can still buy $${Math.max(0, dep.maxPerWeekUsd - weekCents / 100).toFixed(2)} this week.` }, { status: 400 });

  const request = await db.paymentRequest.create({
    data: { userId: user.id, kind: "DEPOSIT", provider: method.id, amountCents: pkg.priceCents, coins: pkg.coins },
  });
  const reference = paymentReference(request.id);
  await db.paymentRequest.update({ where: { id: request.id }, data: { reference } });

  return Response.json({
    id: request.id,
    reference,
    method: METHOD_INFO[method.id].name,
    details: method.details,
    amountUsd: pkg.priceUsd,
    coins: pkg.coins,
    instructions: depositInstructions(method.id, method.details, pkg.priceUsd, reference),
  });
}
