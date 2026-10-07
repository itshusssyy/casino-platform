# Payments: Cash App / Zelle / Chime (manual, placeholder)

Everything is **switched off** right now. Players see the methods as "Coming soon".

## How it works once enabled

**Deposits (buying coins)**
1. Customer picks a coin package and Cash App, Zelle or Chime on `/wallet`.
2. The site shows your payment details, the exact amount, and a short **reference code** to put in the payment note.
3. Customer pays you, then taps **"Send payment screenshot on WhatsApp"**. The message is pre-filled with amount, method, reference and their email.
4. You check the screenshot, find the request in `/admin` → **Payment requests** (same reference), and click **Approve**.
   Coins are credited automatically, plus the $500 → $100 cashback promo and any referral rewards.

**Withdrawals**
1. Customer enters an amount (min $20, max $500 per request, max $500 per 24h by default), picks a method and enters their own $Cashtag / Zelle / $ChimeSign.
2. The coins are held immediately.
3. You send the money manually, then click **Approve** in `/admin`. **Reject** returns the coins to the customer.

## Turning it on

1. `/admin/settings` → **Payment methods**: tick **Enabled**, enter your $Cashtag / Zelle email or phone / $ChimeSign, and choose Deposits / Withdrawals.
2. In `.env` set `PAYMENTS_ENABLED=true` and/or `WITHDRAWALS_ENABLED=true`, then restart the site.
3. Limits: `/admin/settings` → **Withdrawal limits**.

## Before you turn it on

- Have the gaming license for every place you accept players from, and block the places it doesn't cover.
- Get **written approval from Cash App, Zelle (your bank) and Chime** for gaming payments. Their standard terms
  don't allow it, and accounts used this way are commonly frozen with the money inside.
- Add identity / age checks before paying withdrawals, and keep records of every payment (the `Transaction` and
  `PaymentRequest` tables already log everything).
