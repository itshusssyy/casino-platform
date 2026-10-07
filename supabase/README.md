# Supabase setup

Project: `yckdgfeznlzoawlqmgbd` (https://yckdgfeznlzoawlqmgbd.supabase.co)

The website connects to Supabase's **Postgres database** directly from the server.
That needs the **database connection string**, not the publishable/anon key. The publishable key
is for browser apps; this site doesn't use it, and `setup.sql` blocks it from reading anything.

## 1. Get the connection strings (2 minutes)

1. Open https://supabase.com/dashboard/project/yckdgfeznlzoawlqmgbd
2. Click **Connect** (top bar) → **ORMs** tab → choose **Prisma**.
3. It shows two lines, `DATABASE_URL` (port **6543**, pooled) and `DIRECT_URL` (port **5432**).
4. Replace `[YOUR-PASSWORD]` with your database password.
   Forgot it? **Project Settings → Database → Reset database password.**
5. Paste both lines into `.env`, replacing the local ones:

```env
DATABASE_URL="postgresql://postgres.yckdgfeznlzoawlqmgbd:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.yckdgfeznlzoawlqmgbd:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Keep `?pgbouncer=true` on `DATABASE_URL`. Never commit `.env` or share the password.

## 2. Create the tables and admin tools

```bash
npm run supabase:setup
```

This creates the tables, then runs [`setup.sql`](setup.sql), which:
- turns on Row Level Security, so the public API keys can't read or change anything
- adds safety checks (status must be ACTIVE/PAUSED/FROZEN, balance can't go negative)
- creates the `admin` schema with the views and functions below

You can also paste `setup.sql` into **SQL Editor → New query → Run** (after the tables exist).

Then sign up on the site and make yourself admin (SQL Editor):

```sql
select admin.make_admin('you@example.com');
```

## 3. Managing from Supabase

### Table Editor (schema `public`)

| Table | What you can do |
|---|---|
| `User` | Names, email, phone. Change **status**: `ACTIVE`, `PAUSED` (can log in, can't play or claim), `FROZEN` (logged out, can't log in). Add a reason in `statusNote`; the user sees it. Change `role` to `ADMIN`. |
| `Setting` | Row `site`: all settings as JSON (RTP, limits, promos, prices, banner text). Easier to edit at `/admin/settings`. |
| `PaymentRequest` | Deposit/withdrawal requests. Approve them in `/admin` so coins and promos are credited correctly. |
| `ReferralReward` | Referral rewards and their status. |
| `DeviceLog` | Every signup/login with device ID, browser fingerprint and IP (multi-account detection). |
| `RiskFlag` | Suspicious-activity flags. Review them at `/admin/risk`. |
| `Transaction` | Full coin ledger (read only, don't edit). |
| `Bet` | Every game round. |

Changes take effect immediately (settings within 5 seconds).

> ⚠️ Don't edit `User.balance` directly. It skips the ledger. Use `admin.adjust_balance` (below) or the admin panel.

### Views (Table Editor → schema dropdown → `admin`)

| View | Shows |
|---|---|
| `users_overview` | Every user: name, email, phone, status, coins, deposits, referrals, bets, wagered, won, house result |
| `daily_stats` | Per day & game: rounds, players, wagered, paid out, house result, actual RTP |
| `pending_payments` | Deposit/withdrawal requests waiting for review |
| `pending_referral_claims` | Referral rewards waiting for approval |
| `ledger` | Every coin movement with user names |
| `open_risk_flags` | Suspicious activity waiting for review (shared devices, shared payout accounts, big wins…) |

### SQL functions (SQL Editor)

Every function accepts the customer's **email**, **phone** (`+15551234567`) or **user ID**.

```sql
-- Customer forgot password: set a new one, then send it to them (they're logged out everywhere)
select admin.reset_password('player@example.com', 'NewPass2024');

-- Freeze / pause / reactivate
select admin.set_status('player@example.com', 'FROZEN', 'Chargeback');
select admin.set_status('+15551234567', 'PAUSED', 'ID check needed');
select admin.set_status('player@example.com', 'ACTIVE');

-- Add or remove coins (logged in the ledger)
select admin.adjust_balance('player@example.com', 5000, 'Compensation');
select admin.adjust_balance('player@example.com', -2000, 'Correction');

-- Games: turn off, or turn on with a specific RTP (0.80–0.99)
select admin.set_game('crash', false);
select admin.set_game('slots', true, 0.92);

-- Make an admin
select admin.make_admin('you@example.com');
```

## Local development without Supabase

`npm run db:local` starts a local Postgres (PGlite) on port 54329. The default `.env` points there.
