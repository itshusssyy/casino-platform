import { forbidden, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { credit, debit } from "@/lib/wallet";

// Manually add (+) or remove (-) coins from a user's balance.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const amount = Number(body.amount);
  const note = String(body.note ?? "").slice(0, 200) || null;
  if (!userId || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000_000)
    return Response.json({ error: "Enter a non-zero whole number" }, { status: 400 });

  try {
    const balance = await db.$transaction((tx) =>
      amount > 0
        ? credit(tx, userId, amount, "ADMIN_CREDIT", note ?? undefined, admin.id)
        : debit(tx, userId, -amount, "ADMIN_DEBIT", note ?? undefined, admin.id),
    );
    return Response.json({ balance });
  } catch (err) {
    return errorResponse(err);
  }
}
