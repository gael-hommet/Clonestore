#!/usr/bin/env node
// paid-customer-testmode-e2e.mjs
// GO-LIVE 08 — Paid Customer E2E Test Mode Verifier (Node/ESM)
//
// SAFETY:
// - Never uses sk_live_ — blocked at startup.
// - Never calls OpenAI or Anthropic.
// - Never sends real emails.
// - Never modifies go-live-proofs.local.json.
// - Never logs full secret values.
//
// Usage: node scripts/paid-customer-testmode-e2e.mjs

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("[FAIL] .env.local not found.");
    return {};
  }
  const env = {};
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

function mask(val) {
  if (!val) return "(not set)";
  return val.slice(0, Math.min(12, val.length)) + "****";
}

function maskEmail(email) {
  if (!email) return "(not set)";
  return email.replace(/(?<=.{3}).+(?=@)/, "****");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const env = loadEnv();

  console.log("");
  console.log("========================================================");
  console.log("  GO-LIVE 08 — Paid Customer E2E — TEST MODE ONLY      ");
  console.log("========================================================");
  console.log("");
  console.log("[SAFETY] TEST MODE ONLY. No live Stripe calls. No production data.");
  console.log("");

  // ── Safety: refuse sk_live_ ───────────────────────────────────────────────
  const stripeKey = env["STRIPE_SECRET_KEY"] ?? "";
  if (stripeKey.startsWith("sk_live_")) {
    console.error("[BLOCKED] STRIPE_SECRET_KEY is a live key. GO-LIVE 08 refuses to run with sk_live_.");
    console.error("[BLOCKED] Switch to sk_test_ keys for test mode E2E.");
    process.exit(1);
  }
  const pubKey = env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "";
  if (pubKey.startsWith("pk_live_")) {
    console.error("[BLOCKED] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a live key. Refusing.");
    process.exit(1);
  }

  // ── Env checks ────────────────────────────────────────────────────────────
  let pass = 0;
  let fail = 0;
  const blockers = [];

  function check(label, val, prefix) {
    if (!val) {
      console.log(`  [FAIL] ${label} — missing`);
      fail++;
      blockers.push(`Missing: ${label}`);
      return false;
    }
    if (prefix && !val.startsWith(prefix)) {
      console.log(`  [FAIL] ${label} — does not start with '${prefix}'`);
      fail++;
      blockers.push(`Wrong format: ${label}`);
      return false;
    }
    console.log(`  [OK]   ${label} = ${mask(val)}`);
    pass++;
    return true;
  }

  console.log("── ENV CHECK ────────────────────────────────────────────");
  check("STRIPE_SECRET_KEY (sk_test_)", env["STRIPE_SECRET_KEY"], "sk_test_");
  check("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_)", env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"], "pk_test_");
  check("STRIPE_WEBHOOK_SECRET (whsec_)", env["STRIPE_WEBHOOK_SECRET"], "whsec_");
  check("STRIPE_PRICE_PIERRE (price_)", env["STRIPE_PRICE_PIERRE"], "price_");
  check("NEXT_PUBLIC_SUPABASE_URL", env["NEXT_PUBLIC_SUPABASE_URL"], "https://");
  check("NEXT_PUBLIC_SUPABASE_ANON_KEY", env["NEXT_PUBLIC_SUPABASE_ANON_KEY"], "eyJ");
  console.log("");

  // ── Optional: verify Stripe checkout session ───────────────────────────────
  const checkoutSessionId = env["STRIPE_TEST_CHECKOUT_SESSION_ID"] ?? null;
  const stripeTestMode = env["STRIPE_SECRET_KEY"]?.startsWith("sk_test_");
  let checkoutVerified = false;
  let webhookStatus = "pending";
  let orderStatus = "pending";
  let pierreAccessActive = false;

  console.log("── STRIPE SESSION CHECK ─────────────────────────────────");
  if (!checkoutSessionId) {
    console.log("  [PENDING] STRIPE_TEST_CHECKOUT_SESSION_ID not set.");
    console.log("  Run E2E manually and set this var after checkout to verify.");
  } else if (!stripeTestMode) {
    console.log("  [SKIP] Not in test mode — session check skipped.");
  } else {
    console.log(`  [INFO] Checking session: ${mask(checkoutSessionId)}`);
    try {
      const stripe = await importStripe(env["STRIPE_SECRET_KEY"]);
      if (stripe) {
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
        if (session.mode !== "subscription") {
          console.log("  [FAIL] Session mode is not 'subscription'.");
          fail++;
          blockers.push("Checkout session mode is not subscription");
        } else if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
          checkoutVerified = true;
          console.log(`  [OK]   Session payment_status = ${session.payment_status} — checkout confirmed.`);
          pass++;
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          console.log(`  [OK]   Subscription ID: ${mask(subId)}`);
          webhookStatus = "expected — check your webhook logs";
        } else {
          console.log(`  [FAIL] Session payment_status = ${session.payment_status} — not confirmed.`);
          fail++;
          blockers.push("Checkout session not yet confirmed by Stripe");
        }
      } else {
        console.log("  [SKIP] Stripe SDK not available. Install 'stripe' package to enable session check.");
      }
    } catch (err) {
      console.log(`  [WARN] Could not retrieve session: ${err?.message ?? "unknown error"}`);
    }
  }
  console.log("");

  // ── Optional: verify Supabase access ─────────────────────────────────────
  const testUserEmail = env["STRIPE_TEST_USER_EMAIL"] ?? null;
  console.log("── SUPABASE ACCESS CHECK ────────────────────────────────");
  if (!testUserEmail) {
    console.log("  [PENDING] STRIPE_TEST_USER_EMAIL not set.");
    console.log("  Set this var with your test user email to check Pierre access in DB.");
  } else {
    console.log(`  [INFO] Test user: ${maskEmail(testUserEmail)}`);
    const serviceKey = env["SUPABASE_SERVICE_ROLE_KEY"] ?? null;
    const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"] ?? null;
    if (!serviceKey || !supabaseUrl) {
      console.log("  [SKIP] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL not set. Cannot query DB.");
    } else {
      try {
        const sb = await importSupabase(supabaseUrl, serviceKey);
        if (sb) {
          // Find user by email
          const { data: userList } = await sb.auth.admin.listUsers();
          const testUser = userList?.users?.find(u => u.email === testUserEmail);
          if (!testUser) {
            console.log(`  [WARN] Test user email not found in Supabase auth.`);
          } else {
            const userId = testUser.id;
            // Check orders table
            const { data: order } = await sb
              .from("orders")
              .select("status,stripe_subscription_id,agent_slug,started_at,ended_at")
              .eq("user_id", userId)
              .eq("agent_slug", "pierre")
              .maybeSingle();

            if (!order) {
              console.log("  [FAIL] No order found in Supabase for this test user + pierre.");
              blockers.push("No orders row for test user in Supabase");
              fail++;
            } else {
              const isActive = order.status === "active" || order.status === "trialing";
              orderStatus = order.status;
              pierreAccessActive = isActive;
              const statusColor = isActive ? "[OK]  " : "[WARN]";
              console.log(`  ${statusColor} orders.status = ${order.status}`);
              console.log(`  [INFO] subscription_id: ${mask(order.stripe_subscription_id)}`);
              console.log(`  [INFO] started_at: ${order.started_at}`);
              console.log(`  [INFO] ended_at: ${order.ended_at ?? "null"}`);
              if (isActive) pass++;
              else fail++;
            }
          }
        } else {
          console.log("  [SKIP] @supabase/supabase-js not available.");
        }
      } catch (err) {
        console.log(`  [WARN] Supabase query failed: ${err?.message ?? "unknown"}`);
      }
    }
  }
  console.log("");

  // ── E2E verdict ───────────────────────────────────────────────────────────
  console.log("── E2E VERDICT ──────────────────────────────────────────");
  const verdict = {
    env_ok: fail === 0,
    stripe_test_mode_ok: stripeKey.startsWith("sk_test_"),
    checkout_session_seen: checkoutVerified,
    webhook_status: webhookStatus,
    order_active: pierreAccessActive,
    pierre_access_active: pierreAccessActive,
    setup_access_ok: "pending — manual check required",
    cockpit_access_ok: "pending — manual check required",
    cancel_seen: "pending — manual check required",
    access_after_cancel_ok: "pending — manual check required",
    blockers,
    warnings: [],
  };

  console.log(JSON.stringify(verdict, null, 2));
  console.log("");

  // ── Evidence file ─────────────────────────────────────────────────────────
  const evidenceDir = join(process.cwd(), "go-live-evidence", "paid-customer-testmode");
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }
  const evidencePath = join(evidenceDir, "paid-customer-testmode-e2e.txt");

  const now = new Date().toISOString();
  const evidenceLines = [
    "GO-LIVE 08 — Paid Customer Test Mode E2E Evidence",
    "====================================================",
    `Date: ${now}`,
    "Mode: STRIPE TEST MODE ONLY",
    "",
    `Test user email: ${testUserEmail ? maskEmail(testUserEmail) : "(not provided)"}`,
    `Checkout session ID: ${checkoutSessionId ? mask(checkoutSessionId) : "(not provided)"}`,
    "",
    `env_ok: ${verdict.env_ok}`,
    `stripe_test_mode_ok: ${verdict.stripe_test_mode_ok}`,
    `checkout_session_seen: ${verdict.checkout_session_seen}`,
    `webhook_status: ${verdict.webhook_status}`,
    `order_status_in_supabase: ${orderStatus}`,
    `pierre_access_active: ${verdict.pierre_access_active}`,
    "",
    "Manual steps remaining:",
    "  - [ ] /agents/pierre/setup accessible after test payment",
    "  - [ ] /agents/pierre/use accessible, Pierre cockpit active",
    "  - [ ] Cancel subscription in Stripe test dashboard",
    "  - [ ] Webhook customer.subscription.deleted received",
    "  - [ ] orders table updated to canceled",
    "  - [ ] Access revoked / non-active confirmed",
    "",
    `Blockers: ${verdict.blockers.length > 0 ? verdict.blockers.join(", ") : "none"}`,
    "",
    "Verdict: PENDING — complete manual steps above to close GO-LIVE 08.",
    "",
    "PROOF TEMPLATES (copy to go-live-proofs.local.json after each step):",
    "  PAID_CUSTOMER_TESTMODE_E2E_COMPLETED",
    "  STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED",
    "  STRIPE_TEST_WEBHOOK_RECEIVED",
    "  PIERRE_ACCESS_AFTER_TEST_PAYMENT_VERIFIED",
    "  PIERRE_SETUP_AFTER_TEST_PAYMENT_VERIFIED",
    "  PIERRE_COCKPIT_AFTER_TEST_PAYMENT_VERIFIED",
    "  STRIPE_TEST_SUBSCRIPTION_CANCEL_VERIFIED",
    "  PIERRE_BLOCK_AFTER_TEST_CANCEL_VERIFIED",
    "",
    "NOTE: This script does NOT modify go-live-proofs.local.json.",
    "      Copy proof templates manually after verifying each step.",
  ];

  writeFileSync(evidencePath, evidenceLines.join("\n"), "utf-8");
  console.log(`[INFO] Evidence file written: ${evidencePath}`);
  console.log("[INFO] Fill in manual steps and copy proof templates when ready.");
  console.log("");
  console.log("[TEST MODE ONLY] No live Stripe calls. No real payments. No OpenAI. No Anthropic.");
  console.log("");

  if (fail > 0) process.exit(1);
  process.exit(0);
}

// ── Dynamic imports (graceful if packages not installed) ──────────────────────

async function importStripe(secretKey) {
  try {
    const { default: Stripe } = await import("stripe");
    return new Stripe(secretKey, { apiVersion: "2025-11-17" });
  } catch {
    return null;
  }
}

async function importSupabase(url, serviceKey) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, serviceKey, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ?? err);
  process.exit(1);
});
