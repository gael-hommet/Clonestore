// GO-LIVE 02 -- Stripe Live Readiness Check Script
// Reads .env.local, validates Stripe config. Does NOT contact Stripe API.
// Does NOT modify go-live-proofs.local.json.
// Does NOT make real payments. Does NOT call OpenAI/email/Supabase.
//
// Usage: node scripts/stripe-live-readiness.mjs
// Required: STRIPE_SECRET_KEY, STRIPE_PRICE_PIERRE in .env.local
// Optional: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
//
// Pierre = 449 EUR/mois (44900 cents). Env var: STRIPE_PRICE_PIERRE (price_...)
// Webhook URL: /api/webhooks/stripe  (NOT /api/stripe/webhook)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── 1. Load .env.local ────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    console.error('[ERROR] .env.local not found.');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

// ── 2. Read env vars ──────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_PIERRE = process.env.STRIPE_PRICE_PIERRE || '';

// Expected Pierre price in cents (449.00 EUR/mois)
const EXPECTED_PIERRE_PRICE_CENTS = 44900;
const EXPECTED_PIERRE_PRICE_EUR = '449.00 EUR/mois';

// ── 3. Detection helpers ──────────────────────────────────────────────────────

function maskKey(key) {
  if (!key || key.length < 16) return '[SET - hidden]';
  return key.slice(0, 12) + '...' + key.slice(-4);
}

function detectKeyMode(key) {
  if (!key) return 'missing';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('pk_live_')) return 'live';
  if (key.startsWith('pk_test_')) return 'test';
  return 'unknown';
}

// ── 4. Banner ─────────────────────────────────────────────────────────────────

console.log('');
console.log('======================================================');
console.log(' GO-LIVE 02 -- Stripe Live Readiness Check');
console.log('======================================================');
console.log('  Pierre : ' + EXPECTED_PIERRE_PRICE_EUR + ' (' + EXPECTED_PIERRE_PRICE_CENTS + ' cents)');
console.log('  Webhook URL : /api/webhooks/stripe');
console.log('  NOTE: This script does NOT contact Stripe API.');
console.log('  NOTE: This script does NOT modify go-live-proofs.local.json.');
console.log('');

// ── 5. Check each env var ─────────────────────────────────────────────────────

const checks = [];
let isLive = false;
let hasAllRequired = true;

// STRIPE_SECRET_KEY
const secretMode = detectKeyMode(STRIPE_SECRET_KEY);
if (!STRIPE_SECRET_KEY) {
  console.log('[MISSING] STRIPE_SECRET_KEY is not set in .env.local');
  checks.push({ key: 'STRIPE_SECRET_KEY', result: 'MISSING', mode: 'none' });
  hasAllRequired = false;
} else if (secretMode === 'live') {
  console.log('[LIVE]    STRIPE_SECRET_KEY: ' + maskKey(STRIPE_SECRET_KEY));
  checks.push({ key: 'STRIPE_SECRET_KEY', result: 'PASS', mode: 'live' });
  isLive = true;
} else if (secretMode === 'test') {
  console.log('[TEST]    STRIPE_SECRET_KEY: ' + maskKey(STRIPE_SECRET_KEY) + ' (live required for launch)');
  checks.push({ key: 'STRIPE_SECRET_KEY', result: 'TEST', mode: 'test' });
} else {
  console.log('[ERROR]   STRIPE_SECRET_KEY: unknown format (expected sk_live_ or sk_test_)');
  checks.push({ key: 'STRIPE_SECRET_KEY', result: 'ERROR', mode: 'unknown' });
  hasAllRequired = false;
}

// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const pubMode = detectKeyMode(STRIPE_PUBLISHABLE_KEY);
if (!STRIPE_PUBLISHABLE_KEY) {
  console.log('[MISSING] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  checks.push({ key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', result: 'MISSING', mode: 'none' });
  hasAllRequired = false;
} else if (pubMode === 'live') {
  console.log('[LIVE]    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ' + maskKey(STRIPE_PUBLISHABLE_KEY));
  checks.push({ key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', result: 'PASS', mode: 'live' });
} else if (pubMode === 'test') {
  console.log('[TEST]    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ' + maskKey(STRIPE_PUBLISHABLE_KEY));
  checks.push({ key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', result: 'TEST', mode: 'test' });
} else {
  console.log('[ERROR]   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: unknown format');
  checks.push({ key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', result: 'ERROR', mode: 'unknown' });
  hasAllRequired = false;
}

// Live/test mismatch check
if (STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY) {
  const sLive = secretMode === 'live';
  const pLive = pubMode === 'live';
  if (sLive !== pLive) {
    console.log('[ALERT]   KEY MISMATCH: one key is live and the other is test!');
    console.log('          This will cause payment errors in production.');
  }
}

// STRIPE_WEBHOOK_SECRET
if (!STRIPE_WEBHOOK_SECRET) {
  console.log('[MISSING] STRIPE_WEBHOOK_SECRET is not set');
  checks.push({ key: 'STRIPE_WEBHOOK_SECRET', result: 'MISSING', mode: 'none' });
  hasAllRequired = false;
} else if (STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
  console.log('[OK]      STRIPE_WEBHOOK_SECRET: present (whsec_...)');
  checks.push({ key: 'STRIPE_WEBHOOK_SECRET', result: 'PASS', mode: 'ok' });
} else {
  console.log('[ERROR]   STRIPE_WEBHOOK_SECRET: invalid format (expected whsec_...)');
  checks.push({ key: 'STRIPE_WEBHOOK_SECRET', result: 'ERROR', mode: 'unknown' });
  hasAllRequired = false;
}

// STRIPE_PRICE_PIERRE
if (!STRIPE_PRICE_PIERRE) {
  console.log('[MISSING] STRIPE_PRICE_PIERRE is not set');
  console.log('          Create a 449 EUR/mois recurring price in Stripe Dashboard → Products');
  console.log('          Copy the price_... ID into .env.local as STRIPE_PRICE_PIERRE=price_...');
  checks.push({ key: 'STRIPE_PRICE_PIERRE', result: 'MISSING', mode: 'none' });
  hasAllRequired = false;
} else if (STRIPE_PRICE_PIERRE.startsWith('price_')) {
  console.log('[OK]      STRIPE_PRICE_PIERRE: ' + STRIPE_PRICE_PIERRE);
  console.log('          Expected amount: ' + EXPECTED_PIERRE_PRICE_EUR + ' (' + EXPECTED_PIERRE_PRICE_CENTS + ' cents)');
  console.log('          IMPORTANT: verify the price IS 449 EUR/mois in Stripe Dashboard.');
  console.log('          This script cannot verify the amount without contacting Stripe API.');
  checks.push({ key: 'STRIPE_PRICE_PIERRE', result: 'PASS', mode: 'ok' });
} else {
  console.log('[ERROR]   STRIPE_PRICE_PIERRE: invalid format (expected price_...)');
  checks.push({ key: 'STRIPE_PRICE_PIERRE', result: 'ERROR', mode: 'unknown' });
  hasAllRequired = false;
}

console.log('');

// ── 6. Summary ────────────────────────────────────────────────────────────────

console.log('SUMMARY');
console.log('-------');
if (isLive && hasAllRequired) {
  console.log('  [READY]  All required Stripe env vars are set in live mode.');
  console.log('           Run checkout tests to generate real proof evidence.');
} else if (!isLive && hasAllRequired) {
  console.log('  [TEST]   All vars set but using test keys. Switch to live for public launch.');
} else {
  console.log('  [INCOMPLETE] Missing required Stripe env vars. See [MISSING] above.');
}

console.log('');
console.log('  Webhook URL (configure in Stripe Dashboard):');
console.log('    https://[your-domain]/api/webhooks/stripe');
console.log('    Events: checkout.session.completed, customer.subscription.*,');
console.log('            customer.subscription.created, customer.subscription.updated,');
console.log('            customer.subscription.deleted, invoice.payment_failed');
console.log('');
console.log('  Pierre price: ' + EXPECTED_PIERRE_PRICE_EUR + ' = ' + EXPECTED_PIERRE_PRICE_CENTS + ' cents');
console.log('  Trial: 7 days (card required at checkout — not open-bar)');
console.log('');

// ── 7. Write evidence file ────────────────────────────────────────────────────

const evidenceDir = join(process.cwd(), 'go-live-evidence', 'stripe');
if (!existsSync(evidenceDir)) {
  mkdirSync(evidenceDir, { recursive: true });
}

const timestamp = new Date().toISOString();
const evidenceLines = [
  'GO-LIVE 02 -- Stripe Live Readiness Check Report',
  'Generated : ' + timestamp,
  'Mode      : ' + (isLive ? 'LIVE' : 'TEST or INCOMPLETE'),
  '',
  '── ENV VAR CHECKS ──',
  ...checks.map(function(c) {
    return '  [' + c.result + '] ' + c.key + ' (' + c.mode + ')';
  }),
  '',
  '── NOTES ──',
  '  - STRIPE_PRICE_PIERRE must be set to a price_... ID for 449 EUR/mois in Stripe live.',
  '  - Webhook URL in Dashboard: /api/webhooks/stripe',
  '  - This report does NOT verify the actual price amount (needs Stripe API call).',
  '  - This report does NOT automatically mark any proof as verified.',
  '  - Manual review and dashboard verification required before updating proofs.',
  '',
  '── PROOF IDs PENDING ──',
  '  STRIPE_LIVE_SECRET_SET',
  '  STRIPE_LIVE_PRICE_PIERRE_449_CREATED',
  '  STRIPE_LIVE_WEBHOOK_CONFIGURED',
  '  STRIPE_LIVE_CHECKOUT_TESTED',
  '  STRIPE_LIVE_PAYMENT_SUCCESS_TESTED',
  '  STRIPE_LIVE_PAYMENT_FAILURE_TESTED',
  '  STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED',
  '  PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED',
  '  PIERRE_BLOCK_AFTER_CANCEL_VERIFIED',
];

const evidenceFile = join(evidenceDir, 'stripe-live-env-check.txt');
writeFileSync(evidenceFile, evidenceLines.join('\n'), 'utf-8');
console.log('Evidence file: go-live-evidence/stripe/stripe-live-env-check.txt');
console.log('');

// ── 8. Proof templates ────────────────────────────────────────────────────────

console.log('── PROOF TEMPLATES (paste into go-live-proofs.local.json AFTER manual verification) ──');
console.log('   This script does NOT write go-live-proofs.local.json automatically.');
console.log('');

const proofTemplates = [
  {
    proof_id: 'STRIPE_LIVE_SECRET_SET',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'script_output',
    evidence_ref: 'go-live-evidence/stripe/stripe-live-env-check.txt',
    notes: 'STRIPE_SECRET_KEY sk_live_ + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_live_ confirmed in .env.local.',
  },
  {
    proof_id: 'STRIPE_LIVE_PRICE_PIERRE_449_CREATED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'dashboard',
    evidence_ref: 'go-live-evidence/stripe/product-price-449.png',
    notes: 'Price 449 EUR/mois created in Stripe live Dashboard. STRIPE_PRICE_PIERRE=' + (STRIPE_PRICE_PIERRE || 'price_...'),
  },
  {
    proof_id: 'STRIPE_LIVE_WEBHOOK_CONFIGURED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'dashboard',
    evidence_ref: 'go-live-evidence/stripe/webhook-configured.png',
    notes: 'Webhook /api/webhooks/stripe active in Stripe Dashboard with 200 OK status.',
  },
  {
    proof_id: 'STRIPE_LIVE_CHECKOUT_TESTED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'screenshot',
    evidence_ref: 'go-live-evidence/stripe/checkout-449eur.png',
    notes: 'Stripe checkout opens at 449 EUR/mois. Card required (7-day trial). Screenshot taken.',
  },
  {
    proof_id: 'STRIPE_LIVE_PAYMENT_SUCCESS_TESTED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'screenshot',
    evidence_ref: 'go-live-evidence/stripe/payment-success-pierre-activated.png',
    notes: 'Real payment succeeded. Pierre activated. Webhook 200 OK in Dashboard.',
  },
  {
    proof_id: 'STRIPE_LIVE_PAYMENT_FAILURE_TESTED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'screenshot',
    evidence_ref: 'go-live-evidence/stripe/payment-failure-tested.png',
    notes: 'Payment failure tested. past_due status set in orders. Dashboard confirms.',
  },
  {
    proof_id: 'STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'screenshot',
    evidence_ref: 'go-live-evidence/stripe/subscription-cancel-tested.png',
    notes: 'Cancel subscription tested. Pierre access revoked. orders.status = canceled.',
  },
  {
    proof_id: 'PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'screenshot',
    evidence_ref: 'go-live-evidence/stripe/pierre-access-after-payment.png',
    notes: 'After successful payment, /agents/pierre/use is accessible. Pierre is active.',
  },
  {
    proof_id: 'PIERRE_BLOCK_AFTER_CANCEL_VERIFIED',
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: 'screenshot',
    evidence_ref: 'go-live-evidence/stripe/pierre-blocked-after-cancel.png',
    notes: 'After cancel, Pierre access is blocked. Checkout redirect confirmed.',
  },
];

console.log(JSON.stringify(proofTemplates, null, 2));
console.log('');
console.log('======================================================');
console.log(' END -- All 9 Stripe proof IDs remain PENDING');
console.log(' Public launch: NO-GO until all 30 required proofs verified');
console.log('======================================================');
console.log('');
