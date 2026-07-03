// scripts/p814-product-recert.mjs
// PHASE 8.14 — product recertification over the CLOSED canon. Computes the §12 closure gates from real
// evidence and writes .p814-proofs/<run>/product-recertification.json + appends the closed matrix to
// P8_14_COMPLETE_HR_CAPABILITY_CLOSURE.md. No fabrication: IMPLEMENTED_GOVERNED requires a compiling pack;
// legal/external stay blocked.
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { CLOSED_HR_CAPABILITIES, closedStatusCounts, openCapabilitiesRemaining } from "../src/lib/pierre/v1/hr-canon/capability-closure.ts";
import { packsForCapability } from "../src/lib/pierre/v1/hr-mission-packs/registry.ts";
import { packToRuntimePlan } from "../src/lib/pierre/v1/hr-mission-packs/runtime-map.ts";
import { compileMissionPlan } from "../src/lib/pierre/v1/runtime-plan-compiler.ts";

const counts = closedStatusCounts();
const open = openCapabilitiesRemaining();
const domains = [...new Set(CLOSED_HR_CAPABILITIES.map((c) => c.domain))];
const openByDomain = {};
for (const c of CLOSED_HR_CAPABILITIES) if (["MISSING", "PARTIAL", "CONTRACT_ONLY", "IMPLEMENTED_UNVERIFIED"].includes(c.implementation)) openByDomain[c.domain] = (openByDomain[c.domain] ?? 0) + 1;

// integrity checks
const noEvidence = CLOSED_HR_CAPABILITIES.filter((c) => c.implementation !== "OUT_OF_SCOPE" && (c.evidence?.length ?? 0) === 0).map((c) => c.id);
let governedWithoutCompilingPack = 0, legalMislabel = 0, externalMislabel = 0;
for (const c of CLOSED_HR_CAPABILITIES) {
  const legal = (c.countryRuleDependencies ?? []).some((d) => d.required);
  const external = (c.integrationDependencies ?? []).some((d) => d.system && d.system !== "none" && d.status !== "available");
  if (c.implementation === "IMPLEMENTED_GOVERNED") {
    if (legal) legalMislabel++;
    if (external) externalMislabel++;
    const compiles = packsForCapability(c.id).some((p) => { try { return compileMissionPlan(packToRuntimePlan(p)).ok; } catch { return false; } });
    if (!compiles) governedWithoutCompilingPack++;
  }
}

const openTotal = (counts.MISSING ?? 0) + (counts.PARTIAL ?? 0) + (counts.CONTRACT_ONLY ?? 0) + (counts.IMPLEMENTED_UNVERIFIED ?? 0);
const ok = openTotal === 0 && noEvidence.length === 0 && governedWithoutCompilingPack === 0 && legalMislabel === 0 && externalMislabel === 0;

const runId = `p814recert-${randomBytes(5).toString("hex")}`;
const dir = `.p814-proofs/${runId}`; mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/product-recertification.json`, JSON.stringify({
  runId, total: CLOSED_HR_CAPABILITIES.length, domains: domains.length, closed_status_counts: counts,
  open_total: openTotal, open_capabilities: open, open_by_domain: openByDomain,
  integrity: { closed_without_evidence: noEvidence.length, governed_without_compiling_pack: governedWithoutCompilingPack, legal_mislabelled: legalMislabel, external_mislabelled: externalMislabel },
  gates: {
    missing_zero: (counts.MISSING ?? 0) === 0, partial_zero: (counts.PARTIAL ?? 0) === 0,
    contract_only_zero: (counts.CONTRACT_ONLY ?? 0) === 0, implemented_unverified_zero: (counts.IMPLEMENTED_UNVERIFIED ?? 0) === 0,
    all_domains_covered: Object.keys(openByDomain).length === 0,
    every_capability_has_evidence: noEvidence.length === 0,
    no_fabrication: governedWithoutCompilingPack === 0 && legalMislabel === 0 && externalMislabel === 0,
  },
  external_pending: { lawyer_verified_country_rules: false, providers_live: 0, yousign_p874: "OPEN", production_unblock_authorized: false },
  ok,
}, null, 2) + "\n");

let md = `\n---\n\n## Closed canon (product recertification) — proof \`.p814-proofs/${runId}/\`\n\n`;
md += `| Closed status | Count | Terminal? |\n|---|---:|---|\n`;
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md += `| ${k} | ${v} | ${["MISSING", "PARTIAL", "CONTRACT_ONLY", "IMPLEMENTED_UNVERIFIED"].includes(k) ? "OPEN" : "terminal"} |\n`;
md += `\n**OPEN (MISSING+PARTIAL+CONTRACT_ONLY+IMPLEMENTED_UNVERIFIED) = ${openTotal}.** Integrity: closed-without-evidence=${noEvidence.length}, governed-without-compiling-pack=${governedWithoutCompilingPack}, legal-mislabelled=${legalMislabel}, external-mislabelled=${externalMislabel}. Product-recert ok=${ok}.\n`;
appendFileSync("P8_14_COMPLETE_HR_CAPABILITY_CLOSURE.md", md);

console.log(`open=${openTotal} ok=${ok} counts=${JSON.stringify(counts)}`);
console.log(`integrity: noEvidence=${noEvidence.length} governedNoPack=${governedWithoutCompilingPack} legalMislabel=${legalMislabel} externalMislabel=${externalMislabel}`);
console.log(`runId=${runId}`);
