#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log("  OK  " + m); const warn = (m) => console.log("  !!  " + m); let n = 0;
console.log("\n== PHASE 8.3-B2G S5 — Contract Workflow ==\n");
const s = read("src/lib/pierre/v1/contract-state.ts"); const c = read("src/lib/pierre/v1/contracts.ts");
const mig = read("supabase/migrations/2026-06-21__pierre_v14_contract_workflow_guards.sql");
if (/assertContractTransition/.test(s) && /CONTRACT_TRANSITIONS/.test(s)) ok("central state machine"); else { warn("state machine missing"); n++; }
if (/emitContractEvent/.test(s) && /pierre_rt_log_contract_event/.test(s) && /document_access_log/.test(s) && /pierre_rt_outbox/.test(s)) ok("SECURITY DEFINER audit + CloneTrace + outbox"); else { warn("events incomplete"); n++; }
if (/pierre_rt_contract_workflow_guard/.test(mig) && /illegal contract workflow transition/.test(mig)) ok("DB state machine trigger"); else { warn("DB trigger missing"); n++; }
if (/pierre_rt_contract_version_guard/.test(mig) && /immutable/.test(mig)) ok("DB immutability trigger"); else { warn("immutability trigger missing"); n++; }
if (/generateContract/.test(c) && /(COMPENSATION|compensate|deleteObject)/.test(c)) ok("generation + storage compensation"); else { warn("compensation missing"); n++; }
if (/prepareContractSignature/.test(c) && /ready_for_signature/.test(c)) ok("signature preparation"); else { warn("signature preparation missing"); n++; }
console.log("\n" + (n === 0 ? " RESULTAT : PASS — structural checks OK; behavioural proof via Vitest: `npm run test:phase8-3-b2g` (counts from Vitest, never hardcoded)." : " RESULTAT : NEEDS REVIEW — " + n + ".") + "\n");
process.exit(n === 0 ? 0 : 1);
