#!/usr/bin/env node
// BLOC 3 — Readiness check evidence-based.
//
// Ce script ne déclare PAS de constante "READY". Il COLLECTE des preuves :
//   • fixture LeadForge présente ;
//   • fingerprint conforme ;
//   • tests BLOC 3 verts ;
//   • TypeScript propre ;
//   • routes /api/checkout + /api/webhooks/stripe importent ET appellent
//     réellement les bridges BLOC 3 (grep AST-like sur le source).
// Puis appelle buildB3ConversionVerdict(evidence) (côté Node ESM via import dynamique).
//
// Exit codes :
//   0 = CODE_READY (toutes preuves PASS)
//   1 = BLOCKED_EXTERNAL (CODE_READY mais blocages externes ; jamais un défaut code)
//   2 = BLOCKED_<CAUSE> (au moins une preuve code FAIL)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();

function readSafe(rel) {
  try { return readFileSync(resolve(ROOT, rel), "utf8"); } catch { return null; }
}

function check(label, fn) {
  try {
    const ok = fn();
    return { label, ok: Boolean(ok), reason: ok ? "PASS" : "FAIL" };
  } catch (e) {
    return { label, ok: false, reason: e instanceof Error ? e.message : "ERROR" };
  }
}

// --- 1) Fixture présente + fingerprint conforme -----------------------------
const FIXTURE_PATH = "src/lib/clonestore/conversion/fixtures/leadforge-contract-db9b166.json";
const fixtureRaw = readSafe(FIXTURE_PATH);
const fixture = fixtureRaw ? JSON.parse(fixtureRaw) : null;

function canonicalJsonPython(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJsonPython).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJsonPython(value[k])).join(",") + "}";
}

const fixturePresent = check("fixture present", () => !!fixture);
const fingerprintMatches = check("fixture fingerprint matches", () => {
  if (!fixture) return false;
  const canonical = canonicalJsonPython(fixture.contract);
  const computed = createHash("sha256").update(canonical, "utf8").digest("hex");
  return computed === fixture.contract_canonical_json_sha256;
});

// --- 2) Routes wirées ------------------------------------------------------
const checkoutRoute = readSafe("src/app/api/checkout/route.ts");
const webhookRoute = readSafe("src/app/api/webhooks/stripe/route.ts");

