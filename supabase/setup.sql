-- ═══════════════════════════════════════════════════════════════════════════
--  Casino Players Club — Supabase setup
--  Run AFTER `npm run db:push` has created the tables (`npm run supabase:setup` does both).
--  Or: Supabase dashboard → SQL Editor → paste this file → Run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) SECURITY ────────────────────────────────────────────────────────────────
-- The website talks to the database directly (server-side, postgres role), so it
-- does NOT need Supabase's public REST API. Turning on Row Level Security with no
-- policies blocks the public "anon" / "authenticated" API keys from reading or
-- changing anything. The dashboard and the website keep full access.
alter table "User"           enable row level security;
alter table "Transaction"    enable row level security;
alter table "Bet"            enable row level security;
alter table "GameSession"    enable row level security;
alter table "PaymentRequest" enable row level security;
alter table "Setting"        enable row level security;
alter table "ReferralReward" enable row level security;
alter table "DeviceLog"      enable row level security;
alter table "RiskFlag"       enable row level security;

-- Guard rails so a typo in the Table Editor can't break an account.
alter table "User" drop constraint if exists user_status_check;
alter table "User" add constraint user_status_check check (status in ('ACTIVE', 'PAUSED', 'FROZEN'));
alter table "User" drop constraint if exists user_balance_check;
alter table "User" add constraint user_balance_check check (balance >= 0);
alter table "User" drop constraint if exists user_role_check;
alter table "User" add constraint user_role_check check (role in ('USER', 'ADMIN'));

-- bcrypt for admin.reset_password (pgcrypto is pre-installed in "extensions" on Supabase).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2) ADMIN SCHEMA ────────────────────────────────────────────────────────────
-- Views and helper functions live in a separate "admin" schema that the public
-- API never exposes. In the Table Editor, pick schema "admin" from the dropdown.
create schema if not exists admin;
revoke all on schema admin from public;

drop view if exists admin.users_overview;
drop view if exists admin.daily_stats;
drop view if exists admin.pending_payments;
drop view if exists admin.pending_referral_claims;
drop view if exists admin.ledger;
drop view if exists admin.open_risk_flags;

-- Display name used in the views below.
create or replace function admin.display_name(u "User")
returns text language sql immutable as $$
  select coalesce(nullif(trim(coalesce(u."firstName", '') || ' ' || coalesce(u."lastName", '')), ''), u.username, u.email)
$$;

-- Every user with the numbers you usually need.
create view admin.users_overview as
select
  u.id,
  u."firstName"                                     as first_name,
  u."lastName"                                      as last_name,
  u.email,
  u.phone,
  u.status,
  u."statusNote"                                    as status_note,
  u.role,
  u.balance                                         as coins,
  case when u."bonusWagerLeft" > 0 then least(u."bonusCoins", u.balance) else 0 end as bonus_locked,
  u."bonusWagerLeft"                                as bonus_wager_left,
  u."depositWagerLeft"                              as deposit_wager_left,
  u."signupBonusHeld"                               as signup_credit_held,
  (select count(*) from "RiskFlag" f where f."userId" = u.id and f.status = 'OPEN') as open_flags,
  u."signupIp"                                      as signup_ip,
  round(u."totalDepositCents" / 100.0, 2)           as total_deposits_usd,
  u."referralCode"                                  as referral_code,
  admin.display_name(ref)                           as referred_by,
  (select count(*) from "User" r where r."referredById" = u.id) as referrals,
  coalesce(b.bets, 0)                               as bets,
  coalesce(b.wagered, 0)                            as coins_wagered,
  coalesce(b.won, 0)                                as coins_won,
  coalesce(b.wagered, 0) - coalesce(b.won, 0)       as house_result,
  b.last_bet_at,
  u."createdAt"                                     as joined_at
from "User" u
left join "User" ref on ref.id = u."referredById"
left join lateral (
  select count(*) as bets, sum(amount) as wagered, sum(payout) as won, max("createdAt") as last_bet_at
  from "Bet" where "userId" = u.id
) b on true;

-- House result per day and per game.
create view admin.daily_stats as
select
  date_trunc('day', "createdAt")::date as day,
  game,
  count(*)                             as rounds,
  count(distinct "userId")             as players,
  sum(amount)                          as wagered,
  sum(payout)                          as paid_out,
  sum(amount) - sum(payout)            as house_result,
  round(100.0 * sum(payout) / nullif(sum(amount), 0), 2) as actual_rtp_pct
from "Bet"
group by 1, 2
order by 1 desc, house_result desc;

create view admin.pending_payments as
select p.id, p.kind, p.provider, round(p."amountCents" / 100.0, 2) as amount_usd, p.coins, p.reference,
       admin.display_name(u) as customer, u.email, u.phone, p."createdAt" as requested_at
from "PaymentRequest" p join "User" u on u.id = p."userId"
where p.status = 'PENDING'
order by p."createdAt";

create view admin.pending_referral_claims as
select r.id, admin.display_name(ref) as referrer, ref.email as referrer_email, admin.display_name(nu) as referred_user,
       round(r."tierCents" / 100.0, 2) as tier_usd, round(r."rewardCents" / 100.0, 2) as reward_usd, r.coins, r."claimedAt" as claimed_at
from "ReferralReward" r
join "User" ref on ref.id = r."referrerId"
join "User" nu  on nu.id = r."referredUserId"
where r.status = 'CLAIM_REQUESTED'
order by r."claimedAt";

-- Full coin ledger with readable names.
create view admin.ledger as
select t."createdAt" as at, admin.display_name(u) as customer, u.email, t.type, t.amount, t."balanceAfter" as balance_after, t.note, t."createdBy" as created_by
from "Transaction" t join "User" u on u.id = t."userId"
order by t."createdAt" desc;

