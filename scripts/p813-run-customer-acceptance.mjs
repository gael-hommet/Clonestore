// scripts/p813-run-customer-acceptance.mjs
// PHASE 8.13 — customer acceptance: can a real customer operate Pierre without technical intervention?
// Honest framing (functional operability vs country-legal automation). Run: npx tsx scripts/p813-run-customer-acceptance.mjs
import { resolve, dirname, join } from "path"; import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs"; import { createHash } from "crypto";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const log = (m) => process.stderr.write(`[p813-cust] ${m}\n`);
const fc = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/final-certification/index.ts")).href);
const RUN_ID = `p813cust-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0,10)}`;
const dir = join(ROOT, ".p813-proofs", RUN_ID); const write = (n,o)=>{mkdirSync(dir,{recursive:true});writeFileSync(join(dir,n),JSON.stringify(o,null,2));};
const ca = fc.assessCustomerAcceptance();
write("customer-acceptance.json", { run_id: RUN_ID, ...ca });
log(`ok=${ca.ok} backendUsable=${ca.functionalBackendUsable} coverage=${ca.capabilitiesCovered}/${ca.totalCapabilities} criteria=${ca.selfServiceCriteria.filter(c=>c.met).length}/${ca.selfServiceCriteria.length}`);
log(`disclosure: ${ca.disclosure}`);
log(`VERDICT ${ca.ok ? "GREEN (functional operability certified; country-legal automation separate)" : "RED"} — .p813-proofs/${RUN_ID}/`);
process.exit(ca.ok ? 0 : 1);
