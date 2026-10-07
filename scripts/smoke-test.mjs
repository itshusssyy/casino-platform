// End-to-end test through the real HTTP API + database. Needs `npm run db:local` (or Supabase)
// and `npm run dev` running. Usage: npm run smoke-test
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const db = new PrismaClient();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("  ✗", msg); } else console.log("  ✓", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const jar = new Map();
  async function api(path, body, { expectFail = false } = {}, attempt = 0) {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-forwarded-for": `smoke-${Math.random()}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (v) jar.set(k, v); else jar.delete(k);
    }
    if (res.status === 429 && attempt < 5) { await sleep(1100); return api(path, body, { expectFail }, attempt + 1); } // rate limiter
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !expectFail) throw new Error(`${path} ${res.status}: ${data.error}`);
    return { ok: res.ok, status: res.status, ...data };
  }
  const game = (slug, action, body = {}, opts) => api(`/api/games/${slug}`, { action, ...body }, opts);
  return { api, game, jar };
}

const id = Math.random().toString(36).slice(2, 7);
const A = client(); // referrer (also made admin for this test)
const B = client(); // referred player

// ── Signup credit ──────────────────────────────────────────────
console.log("\nSignup & referral link");
const phoneA = String(2000000000 + Math.floor(Math.random() * 7e9));
const phoneB = String(2000000000 + Math.floor(Math.random() * 7e9));
const signup = (email, phone, extra = {}) => ({ firstName: "Test", lastName: "Player", country: "US", phone, email, password: `pw-${id}-${id}`, ageConfirmed: true, ...extra });
await A.api("/api/auth/signup", signup(`ref_${id}@example.test`, phoneA));
const userA = await db.user.findUniqueOrThrow({ where: { email: `ref_${id}@example.test` } });
check((await A.api("/api/wallet/balance")).balance === 1_000, "$10 signup credit = 1,000 coins ($1 = 100 coins)");
check(!!userA.referralCode, `referral code created (${userA.referralCode})`);
const badRef = await B.api("/api/auth/signup", signup(`x_${id}@example.test`, phoneB, { ref: "NOPE1234" }), { expectFail: true });
check(badRef.status === 400, "invalid referral code rejected");
const dupPhone = await B.api("/api/auth/signup", signup(`dup_${id}@example.test`, phoneA), { expectFail: true });
check(dupPhone.status === 409, "duplicate phone number rejected");
await B.api("/api/auth/signup", signup(`new_${id}@example.test`, phoneB, { firstName: "Bella", ref: userA.referralCode.toLowerCase() }));
const userB = await db.user.findUniqueOrThrow({ where: { email: `new_${id}@example.test` } });
check(userB.referredById === userA.id, "referred user linked to referrer");
check(userB.phone === `+1${phoneB}` && userB.firstName === "Bella", `name + phone stored (${userB.phone})`);
await db.user.update({ where: { id: userA.id }, data: { role: "ADMIN" } });

// ── All 15 games, balance consistency ─────────────────────────
console.log("\nGames");
let balance = 1_000;
async function instant(slug, action, body, bet) {
  const r = await B.game(slug, action, body);
  if (r.balance !== balance - bet + r.payout) { failures++; console.error(`  ✗ ${slug} balance mismatch`); }
  balance = r.balance;
}
for (let i = 0; i < 3; i++) {
  await instant("dice", "roll", { bet: 10, target: 50, over: true }, 10);
  await instant("limbo", "play", { bet: 10, target: 2 }, 10);
  await instant("coinflip", "flip", { bet: 10, side: "heads" }, 10);
  await instant("roulette", "spin", { bets: [{ type: "red", amount: 10 }, { type: "straight", value: 17, amount: 5 }] }, 15);
  await instant("slots", "spin", { bet: 10 }, 10);
  await instant("plinko", "drop", { bet: 10, risk: "high" }, 10);
  await instant("keno", "play", { bet: 10, picks: [1, 5, 9, 13, 22] }, 10);
  await instant("wheel", "spin", { bet: 10 }, 10);
  await instant("baccarat", "deal", { bet: 10, side: "banker" }, 10);
  await instant("scratch", "buy", { bet: 10 }, 10);
  let r = await B.game("blackjack", "deal", { bet: 10 });
  while (r.active) r = await B.game("blackjack", r.playerTotal < 17 ? "hit" : "stand");
  r = await B.game("mines", "start", { bet: 10, mines: 3 }); r = await B.game("mines", "reveal", { index: 7 }); if (r.active) r = await B.game("mines", "cashout");
  r = await B.game("hilo", "start", { bet: 10 }); r = await B.game("hilo", "guess", { dir: r.higherChance < 1 && (r.higherChance >= r.lowerChance || r.lowerChance >= 1) ? "higher" : "lower" }); if (r.active) r = await B.game("hilo", "cashout");
  await B.game("video-poker", "deal", { bet: 10 }); r = await B.game("video-poker", "draw", { holds: [true, true, false, false, false] });
  await B.game("crash", "start", { bet: 10, autoCashout: 1.3 });
  do { await sleep(250); r = await B.game("crash", "status"); } while (r.status === "running");
  balance = r.balance;
}
check(true, "all 15 games played; instant-game balances consistent");

