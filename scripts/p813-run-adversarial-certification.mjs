// scripts/p813-run-adversarial-certification.mjs
// PHASE 8.13 — programmatic adversarial refutation checks against the certification (in addition to
// the independent multi-agent adversarial workflow). Tries to REFUTE the green: any capability
// NOT_CERTIFIED? any country allowed? any provider usable/fabricated? any manual path counted as an
// integration? any human-only automated? Run: npx tsx scripts/p813-run-adversarial-certification.mjs
import { resolve, dirname, join } from "path"; import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs"; import { createHash } from "crypto";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const log = (m) => process.stderr.write(`[p813-adv] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const fc = await imp("src/lib/pierre/v1/final-certification/index.ts");
const canon = await imp("src/lib/pierre/v1/hr-canon/capability-registry.ts");
const RUN_ID = `p813adv-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0,10)}`;
const dir = join(ROOT, ".p813-proofs", RUN_ID); const write = (n,o)=>{mkdirSync(dir,{recursive:true});writeFileSync(join(dir,n),JSON.stringify(o,null,2));};
const cov = fc.certifyAllCapabilities(); const cr = fc.countryReadiness({}); const pr = fc.providerReadiness({});
const scen = fc.runAllScenarios();
const refutations = [
  { claim: "functional completeness", refuted: cov.uncertifiedIds.length > 0, detail: `uncertified=${cov.uncertifiedIds.length}` },
  { claim: "no country auto-authorized without verified rules", refuted: cr.countries.some(c => c.launchGrade), detail: `launchGrade=${cr.launchGradeCount}` },
  { claim: "no provider usable/fabricated", refuted: pr.liveGrade > 0, detail: `liveGrade=${pr.liveGrade}` },
  { claim: "human-only never automated", refuted: cov.entries.some(e => e.implementation==="HUMAN_ONLY" && (e.state==="CERTIFIED_AUTOMATED"||e.state==="CERTIFIED_AFTER_APPROVAL")), detail: "checked" },
  { claim: "manual path not counted as integration", refuted: pr.manualPaths > 0 && pr.liveGrade !== 0, detail: `manual=${pr.manualPaths} live=${pr.liveGrade}` },
  { claim: "no scenario fabricates result / invents law", refuted: scen.outcomes.some(o => o.forbiddenEffectsObserved.length > 0), detail: `failed=${scen.failed.length}` },
];
const anyRefuted = refutations.some(r => r.refuted);
write("adversarial-reviews.json", { run_id: RUN_ID, method: "programmatic self-refutation (complements the multi-agent adversarial workflow)", refutations, anyRefuted });
log(`refutations=${refutations.length} anyRefuted=${anyRefuted}`);
for (const r of refutations) log(`  [${r.refuted?"REFUTED":"holds"}] ${r.claim} (${r.detail})`);
log(`VERDICT ${anyRefuted ? "RED (a claim was refuted)" : "GREEN (all certification claims survive refutation)"} — .p813-proofs/${RUN_ID}/`);
process.exit(anyRefuted ? 1 : 0);
