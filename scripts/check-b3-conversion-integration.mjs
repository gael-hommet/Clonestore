#!/usr/bin/env node
// BLOC 3 — Check de readiness pour la couche conversion.
//
// Ce script ne touche à AUCUNE infrastructure réelle : il vérifie uniquement
// que le code, les surfaces et le contrat sont cohérents. Les blocages
// externes (campagne, vraies grants, Stripe live) restent gérés ailleurs.
//
// Sorties (exit code) :
//   0 = CODE_READY (verdict V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED)
//   1 = BLOCKED_EXTERNAL (verdict CODE_READY mais blocages externes listés)
//   2 = CODE_DEFECT (verdict V0_CONVERSION_ENGINE_BLOCKED_*)
//
// Le rapport JSON est imprimé sur stdout (utilisable en CI ou par les agents).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function fail(msg, exit = 2) {
  console.error(`[b3-check] ${msg}`);
  process.exit(exit);
}

// 1) Sanity : fichiers attendus.
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
  "src/lib/clonestore/conversion/index.ts",
  "src/app/p/[token]/route.ts",
  "src/app/api/conversion/events/route.ts",
  "src/app/api/conversion/diagnostic/route.ts",
  "src/app/demo/pierre/layout.tsx",
  "src/app/demo/pierre/_variant/VariantHero.tsx",
  "src/app/diagnostic-rh/page.tsx",
  "src/app/diagnostic-rh/_components/DiagnosticForm.tsx",
  "supabase/sql/BLOC_3_CONVERSION_INTEGRATION.sql",
];
const missing = expectedFiles.filter((p) => !existsSync(resolve(ROOT, p)));
if (missing.length > 0) {
  console.error(`[b3-check] fichiers manquants:\n${missing.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(2);
}

// 2) Charger le verdict (compilé à la volée via tsx? non — on lit le fingerprint
// via une mini-évaluation Node en ESM directement depuis le source compilé).
// Plus simple : on exécute vitest ciblé qui ne tape ni Supabase ni Stripe.
const tsc = spawnSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", shell: true });
if (tsc.status !== 0) {
  console.error(`[b3-check] tsc échec:\n${tsc.stdout}\n${tsc.stderr}`);
  process.exit(2);
}

const vitest = spawnSync(
  "npx",
  ["vitest", "run", "src/lib/clonestore/conversion/__tests__/"],
  { encoding: "utf8", shell: true },
);
if (vitest.status !== 0) {
  console.error(`[b3-check] vitest échec:\n${vitest.stdout?.slice(-3000) ?? ""}\n${vitest.stderr?.slice(-1500) ?? ""}`);
  process.exit(2);
}

// 3) Verdict structurel.
const report = {
  bloc: "BLOC_3_V0_CONVERSION_ENGINE",
  verdict: "V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED",
  leadforge_commit: "db9b166",
  files_checked: expectedFiles.length,
  ts_status: "ok",
  vitest_status: "ok",
  blocking_external: [
    "Stripe live non activé (TEST uniquement requis par ce bloc)",
    "Aucune vraie grant LeadForge importée dans ce dépôt",
    "Aucune campagne réelle activée depuis CloneStore",
    "Domaines outreach non provisionnés",
  ],
  notes: [
    "Pas d'activation publique modifiée par ce bloc.",
    "Pas de modification des go-live proofs.",
    "Pas de Stripe live, pas d'email réel, pas de paiement réel.",
  ],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.blocking_external.length > 0 ? 1 : 0);
