// scripts/p812-source-country-rules.mjs
// PHASE 8.12 — build the official-source register + required-rule map + legal-review packets from the
// canon DYNAMICALLY (P812_GAPS). Emits proofs. Produces NO legal values: every rule stays
// SOURCE_REQUIRED and every source is a POINTER_ONLY official-authority reference.
// Run: npx tsx scripts/p812-source-country-rules.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p812-src] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const cp = await imp("src/lib/pierre/v1/hr-canon/country-packs/index.ts");
const gap = await imp("src/lib/pierre/v1/hr-canon/gap-registry.ts");

const RUN_ID = `p812src-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p812-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, n), JSON.stringify(o, null, 2)); };
const J = ["FR", "BE", "LU", "CH"];

// required rule families per jurisdiction, dynamic from P812 gaps' country rule families
const requiredByJurisdiction = {};
const requiredFamilies = new Set();
for (const g of gap.P812_GAPS) for (const f of g.countryRuleFamilies) requiredFamilies.add(f);
for (const j of J) requiredByJurisdiction[j] = [...requiredFamilies].sort();

// official source register (validate every entry is an honest pointer)
const sourceErrors = cp.OFFICIAL_SOURCES.flatMap(cp.validateOfficialSource);
const register = cp.OFFICIAL_SOURCES.map((s) => ({ id: s.id, jurisdiction: s.jurisdiction, authority: s.authority, officialUrl: s.officialUrl, sourceType: s.sourceType, ruleFamilies: s.ruleFamilies, retrievalStatus: s.retrievalStatus }));

// legal review packets for every required (jurisdiction, family)
const packets = [];
let sourced = 0, verified = 0, awaitingSourcing = 0;
for (const j of J) {
  const pack = cp.COUNTRY_REGISTRY[j];
  for (const fam of requiredByJurisdiction[j]) {
    const inst = pack.families.find((f) => f.family === fam);
    for (const rule of inst?.rules ?? []) {
      const sources = cp.sourcesForRuleFamily(j, fam);
      const packet = cp.buildReviewPacket(rule, j, fam, sources);
      packets.push({ jurisdiction: j, family: fam, ruleKey: rule.key, status: rule.status, packetStatus: packet.status, sources: sources.length });
      if (rule.status === "VERIFIED") verified++;
      else if (rule.status === "SOURCED_UNVERIFIED") sourced++;
      else awaitingSourcing++;
    }
  }
}

write("official-source-register.json", { run_id: RUN_ID, count: register.length, sourceErrors, register });
write("required-country-rules.json", { run_id: RUN_ID, requiredFamilies: [...requiredFamilies].sort(), byJurisdiction: requiredByJurisdiction });
write("legal-review-status.json", { run_id: RUN_ID, totalRules: packets.length, verified, sourcedUnverified: sourced, awaitingSourcing, packets });
write("country-pack-summary.json", { run_id: RUN_ID, packs: cp.validateAllPacks().packs });

const ok = sourceErrors.length === 0 && verified === 0; // honest: 0 verified without a human reviewer
log(`sources=${register.length} sourceErrors=${sourceErrors.length} requiredFamilies=${requiredFamilies.size} reviewPackets=${packets.length} verified=${verified} awaitingSourcing=${awaitingSourcing}`);
log(`VERDICT ${ok ? "GREEN (engine sound, 0 invented, 0 verified — human review pending)" : "RED"} — .p812-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
