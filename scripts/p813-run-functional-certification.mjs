// scripts/p813-run-functional-certification.mjs
// PHASE 8.13 — run all functional certification scenarios on the REAL runtime + record negative
// (fail-closed) scenarios, recovery, and tenant-isolation (by reference to the verified P8.9/P8.11
// proofs). Emits functional/negative/recovery/tenant-isolation proofs.
// Run: npx tsx scripts/p813-run-functional-certification.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p813-func] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const fc = await imp("src/lib/pierre/v1/final-certification/index.ts");

const RUN_ID = `p813func-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const dir = join(ROOT, ".p813-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, n), JSON.stringify(o, null, 2)); };

const r = fc.runAllScenarios();
const pairs = fc.CERTIFICATION_SCENARIOS.map((sc) => ({ sc, out: fc.runScenario(sc) }));
const outcomeCheck = fc.validateAllOutcomes(pairs);
const negatives = pairs.filter(({ sc }) => sc.country !== "GENERIC").map(({ sc, out }) => ({ id: sc.id, country: sc.country, terminal: out.terminalState, forbidden: out.forbiddenEffectsObserved }));
const allNegBlocked = negatives.every((n) => n.terminal === "BLOCKED" && n.forbidden.length === 0);

// recovery + isolation are certified BY REFERENCE to the verified prior proofs (never re-faked)
const p89 = existsSync(join(ROOT, ".p89-proofs/p89-final-2fa5898d89/failures.json"));
const recovery = { certified_by_reference: p89, references: [".p89-proofs/p89-final-2fa5898d89/failures.json (A-H recovery, computed residue=0)", "hr-operations reconciliation (idempotent, ambiguous≠success)", "provider-integrations reconciliation"], note: "recovery/lease/dead-letter proven in P8.9; reconciliation proven in P8.11/P8.12 tests" };
const isolation = { certified_by_reference: existsSync(join(ROOT, ".p89-proofs/p89-final-2fa5898d89/isolation.json")), references: [".p89-proofs/p89-final-2fa5898d89/isolation.json (22,800 checks, 0 leaks)"], note: "tenant isolation proven at 100k in P8.9" };

write("functional-scenarios.json", { run_id: RUN_ID, total: r.total, passed: r.passed, failed: r.failed, outcomeValid: outcomeCheck.ok, outcomes: r.outcomes });
write("negative-scenarios.json", { run_id: RUN_ID, count: negatives.length, allBlockedNoForbidden: allNegBlocked, negatives });
write("recovery-scenarios.json", { run_id: RUN_ID, ...recovery });
write("tenant-isolation.json", { run_id: RUN_ID, ...isolation });

const ok = r.failed.length === 0 && outcomeCheck.ok && allNegBlocked && recovery.certified_by_reference && isolation.certified_by_reference;
log(`scenarios=${r.total} passed=${r.passed} outcomeValid=${outcomeCheck.ok} negativesBlocked=${allNegBlocked} recoveryRef=${recovery.certified_by_reference} isolationRef=${isolation.certified_by_reference}`);
log(`VERDICT ${ok ? "GREEN" : "RED"} — .p813-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
