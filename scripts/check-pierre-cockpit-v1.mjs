#!/usr/bin/env node
// scripts/check-pierre-cockpit-v1.mjs
// PHASE 8.2-C — read-only check: cockpit reads & writes route to V1 only.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.2-C — Cockpit → V1 (reads + writes) — Check ══\n");

const api = read("src/lib/pierre/cockpit/api-client.ts");
// Reads route through the V1 client seam.
if (/async function callV1/.test(api)) ok("seam callV1 unique pour les lectures/décisions V1"); else { warn("callV1 absent"); needs++; }
for (const fn of ["fetchPierreMission", "fetchPierreHistory", "fetchPierreMissionTasks", "fetchPierreMissionTimeline", "fetchPierreMissionValidations", "fetchPierreWorkerState"]) {
  const body = api.split(`export async function ${fn}`)[1]?.split("export ")[0] ?? "";
  if (body && /callV1\(/.test(body)) ok(`${fn} → V1`); else { warn(`${fn} ne route pas vers V1`); needs++; }
}
for (const fn of ["approvePierreValidation", "rejectPierreValidation", "requestPierreValidationChanges", "cancelPierreMission"]) {
  if (new RegExp(`export async function ${fn}`).test(api)) ok(`décision V1 ${fn}`); else { warn(`décision V1 ${fn} manquante`); needs++; }
}
// No active legacy read for missions (fetchPierreMission must NOT directly safeFetch the legacy mission endpoint).
const missionBody = api.split("export async function fetchPierreMission")[1]?.split("export ")[0] ?? "";
if (!/safeFetch\(`\/api\/pierre\/use\/mission/.test(missionBody) || /legacyEndpoint/.test(missionBody)) ok("aucune lecture mission legacy active (fallback gated uniquement)"); else { warn("lecture mission legacy active"); needs++; }
// Legacy task endpoints emit a metric/alert.
if (/recordLegacyFallbackUsed/.test(api)) ok("métrique + alerte si legacy est appelé"); else { warn("pas de métrique legacy"); needs++; }
// Write path default V1.
if (/pierreRuntimeV1Enabled\(\)/.test(api) && /createCockpitV1Client/.test(api)) ok("écriture mission V1 par défaut"); else { warn("écriture non V1"); needs++; }
// No direct legacy submit in new code path (only as gated fallback).
if (/mayFallback/.test(api)) ok("submit legacy seulement en fallback gated (tenant_not_migrated + flag)"); else { warn("submit legacy non gated"); needs++; }

const bridge = read("src/lib/pierre/cockpit/v1-bridge.ts");
if (/recordLegacyFallbackUsed/.test(bridge) && /pierre:legacy-fallback/.test(bridge)) ok("event/alerte legacy exposé (pierre:legacy-fallback)"); else { warn("event legacy absent"); needs++; }

// Active hook is V1-only (no legacy task functions, imports the V1 lifecycle).
const hook = read("src/app/agents/pierre/use/hooks/usePierreCockpit.ts");
const legacyFns = ["approvePierreTask", "cancelPierreTask", "runPierreTask", "reschedulePierreTask"];
if (legacyFns.every((f) => !hook.includes(f))) ok("hook actif sans fonction task legacy"); else { warn("hook actif référence une fonction legacy"); needs++; }
if (["approvePierreValidation", "cancelPierreMission", "fetchPierreWorkerState", "fetchPierreMissionValidations"].every((f) => hook.includes(f))) ok("hook actif utilise le cycle de validation V1 + worker"); else { warn("hook n'utilise pas le cycle V1"); needs++; }
if (!/\/api\/pierre\/use\/(task|mission|continuity|submit)/.test(hook)) ok("aucune URL legacy dans le hook actif"); else { warn("URL legacy dans le hook"); needs++; }
// Legacy task functions decommissioned from api-client.
if (legacyFns.every((f) => !new RegExp(`export async function ${f}`).test(api))) ok("fonctions task legacy retirées d'api-client"); else { warn("fonctions task legacy encore exportées"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — lectures et écritures cockpit via V1 ; legacy seulement en fallback gated + alerté. (UI non exécutée en sandbox : honnête.)"
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");
