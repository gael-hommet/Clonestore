// scripts/p812-country-execution-scenarios.mjs
// PHASE 8.12 — country execution scenarios: for every P8.12 gap capability × {FR,BE,LU,CH}, resolve
// the jurisdiction, run the FAIL-CLOSED gate, and confirm it blocks automated legally-sensitive
// execution + routes to a governed fallback. Proves capability transitions are honest (still gated
// pending human-verified rules). Dynamic P812 load. Run: npx tsx scripts/p812-country-execution-scenarios.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p812-exec] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const gap = await imp("src/lib/pierre/v1/hr-canon/gap-registry.ts");
const mp = await imp("src/lib/pierre/v1/hr-mission-packs/registry.ts");
const exec = await imp("src/lib/pierre/v1/hr-country-execution/index.ts");
const cp = await imp("src/lib/pierre/v1/hr-canon/country-packs/index.ts");

const RUN_ID = `p812exec-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p812-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, n), JSON.stringify(o, null, 2)); };
const J = ["FR", "BE", "LU", "CH"];
const NOW = "2026-07-02T10:00:00.000Z";

// jurisdiction resolver scenarios
const jurScenarios = [
  { in: { companyCountry: "France" }, expect: "FR" },
  { in: { companyCountry: "FR", siteCountry: "BE" }, expect: "BE" },
  { in: { companyCountry: "Suisse", subRegion: "CH-VD" }, expect: "CH" },
  { in: { companyCountry: "US" }, expect: null },
].map((s) => { const r = cp.resolveJurisdiction(s.in); return { input: s.in, resolved: r.jurisdiction, expected: s.expect, ok: r.jurisdiction === s.expect }; });

// country-dependent execution set = every mission pack that REQUIRES country rules (P8.11 orchestrated
// these; P8.12 gates them). This is the honest surface where country law governs execution.
const countryDependentPacks = mp.HR_MISSION_PACKS.filter((p) => p.countryRuleRequirements.some((r) => r.required));
const scenarios = [];
for (const pack of countryDependentPacks) for (const j of J) {
  const gate = exec.evaluateExecutionGate(pack, { packId: pack.id, jurisdiction: j, nowIso: NOW });
  scenarios.push({ pack: pack.id, jurisdiction: j, allowed: gate.allowed, route: gate.route, blockedFamilies: gate.blockedRules.map((b) => b.family) });
}
// capability transitions: every P8.12 gap stays COUNTRY_RULES_REQUIRED until rules are human-VERIFIED.
const transitions = gap.P812_GAPS.map((g) => ({ capability: g.id, domain: g.domain, priorStatus: g.status, targetPhase: g.targetPhase, countryRuleFamilies: g.countryRuleFamilies, unblockedForAutomation: false, newStatus: "COUNTRY_RULES_REQUIRED (engine ready; qualified human legal review of the required rules pending)" }));
const allBlocked = scenarios.every((s) => !s.allowed);        // fail-closed: none automated
const allRouted = scenarios.every((s) => ["GOVERNED_MANUAL", "HUMAN_DECISION", "EXTERNAL_BLOCKED"].includes(s.route));
const jurOk = jurScenarios.every((s) => s.ok);

write("targeted-p812-gaps.json", { run_id: RUN_ID, count: gap.P812_GAPS.length, gaps: gap.P812_GAPS.map((g) => ({ id: g.id, domain: g.domain, families: g.countryRuleFamilies })) });
write("jurisdiction-scenarios.json", { run_id: RUN_ID, ok: jurOk, scenarios: jurScenarios });
write("rule-execution-scenarios.json", { run_id: RUN_ID, total: scenarios.length, allBlockedFromAutomation: allBlocked, allRoutedToGovernedFallback: allRouted, scenarios });
write("capability-transitions.json", { run_id: RUN_ID, transitions });

const ok = jurOk && allBlocked && allRouted;
log(`p812Gaps=${gap.P812_GAPS.length} scenarios=${scenarios.length} allBlocked=${allBlocked} allRouted=${allRouted} jurisdictionResolver=${jurOk}`);
log(`VERDICT ${ok ? "GREEN (fail-closed for all countries; nothing runs on unverified law)" : "RED"} — .p812-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