// ── Settings: RTP, disable game, limits ───────────────────────
console.log("\nAdmin settings");
const settings = await A.api("/api/admin/settings");
const saved = await A.api("/api/admin/settings", { ...settings, maxBet: 500, games: { ...settings.games, slots: { enabled: false }, dice: { enabled: true, rtp: 0.9 } } });
check(saved.maxBet === 500, "settings saved");
await sleep(5_500); // settings cache TTL
check((await B.game("slots", "spin", { bet: 10 }, { expectFail: true })).status === 403, "disabled game refuses bets");
check((await B.game("dice", "roll", { bet: 501, target: 50 }, { expectFail: true })).status === 400, "max bet enforced");
const d = await B.game("dice", "roll", { bet: 10, target: 50, over: false });
check(d.multiplier === 1.8, `dice multiplier follows 90% RTP (got ${d.multiplier}×)`);
const badSettings = await A.api("/api/admin/settings", { ...settings, games: { dice: { enabled: true, rtp: 1.2 } } }, { expectFail: true });
check(badSettings.status === 400, "RTP above 99% rejected");
await A.api("/api/admin/settings", settings); // restore
check((await B.api("/api/admin/settings", undefined, { expectFail: true })).status === 403, "non-admin cannot read settings");

// ── Deposit approval → cashback promo + referral rewards ─────
console.log("\nDeposit promo & referral rewards");
const before = (await B.api("/api/wallet/balance")).balance;
const dep = await db.paymentRequest.create({ data: { userId: userB.id, kind: "DEPOSIT", provider: "cashapp", amountCents: 50_000, coins: 62_500 } });
await A.api(`/api/admin/payments/${dep.id}`, { decision: "approve" });
const after = (await B.api("/api/wallet/balance")).balance;
check(after - before === 62_500 + 10_000, `$500 deposit credited + $100 cashback (${(after - before).toLocaleString()} coins)`);
const again = await A.api(`/api/admin/payments/${dep.id}`, { decision: "approve" }, { expectFail: true });
check(again.status === 409, "deposit cannot be approved twice");
const rewards = await db.referralReward.findMany({ where: { referrerId: userA.id }, orderBy: { tierCents: "asc" } });
check(rewards.length === 2 && rewards[0].tierCents === 25_000 && rewards[1].tierCents === 50_000, "referrer unlocked $250 and $500 tiers");
const aBefore = (await A.api("/api/wallet/balance")).balance;
for (const r of rewards) await A.api("/api/referrals/claim", { id: r.id });
check((await A.api("/api/referrals/claim", { id: rewards[0].id }, { expectFail: true })).status === 400, "reward cannot be claimed twice");
for (const r of rewards) await A.api(`/api/admin/referrals/${r.id}`, { decision: "approve" });
check((await A.api("/api/wallet/balance")).balance - aBefore === 5_000, "referrer received $50 (5,000 coins) after approval");

// ── Account status ────────────────────────────────────────────
console.log("\nPause / freeze");
await A.api("/api/admin/status", { userId: userB.id, status: "PAUSED", note: "test" });
check((await B.game("dice", "roll", { bet: 10, target: 50 }, { expectFail: true })).status === 403, "paused user cannot bet");
check((await B.api("/api/wallet/balance")).ok, "paused user can still log in / view");
await db.$queryRawUnsafe(`select admin.set_status($1, 'FROZEN', 'sql test')`, userB.email);
check((await B.api("/api/wallet/balance", undefined, { expectFail: true })).status === 401, "frozen (via Supabase SQL function) user is logged out");
const login = await B.api("/api/auth/login", { identifier: userB.email, password: `pw-${id}-${id}` }, { expectFail: true });
check(login.status === 403, "frozen user cannot log in");
await db.$queryRawUnsafe(`select admin.set_status($1, 'ACTIVE')`, userB.email);
await B.api("/api/auth/login", { identifier: userB.phone, password: `pw-${id}-${id}` });
check((await B.game("dice", "roll", { bet: 10, target: 50 })).ok, "reactivated user can log in by phone and play again");

