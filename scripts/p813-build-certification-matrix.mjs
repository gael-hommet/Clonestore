// scripts/p813-build-certification-matrix.mjs
// PHASE 8.13 — build the full HR certification matrix from the canon + packs (DIMENSION A). Emits
// canon/domain/capability/mission-pack certification proofs. Dynamic; no hardcoded counts.
// Run: npx tsx scripts/p813-build-certification-matrix.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p813-matrix] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const fc = await imp("src/lib/pierre/v1/final-certification/index.ts");
const canon = await imp("src/lib/pierre/v1/hr-canon/index.ts");
const mp = await imp("src/lib/pierre/v1/hr-mission-packs/index.ts");

const RUN_ID = `p813matrix-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const dir = join(ROOT, ".p813-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, n), JSON.stringify(o, null, 2)); };

const cov = fc.certifyAllCapabilities();
const evidence = fc.validateAllEvidence(cov.entries);
// domain rollup
const byDomain = {};
for (const e of cov.entries) { (byDomain[e.domain] ??= { total: 0, certified: 0, byState: {} }); byDomain[e.domain].total++; if (fc.isCertified(e.state)) byDomain[e.domain].certified++; byDomain[e.domain].byState[e.state] = (byDomain[e.domain].byState[e.state] ?? 0) + 1; }
// mission pack certification (from runtime status)
const packCert = mp.HR_MISSION_PACKS.map((p) => ({ id: p.id, domain: p.domain, runtimeStatus: p.runtimeStatus, capabilities: p.capabilityIds.length }));

write("canon-coverage.json", { run_id: RUN_ID, capabilities: cov.totalCapabilities, certified: cov.certified, functionallyComplete: cov.functionallyComplete, byState: cov.byState, byAutomationBlocker: cov.byAutomationBlocker, evidenceValid: evidence.ok, evidenceErrors: evidence.errors });
write("domain-certification.json", { run_id: RUN_ID, domains: Object.keys(byDomain).length, byDomain });
write("capability-certification.json", { run_id: RUN_ID, entries: cov.entries });
write("mission-pack-certification.json", { run_id: RUN_ID, packs: packCert.length, packCert });

const ok = cov.functionallyComplete && evidence.ok && cov.uncertifiedIds.length === 0;
log(`capabilities=${cov.totalCapabilities} certified=${cov.certified} complete=${cov.functionallyComplete} evidenceValid=${evidence.ok}`);
log(`byState=${JSON.stringify(cov.byState)}`);
log(`VERDICT ${ok ? "GREEN (functional matrix complete)" : "RED"} — .p813-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
