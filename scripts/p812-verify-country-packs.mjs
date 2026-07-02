// scripts/p812-verify-country-packs.mjs
// PHASE 8.12 — verify the country packs + sourcing engine: all packs valid, every source an honest
// pointer, and CRITICALLY 0 rules VERIFIED / 0 invented values (no human reviewer present).
// Run: npx tsx scripts/p812-verify-country-packs.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p812-cp] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const cp = await imp("src/lib/pierre/v1/hr-canon/country-packs/index.ts");

const RUN_ID = `p812cp-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p812-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, n), JSON.stringify(o, null, 2)); };

const packs = cp.validateAllPacks();
let totalRules = 0, invented = 0, verified = 0, nonNull = 0;
for (const pack of cp.COUNTRY_PACKS) for (const fam of pack.families) for (const rule of fam.rules) {
  totalRules++;
  if (rule.status === "VERIFIED") verified++;
  if (rule.value !== null) nonNull++;
  if (rule.value !== null && rule.status !== "VERIFIED") invented++; // a value without verification = invented
}
const sourceErrors = cp.OFFICIAL_SOURCES.flatMap(cp.validateOfficialSource);

const gates = {
  packs_valid: packs.ok,
  no_invented_values: invented === 0,
  zero_verified_without_reviewer: verified === 0,   // honest: nothing verified in this environment
  all_rules_null_value: nonNull === 0,
  source_register_valid: sourceErrors.length === 0,
};
const ok = Object.values(gates).every(Boolean);
write("country-pack-summary.json", { run_id: RUN_ID, totalRules, verified, invented, nonNull, packs: packs.packs, sourceErrors, gates, ok });
log(`packs valid=${packs.ok} rules=${totalRules} verified=${verified} invented=${invented} sourceErrors=${sourceErrors.length}`);
log(`GATES ${Object.entries(gates).map(([k, v]) => `${k}=${v ? "Y" : "N"}`).join(" ")}`);
log(`VERDICT ${ok ? "GREEN" : "RED"} — .p812-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