// ── Passwords ────────────────────────────────────────────────
console.log("\nPasswords");
const C = client(); // second device for B
await C.api("/api/auth/login", { identifier: userB.email, password: `pw-${id}-${id}` });
const { tempPassword } = await A.api("/api/admin/reset-password", { userId: userB.id });
check(typeof tempPassword === "string" && tempPassword.length === 10, "admin reset returns a temporary password");
check((await C.api("/api/wallet/balance", undefined, { expectFail: true })).status === 401, "reset logs the user out on all devices");
check((await B.api("/api/auth/login", { identifier: userB.email, password: `pw-${id}-${id}` }, { expectFail: true })).status === 401, "old password no longer works");
await B.api("/api/auth/login", { identifier: userB.email, password: tempPassword });
await B.api("/api/auth/change-password", { current: tempPassword, next: "MyNewPass123" });
check((await B.api("/api/wallet/balance")).ok, "user changed password and stays logged in");
await db.$queryRawUnsafe(`select admin.reset_password($1, 'SqlReset987')`, userB.email);
check((await B.api("/api/wallet/balance", undefined, { expectFail: true })).status === 401, "Supabase SQL reset logs the user out");
check((await B.api("/api/auth/login", { identifier: userB.email, password: "SqlReset987" })).ok, "password set from Supabase SQL works for login");

// ── Supabase SQL helpers ─────────────────────────────────────
console.log("\nSupabase SQL helpers");
const [{ adjust_balance: newBal }] = await db.$queryRawUnsafe(`select admin.adjust_balance($1, 777, 'sql credit')`, userB.email);
check(newBal === (await B.api("/api/wallet/balance")).balance, "admin.adjust_balance credits and logs to ledger");
const overview = await db.$queryRawUnsafe(`select coins, referrals from admin.users_overview where id = $1`, userA.id);
check(Number(overview[0].referrals) === 1, "admin.users_overview shows referral count");

