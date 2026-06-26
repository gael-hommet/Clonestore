#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const has = (r) => existsSync(resolve(ROOT, r));
const ok = (m) => console.log("  OK  " + m); const warn = (m) => console.log("  !!  " + m); let n = 0;
console.log("\n== PHASE 8.3-B2 — Document & Contract Core Closure ==\n");
const modules = ["document-types", "document-policy", "document-guard", "templates", "template-state", "field-policies", "custom-fields", "generation-context", "files", "file-storage", "signature-webhooks", "data-integrity-preflight", "contract-policies", "contract-readiness", "contract-render-model", "contract-template-compiler", "contract-state", "contracts"];
for (const f of modules) { if (has("src/lib/pierre/v1/" + f + ".ts")) ok(f); else { warn(f + " missing"); n++; } }
const migs = readdirSync(resolve(ROOT, "supabase/migrations"));
for (const v of ["v10", "v11", "v12", "v13", "v14", "v15"]) { if (migs.some((x) => x.includes("pierre_" + v + "_"))) ok("migration " + v); else { warn("migration " + v + " missing"); n++; } }
// R1 truth/bypass-closure invariants present in the real code + DB.
const cs = readFileSync(resolve(ROOT, "src/lib/pierre/v1/contracts.ts"), "utf-8");
const v15 = has("supabase/migrations/2026-06-22__pierre_v15_contract_truth_closure.sql") ? readFileSync(resolve(ROOT, "supabase/migrations/2026-06-22__pierre_v15_contract_truth_closure.sql"), "utf-8") : "";
const r1 = [
  ["R1.1 no parent in normal create", !/parent_contract_id\?:/.test(cs) && /pierre_rt_contract_parent_guard/.test(v15)],
  ["R1.2 role fail-closed", /assertContractRole/.test(cs)],
  ["R1.3 template-driven render", /compileContractTemplate/.test(cs)],
  ["R1.4 document workflow unified", /driveDocumentVersionToFinal/.test(cs)],
  ["R1.5 real recipients", /resolveSignatureRecipients/.test(cs) && /signatory_email/.test(v15)],
  ["R1.6 signature idempotency", /idempotency FIRST/.test(cs) || /idempotent: true/.test(cs)],
  ["R1.7 version coherence", /Reopen the contract/.test(cs)],
  ["R1.8 amendment truth", /amendment_reason/.test(cs) && /uq_pierre_rt_contract_amendment_idem/.test(v15)],
  ["R1.10 storage compensation", /__failBeforeCommit/.test(cs) && /storage_compensation_failed/.test(cs)],
  ["R1.11 DB invariants", /finalized document version/.test(v15) && /pierre_rt_signature_request_guard/.test(v15)],
];
for (const [label, present] of r1) { if (present) ok(label); else { warn(label + " missing"); n++; } }
if (has("docs/PHASE_8_3_B2G_CONTRACT_CORE.md") && has("docs/PHASE_8_3_B2_DOCUMENT_CONTRACT_CORE_CLOSURE.md")) ok("B2G + B2 closure docs"); else { warn("docs missing"); n++; }
console.log("\n" + (n === 0 ? " RESULTAT : PASS — structural closure OK; behavioural proof via Vitest: `npm run test:phase8-3-b2g` / `test:phase8-1` (counts from Vitest, never hardcoded)." : " RESULTAT : NEEDS REVIEW — " + n + ".") + "\n");
process.exit(n === 0 ? 0 : 1);
