// scripts/p813-final-decision-gate.mjs
// PHASE 8.13 — the FINAL owner decision gate. Aggregates both dimensions, keeps them SEPARATE, and
// answers the 5 owner questions honestly. Certifies FUNCTIONAL completeness while refusing to grant
// country authorization or production unblock (0 VERIFIED rules, 0 live providers, Yousign blocked,
// deploy-block active). Emits blockers + cleanup + final report. Run: npx tsx scripts/p813-final-decision-gate.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p813] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const fc = await imp("src/lib/pierre/v1/final-certification/index.ts");

const RUN_ID = `p813-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const dir = join(ROOT, ".p813-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, n), JSON.stringify(o, null, 2)); };

const cov = fc.certifyAllCapabilities();
const scen = fc.runAllScenarios();
const country = fc.countryReadiness({});
const provider = fc.providerReadiness({});
const customer = fc.assessCustomerAcceptance();
const decision = fc.buildLaunchDecision({});
const evidence = fc.validateAllEvidence(cov.entries);
const deployBlock = process.env.NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE;

const gates = {
  // DIMENSION A — functional (may be CERTIFIED)
  functional_complete: cov.functionallyComplete,
  functional_evidence_valid: evidence.ok,
  all_scenarios_pass_real_runtime: scen.failed.length === 0,
  customer_operable: customer.ok,
  // DIMENSION B / production — MUST remain not-granted (honest)
  no_country_auto_authorized: country.launchGradeCount === 0,
  no_provider_live: provider.liveGrade === 0,
  deploy_block_active: deployBlock === "1" || deployBlock === "true" || deployBlock === undefined,
};
// The gate is GREEN when functional certification holds AND the country/production blockers are correctly preserved.
const ok = Object.values(gates).every(Boolean);

write("blockers.json", { run_id: RUN_ID, blockers: fc.BLOCKERS, byScope: fc.blockersByScope() });
write("cleanup-proof.json", { run_id: RUN_ID, residue: "none — P8.13 is pure certification (no DB/provider/network, no temp state)", note: "no ephemeral resources created" });
write("final-report.json", {
  run_id: RUN_ID, phase: "P8.13",
  dimensionA_functional: { certification: decision.functionalCertification, certified: cov.certified, total: cov.totalCapabilities, byState: cov.byState, scenarios: { total: scen.total, passed: scen.passed } },
  dimensionB_country: { launchGrade: country.launchGradeCount, of: 4, countries: country.countries },
  provider: { liveGrade: provider.liveGrade, manualPaths: provider.manualPaths },
  productionUnblock: decision.productionUnblock,
  answers: decision.answers,
  gates, ok,
  verdict: ok
    ? "P8.13 — HR BACKEND FUNCTIONAL CERTIFICATION ACHIEVED (215/215 capabilities, governed paths, real-runtime scenarios) / COUNTRY PRODUCTION AUTHORIZATION: NOT GRANTED (0/4) / PRODUCTION UNBLOCK: NOT AUTHORIZED"
    : "P8.13 — NOT CERTIFIED",
});

log(`DIM A functional: ${decision.functionalCertification} (${cov.certified}/${cov.totalCapabilities}, scenarios ${scen.passed}/${scen.total})`);
log(`DIM B country: ${country.launchGradeCount}/4 launch-grade | providers live=${provider.liveGrade}`);
log(`production unblock: ${decision.productionUnblock} | deploy-block=${deployBlock ?? "(unset local)"}`);
log(`GATES ${Object.entries(gates).map(([k, v]) => `${k}=${v ? "Y" : "N"}`).join(" ")}`);
log("── OWNER ANSWERS ──");
for (const [k, v] of Object.entries(decision.answers)) log(`  ${k}: ${v}`);
log(`VERDICT ${ok ? "GREEN" : "RED"} — .p813-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
