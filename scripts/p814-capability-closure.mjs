// scripts/p814-capability-closure.mjs
// PHASE 8.14 (§3) — ground-truth capability closure matrix, COMPUTED from the real registry (not curated).
// For every canonical capability it records status + the governed-path facts (pack, runtime actions,
// permissions, approvals, external/legal deps, evidence) and the exact remaining gap to reach closure.
// Writes P8_14_COMPLETE_HR_CAPABILITY_CLOSURE.md + .p814-proofs/<run>/capability-closure-baseline.json.
import { writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { HR_CAPABILITIES } from "../src/lib/pierre/v1/hr-canon/capability-registry.ts";
import { packsForCapability } from "../src/lib/pierre/v1/hr-mission-packs/registry.ts";

const OPEN = ["MISSING", "PARTIAL", "CONTRACT_ONLY", "IMPLEMENTED_UNVERIFIED"];

function classify(c) {
  const packs = packsForCapability(c.id).map((p) => p.id);
  const external = (c.integrationDependencies ?? []).some((d) => d.system && d.system !== "none" && d.status !== "available");
  const legal = (c.countryRuleDependencies ?? []).some((d) => d.required) || c.implementation === "LEGAL_CONTENT_REQUIRED";
  const humanOnly = c.autonomy === "human_only" || c.autonomy === "forbidden" || c.implementation === "HUMAN_ONLY";
  const verified = c.implementation === "VERIFIED_EXISTING";
  const hasRefs = (c.implementationReferences ?? []).length > 0;
  const hasEvidence = (c.evidence ?? []).length > 0;
  const hasPack = packs.length > 0;
  // A capability has a governed path if: verified, OR realized by a pack, OR human-only (assist path),
  // OR external/legal (fail-closed + governed manual path from P8.12/P8.13).
  const governedPath = verified || hasPack || humanOnly || external || legal;
  const open = OPEN.includes(c.implementation);
  // The remaining build gap to reach closure per the owner's §4 rules.
  let gap = "none";
  if (open && !hasPack && !verified && !humanOnly && !external && !legal) gap = "needs_mission_pack_or_runtime_realization";
  else if (open && (external || legal)) gap = "external_or_legal_governed_path_present_verify_completeness";
  else if (open && hasPack) gap = "realized_by_pack_promote_status";
  else if (open && humanOnly) gap = "human_only_surrounding_automation_verify";
  return { packs, external, legal, humanOnly, verified, hasRefs, hasEvidence, hasPack, governedPath, open, gap };
}

const rows = HR_CAPABILITIES.map((c) => {
  const k = classify(c);
  return {
    id: c.id, domain: c.domain, status: c.implementation, autonomy: c.autonomy, risk: c.risk?.level ?? "?",
    label: c.label, packs: k.packs, hasRuntimeRefs: k.hasRefs, hasEvidence: k.hasEvidence,
    external: k.external, legal: k.legal, humanOnly: k.humanOnly, governedPath: k.governedPath,
    open: k.open, gap: k.gap,
    permissions: (c.permissions ?? []).map((p) => p.permission ?? p).slice(0, 4),
    approvals: (c.approvals ?? []).length, artifacts: (c.expectedArtifacts ?? []).length,
    comms: (c.expectedCommunications ?? []).length, mutations: (c.employeeMutations ?? []).length,
  };
});

const byStatus = {}; const byDomain = {}; const openByDomain = {};
for (const r of rows) {
  byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  byDomain[r.domain] = (byDomain[r.domain] ?? 0) + 1;
  if (r.open) openByDomain[r.domain] = (openByDomain[r.domain] ?? 0) + 1;
}
const openRows = rows.filter((r) => r.open);
const openNoPath = openRows.filter((r) => !r.governedPath);

const runId = `p814closure-${randomBytes(5).toString("hex")}`;
const dir = `.p814-proofs/${runId}`; mkdirSync(dir, { recursive: true });
const baseline = {
  runId, total: rows.length, domains: Object.keys(byDomain).length, byStatus,
  open_total: openRows.length, open_without_governed_path: openNoPath.length,
  openByDomain, rows,
};
writeFileSync(`${dir}/capability-closure-baseline.json`, JSON.stringify(baseline, null, 2) + "\n");

// Markdown matrix
let md = `# P8.14 — Complete HR Capability Closure Matrix\n\n`;
md += `Computed from the real canon registry. **Total ${rows.length} capabilities / ${Object.keys(byDomain).length} domains.**\n\n`;
md += `## Status counts (canon \`implementation\` field)\n\n| Status | Count | Open? |\n|---|---:|---|\n`;
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) md += `| ${k} | ${v} | ${OPEN.includes(k) ? "OPEN" : "closed"} |\n`;
md += `\n**OPEN total (MISSING+PARTIAL+CONTRACT_ONLY+IMPLEMENTED_UNVERIFIED): ${openRows.length}.** Of these, ${openNoPath.length} have NO governed path yet (need mission-pack/runtime realization); ${openRows.length - openNoPath.length} already have a governed path (pack / external-manual / legal-fail-closed / human-only) and need status promotion + verification.\n\n`;
md += `## Open capabilities by domain\n\n| Domain | Open | Total |\n|---|---:|---:|\n`;
for (const d of Object.keys(byDomain).sort()) md += `| ${d} | ${openByDomain[d] ?? 0} | ${byDomain[d]} |\n`;
md += `\n## Open capabilities — gap per capability\n\n| Capability | Domain | Status | Governed path | Gap |\n|---|---|---|---|---|\n`;
for (const r of openRows.sort((a, b) => a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id))) {
  md += `| \`${r.id}\` | ${r.domain} | ${r.status} | ${r.governedPath ? (r.humanOnly ? "human-only" : r.external ? "external+manual" : r.legal ? "legal-fail-closed" : r.hasPack ? "pack:" + r.packs[0] : "yes") : "NONE"} | ${r.gap} |\n`;
}
md += `\nProof: \`.p814-proofs/${runId}/capability-closure-baseline.json\`\n`;
writeFileSync("P8_14_COMPLETE_HR_CAPABILITY_CLOSURE.md", md);

console.log(`total=${rows.length} open=${openRows.length} open_no_path=${openNoPath.length}`);
console.log("byStatus=", JSON.stringify(byStatus));
console.log("openByDomain=", JSON.stringify(openByDomain));
console.log(`runId=${runId}`);