-- Suspicious activity waiting for review (same list as /admin/risk).
create view admin.open_risk_flags as
select f.id, f.severity, f.type, admin.display_name(u) as customer, u.email, u.phone, u.status as account_status,
       f.details, f."relatedUsers" as related_user_ids, f."createdAt" as flagged_at
from "RiskFlag" f join "User" u on u.id = f."userId"
where f.status = 'OPEN'
order by case f.severity when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end, f."createdAt" desc;

-- 3) HELPER FUNCTIONS (run from SQL Editor) ──────────────────────────────────
-- Every function accepts a user's email, phone (+15551234567), user ID, or old username.

create or replace function admin.find_user(p_user text)
returns text language plpgsql stable as $$
declare v_id text; v_count int;
begin
  select min(id), count(*) into v_id, v_count from "User"
   where lower(email) = lower(trim(p_user))
      or phone = trim(p_user)
      or phone = '+' || regexp_replace(p_user, '\D', '', 'g')
      or id = trim(p_user)
      or username = trim(p_user);
  if v_count = 0 then raise exception 'No user matches "%"', p_user; end if;
  if v_count > 1 then raise exception 'More than one user matches "%". Use the email or ID', p_user; end if;
  return v_id;
end $$;

-- Freeze / pause / reactivate.
--   select admin.set_status('player@example.com', 'FROZEN', 'Chargeback');
--   select admin.set_status('+15551234567', 'PAUSED', 'Verification needed');
--   select admin.set_status('player@example.com', 'ACTIVE');
create or replace function admin.set_status(p_user text, p_status text, p_note text default null)
returns text language plpgsql as $$
begin
  if p_status not in ('ACTIVE', 'PAUSED', 'FROZEN') then
    raise exception 'Status must be ACTIVE, PAUSED or FROZEN';
  end if;
  update "User"
     set status = p_status,
         "statusNote" = case when p_status = 'ACTIVE' then null else p_note end,
         "updatedAt" = now()
   where id = admin.find_user(p_user);
  return format('%s is now %s', p_user, p_status);
end $$;

-- Reset a forgotten password. The customer is logged out everywhere; send them the new password.
--   select admin.reset_password('player@example.com', 'NewPass2024');
create or replace function admin.reset_password(p_user text, p_new_password text)
returns text language plpgsql as $$
begin
  if length(p_new_password) < 8 then raise exception 'Password must be at least 8 characters'; end if;
  update "User"
     set "passwordHash" = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
         "sessionVersion" = "sessionVersion" + 1,
         "updatedAt" = now()
   where id = admin.find_user(p_user);
  return format('Password for %s has been reset', p_user);
end $$;

-- Add (+) or remove (-) coins, recorded in the ledger like the admin panel does.
-- Editing "User".balance directly in the Table Editor skips the ledger, so prefer this.
--   select admin.adjust_balance('player@example.com', 5000, 'Promo compensation');
--   select admin.adjust_balance('player@example.com', -2000, 'Correction');
create or replace function admin.adjust_balance(p_user text, p_amount integer, p_note text default null)
returns integer language plpgsql as $$
declare v_id text := admin.find_user(p_user); v_balance integer;
begin
  if p_amount = 0 then raise exception 'Amount must not be zero'; end if;
  update "User"
     set balance = balance + p_amount, "updatedAt" = now()
   where id = v_id and balance + p_amount >= 0
  returning balance into v_balance;
  if v_balance is null then raise exception 'Not enough coins for %', p_user; end if;
  insert into "Transaction" (id, "userId", type, amount, "balanceAfter", note, "createdBy", "createdAt")
  values (gen_random_uuid()::text, v_id, case when p_amount > 0 then 'ADMIN_CREDIT' else 'ADMIN_DEBIT' end,
          p_amount, v_balance, p_note, 'supabase', now());
  return v_balance;
end $$;

-- Make someone an admin of the website (they must have signed up first).
--   select admin.make_admin('you@example.com');
create or replace function admin.make_admin(p_user text)
returns text language plpgsql as $$
begin
  update "User" set role = 'ADMIN', "updatedAt" = now() where id = admin.find_user(p_user);
  return format('%s is now an admin', p_user);
end $$;

-- Turn a game on/off or change its RTP without opening the website.
--   select admin.set_game('slots', false);          -- disable
--   select admin.set_game('slots', true, 0.92);     -- enable with 92% RTP
create or replace function admin.set_game(p_game text, p_enabled boolean, p_rtp numeric default null)
returns text language plpgsql as $$
declare v jsonb;
begin
  if p_rtp is not null and (p_rtp < 0.80 or p_rtp > 0.99) then
    raise exception 'RTP must be between 0.80 and 0.99';
  end if;
  select value::jsonb into v from "Setting" where key = 'site';
  if v is null then
    raise exception 'Open /admin/settings on the website and click Save once to create the settings row';
  end if;
  v := jsonb_set(v, array['games', p_game],
         jsonb_strip_nulls(jsonb_build_object('enabled', p_enabled, 'rtp', p_rtp)), true);
  update "Setting" set value = v::text, "updatedAt" = now(), "updatedBy" = 'supabase' where key = 'site';
  return format('%s: enabled=%s rtp=%s', p_game, p_enabled, coalesce(p_rtp::text, 'default'));
end $$;

revoke all on all tables in schema admin from public;
revoke all on all functions in schema admin from public;
-- Supabase API roles (skipped automatically on a plain Postgres without them).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema admin from anon, authenticated;
    revoke all on all tables in schema admin from anon, authenticated;
    revoke all on all functions in schema admin from anon, authenticated;
  end if;
end $$;
