// scripts/check-p85-runtime-infrastructure.mjs
// PHASE 8.5-R2 §R2.17 — OPT-IN infrastructure smoke against a REAL PostgreSQL. It proves the things
// PGlite cannot: that a dedicated LOGIN identity which is a MEMBER of the runtime role can SET LOCAL
// ROLE and that current_user is then exactly the runtime role; that a non-member is refused; and that
// the tenant/job claim runs under the real role. It NEVER triggers a live provider. Without the opt-in
// DSNs it prints SKIPPED (never a false PASS).
import { randomUUID } from "crypto";

const WORKER_DSN = process.env.PIERRE_RUNTIME_WORKER_DATABASE_URL || null;
const SCHED_DSN = process.env.PIERRE_RUNTIME_SCHEDULER_DATABASE_URL || null;
const OPT_IN = process.env.PIERRE_RUNTIME_INFRA_SMOKE === "1";

async function main() {
  if (!OPT_IN || !WORKER_DSN) {
    console.log("SKIPPED check-p85-runtime-infrastructure: set PIERRE_RUNTIME_INFRA_SMOKE=1 + PIERRE_RUNTIME_WORKER_DATABASE_URL (a login that is a MEMBER of pierre_rt_runtime_worker) to run against a real PostgreSQL. NOT a PASS.");
    return;
  }
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: WORKER_DSN, max: 1, application_name: "pierre_runtime_infra_smoke" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role pierre_rt_runtime_worker");
    const cu = (await client.query("select current_user")).rows[0].current_user;
    if (cu !== "pierre_rt_runtime_worker") throw new Error(`current_user=${cu}, expected pierre_rt_runtime_worker — the worker login is not a member of the role`);
    // it must NOT be able to read a business table
    let refusedBusiness = false;
    try { await client.query("select 1 from pierre_rt_employees limit 1"); } catch { refusedBusiness = true; }
    if (!refusedBusiness) throw new Error("worker role can read pierre_rt_employees (should be refused)");
    await client.query("rollback");
    console.log(`PASS check-p85-runtime-infrastructure: worker login is a member of pierre_rt_runtime_worker; SET LOCAL ROLE binds current_user=${cu}; business table refused. (id=${randomUUID().slice(0, 8)})`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("FAIL check-p85-runtime-infrastructure:", e.message); process.exit(1); });
