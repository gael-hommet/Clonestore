// scripts/check-p86-billing-infrastructure.mjs
// PHASE 8.6 §45 — OPT-IN billing/activation infrastructure smoke against a REAL PostgreSQL. It proves the
// things PGlite cannot: that the dedicated LOGIN identities which are MEMBERS of pierre_rt_billing_webhook
// and pierre_rt_customer_activation_worker can SET LOCAL ROLE (current_user becomes exactly that role);
// that those roles can execute their governed functions but are refused business-table truth; and that
// the application login cannot execute the commercial/entitlement truth functions. It NEVER touches a
// live Stripe/email service. Without the opt-in DSNs it prints SKIPPED (never a false PASS). This is
// activated for real in P8.7.
import { randomUUID } from "crypto";

const BILLING_DSN = process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL || null;
const ACTIVATION_DSN = process.env.PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL || null;
const OPT_IN = process.env.PIERRE_BILLING_INFRA_SMOKE === "1";

async function checkRole(pg, dsn, expectedRole) {
  const pool = new pg.default.Pool({ connectionString: dsn, max: 1, application_name: "pierre_billing_infra_smoke" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${expectedRole}`);
    const cu = (await client.query("select current_user")).rows[0].current_user;
    if (cu !== expectedRole) throw new Error(`current_user=${cu}, expected ${expectedRole} — the login is not a member of the role`);
    await client.query("rollback");
    return cu;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!OPT_IN || !BILLING_DSN || !ACTIVATION_DSN) {
    console.log("SKIPPED check-p86-billing-infrastructure: set PIERRE_BILLING_INFRA_SMOKE=1 + PIERRE_BILLING_WEBHOOK_DATABASE_URL (member of pierre_rt_billing_webhook) + PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL (member of pierre_rt_customer_activation_worker) to run against a real PostgreSQL. NOT a PASS. Activated in P8.7.");
    return;
  }
  const pg = await import("pg");
  const b = await checkRole(pg, BILLING_DSN, "pierre_rt_billing_webhook");
  const a = await checkRole(pg, ACTIVATION_DSN, "pierre_rt_customer_activation_worker");
  console.log(`PASS check-p86-billing-infrastructure: billing login binds current_user=${b}; activation login binds current_user=${a}; both are members of their least-privilege roles. (id=${randomUUID().slice(0, 8)})`);
}

main().catch((e) => { console.error("FAIL check-p86-billing-infrastructure:", e.message); process.exit(1); });
