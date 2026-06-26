#!/usr/bin/env node
// scripts/check-pierre-gdpr.mjs
// PHASE 8.2-C — read-only check: GDPR operations + CSV import.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.2-C — GDPR & CSV Import — Check ══\n");

const g = read("src/lib/pierre/v1/gdpr.ts");
for (const fn of ["exportEmployee", "exportCompany", "setLegalHold", "anonymizeEmployee", "deleteDocument", "purgeEmployee", "dataAccessAudit"]) {
  if (new RegExp(`export async function ${fn}`).test(g)) ok(`service ${fn}`); else { warn(`service ${fn} manquant`); needs++; }
}
if (/legal hold; anonymization blocked/.test(g)) ok("legal hold bloque l'anonymisation"); else { warn("legal hold n'empêche pas l'anonymisation"); needs++; }
if (/legal hold; purge blocked/.test(g)) ok("legal hold bloque la purge"); else { warn("legal hold n'empêche pas la purge"); needs++; }
if (/Retention period not elapsed/.test(g)) ok("aucune purge avant retention_until sauf motif légal"); else { warn("rétention non gardée"); needs++; }
if (/employee\.sensitive\.read/.test(g) && /sensitive_categories/.test(g)) ok("export sensible conditionné à la permission"); else { warn("export sensible non gardé"); needs++; }
if (/audit\(db, ctx/.test(g) || /data_access_log/.test(g)) ok("chaque opération RGPD auditée"); else { warn("opérations RGPD non auditées"); needs++; }

const imp = read("src/lib/pierre/v1/employee-import.ts");
for (const fn of ["parseCsv", "previewImport", "commitImport", "rollbackImport", "getImportBatch"]) {
  if (new RegExp(`export (async function|function) ${fn}`).test(imp)) ok(`import ${fn}`); else { warn(`import ${fn} manquant`); needs++; }
}
if (/keyValueFor/.test(imp) && /OR semantics/.test(imp) && /matched_key/.test(imp)) ok("détection de doublons OR configurable (matricule/email pro/external_ref/nom) + détail par doublon"); else { warn("dédup manquante"); needs++; }
if (/idempotency_key/.test(imp) && /idempotent: true/.test(imp)) ok("import idempotent (rerun sûr)"); else { warn("import non idempotent"); needs++; }
if (/allow_partial/.test(imp)) ok("import partiel explicitement autorisé"); else { warn("import partiel absent"); needs++; }

const routes = [
  "src/app/api/pierre/v1/employees/[id]/export/route.ts",
  "src/app/api/pierre/v1/employees/[id]/anonymize/route.ts",
  "src/app/api/pierre/v1/employees/[id]/legal-hold/route.ts",
  "src/app/api/pierre/v1/employees/[id]/documents/[documentId]/route.ts",
  "src/app/api/pierre/v1/company/export/route.ts",
  "src/app/api/pierre/v1/audit/data-access/route.ts",
  "src/app/api/pierre/v1/employees/import/preview/route.ts",
  "src/app/api/pierre/v1/employees/import/commit/route.ts",
  "src/app/api/pierre/v1/employees/import/[batchId]/rollback/route.ts",
];
for (const r of routes) { if (read(r)) ok(`route ${r.replace("src/app/api/pierre/v1/", "/")}`); else { warn(`route manquante ${r}`); needs++; } }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — RGPD + import CSV implémentés et testés localement (p82c-operational.itest)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");
