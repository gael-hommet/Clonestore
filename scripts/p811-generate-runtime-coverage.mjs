// scripts/p811-generate-runtime-coverage.mjs
// PHASE 8.11 — generate the runtime coverage matrix markdown from the canon + mission packs, so the
// doc never drifts from code. Run: npx tsx scripts/p811-generate-runtime-coverage.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const packs = await imp("src/lib/pierre/v1/hr-mission-packs/index.ts");
const gap = await imp("src/lib/pierre/v1/hr-canon/gap-registry.ts");
const ops = await imp("src/lib/pierre/v1/hr-operations/index.ts");

const ALL = [...packs.HR_MISSION_PACKS];
const coverage = packs.computePackCoverage();
const gov = ops.governanceSummary(ALL);
const byStatus = {}; for (const p of ALL) byStatus[p.runtimeStatus] = (byStatus[p.runtimeStatus] ?? 0) + 1;

let m = `# P8.11 — Runtime Coverage Matrix (generated)\n\n`;
m += `> Generated from \`src/lib/pierre/v1/hr-mission-packs\` + the P8.10 canon by \`scripts/p811-generate-runtime-coverage.mjs\`. Do not hand-edit.\n\n`;
m += `**${ALL.length} mission packs** realize **${coverage.coveredGapCount}/${coverage.targetedGapCount}** of the canon's P8.11-targeted gaps (dynamic — the count comes from the canon, not hardcoded). Uncovered: ${coverage.uncoveredGapIds.length}.\n\n`;
m += `## Runtime status distribution\n\n| Runtime status | Packs |\n|---|---|\n`;
for (const [k, v] of Object.entries(byStatus)) m += `| ${k} | ${v} |\n`;
m += `\n## Governance rollup\n\n- Packs with approvals: ${gov.packsWithApprovals}\n- Packs with a human decision: ${gov.packsWithHumanDecision}\n- Packs with an external handoff: ${gov.packsWithExternalHandoff}\n- Distinct approvers: ${gov.distinctApprovers.join(", ")}\n- External systems awaited: ${gov.externalSystems.join(", ") || "none"}\n\n`;
m += `## Coverage by domain\n\n| Domain | Targeted | Covered |\n|---|---|---|\n`;
for (const [d, v] of Object.entries(coverage.byDomain).sort()) m += `| ${d} | ${v.targeted} | ${v.covered} |\n`;
m += `\n## Mission packs\n\n| Pack | Domain | Runtime status | Capabilities | Steps |\n|---|---|---|---|---|\n`;
for (const p of [...ALL].sort((a, b) => a.id.localeCompare(b.id))) m += `| \`${p.id}\` | ${p.domain} | ${p.runtimeStatus} | ${p.capabilityIds.length} | ${p.steps.length} |\n`;
m += `\n## Capability → pack runtime map (P8.11 gaps)\n\n| Capability | Domain | Realized by pack(s) |\n|---|---|---|\n`;
for (const g of [...gap.P811_GAPS].sort((a, b) => a.id.localeCompare(b.id))) m += `| \`${g.id}\` | ${g.domain} | ${packs.packsForCapability(g.id).map((p) => p.id).join(", ")} |\n`;
writeFileSync(join(ROOT, "P8_11_RUNTIME_COVERAGE_MATRIX.md"), m);
process.stderr.write(`[p811-gen] wrote P8_11_RUNTIME_COVERAGE_MATRIX.md (${ALL.length} packs, ${coverage.coveredGapCount}/${coverage.targetedGapCount} gaps)\n`);
