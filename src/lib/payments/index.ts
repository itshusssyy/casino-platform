// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENTS (manual, placeholder)
//  Customers pay you directly via Cash App / Zelle / Chime, send a screenshot on
//  WhatsApp, and you approve the request in /admin. Withdrawals are paid out by
//  you manually, then marked approved.
//
//  Everything stays OFF until:
//    1. PAYMENTS_ENABLED / WITHDRAWALS_ENABLED are "true" in .env, and
//    2. a method is enabled with your payment details in /admin/settings.
//  Read ./README.md before enabling anything.
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_METHOD_IDS = ["cashapp", "zelle", "chime"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export const METHOD_INFO: Record<PaymentMethodId, { name: string; detailsLabel: string; detailsExample: string; payoutLabel: string; color: string }> = {
  cashapp: { name: "Cash App", detailsLabel: "Your $Cashtag", detailsExample: "$YourCashtag", payoutLabel: "Your $Cashtag", color: "#00D632" },
  zelle: { name: "Zelle", detailsLabel: "Zelle email or phone (and name)", detailsExample: "pay@yourbusiness.com (Your Name)", payoutLabel: "Your Zelle email or phone", color: "#6D1ED4" },
  chime: { name: "Chime", detailsLabel: "Your $ChimeSign", detailsExample: "$YourChimeSign", payoutLabel: "Your $ChimeSign or phone", color: "#1EC677" },
};

export type PaymentMethodConfig = {
  id: PaymentMethodId;
  enabled: boolean;
  details: string; // where customers send money, e.g. "$CasinoPlayersClub"
  deposit: boolean;
  withdrawal: boolean;
};

/** Short code customers put in the payment note so you can match the screenshot to the request. */
export const paymentReference = (requestId: string) => requestId.slice(-8).toUpperCase();

/** Customer-facing deposit instructions (English). */
export function depositInstructions(methodId: PaymentMethodId, details: string, amountUsd: number, reference: string) {
  const m = METHOD_INFO[methodId];
  return [
    `Send exactly $${amountUsd.toFixed(2)} via ${m.name} to: ${details}`,
    `Write this reference in the payment note: ${reference}`,
    "Take a screenshot of the completed payment and send it to us on WhatsApp.",
    "Your coins are added as soon as we confirm the payment.",
  ];
}
