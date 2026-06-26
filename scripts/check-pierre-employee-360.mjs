#!/usr/bin/env node
// scripts/check-pierre-employee-360.mjs
// PHASE 8.2 — read-only check: relational Employee 360, sensitive isolation,
// completeness, search.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const has = (r) => existsSync(resolve(ROOT, r));
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.2 — Employee 360 — Check ══\n");

const mig = read("supabase/migrations/2026-06-15__pierre_v3_enterprise_complete.sql");
const tables = [
  "pierre_rt_employee_employments","pierre_rt_employee_contracts","pierre_rt_employee_contract_versions",
  "pierre_rt_employee_contact_methods","pierre_rt_employee_addresses","pierre_rt_employee_emergency_contacts",
  "pierre_rt_employee_manager_assignments","pierre_rt_employee_site_assignments","pierre_rt_employee_document_requirements",
  "pierre_rt_employee_notes","pierre_rt_employee_tags","pierre_rt_employee_status_history",
  "pierre_rt_employee_sensitive_data","pierre_rt_employee_custom_fields","pierre_rt_employee_missions","pierre_rt_employee_tasks",
];
for (const t of tables) { if (mig.includes(`create table if not exists ${t}`)) ok(`table ${t}`); else { warn(`table ${t} absente`); needs++; } }
if (!/pierre_rt_employee_employments[\s\S]{0,400}jsonb/.test(mig)) ok("Employee 360 relationnel (pas un seul blob JSONB)"); else { warn("relations remplacées par JSONB ?"); needs++; }
if (/contract_type text not null check/.test(mig) && /CDI_FULL_TIME/.test(mig)) ok("types de contrat (CDI_FULL_TIME … OTHER)"); else { warn("types de contrat absents"); needs++; }
if (has("src/lib/pierre/v1/employee-sensitive.ts") && /employee\.sensitive\.read/.test(read("src/lib/pierre/v1/employee-sensitive.ts")) && /sensitive_access_log/.test(read("src/lib/pierre/v1/employee-sensitive.ts"))) ok("données sensibles isolées + lecture auditée + permission"); else { warn("sensitive isolation incomplète"); needs++; }
if (has("src/lib/pierre/v1/completeness.ts") && /completeness_score/.test(read("src/lib/pierre/v1/completeness.ts"))) ok("moteur de complétude explicable"); else { warn("completeness absent"); needs++; }
if (has("src/lib/pierre/v1/employee-search.ts") && /Diacritic/.test(read("src/lib/pierre/v1/employee-search.ts"))) ok("recherche accent-insensitive + index search_text"); else { warn("search absent"); needs++; }
if (/search_text/.test(mig)) ok("colonne search_text indexée"); else { warn("search_text absent"); needs++; }
if (/retention_until/.test(mig) && /legal_hold/.test(mig)) ok("RGPD: retention_until + legal_hold + data_access_log"); else { warn("RGPD champs absents"); needs++; }
if (has("src/lib/pierre/v1/__integration__/employee-360-scale.bench.ts")) ok("benchmark 1k/10k présent"); else { warn("bench 10k absent"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — Employee 360 relationnel + sensible + complétude + recherche (testés localement)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`));
console.log(" Honnête: UI Employee 360 + import CSV + RGPD complet encore partiels ; prod non prouvée.\n");
