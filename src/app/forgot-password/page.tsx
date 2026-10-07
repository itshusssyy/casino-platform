import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { config } from "@/lib/config";

export const metadata = { title: "Forgot password" };

// No email service is connected, so resets go through support: the customer messages
// WhatsApp, the admin clicks "Reset password" in /admin (or runs admin.reset_password in Supabase).
export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="panel space-y-4 p-6 sm:p-8">
        <h1 className="text-center text-2xl font-black">Forgot your password?</h1>
        <p className="text-sm text-muted">
          Send us your account email and our support team will reset your password and send you a temporary one.
          You can change it after logging in.
        </p>
        <ForgotPasswordForm whatsappNumber={config.whatsappNumber} />
        <p className="text-center text-sm"><Link href="/login" className="text-gold">← Back to login</Link></p>
      </div>
    </div>
  );
}
