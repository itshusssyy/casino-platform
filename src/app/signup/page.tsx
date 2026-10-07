import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { usdToCoins } from "@/lib/settings-shared";

export const metadata = { title: "Sign up" };

// Referral links look like /signup?ref=ABCD2345
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  if (await getCurrentUser()) redirect("/");
  const { ref } = await searchParams;
  const s = await getSettings();
  const bonus = s.signupBonusUsd > 0 ? `$${s.signupBonusUsd} (${usdToCoins(s, s.signupBonusUsd).toLocaleString()} coins)` : undefined;
  return <AuthForm mode="signup" referralCode={typeof ref === "string" ? ref.toUpperCase() : undefined} signupBonus={bonus} />;
}
