# Casino Players Club

15 casino games with server-side logic. Signup with first/last name, phone (country code), email and password, plus a **$10 signup credit**, referral program,
deposit cashback promo, admin panel, Supabase management, WhatsApp support, scrolling promo/winners banner,
and a **disabled placeholder** for payments.

## Games (server-side logic, crypto RNG)

RTP = % of wagers paid back over the long run. House edge = 100% − RTP. RTP is set per game in
**/admin/settings** (80–99%). Players see the RTP you set, and payout tables update to match.

| Game | Default RTP | Adjustable |
|---|---|---|
| Lucky Slots | 95% | ✓ |
| Blackjack | ≈99% (6 decks, S17, BJ 3:2, double, no split) | fixed rules |
| Roulette | 97.3% (European) | fixed rules |
| Crash | 99% | ✓ |
| Mines | 99% | ✓ |
| Plinko | 99% | ✓ |
| Dice | 99% | ✓ |
| Keno | 95% | ✓ |
| Baccarat | ≈98.9% | fixed rules |
| Video Poker | 99.5% (Jacks or Better 9/6) | fixed rules |
| Hi-Lo | 99% | ✓ |
| Fortune Wheel | 97% | ✓ |
| Coin Flip | 98% | ✓ |
| Limbo | 99% | ✓ |
| Scratch Card | 94% | ✓ |

Outcomes are decided on the server (`src/lib/games/`). Decks, mine positions and crash points never reach the
browser. Every bet is one DB transaction: debit, then outcome, then payout (capped at *max win per bet*), then ledger.
`npm run rtp-check` verifies mathematically that no game pays more than its configured RTP.

## Setup

```bash
npm install
cp .env.example .env        # set AUTH_SECRET
```

Database: local or Supabase.

- **Local (no install):** run `npm run db:local` in one terminal, keep it open.
- **Supabase:** follow [supabase/README.md](supabase/README.md).

```bash
npm run supabase:setup
```

```bash
npm run dev
```

Make yourself admin (sign up on the site first):

```bash
npm run make-admin -- you@example.com
```

## Admin

- **/admin**: users (search, add/remove coins, Pause / Freeze / Activate), payment requests, referral claims, stats.
- **/admin/settings**:
  - coin price ($1 = N coins), signup credit, coin packages
  - $500 → $100 deposit cashback promo
  - referral tiers ($250 → $25, $500 → $25 more)
  - withdrawal limits (min / per request / per day)
  - banner messages
  - min/max bet, max win per bet
  - per-game RTP and on/off
- **Supabase:** same controls from the dashboard. See [supabase/README.md](supabase/README.md).

## Passwords

- Customers log in with **email or phone**. Logged-in customers change their password at **/account**.
- **Forgot password?** on the login page opens WhatsApp support with their email pre-filled.
- You reset it in **/admin → Reset password** (shows a temporary password to send them), or in Supabase:
  `select admin.reset_password('their@email.com', 'NewPass2024');`
- A reset logs the customer out on every device.

## Account status

| Status | Can log in | Can play / claim / request payouts |
|---|---|---|
| ACTIVE | ✓ | ✓ |
| PAUSED | ✓ (sees a notice with your reason) | ✗ |
| FROZEN | ✗ (logged out immediately) | ✗ |

## Promotions & referrals

- **Signup credit:** $10 → coins at your coin price, credited on signup.
- **Deposit cashback:** a single approved deposit ≥ $500 auto-credits $100 in coins.
- **Referrals:** every user has a link (`/signup?ref=CODE`) on their wallet page. When the friend's total approved
  deposits reach a tier, the referrer gets a reward → clicks **Claim** → you approve in /admin → coins credited.

Deposit-based promos only trigger once payments are enabled (see below).

## WhatsApp

Set `NEXT_PUBLIC_WHATSAPP_NUMBER` (international format without `+`, e.g. `15551234567`).

## Payments & withdrawals (placeholder)

Off by default. Read [src/lib/payments/README.md](src/lib/payments/README.md) before enabling anything.

## Tests

```bash
npm run rtp-check
```

```bash
npm run smoke-test
```

The smoke test needs the database and `npm run dev` running. It plays every game and tests settings, promos,
referrals, pause/freeze and the Supabase SQL functions.

## Going live

- Supabase for the database; deploy the site to Vercel with all `.env` values (`APP_URL` = your domain).
- Replace `/terms` with lawyer-reviewed terms.
- The rate limiter is in-memory; use Redis (e.g. Upstash) if you run more than one server.
