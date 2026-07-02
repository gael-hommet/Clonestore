// scripts/p810-generate-coverage-report.mjs
// PHASE 8.10 — generate the machine-derived coverage matrix + gap register markdown from the canon
// so the docs can never drift from the registry. Run AFTER the canon compiles.
// Run: npx tsx scripts/p810-generate-coverage-report.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const canon = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/hr-canon/index.ts")).href);

const caps = canon.HR_CAPABILITIES;
const domains = canon.HR_DOMAINS;
const cov = canon.computeCoverage(caps);
const gaps = canon.gapSummary();

// ── P8_10_CAPABILITY_COVERAGE_MATRIX.md ──
let m = `# P8.10 — Capability Coverage Matrix (generated)\n\n`;
m += `> Generated from \`src/lib/pierre/v1/hr-canon\` by \`scripts/p810-generate-coverage-report.mjs\`. Do not hand-edit.\n\n`;
m += `**${caps.length} atomic capabilities across ${cov.domainsCovered}/${domains.length} domains.** Verified-existing: ${cov.byStatus.VERIFIED_EXISTING || 0} (${cov.verifiedPct}%).\n\n`;
m += `## Status distribution\n\n| Status | Count |\n|---|---|\n`;
for (const [k, v] of Object.entries(cov.byStatus).sort((a, b) => b[1] - a[1])) m += `| ${k} | ${v} |\n`;
m += `\n## By target phase\n\n| Target | Count |\n|---|---|\n`;
for (const [k, v] of Object.entries(cov.byTargetPhase)) m += `| ${k} | ${v} |\n`;
m += `\n## By domain\n\n| Domain | Total | Verified | Readiness % | Status breakdown |\n|---|---|---|---|---|\n`;
for (const d of cov.byDomain) {
  const brk = Object.entries(d.byStatus).map(([k, v]) => `${k}:${v}`).join(", ");
  m += `| ${d.name} (${d.domain}) | ${d.total} | ${d.verified} | ${d.readinessPct}% | ${brk} |\n`;
}
m += `\n## Full capability list\n\n| ID | Domain | Label | Status | Autonomy | Risk | Target |\n|---|---|---|---|---|---|---|\n`;
for (const c of [...caps].sort((a, b) => a.id.localeCompare(b.id))) {
  m += `| \`${c.id}\` | ${c.domain} | ${c.label} | ${c.implementation} | ${c.autonomy} | ${c.risk.level} | ${c.targetPhase} |\n`;
}
writeFileSync(join(ROOT, "P8_10_CAPABILITY_COVERAGE_MATRIX.md"), m);

// ── P8_10_GAP_REGISTER.md ──
let g = `# P8.10 — Gap Register (generated) — the exact P8.11 / P8.12 build list\n\n`;
g += `> Generated from the canon. P8.11/P8.12 must build ONLY what is listed here (anti-improvisation contract).\n\n`;
g += `- **Total gaps:** ${gaps.total}\n- **P8.11 (runtime workflows):** ${gaps.p811}\n- **P8.12 (country legal rules):** ${gaps.p812}\n- **HUMAN_ONLY (never automated):** ${gaps.humanOnly}\n\n`;
const section = (title, list) => {
  g += `## ${title} (${list.length})\n\n| ID | Domain | Label | Status | Autonomy | Legal | Country rule families | Integrations |\n|---|---|---|---|---|---|---|---|\n`;
  for (const x of [...list].sort((a, b) => a.domain.localeCompare(b.domain))) {
    g += `| \`${x.id}\` | ${x.domain} | ${x.label} | ${x.status} | ${x.autonomy} | ${x.legalSensitivity} | ${x.countryRuleFamilies.join(", ") || "-"} | ${x.integrations.join(", ") || "-"} |\n`;
  }
  g += `\n`;
};
section("P8.11 — build & verify runtime workflows", canon.P811_GAPS);
section("P8.12 — source & review country legal rules", canon.P812_GAPS);
section("HUMAN_ONLY — governed, never automated", canon.HUMAN_ONLY_GAPS);
writeFileSync(join(ROOT, "P8_10_GAP_REGISTER.md"), g);

process.stderr.write(`[p810-gen] wrote P8_10_CAPABILITY_COVERAGE_MATRIX.md (${caps.length} caps) + P8_10_GAP_REGISTER.md (${gaps.total} gaps)\n`);
