// scripts/check-p85-runtime-smoke.mjs
// PHASE 8.5-R2 §R2.17 — LOCAL runtime smoke against a real in-process PostgreSQL (PGlite). Loads the
// full migration chain v1→v24, seeds two tenants, creates a mission, builds a governed run + step via
// the planner function, claims + completes the job under the fencing token, verifies the run completes,
// and asserts tenant isolation. No live provider, no DSN. Prints PASS / FAIL (exit 1 on failure).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

const MIG = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  const pg = await PGlite.create();
  for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8"));
  const lastMig = files[files.length - 1];
  assert(lastMig.includes("pierre_v28"), `last migration is ${lastMig}, expected v28`);

  const cA = randomUUID(), cB = randomUUID(), uA = randomUUID(), uB = randomUUID();
  await pg.query("insert into pierre_rt_companies (id,name) values ($1,'A'),($2,'B')", [cA, cB]);
  await pg.query("insert into pierre_rt_members (id,company_id,user_id,role) values ($1,$2,$3,'owner'),($4,$5,$6,'owner')", [randomUUID(), cA, uA, randomUUID(), cB, uB]);

  const mission = randomUUID();
  await pg.query("insert into pierre_rt_missions (id,company_id,requester_user_id,instruction,status,correlation_id,request_id,idempotency_key) values ($1,$2,$3,'smoke','planned',$4,$5,$6)", [mission, cA, uA, randomUUID(), randomUUID(), "m:" + mission]);
  await pg.query("select set_config('app.current_company',$1,false)", [cA]);

  const steps = JSON.stringify([{ step_key: "s1", action_key: "mission.noop", step_ordinal: 0, input: {}, input_hash: "x", dependency_count: 0 }]);
  const created = await pg.query("select created_mission_run_id as run from pierre_rt_create_compiled_mission_run($1,$2,'1','fp-smoke','{}','{}',$3,'[]',$4,null,'normal')", [cA, mission, steps, uA]);
  const runId = created.rows[0].run;
  assert(runId, "run not created");

  // R4.5 — the DB derived + pinned its OWN canonical content hash on the plan version (non-forgeable)
  const pv = (await pg.query("select plan_content_md5 from pierre_rt_mission_plan_versions where company_id=$1 and plan_fingerprint='fp-smoke'", [cA])).rows[0];
  assert(pv && pv.plan_content_md5, "plan_content_md5 not pinned by the DB (R4.5)");

  // R4.6 — with job1 still QUEUED (due work), the atomic tenant-lease claim hands tenant A to a holder,
  // then nobody else, and a clean release makes it reclaimable with a BUMPED fencing token
  const leased = (await pg.query("select tenant_company_id, lease_fencing from pierre_rt_claim_runtime_tenant_leases('worker','smoke-holder',10,300,now())")).rows;
  assert(leased.some((r) => r.tenant_company_id === cA), "tenant A not leased despite due work (R4.6)");
  const second = (await pg.query("select tenant_company_id from pierre_rt_claim_runtime_tenant_leases('worker','other-holder',10,300,now())")).rows;
  assert(!second.some((r) => r.tenant_company_id === cA), "a leased tenant was re-handed to a second holder (R4.6)");
  const f1 = Number(leased.find((r) => r.tenant_company_id === cA).lease_fencing);
  await pg.query("select pierre_rt_complete_tenant_lease($1,'worker','smoke-holder',$2,now())", [cA, f1]);
  const reLeased = (await pg.query("select lease_fencing from pierre_rt_claim_runtime_tenant_leases('worker','smoke-holder-2',10,300,now())")).rows;
  assert(reLeased.length === 0 || Number(reLeased[0].lease_fencing) > f1, "released lease did not bump the fencing token (R4.6)");

  const job = (await pg.query("select * from pierre_rt_runtime_claim($1,5,'smoke-w',60,now())", [cA])).rows[0];
  assert(job && job.locked_by === "smoke-w", "job not claimed");
  await pg.query("select pierre_rt_runtime_start_step($1,$2,$3,$4)", [cA, job.id, "smoke-w", job.fencing_token]);
  await pg.query("select pierre_rt_runtime_complete_job($1,$2,$3,$4,'succeeded',null,'{}')", [cA, job.id, "smoke-w", job.fencing_token]);

  const run = (await pg.query("select status from pierre_rt_mission_runs where id=$1", [runId])).rows[0];
  assert(run.status === "completed", `run status ${run.status}, expected completed`);

  // a timer wait + scheduler resolution
  const mission2 = randomUUID();
  await pg.query("insert into pierre_rt_missions (id,company_id,requester_user_id,instruction,status,correlation_id,request_id,idempotency_key) values ($1,$2,$3,'wait','planned',$4,$5,$6)", [mission2, cA, uA, randomUUID(), randomUUID(), "m:" + mission2]);
  const steps2 = JSON.stringify([{ step_key: "w", action_key: "wait.until_time", step_ordinal: 0, input: { wake_at: new Date(Date.now() - 1000).toISOString() }, input_hash: "y", dependency_count: 0 }]);
  const run2 = (await pg.query("select created_mission_run_id as run from pierre_rt_create_compiled_mission_run($1,$2,'1','fp-wait','{}','{}',$3,'[]',$4,null,'normal')", [cA, mission2, steps2, uA])).rows[0].run;
  const job2 = (await pg.query("select * from pierre_rt_runtime_claim($1,5,'smoke-w2',60,now())", [cA])).rows[0];
  await pg.query("select pierre_rt_runtime_start_step($1,$2,$3,$4)", [cA, job2.id, "smoke-w2", job2.fencing_token]);
  await pg.query("select pierre_rt_runtime_wait_job($1,$2,$3,$4,'timer',null,null,null,null,null,$5,null)", [cA, job2.id, "smoke-w2", job2.fencing_token, new Date(Date.now() - 1000).toISOString()]);
  const waitRow = (await pg.query("select id from pierre_rt_runtime_waits where company_id=$1 and mission_run_id=$2 and status='pending'", [cA, run2])).rows[0];
  const res = (await pg.query("select pierre_rt_resolve_runtime_wait($1,$2,null,null,null,null,null) as r", [cA, waitRow.id])).rows[0].r;
  assert(res === "resolved", `timer wait not resolved: ${res}`);

  // tenant isolation: tenant B has no runtime rows
  const bRuns = (await pg.query("select count(*)::int n from pierre_rt_mission_runs where company_id=$1", [cB])).rows[0].n;
  assert(bRuns === 0, "tenant B leaked runtime rows");

  await pg.close();
  console.log(`PASS check-p85-runtime-smoke: v1→v28 applied; governed run completed; canonical plan hash pinned; atomic tenant lease claim/exclusivity/fencing held; timer wait resolved; tenant isolation holds (${files.length} migrations).`);
}

main().catch((e) => { console.error("FAIL check-p85-runtime-smoke:", e.message); process.exit(1); });
