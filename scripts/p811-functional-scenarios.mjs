// scripts/p811-functional-scenarios.mjs
// PHASE 8.11 — functional scenarios: for a representative pack per domain, drive a synthetic case
// through the governed lifecycle (open → resolve → next step → checklist) using the PURE operations
// layer (no DB, no provider). Proves the packs + case machine + completion wire together. Writes
// .p811-proofs/<run_id>/functional-scenarios.json. Run: npx tsx scripts/p811-functional-scenarios.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const log = (m) => process.stderr.write(`[p811-fs] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const packs = await imp("src/lib/pierre/v1/hr-mission-packs/index.ts");
const ops = await imp("src/lib/pierre/v1/hr-operations/index.ts");

const RUN_ID = `p811fs-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p811-proofs", RUN_ID);

// one representative pack per domain
const ALL = [...packs.HR_MISSION_PACKS];
const byDomain = new Map();
for (const p of ALL) if (!byDomain.has(p.domain)) byDomain.set(p.domain, p);

const scenarios = [];
for (const p of byDomain.values()) {
  const compiled = packs.compileMissionPack(p);
  let c = ops.openCase(p, { caseId: `sc-${p.id}`, companyId: "co-synthetic", correlationId: `corr-${p.id}`, subjectRef: "subject-synthetic" });
  const opened = c.state === "intake";
  const adv = ops.advanceCase(c, "subject_resolved");
  const firstStep = adv.ok ? ops.nextStep(adv.case, p) : null;
  const checklist = ops.buildChecklist(p);
  const handoffs = ops.handoffsFor(p);
  // completion is gated: an empty case must NOT be completable
  const cannotCompleteEmpty = !ops.canComplete({ ...c, state: "executing" }, p, packs.emptyEvidence()).ok;
  const ok = compiled.ok && opened && adv.ok && checklist.length > 0 && cannotCompleteEmpty;
  scenarios.push({ domain: p.domain, pack: p.id, runtimeStatus: p.runtimeStatus, compiled: compiled.ok, opened, advanced: adv.ok, firstStep: firstStep?.key ?? null, checklistItems: checklist.length, handoffs: handoffs.length, cannotCompleteEmpty, ok });
}
const ok = scenarios.every((s) => s.ok);
mkdirSync(proofDir, { recursive: true });
writeFileSync(join(proofDir, "functional-scenarios.json"), JSON.stringify({ run_id: RUN_ID, domains: scenarios.length, ok, scenarios }, null, 2));
log(`domains=${scenarios.length} ok=${ok}`);
for (const s of scenarios) log(`  ${s.domain.padEnd(14)} ${s.pack.padEnd(34)} compiled=${s.compiled} firstStep=${s.firstStep} items=${s.checklistItems} ok=${s.ok}`);
log(`VERDICT ${ok ? "GREEN" : "RED"} — .p811-proofs/${RUN_ID}/functional-scenarios.json`);
process.exit(ok ? 0 : 1);
