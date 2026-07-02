// scripts/p813-run-scale-non-regression.mjs
// PHASE 8.13 — confirm P8.9–P8.12 not regressed: canon (215), packs (43), country rules (276, 0
// verified), providers (0 usable), and the 100k sellability proof present (by reference — not re-run).
// Run: npx tsx scripts/p813-run-scale-non-regression.mjs
import { resolve, dirname, join } from "path"; import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync, existsSync } from "fs"; import { createHash } from "crypto";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const log = (m) => process.stderr.write(`[p813-scale] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const canon = await imp("src/lib/pierre/v1/hr-canon/index.ts");
const mp = await imp("src/lib/pierre/v1/hr-mission-packs/registry.ts");
const cp = await imp("src/lib/pierre/v1/hr-canon/country-packs/index.ts");
const pi = await imp("src/lib/pierre/v1/provider-integrations/registry.ts");
const RUN_ID = `p813scale-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0,10)}`;
const dir = join(ROOT, ".p813-proofs", RUN_ID); const write = (n,o)=>{mkdirSync(dir,{recursive:true});writeFileSync(join(dir,n),JSON.stringify(o,null,2));};
const cs = canon.buildCanonSummary();
let rules=0, verified=0; for (const p of cp.COUNTRY_PACKS) for (const f of p.families) for (const r of f.rules){rules++; if(r.status==="VERIFIED")verified++;}
const p89 = existsSync(join(ROOT, ".p89-proofs/p89-final-2fa5898d89/final-sellability-report.json"));
const checks = {
  canon_capabilities: cs.capabilities === 215,
  canon_valid: cs.registryValid,
  mission_packs: mp.HR_MISSION_PACKS.length === 43,
  country_rules_zero_verified: rules === 276 && verified === 0,
  providers_zero_usable: pi.providerSummary({}).usable === 0,
  sellability_100k_proof_present: p89,
};
const ok = Object.values(checks).every(Boolean);
write("scale-non-regression.json", { run_id: RUN_ID, checks, canon: cs.capabilities, packs: mp.HR_MISSION_PACKS.length, countryRules: rules, rulesVerified: verified, note: "100k sellability by reference to .p89-proofs/p89-final-2fa5898d89 (not re-run in P8.13)" });
log(`canon=${cs.capabilities} packs=${mp.HR_MISSION_PACKS.length} countryRules=${rules}(v${verified}) providersUsable=${pi.providerSummary({}).usable} p89Proof=${p89}`);
log(`VERDICT ${ok ? "GREEN (no regression)" : "RED"} — .p813-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