// ── Ticker & guard rails ──────────────────────────────────────
console.log("\nBanner & guard rails");
const ticker = await B.api("/api/ticker");
check(ticker.promos.some((p) => p.includes("$10")) && ticker.promos.some((p) => p.includes("cashback")), "banner shows signup + cashback promos");
check((await B.api("/api/admin/adjust", { userId: userA.id, amount: 100 }, { expectFail: true })).status === 403, "player cannot use admin API");
if (!process.env.TEST_PAYMENTS) {
  check((await B.api("/api/payments/deposit", { packageId: "pkg0", method: "cashapp" }, { expectFail: true })).status === 503, "deposits disabled until enabled in .env");
} else {
  // Run with the dev server started as PAYMENTS_ENABLED=true WITHDRAWALS_ENABLED=true and TEST_PAYMENTS=1 here.
  console.log("\nCash App / Zelle / Chime flow");
  const cur = await A.api("/api/admin/settings");
  const methods = cur.paymentMethods.map((m) => (m.id === "cashapp" ? { ...m, enabled: true, details: "$TestCashtag" } : m.id === "zelle" ? { ...m, enabled: true, details: "" } : m));
  await A.api("/api/admin/settings", { ...cur, paymentMethods: methods, withdrawal: { ...cur.withdrawal, minUsd: 20, maxPerRequestUsd: 500, maxPerDayUsd: 500, newAccountHours: 0, depositWagerMultiplier: 0 } });
  await sleep(5_500);
  check((await B.api("/api/payments/deposit", { packageId: "pkg6", method: "zelle" }, { expectFail: true })).status === 400, "method without details can't take deposits");
  check((await B.api("/api/payments/deposit", { packageId: "pkg6", method: "chime" }, { expectFail: true })).status === 400, "disabled method can't take deposits");
  const order = await B.api("/api/payments/deposit", { packageId: "pkg6", method: "cashapp" });
  check(order.details === "$TestCashtag" && order.amountUsd === 500 && /^[A-Z0-9]{8}$/.test(order.reference), `deposit shows Cash App details, $500 and reference ${order.reference}`);
  check(order.instructions.some((t) => t.includes("WhatsApp")) && order.instructions.some((t) => t.includes(order.reference)), "instructions tell customer to note the reference and send screenshot on WhatsApp");
  const b0 = (await B.api("/api/wallet/balance")).balance;
  await A.api(`/api/admin/payments/${order.id}`, { decision: "approve" });
  check((await B.api("/api/wallet/balance")).balance - b0 === order.coins + 10_000, "manual approval credits coins + $100 cashback");

  await db.user.update({ where: { id: userB.id }, data: { depositWagerLeft: 0 } }); // earlier deposits count as played through for this part
  check((await B.api("/api/payments/withdraw", { coins: 60_000, method: "zelle", payoutHandle: "bella@example.com" }, { expectFail: true })).status === 400, "withdrawal above $500 rejected");
  check((await B.api("/api/payments/withdraw", { coins: 30_000, method: "zelle", payoutHandle: "" }, { expectFail: true })).status === 400, "withdrawal needs the customer's payout account");
  const w0 = (await B.api("/api/wallet/balance")).balance;
  const w = await B.api("/api/payments/withdraw", { coins: 30_000, method: "zelle", payoutHandle: "bella@example.com" });
  check((await B.api("/api/wallet/balance")).balance === w0 - 30_000, "$300 withdrawal requested, coins held");
  const daily = await B.api("/api/payments/withdraw", { coins: 30_000, method: "zelle", payoutHandle: "bella@example.com" }, { expectFail: true });
  check(daily.status === 400 && /Daily/.test(daily.error), "second $300 the same day blocked by $500 daily limit");
  await A.api(`/api/admin/payments/${w.id}`, { decision: "reject" });
  check((await B.api("/api/wallet/balance")).balance === w0, "rejected withdrawal refunds the coins");
  const w2 = await B.api("/api/payments/withdraw", { coins: 20_000, method: "zelle", payoutHandle: "bella@example.com" });
  await A.api(`/api/admin/payments/${w2.id}`, { decision: "approve" });
  check((await db.paymentRequest.findUnique({ where: { id: w2.id } })).status === "APPROVED", "admin marks manual payout as approved");

  // ── Risk controls ────────────────────────────────────────────
  console.log("\nRisk controls");
  const strict = { ...cur, paymentMethods: methods, withdrawal: { ...cur.withdrawal, newAccountHours: 24, depositWagerMultiplier: 1, requireDeposit: true, maxRequestsPerDay: 5 }, deposit: { ...cur.deposit, maxPerDayUsd: 600, maxPerWeekUsd: 5000, maxPending: 3 }, risk: { bigWinUsd: 0.5, dailyProfitUsd: 1000 } };
  await A.api("/api/admin/settings", strict);
  await sleep(5_500);

  // Same browser (device cookie) as A → signup credit held + flagged
  const D = client();
  D.jar.set("rs_did", A.jar.get("rs_did"));
  const phoneD = String(2000000000 + Math.floor(Math.random() * 7e9));
  const dSign = await D.api("/api/auth/signup", signup(`dup_dev_${id}@example.test`, phoneD));
  const userD = await db.user.findUniqueOrThrow({ where: { email: `dup_dev_${id}@example.test` } });
  check(dSign.bonusHeld === true && (await D.api("/api/wallet/balance")).balance === 0, "second account on the same device: signup credit held (0 coins)");
  const dFlags = await db.riskFlag.findMany({ where: { userId: userD.id, status: "OPEN" } });
  check(dFlags.some((x) => x.type === "SHARED_DEVICE" && x.severity === "HIGH") && dFlags.some((x) => x.type === "BONUS_HELD"), "SHARED_DEVICE + BONUS_HELD flags raised");
  const held = dFlags.find((x) => x.type === "BONUS_HELD");
  await A.api(`/api/admin/risk/flags/${held.id}`, { action: "grant_bonus" });
  check((await D.api("/api/wallet/balance")).balance === 1_000, "admin granted the held credit (1,000 coins)");
  check((await A.api(`/api/admin/risk/flags/${held.id}`, { action: "grant_bonus" }, { expectFail: true })).status >= 400, "held credit can't be granted twice");

  // Withdrawal rules
  const tryW = (coins, handle = "dup@example.com") => D.api("/api/payments/withdraw", { coins, method: "zelle", payoutHandle: handle }, { expectFail: true });
  let wr = await tryW(2_000);
  check(wr.status === 400 && /New accounts/.test(wr.error), "new account must wait 24h before withdrawing");
  await A.api("/api/admin/settings", { ...strict, withdrawal: { ...strict.withdrawal, newAccountHours: 0 } });
  await sleep(5_500);
  wr = await tryW(2_000);
  check(wr.status === 400 && /deposit before/.test(wr.error), "bonus-only account cannot withdraw (deposit required)");
  const depD = await db.paymentRequest.create({ data: { userId: userD.id, kind: "DEPOSIT", provider: "cashapp", amountCents: 5_000, coins: 5_000 } });
  await A.api(`/api/admin/payments/${depD.id}`, { decision: "approve" });
  wr = await tryW(2_000);
  check(wr.status === 400 && /Play through your deposit/.test(wr.error), "deposit must be played through before withdrawing");
  const beforeBet = await db.user.findUniqueOrThrow({ where: { id: userD.id } });
  await D.game("dice", "roll", { bet: 100, target: 50, over: true });
  const afterBet = await db.user.findUniqueOrThrow({ where: { id: userD.id } });
  check(beforeBet.depositWagerLeft - afterBet.depositWagerLeft === 100 && beforeBet.bonusWagerLeft - afterBet.bonusWagerLeft === 100 && afterBet.totalWagered === beforeBet.totalWagered + 100,
    "each bet counts toward deposit play-through and bonus unlock");
  check(afterBet.bonusCoins === 1_000 && afterBet.bonusWagerLeft === 10 * 1_000 - 100, "signup credit locked with 10× wagering (10,000 coins)");
  await db.user.update({ where: { id: userD.id }, data: { depositWagerLeft: 0 } }); // pretend the deposit was played through
  const bal = (await D.api("/api/wallet/balance")).balance;
  wr = await tryW(bal);
  check(wr.status === 400 && /bonus coins unlock/.test(wr.error), "locked bonus can't be withdrawn");
  const okW = await D.api("/api/payments/withdraw", { coins: 2_000, method: "zelle", payoutHandle: "Bella@Example.com" });
  check(!!okW.id, "withdrawal of non-bonus coins allowed");
  const dFlags2 = await db.riskFlag.findMany({ where: { userId: userD.id, status: "OPEN" } });
  check(dFlags2.some((x) => x.type === "SHARED_PAYOUT" && x.severity === "HIGH"), "same Zelle account as another user → SHARED_PAYOUT flag");
  check(dFlags2.some((x) => x.type === "NO_PLAY_WITHDRAW"), "withdraw with little play → NO_PLAY_WITHDRAW flag");

  // Deposit velocity ($600/day in this test)
  await D.api("/api/payments/deposit", { packageId: "pkg6", method: "cashapp" });
  const dv = await D.api("/api/payments/deposit", { packageId: "pkg5", method: "cashapp" }, { expectFail: true });
  check(dv.status === 400 && /Daily purchase limit/.test(dv.error), "deposit daily limit enforced");

  // Big win flag (threshold $0.50 in this test)
  for (let i = 0; i < 12; i++) {
    const r = await D.game("limbo", "play", { bet: 100, target: 2 });
    if (r.win) break;
  }
  check(await db.riskFlag.count({ where: { userId: userD.id, type: "BIG_WIN" } }) >= 1, "big win → BIG_WIN flag");

  // Dashboard + flag actions
  const stats = await A.api("/api/admin/risk/stats");
  check(typeof stats.last24h.houseResultUsd === "number" && stats.flags.HIGH >= 2 && stats.pending.depositsCount >= 1 && stats.liability.lockedBonusUsd > 0,
    `risk dashboard: house ${stats.last24h.houseResultUsd.toFixed(2)}, ${stats.flags.HIGH} high flags, locked bonus $${stats.liability.lockedBonusUsd.toFixed(2)}`);
  check((await D.api("/api/admin/risk/stats", undefined, { expectFail: true })).status === 403, "players can't see the risk dashboard");
  const anyFlag = dFlags2.find((x) => x.type === "NO_PLAY_WITHDRAW");
  await A.api(`/api/admin/risk/flags/${anyFlag.id}`, { action: "dismiss" });
  check((await db.riskFlag.findUnique({ where: { id: anyFlag.id } })).status === "DISMISSED", "admin can dismiss a flag");
  const payoutFlag = dFlags2.find((x) => x.type === "SHARED_PAYOUT");
  await A.api(`/api/admin/risk/flags/${payoutFlag.id}`, { action: "freeze" });
  check((await D.api("/api/wallet/balance", undefined, { expectFail: true })).status === 401, "freeze from a flag logs the user out");

  await A.api("/api/admin/settings", cur);
}
check((await B.game("dice", "roll", { bet: 1.5, target: 50 }, { expectFail: true })).status === 400, "fractional bet rejected");

await db.$disconnect();
console.log(failures === 0 ? "\n✔ ALL CHECKS PASSED" : `\n✗ ${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
