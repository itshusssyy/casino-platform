import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { whatsappLink } from "@/lib/config";
import { fullName, getCurrentUser } from "@/lib/session";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const support = whatsappLink(`Hi, I want to update my account details (${user.email})`);

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <section className="panel space-y-3 p-6">
        <h1 className="text-xl font-black">My account</h1>
        <dl className="space-y-2 text-sm">
          <div><dt className="label">Name</dt><dd>{fullName(user) || user.username || "—"}</dd></div>
          <div><dt className="label">Email</dt><dd>{user.email}</dd></div>
          <div><dt className="label">Phone</dt><dd className="font-mono">{user.phone ?? "—"}</dd></div>
          <div><dt className="label">Status</dt><dd>{user.status}</dd></div>
        </dl>
        <p className="text-xs text-muted">
          To change your name, email or phone, contact support{support ? "" : "."}
          {support && <> on <a href={support} target="_blank" rel="noopener noreferrer" className="text-gold underline">WhatsApp</a>.</>}
        </p>
      </section>
      <section className="panel space-y-3 p-6">
        <h2 className="text-lg font-bold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
