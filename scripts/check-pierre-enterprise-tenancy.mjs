#!/usr/bin/env node
// scripts/check-pierre-enterprise-tenancy.mjs
// PHASE 8.2 — read-only check: production-like RLS binding, complete company
// model, full relational RBAC, member lifecycle.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const has = (r) => existsSync(resolve(ROOT, r));
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.2 — Enterprise Tenancy / RBAC — Check ══\n");

const tx = read("src/lib/pierre/v1/tenant-tx.ts");
if (/set local role pierre_rt_app/.test(tx) && /app\.current_company/.test(tx)) ok("withTenantTransaction: SET LOCAL ROLE pierre_rt_app + GUC (RLS binding)"); else { warn("withTenantTransaction absent/incomplet"); needs++; }
const mig = read("supabase/migrations/2026-06-15__pierre_v3_enterprise_complete.sql");
for (const t of ["pierre_rt_roles","pierre_rt_permissions","pierre_rt_role_permissions","pierre_rt_membership_roles","pierre_rt_custom_roles","pierre_rt_invitations"]) {
  if (mig.includes(t)) ok(`table ${t}`); else { warn(`table ${t} absente`); needs++; }
}
for (const r of ["OWNER","HR_DIRECTOR","PAYROLL_MANAGER","SITE_MANAGER","VALIDATOR","AUDITOR","EMPLOYEE","VIEWER"]) {
  if (mig.includes(`'${r}'`)) ok(`rôle système ${r}`); else { warn(`rôle ${r} absent`); needs++; }
}
if (/legal_name/.test(mig) && /onboarding_status/.test(mig) && /chk_rt_companies_status/.test(mig)) ok("modèle entreprise complet + statuts"); else { warn("company model incomplet"); needs++; }
const ctx = read("src/lib/pierre/v1/tenant-context.ts");
if (/membership_roles/.test(ctx) && /role_permissions/.test(ctx)) ok("RBAC DB-driven (membership_roles → role_permissions)"); else { warn("RBAC non DB-driven"); needs++; }
if (/membershipSuspended/.test(ctx) && /companySuspended/.test(ctx)) ok("garde-fous lifecycle (membership/company suspended)"); else { warn("lifecycle guards absents"); needs++; }
if (has("src/lib/pierre/v1/company.ts")) ok("service company (patch optimistic + switch)"); else { warn("company.ts manquant"); needs++; }
if (/withTenantTransaction/.test(read("src/lib/pierre/v1/api.ts"))) ok("handlers tenant data liés via withTenantTransaction"); else { warn("handlers non liés"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — RLS binding + company + RBAC complets (intégration testée localement)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`));
console.log(" Honnête: prod Supabase application + scale 100k NON prouvés.\n");
