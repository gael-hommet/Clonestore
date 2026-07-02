// scripts/p810-verify-hr-canon.mjs
// PHASE 8.10 — verify the Complete HR Capability Canon + country packs and emit machine-readable
// proofs to .p810-proofs/<run_id>/. Fails (exit 1) if any integrity invariant is violated:
// registry invalid, a domain uncovered, < target capabilities, a VERIFIED_EXISTING without
// evidence, a dangling public promise, a country pack with an invented rule (source-contract
// breach), or a capability referencing an unknown country rule family.
//
// Run: npx tsx scripts/p810-verify-hr-canon.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const log = (m) => process.stderr.write(`[p810] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);

const canon = await imp("src/lib/pierre/v1/hr-canon/index.ts");
const rf = await imp("src/lib/pierre/v1/hr-canon/country-packs/rule-families.ts");

const RUN_ID = `p810-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p810-proofs", RUN_ID);
const write = (name, obj) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, name), JSON.stringify(obj, null, 2)); };

const TARGET_MIN_CAPABILITIES = 150;

const summary = canon.buildCanonSummary();
const caps = canon.HR_CAPABILITIES;
const domainIds = canon.HR_DOMAIN_IDS;
const ruleFamilyKeys = new Set(rf.RULE_FAMILY_KEYS);

// ── cross-check: every countryRuleDependency references a known rule family ──
const unknownRuleFamilyRefs = [];
for (const c of caps) for (const d of c.countryRuleDependencies) if (!ruleFamilyKeys.has(d.ruleFamily)) unknownRuleFamilyRefs.push({ id: c.id, ruleFamily: d.ruleFamily });

// ── country pack: assert nothing invented (every rule SOURCE_REQUIRED at P8.10, source errors 0) ──
const packSummary = summary.countryPacks;
const invented = [];
for (const p of packSummary.packs) if (p.verifiedCount > 0) invented.push({ jurisdiction: p.jurisdiction, verifiedCount: p.verifiedCount });

// ── integrity gates ──
const gates = {
  registry_valid: summary.registryValid && summary.duplicateIds.length === 0,
  all_domains_covered: summary.coverage.domainsCovered === domainIds.length,
  min_capabilities: caps.length >= TARGET_MIN_CAPABILITIES,
  verified_have_evidence: summary.integrity.verifiedWithoutEvidence === 0,
  no_dangling_promises: summary.promises.dangling === 0,
  country_packs_ok: packSummary.ok,
  no_invented_country_rules: invented.length === 0,
  known_country_rule_refs: unknownRuleFamilyRefs.length === 0,
};
const ok = Object.values(gates).every(Boolean);

// ── emit proofs ──
write("canon-summary.json", { run_id: RUN_ID, ...summary });
write("domain-coverage.json", { run_id: RUN_ID, domains: summary.coverage.byDomain });
write("capability-coverage.json", { run_id: RUN_ID, total: summary.capabilities, byStatus: summary.coverage.byStatus, byAutonomy: summary.coverage.byAutonomy, byTargetPhase: summary.coverage.byTargetPhase, verifiedPct: summary.coverage.verifiedPct });
write("implementation-traceability.json", { run_id: RUN_ID, entries: canon.IMPLEMENTATION_MAP, referencelessImplemented: canon.referencelessImplemented() });
write("public-promise-traceability.json", { run_id: RUN_ID, promises: canon.PROMISE_TRACEABILITY, dangling: canon.danglingPromises() });
write("country-pack-summary.json", { run_id: RUN_ID, ok: packSummary.ok, packs: packSummary.packs, ruleFamilies: rf.RULE_FAMILIES.length });
write("gap-register.json", { run_id: RUN_ID, summary: summary.gaps, p811: canon.P811_GAPS, p812: canon.P812_GAPS, humanOnly: canon.HUMAN_ONLY_GAPS });
const finalReport = {
  run_id: RUN_ID, phase: "P8.10",
  capabilities: caps.length, domains: summary.domains, target_min_capabilities: TARGET_MIN_CAPABILITIES,
  by_status: summary.coverage.byStatus, gaps: summary.gaps, promises: summary.promises,
  country_packs: { ok: packSummary.ok, jurisdictions: packSummary.jurisdictions, all_source_required: invented.length === 0 },
  unknown_rule_family_refs: unknownRuleFamilyRefs, gates, ok,
};
write("final-report.json", finalReport);

log(`capabilities=${caps.length} domains=${summary.coverage.domainsCovered}/${domainIds.length} verified=${summary.coverage.byStatus.VERIFIED_EXISTING||0} gaps(P8.11=${summary.gaps.p811},P8.12=${summary.gaps.p812},human=${summary.gaps.humanOnly})`);
log(`promises fully=${summary.promises.fullyBacked} partial=${summary.promises.partiallyBacked} aspirational=${summary.promises.aspirational} dangling=${summary.promises.dangling}`);
log(`country packs ok=${packSummary.ok} (all rules SOURCE_REQUIRED=${invented.length === 0})`);
log(`GATES: ${Object.entries(gates).map(([k, v]) => `${k}=${v ? "Y" : "N"}`).join(" ")}`);
log(`VERDICT ${ok ? "GREEN" : "RED"} — proofs .p810-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
