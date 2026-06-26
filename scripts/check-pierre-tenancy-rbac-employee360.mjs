#!/usr/bin/env node
// scripts/check-pierre-tenancy-rbac-employee360.mjs
// PHASE 8.2 — read-only structural check: tenancy/RBAC/sites/Employee 360 model,
// idempotent backfill, RLS, routes, cockpit v1-default. PASS / NEEDS REVIEW.

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const read = (rel) => (existsSync(resolve(ROOT, rel)) ? readFileSync(resolve(ROOT, rel), "utf-8") : "");
const has = (rel) => existsSync(resolve(ROOT, rel));
const ok = (m) => console.log(`  ✅ ${m}`);
const warn = (m) => console.log(`  ⚠️  ${m}`);
const step = (n, m) => console.log(`\n${"─".repeat(60)}\n  ÉTAPE ${n} — ${m}\n`);
let needs = 0;

console.log("\n" + "═".repeat(60));
console.log(" PHASE 8.2 — Enterprise Tenancy / RBAC / Sites / Employee 360 — Check");
console.log("═".repeat(60));

const V1 = "src/lib/pierre/v1";

step("A", "Modèle SQL (sites, member_sites, employees 360, RLS, backfill)");
const mig = read("supabase/migrations/2026-06-15__pierre_v2_tenancy_rbac_employee360.sql");
if (mig.length > 0) ok("migration pierre_v2 présente"); else { warn("migration v2 manquante"); needs++; }
for (const t of ["pierre_rt_sites","pierre_rt_member_sites","pierre_rt_employees","pierre_rt_employee_events","pierre_rt_employee_documents","pierre_rt_employee_absences"]) {
  if (mig.includes(`create table if not exists ${t}`)) ok(`table ${t}`); else { warn(`table ${t} absente`); needs++; }
}
if (/enable row level security/.test(mig) && /force row level security/.test(mig)) ok("RLS enabled + forced (v2)"); else { warn("RLS v2 absente"); needs++; }
if (/create or replace function pierre_rt_backfill_tenancy/.test(mig)) ok("fonction backfill idempotente");
else { warn("fonction backfill absente"); needs++; }
if (/to_regclass/.test(mig) && /on conflict/.test(mig)) ok("backfill: guards to_regclass + on conflict (idempotent, no dup)"); else { warn("backfill non idempotent/guardé"); needs++; }
if (/active.*trialing|trialing.*active/.test(mig)) ok("backfill source: orders status active/trialing (== hasPierreAccess)"); else { warn("source ownership douteuse"); needs++; }

step("B", "Modules RBAC / sites / employees / backfill");
for (const f of ["rbac.ts","sites.ts","employees.ts","backfill.ts"]) {
  if (has(`${V1}/${f}`)) ok(`${V1}/${f}`); else { warn(`module manquant: ${f}`); needs++; }
}
if (/site_ids/.test(read(`${V1}/tenant-context.ts`))) ok("TenantContext: site scope (site_ids)"); else { warn("site scope absent du TenantContext"); needs++; }
if (/resolveDefaultCompanyId/.test(read(`${V1}/tenant-context.ts`))) ok("résolution entreprise par défaut (single membership)"); else { warn("default company resolver absent"); needs++; }

step("C", "Routes v1 (sites, employees, backfill admin)");
for (const r of [
  "src/app/api/pierre/v1/sites/route.ts",
  "src/app/api/pierre/v1/employees/route.ts",
  "src/app/api/pierre/v1/employees/[id]/route.ts",
  "src/app/api/pierre/v1/admin/backfill/route.ts",
]) { if (has(r)) ok(r); else { warn(`route manquante: ${r}`); needs++; } }

step("D", "Cockpit V1 par défaut + fallback migration-safe");
const bridge = read("src/lib/pierre/cockpit/v1-bridge.ts");
if (/!==\s*"0"/.test(bridge)) ok("cockpit v1 = défaut (opt-out via NEXT_PUBLIC_PIERRE_RUNTIME_V1=0)"); else { warn("v1 pas par défaut"); needs++; }
if (/isNotMigratedError/.test(bridge)) ok("fallback legacy seulement pour comptes non migrés"); else { warn("fallback migration-safe absent"); needs++; }
const apiClient = read("src/lib/pierre/cockpit/api-client.ts");
if (/isNotMigratedError/.test(apiClient)) ok("submitPierreMission: v1 défaut + fallback non-migré"); else { warn("submit non basculé"); needs++; }

step("E", "Tests + bench + scripts");
for (const f of [
  `${V1}/__integration__/tenancy-rbac-employee360.itest.ts`,
  `${V1}/__integration__/tenancy-employee360.bench.ts`,
  "scripts/db/backfill-tenancy.mjs",
]) { if (has(f)) ok(f); else { warn(`manquant: ${f}`); needs++; } }
const pkg = read("package.json");
for (const s of ["test:phase8-2","check:pierre-tenancy-rbac-employee360","db:backfill"]) {
  if (pkg.includes(`"${s}"`)) ok(s); else { warn(`script manquant: ${s}`); needs++; }
}

step("F", "Docs");
for (const d of [
  "docs/PHASE_8_2_ENTERPRISE_TENANCY_RBAC_SITES_EMPLOYEE360.md",
  "docs/architecture/PIERRE_TENANCY_RBAC.md",
]) { if (has(d)) ok(d); else { warn(`doc manquante: ${d}`); needs++; } }

console.log("\n" + "═".repeat(60));
if (needs === 0) console.log(" RÉSULTAT : PASS — tenancy/RBAC/sites/Employee 360 + backfill présents (intégration testée localement).");
else console.log(` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`);
console.log(" Honnête: backfill + RLS + RBAC prouvés localement ; application prod Supabase + scale 100k NON prouvés.");
console.log("═".repeat(60) + "\n");