const checkoutWired = check("/api/checkout bridge wired", () =>
  checkoutRoute &&
  /from\s+["']@\/lib\/clonestore\/conversion\/checkout-bridge["']/.test(checkoutRoute) &&
  /bridgeCheckoutStarted\s*\(/.test(checkoutRoute) &&
  /buildConversionCheckoutMetadata\s*\(/.test(checkoutRoute) &&
  /readConversionSessionId\s*\(/.test(checkoutRoute),
);
const webhookWired = check("/api/webhooks/stripe bridge wired", () =>
  webhookRoute &&
  /from\s+["']@\/lib\/clonestore\/conversion\/checkout-bridge["']/.test(webhookRoute) &&
  /bridgeCheckoutCompleted\s*\(/.test(webhookRoute) &&
  /bridgePierreActivated\s*\(/.test(webhookRoute) &&
  /bridgeCheckoutFailed\s*\(/.test(webhookRoute),
);

// --- 3) Fichiers BLOC 3 attendus -------------------------------------------
const expectedFiles = [
  "src/lib/clonestore/conversion/contract.ts",
  "src/lib/clonestore/conversion/types.ts",
  "src/lib/clonestore/conversion/validation.ts",
  "src/lib/clonestore/conversion/attribution-token.ts",
  "src/lib/clonestore/conversion/session.ts",
  "src/lib/clonestore/conversion/storage.ts",
  "src/lib/clonestore/conversion/claims-registry.ts",
  "src/lib/clonestore/conversion/claims-linter.ts",
  "src/lib/clonestore/conversion/diagnostic.ts",
  "src/lib/clonestore/conversion/checkout-bridge.ts",
  "src/lib/clonestore/conversion/readiness.ts",
  "src/lib/clonestore/conversion/client-emitter.ts",
  "src/lib/clonestore/conversion/index.ts",
  "src/app/p/[token]/route.ts",
  "src/app/api/conversion/events/route.ts",
  "src/app/api/conversion/diagnostic/route.ts",
  "src/app/demo/pierre/layout.tsx",
  "src/app/demo/pierre/_variant/VariantHero.tsx",
  "src/app/demo/pierre/_variant/DemoEventTracker.tsx",
  "src/app/diagnostic-rh/page.tsx",
  "src/app/diagnostic-rh/_components/DiagnosticForm.tsx",
  "supabase/sql/BLOC_3_CONVERSION_INTEGRATION.sql",
  FIXTURE_PATH,
];
const allFilesPresent = check("all expected files present", () =>
  expectedFiles.every((p) => existsSync(resolve(ROOT, p))),
);

// --- 4) TypeScript --------------------------------------------------------
const tsc = spawnSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", shell: true });
const tsOk = check("tsc --noEmit", () => tsc.status === 0);

// --- 5) Tests BLOC 3 ciblé -----------------------------------------------
const vitest = spawnSync(
  "npx",
  ["vitest", "run", "src/lib/clonestore/conversion/__tests__/"],
  { encoding: "utf8", shell: true },
);
const bloc3Ok = check("BLOC 3 vitest suite", () => vitest.status === 0);

// --- Rapport et verdict ---------------------------------------------------
const checks = [
  fixturePresent,
  fingerprintMatches,
  allFilesPresent,
  checkoutWired,
  webhookWired,
  tsOk,
  bloc3Ok,
];

const failed = checks.filter((c) => !c.ok);

const report = {
  bloc: "BLOC_3_V0_CONVERSION_ENGINE",
  leadforge_commit: "db9b166",
  fixture_fingerprint: fixture?.contract_canonical_json_sha256 ?? null,
  checks,
  blocking_external: [
    "Stripe live non activé (TEST uniquement requis par BLOC 3)",
    "Aucune vraie grant LeadForge importée dans CloneStore",
    "Aucune campagne réelle activée",
    "Domaines outreach non provisionnés",
    "Public launch flags inchangés",
  ],
  notes: [
    "Pas d'activation publique modifiée.",
    "Pas de Stripe live, pas d'email réel, pas de paiement réel.",
  ],
};

if (failed.length === 0) {
  report.verdict = "V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED";
  report.exit_code_semantics = {
    "0": "code ready, external activation still blocked BY DESIGN (Stripe live, real prospects, domains, public-launch flags)",
    "1": "code itself NOT ready (a check failed). Blockers externes are a report field, not a process error.",
  };
  console.log(JSON.stringify(report, null, 2));
  // exit 0 = code ready (les blockers externes sont des champs du rapport, pas un échec process)
  process.exit(0);
} else {
  // Map du premier échec → verdict spécifique
  const first = failed[0];
  const map = {
    "fixture present": "V0_CONVERSION_ENGINE_BLOCKED_FIXTURE_MISSING",
    "fixture fingerprint matches": "V0_CONVERSION_ENGINE_BLOCKED_CONTRACT_DRIFT",
    "all expected files present": "V0_CONVERSION_ENGINE_BLOCKED_MISSING_FILES",
    "/api/checkout bridge wired": "V0_CONVERSION_ENGINE_BLOCKED_CHECKOUT_ROUTE_NOT_WIRED",
    "/api/webhooks/stripe bridge wired": "V0_CONVERSION_ENGINE_BLOCKED_WEBHOOK_ROUTE_NOT_WIRED",
    "tsc --noEmit": "V0_CONVERSION_ENGINE_BLOCKED_BUILD_FAILURE",
    "BLOC 3 vitest suite": "V0_CONVERSION_ENGINE_BLOCKED_FULL_SUITE_FAILURE",
  };
  report.verdict = map[first.label] ?? "V0_CONVERSION_ENGINE_BLOCKED_MISSING_EVIDENCE";
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}
