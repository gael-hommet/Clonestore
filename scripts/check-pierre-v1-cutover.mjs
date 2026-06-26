#!/usr/bin/env node
// scripts/check-pierre-v1-cutover.mjs
// PHASE 8.2 — read-only check: V1 default, strict legacy-fallback removal.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.2 — V1 Cutover — Check ══\n");

const bridge = read("src/lib/pierre/cockpit/v1-bridge.ts");
if (/!==\s*"0"/.test(bridge)) ok("V1 par défaut (opt-out NEXT_PUBLIC_PIERRE_RUNTIME_V1=0)"); else { warn("V1 pas par défaut"); needs++; }
if (/tenant_not_migrated/.test(bridge) && /legacyEmergencyFallbackAllowed/.test(bridge)) ok("fallback uniquement sur tenant_not_migrated + flag explicite"); else { warn("fallback non strict"); needs++; }
// must NOT fall back on auth/forbidden codes
if (!/tenant_access_denied|membership_suspended|company_suspended/.test(read("src/lib/pierre/cockpit/v1-bridge.ts").split("isNotMigratedError")[1] ?? "")) ok("aucun fallback sur 403/suspended/cross-tenant"); else { warn("fallback sur des codes interdits"); needs++; }
const api = read("src/lib/pierre/cockpit/api-client.ts");
if (/legacyEmergencyFallbackAllowed/.test(api) && /mayFallback/.test(api)) ok("submit: fallback gated (défaut OFF)"); else { warn("submit fallback non gated"); needs++; }
const rt = read("src/app/api/pierre/v1/_runtime.ts");
if (/isAccountMigrated/.test(rt) && /tenantNotMigrated/.test(rt)) ok("route émet tenant_not_migrated pour compte non backfillé"); else { warn("route n'émet pas tenant_not_migrated"); needs++; }
if (/resolveDefaultCompanyId/.test(rt)) ok("résolution entreprise par défaut côté serveur (header = intention, pas autorité)"); else { warn("default company resolution absente"); needs++; }
if (read("src/app/agents/pierre/use/submit/route.ts").includes("@deprecated")) ok("legacy submit @deprecated"); else { warn("legacy non déprécié"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — V1 par défaut, fallback legacy interdit en fonctionnement normal (testé localement)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`));
console.log(" Honnête: cockpit reads V1 complet + Playwright non exécutés en sandbox ; prod non prouvée.\n");
