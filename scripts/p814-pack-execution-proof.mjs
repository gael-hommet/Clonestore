// scripts/p814-pack-execution-proof.mjs
// PHASE 8.14 (§5/§6 evidence) — proves the governed-path substrate for the 97 pack-realized OPEN
// capabilities: EVERY mission pack is translated to a runtime plan (packToRuntimePlan) and compiled on the
// REAL compiler (compileMissionPlan). Records which capabilities are realized by a compiling pack. This is
// the compile-level evidence; per-domain PERSISTED execution is proven by the integration test
// (__tests__/cognitive-domain-execution.test.ts) on real PGlite.
import { writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { HR_MISSION_PACKS } from "../src/lib/pierre/v1/hr-mission-packs/registry.ts";
import { packToRuntimePlan, registeredActionKeysUsed } from "../src/lib/pierre/v1/hr-mission-packs/runtime-map.ts";
import { compileMissionPlan } from "../src/lib/pierre/v1/runtime-plan-compiler.ts";
import { HR_CAPABILITIES } from "../src/lib/pierre/v1/hr-canon/capability-registry.ts";

let ok = 0, fail = 0; const realizedCaps = new Set(); const failures = []; const packRows = [];
for (const p of HR_MISSION_PACKS) {
  let compiled = false, blockers = [];
  try {
    const plan = packToRuntimePlan(p);
    const c = compileMissionPlan(plan);
    compiled = c.ok; blockers = c.blockers ?? [];
    if (c.ok) { ok++; (p.capabilityIds ?? []).forEach((id) => realizedCaps.add(id)); }
    else { fail++; failures.push(`${p.id}:${blockers.slice(0, 2).join(",")}`); }
  } catch (e) { fail++; failures.push(`${p.id}:ERR:${String(e).slice(0, 60)}`); }
  packRows.push({ id: p.id, domain: p.domain, capabilityIds: p.capabilityIds ?? [], compiled, actions: (() => { try { return registeredActionKeysUsed(p); } catch { return []; } })(), blockers: blockers.slice(0, 3) });
}

const canonIds = new Set(HR_CAPABILITIES.map((c) => c.id));
const realizedInCanon = [...realizedCaps].filter((id) => canonIds.has(id));
const runId = `p814pack-${randomBytes(5).toString("hex")}`;
const dir = `.p814-proofs/${runId}`; mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/pack-execution-proof.json`, JSON.stringify({
  runId, packs_total: HR_MISSION_PACKS.length, packs_compiled_ok: ok, packs_compile_fail: fail,
  capabilities_realized_by_compiling_pack: realizedInCanon.length, failures, packs: packRows,
}, null, 2) + "\n");
console.log(`packs=${HR_MISSION_PACKS.length} compiled_ok=${ok} fail=${fail} caps_realized=${realizedInCanon.length}`);
if (failures.length) console.log("FAILURES:", failures.slice(0, 12).join(" | "));
console.log(`runId=${runId}`);
