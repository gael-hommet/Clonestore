// scripts/p811-verify-total-hr-runtime.mjs
// PHASE 8.11 — verify the Total HR Mission Packs + case operations + proactive layer, and emit
// machine-readable proofs to .p811-proofs/<run_id>/. Loads the P8.10 canon DYNAMICALLY: the P8.11
// gap set (102) is read from the canon, never hardcoded. Fails (exit 1) if: a pack is invalid, a
// pack does not compile on the REAL runtime compiler, any P8.11 gap is uncovered, a HUMAN_ONLY
// capability is directly automated, a pack references an unknown action/capability, or the canon
// regressed.
//
// Run: npx tsx scripts/p811-verify-total-hr-runtime.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const log = (m) => process.stderr.write(`[p811] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);

const packs = await imp("src/lib/pierre/v1/hr-mission-packs/index.ts");
const canon = await imp("src/lib/pierre/v1/hr-canon/index.ts");
const gap = await imp("src/lib/pierre/v1/hr-canon/gap-registry.ts");
const ops = await imp("src/lib/pierre/v1/hr-operations/index.ts");
const proactive = await imp("src/lib/pierre/v1/hr-proactive/index.ts");
const actionRegistry = await imp("src/lib/pierre/v1/runtime-action-registry.ts");

const RUN_ID = `p811-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p811-proofs", RUN_ID);
const write = (name, obj) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, name), JSON.stringify(obj, null, 2)); };

const ALL = [...packs.HR_MISSION_PACKS];
const summary = packs.buildMissionPackSummary();
const coverage = summary.coverage;
const compileResults = packs.compileAll(ALL);

// capability → runtime map (which pack realizes it, its runtime bindings)
const capRuntimeMap = [];
for (const g of gap.P811_GAPS) {
  const ps = packs.packsForCapability(g.id);
  capRuntimeMap.push({ capabilityId: g.id, domain: g.domain, packs: ps.map((p) => p.id), runtimeStatus: ps[0]?.runtimeStatus ?? "UNCOVERED" });
}

// external handoffs + recovery + governance summaries
const externalHandoffs = ALL.flatMap((p) => ops.handoffsFor(p).filter((h) => h.type === "external").map((h) => ({ pack: p.id, ...h })));
const recoverySummary = ALL.map((p) => ({ pack: p.id, resumable: p.recovery.resumable, onWorkerCrash: p.recovery.onWorkerCrash, onProviderFailure: p.recovery.onProviderFailure, idempotency: p.idempotency.dedup }));
const governance = ops.governanceSummary(ALL);

// functional scenarios (one per pack): open a case, walk to a legal next step (proves the FSM + pack wire up)
const scenarios = ALL.map((p) => {
  let c = ops.openCase(p, { caseId: `s-${p.id}`, companyId: "co-synthetic", correlationId: `corr-${p.id}`, subjectRef: "subj-synthetic" });
  const adv = ops.advanceCase(c, "subject_resolved");
  const step = adv.ok ? ops.nextStep(adv.case, p) : null;
  return { pack: p.id, opened: c.state === "intake", advanced: adv.ok, firstStep: step?.key ?? null, checklistItems: ops.buildChecklist(p).length, runtimeStatus: p.runtimeStatus };
});
const scenariosOk = scenarios.every((s) => s.opened && s.advanced && s.checklistItems > 0);

// proactive
const signalDefs = [...proactive.SIGNAL_REGISTRY];
const proactiveOk = signalDefs.length > 0 && signalDefs.every((s) => !!packs.getMissionPack(s.handledByPackId));

// non-regression: canon still valid + all closed actions still present
const canonSummary = canon.buildCanonSummary();
const nonRegression = {
  canon_registry_valid: canonSummary.registryValid,
  canon_capabilities: canonSummary.capabilities,
  canon_p811_gaps: gap.P811_GAPS.length,
  closed_action_count: actionRegistry.allRuntimeActions().length,
};

// remaining P8.12 gaps (country-dependent) — untouched by P8.11
const remainingP812 = gap.P812_GAPS.map((g) => ({ id: g.id, domain: g.domain, countryRuleFamilies: g.countryRuleFamilies }));

const gates = {
  packs_valid: summary.valid && summary.duplicateIds.length === 0 && summary.dangling.length === 0,
  all_packs_compile_on_real_runtime: compileResults.ok,
  full_p811_coverage: coverage.uncoveredGapIds.length === 0 && coverage.coveredGapCount === coverage.targetedGapCount,
  coverage_matches_canon_dynamically: coverage.targetedGapCount === gap.P811_GAPS.length,
  human_only_not_automated: coverage.humanOnlyNotAutomated.length === 0,
  functional_scenarios_ok: scenariosOk,
  proactive_ok: proactiveOk,
  canon_not_regressed: nonRegression.canon_registry_valid && nonRegression.canon_capabilities >= 150,
};
const ok = Object.values(gates).every(Boolean);

write("targeted-gaps.json", { run_id: RUN_ID, count: gap.P811_GAPS.length, gaps: gap.P811_GAPS });
write("mission-pack-summary.json", { run_id: RUN_ID, ...summary });
write("capability-runtime-map.json", { run_id: RUN_ID, entries: capRuntimeMap });
write("domain-coverage.json", { run_id: RUN_ID, byDomain: coverage.byDomain });
write("functional-scenarios.json", { run_id: RUN_ID, ok: scenariosOk, scenarios });
write("proactive-signals.json", { run_id: RUN_ID, ok: proactiveOk, signals: signalDefs });
write("governance-summary.json", { run_id: RUN_ID, ...governance });
write("recovery-summary.json", { run_id: RUN_ID, packs: recoverySummary });
write("external-handoffs.json", { run_id: RUN_ID, handoffs: externalHandoffs });
write("remaining-p812-gaps.json", { run_id: RUN_ID, count: remainingP812.length, gaps: remainingP812 });
write("non-regression.json", { run_id: RUN_ID, ...nonRegression });
write("final-report.json", { run_id: RUN_ID, phase: "P8.11", packs: ALL.length, byRuntimeStatus: summary.byRuntimeStatus, coverage: { targeted: coverage.targetedGapCount, covered: coverage.coveredGapCount }, gates, ok });

log(`packs=${ALL.length} valid=${summary.valid} compileOk=${compileResults.ok} coverage=${coverage.coveredGapCount}/${coverage.targetedGapCount} (dynamic canon P8.11=${gap.P811_GAPS.length})`);
log(`byRuntimeStatus=${JSON.stringify(summary.byRuntimeStatus)}`);
log(`scenarios=${scenariosOk} proactiveSignals=${signalDefs.length} externalHandoffs=${externalHandoffs.length} remainingP8.12=${remainingP812.length}`);
log(`GATES: ${Object.entries(gates).map(([k, v]) => `${k}=${v ? "Y" : "N"}`).join(" ")}`);
log(`VERDICT ${ok ? "GREEN" : "RED"} — proofs .p811-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
