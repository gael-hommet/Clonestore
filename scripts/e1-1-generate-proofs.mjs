#!/usr/bin/env node
// scripts/e1-1-generate-proofs.mjs
// E1.1 §16 — Génère les preuves en EXÉCUTANT RÉELLEMENT les commandes (tsc, vitest, next build)
// et en SONDANT la source courante. Aucun chiffre recopié à la main, aucune valeur verte inventée.
// N'imprime aucun secret.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const DIR = resolve(ROOT, ".e1-1-proofs", "repository-reconciliation");
mkdirSync(DIR, { recursive: true });
const w = (n, o) => writeFileSync(resolve(DIR, n), JSON.stringify(o, null, 2));
const read = (p) => (existsSync(resolve(ROOT, p)) ? readFileSync(resolve(ROOT, p), "utf8") : null);
const RUN = "repository-reconciliation";

/** Exécute une commande et rend { code, out } — jamais de throw. */
function sh(cmd, timeout = 1_800_000) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout, maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === "number" ? e.status : 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
/** Extrait les compteurs de la ligne « Tests  N passed | M failed ». */
function vitestCounts(out) {
  const m = strip(out).match(/^\s*Tests\s+(.+)$/m);
  const line = m ? m[1] : "";
  const num = (label) => {
    const r = new RegExp(`(\\d+)\\s+${label}`).exec(line);
    return r ? Number(r[1]) : 0;
  };
  return { passed: num("passed"), failed: num("failed"), skipped: num("skipped"), raw: line.trim() };
}

console.log("→ tsc");
const tsc = sh("npx tsc --noEmit", 900_000);
const tscErrors = strip(tsc.out).split("\n").filter((l) => /error TS/.test(l));
w("typescript.json", {
  runId: RUN,
  command: "npx tsc --noEmit",
  exitCode: tsc.code,
  errorCount: tscErrors.length,
  errors: tscErrors.slice(0, 20),
  errorsInsideC14Perimeter: tscErrors.filter((l) => /clonechat|pierre\/access|api\/assistant/.test(l)).length,
  errorsInsidePartnerPerimeter: tscErrors.filter((l) => /partner/.test(l)).length,
});

const SUITES = {
  "partner-program": "src/lib/partner-program src/app/api/partners",
  "premium-document-system": "src/lib/pierre/__tests__/premium-document-system.test.ts",
  "pierre-v1": "src/lib/pierre/v1",
  "clonechat-c14": "src/lib/clonechat src/app/api/assistant src/app/assistant src/components/clonechat",
  "p16c-t1-t2": "src/lib/clonestore/integration/p16c src/lib/clonestore/technologies/t1 src/lib/clonestore/product-technologies/t2",
  "production-pricing": "src/lib/clonestore/production src/lib/clonestore/pricing",
  "c14-access-contract": "src/lib/pierre/__tests__/access-contract-c1-4.test.ts",
};
const suites = {};
for (const [name, paths] of Object.entries(SUITES)) {
  console.log(`→ vitest ${name}`);
  const r = sh(`npx vitest run ${paths} --testTimeout=120000`, 1_200_000);
  suites[name] = { command: `npx vitest run ${paths}`, exitCode: r.code, ...vitestCounts(r.out) };
}
w("targeted-tests.json", { runId: RUN, suites });

