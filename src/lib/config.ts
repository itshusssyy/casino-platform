const bool = (v: string | undefined) => v === "true" || v === "1";

export const config = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Casino Players Club",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  // Real-money features stay off until licensed. See src/lib/payments/README.md
  paymentsEnabled: bool(process.env.PAYMENTS_ENABLED),
  withdrawalsEnabled: bool(process.env.WITHDRAWALS_ENABLED),
};

export function whatsappLink(text?: string) {
  if (!config.whatsappNumber) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${config.whatsappNumber}${q}`;
}
