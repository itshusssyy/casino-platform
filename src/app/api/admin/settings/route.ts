import { forbidden, requireAdmin } from "@/lib/admin";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  return Response.json(await getSettings());
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  const result = await saveSettings(await req.json().catch(() => null), admin.id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.settings);
}