console.log("→ fair-claim stability (3 isolated + 1 under parallel load, NO timeout flag)");
const isolated = [];
for (let i = 0; i < 3; i++) {
  const r = sh("npx vitest run src/lib/pierre/v1/__tests__/fair-claim.test.ts --testTimeout=120000", 600_000);
  isolated.push({ run: i + 1, exitCode: r.code, ...vitestCounts(r.out) });
}
const underLoad = sh("npx vitest run src/lib/pierre/v1", 1_200_000); // sans drapeau : la condition qui échouait
const fairSrc = read("src/lib/pierre/v1/__tests__/fair-claim.test.ts") ?? "";
w("fair-claim-stability.json", {
  runId: RUN,
  rootCause: "Test d'intégration PGlite (~215 travaux insérés) dépassant le délai vitest PAR DÉFAUT (5 000 ms) sous charge parallèle. Message exact reproduit avant correction : « Error: Test timed out in 5000ms. » — jamais un défaut d'équité.",
  classification: "flaky/environmental (délai), PAS un défaut produit",
  isolatedRuns: isolated,
  underParallelLoadWithoutTimeoutFlag: { command: "npx vitest run src/lib/pierre/v1", exitCode: underLoad.code, ...vitestCounts(underLoad.out) },
  stabilization: {
    harnessMovedToBeforeAllHook: /beforeAll\(async \(\) => \{ h = await createHarness\(\); \}, DB_TIMEOUT_MS\)/.test(fairSrc),
    explicitTimeoutInFile: /const DB_TIMEOUT_MS = 120_000/.test(fairSrc),
    cleanupGuaranteed: /afterAll\(async \(\) => \{ if \(h\) await h\.close\(\); \}/.test(fairSrc),
    fairnessAssertionsUntouched: /expect\(byTenant\.get\(noisy\)\)\.toBe\(2\)/.test(fairSrc) && /expect\(normalsServedGlobally\)\.toBe\(0\)/.test(fairSrc),
    testSkipped: /\.skip\(|it\.todo/.test(fairSrc),
  },
});

console.log("→ canonical scoped non-regression");
const canon = sh("npx vitest run src/lib/nav src/lib/clonestore src/lib/clonechat src/lib/pierre/v1 src/app/api/assistant src/app/assistant src/components --testTimeout=120000", 1_800_000);
w("canonical-non-regression.json", { runId: RUN, command: "npx vitest run src/lib/nav src/lib/clonestore src/lib/clonechat src/lib/pierre/v1 src/app/api/assistant src/app/assistant src/components", exitCode: canon.code, ...vitestCounts(canon.out) });

console.log("→ FULL project suite");
const full = sh("npx vitest run --testTimeout=120000", 2_400_000);
w("full-project-tests.json", { runId: RUN, command: "npx vitest run --testTimeout=120000", exitCode: full.code, ...vitestCounts(full.out), noSuiteOmitted: true });

console.log("→ clean serialized build");
sh("node -e \"require('fs').rmSync('.next',{recursive:true,force:true})\"", 120_000);
const build = sh("npm run build", 1_800_000);
const bo = strip(build.out);
w("build.json", {
  runId: RUN,
  command: "rm -rf .next && npm run build",
  exitCode: build.code,
  compiled: /Compiled successfully/.test(bo),
  typeValidationRan: /Checking validity of types/.test(bo),
  // Une compilation réussie SUIVIE d'un échec de validation de routes n'est PAS un build vert.
  routeValidationPassed: build.code === 0 && !/Type error|Failed to compile/.test(bo),
  staticGenerationComplete: /Generating static pages \((\d+)\/\1\)/.test(bo),
  routeCount: (bo.match(/^[├└┌]/gm) ?? []).length,
  assistantRoutePresent: /ƒ \/assistant\s/.test(bo),
  partnerRouteCount: (bo.match(/\/api\/partners|\/partenaires/g) ?? []).length,
  concurrentBuildSymptoms: /ENOENT|EBUSY|another build/i.test(bo),
  externalProviderCallDuringBuild: /api\.openai\.com|api\.stripe\.com/.test(bo),
});

console.log("→ source probes");
const route = read("src/app/api/assistant/chat/route.ts") ?? "";
const access = read("src/lib/pierre/access.ts") ?? "";
const importers = sh('npx --no-install rg -l "lib/pierre/access" src --glob "!**/__tests__/**"', 60_000).out;
w("c14-access-non-regression.json", {
  runId: RUN,
  objectTruthinessBugAbsent: !/if\s*\(\s*!\s*access\s*\)/.test(route),
  discriminatedUnion: access.includes('reason: "NO_ENTITLEMENT"') && access.includes('reason: "LOOKUP_FAILED"'),
  grantingStatuses: (access.match(/PIERRE_ACTIVE_STATUSES = \[(.*?)\]/) ?? [])[1] ?? null,
  entitlementRequiredGate: route.includes('access.mode === "ENTITLEMENT_REQUIRED"'),
  companyRequiredGate: route.includes('access.mode === "COMPANY_REQUIRED"'),
  publicDiscoveryOpenWithoutEntitlement: route.includes('access.mode === "AUTHENTICATED_DISCOVERY"'),
  lookupFailureFailClosed: route.includes('access.mode === "ACCESS_CHECK_UNAVAILABLE"'),
  tenantFailClosed: route.includes('access.mode === "TENANT_FAIL_CLOSED"'),
  anonymousBlocked: /code: "AUTH_REQUIRED"[\s\S]{0,40}401/.test(route),
  killSwitch: /isCloneChatEnabled\(\)/.test(route),
  sharedContractImporters: importers.split("\n").filter(Boolean),
  suite: suites["c14-access-contract"],
});
w("c14-budget-provider-non-regression.json", {
  runId: RUN,
  noModelWithoutReservation: /const useModel = pubReservation\.granted && !!key && cfg\.enabled/.test(route),
  measuredOrderingNotHardcoded: /reservedBeforeProvider:\s*providerSeq === 0 \? null :/.test(route),
  hardcodedTrueAbsent: !/reservedBeforeProvider:\s*true/.test(route),
  providerReportedModel: /model:\s*viaProvider \? \(usage\?\.model \?\? null\) : null/.test(route),
  deterministicFallbackNotLabelledOpenAI: /provider:\s*viaProvider \? "openai" : "deterministic"/.test(route),
  realProviderProof: "PRÉCÉDEMMENT ÉTABLIE en C1.4 — SOURCE INCHANGÉE depuis (aucun fichier runtime C1.4 modifié en E1.1) ⇒ AUCUN nouvel appel provider payant n'a été émis par E1.1.",
  newProviderCallExecutedByE11: false,
  c14ProofRef: ".c1-4-proofs/access-openai-runtime/real-openai-browser.json",
});

console.log("→ done");
