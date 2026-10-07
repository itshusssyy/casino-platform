import Link from "next/link";
import { notFound } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  if (!(await requireAdmin())) notFound();
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-sm text-muted hover:text-text">← Admin</Link>
        <h1 className="text-2xl font-black">Settings</h1>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
