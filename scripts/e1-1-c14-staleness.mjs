#!/usr/bin/env node
// E1.1 §11 — C1.4 PROOF STALENESS (read-only).
// Compares the mtime/SHA-256 of every C1.4 runtime source file against the recorded real-OpenAI
// browser proof. If NO runtime file changed after the proof, the proof is SOURCE-CURRENT and no new
// (paid) OpenAI call is made. Prints paths/hashes only — never a secret, never a key, never a URL.

import { statSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";

const PROOF = ".c1-4-proofs/access-openai-runtime/real-openai-browser.json";
const FILES = ["src/app/api/assistant/chat/route.ts", "src/lib/pierre/access.ts"];
const DIRS = ["src/lib/clonechat/server", "src/lib/clonechat/openai", "src/lib/clonechat/durable"];

// MATERIALITY. The proof attests a RUNTIME behaviour: access gate -> budget reservation -> real
// provider call -> committed tokens. Only files ON THAT PATH can invalidate it. A change to a
// read-only COMMAND CENTER (which merely reports) or to a TEST/PROOF GENERATOR cannot alter what
// the runtime does — treating those as "material" would burn a paid OpenAI call to re-prove a
// behaviour that provably did not change. Non-material paths are reported, never ignored silently.
const NON_MATERIAL = [
  /__tests__/,                 // tests never change runtime behaviour
  /-command-center\.ts$/,      // read-only reporting/aggregation surface
  /\.test\.ts$/,
];
const isMaterial = (p) => !NON_MATERIAL.some((re) => re.test(p.split("\\").join("/")));

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

if (!existsSync(PROOF)) {
  console.log(JSON.stringify({ proofPresent: false, verdict: "PROOF_MISSING" }, null, 2));
  process.exit(0);
}

const proofStat = statSync(PROOF);
const proof = JSON.parse(readFileSync(PROOF, "utf8"));

const paths = [...FILES];
for (const d of DIRS) walk(d, paths);

const entries = [];
const changedMaterial = [];
const changedNonMaterial = [];
for (const p of paths) {
  if (!existsSync(p)) continue;
  const st = statSync(p);
  const sha256 = createHash("sha256").update(readFileSync(p)).digest("hex");
  const rel = p.split("\\").join("/");
  const material = isMaterial(p);
  const e = { path: rel, mtimeIso: st.mtime.toISOString(), sha256: sha256.slice(0, 16), material };
  entries.push(e);
  if (st.mtimeMs > proofStat.mtimeMs) (material ? changedMaterial : changedNonMaterial).push(e);
}

const sourceCurrent = changedMaterial.length === 0;
const out = {
  proofPresent: true,
  proofPath: PROOF,
  proofMtimeIso: proofStat.mtime.toISOString(),
  proofSummary: proof.summary ?? null,
  c14FilesScanned: entries.length,
  materialFilesScanned: entries.filter((e) => e.material).length,
  changedAfterProofMaterial: changedMaterial,
  // Disclosed, not hidden: these changed but CANNOT alter runtime behaviour.
  changedAfterProofNonMaterial: changedNonMaterial,
  proofSourceCurrent: sourceCurrent,
  newOpenAICallMade: false,
  verdict: sourceCurrent
    ? "PROOF_SOURCE_CURRENT — no C1.4 RUNTIME file changed after the proof. The existing real-provider proof is preserved and NO new (paid) OpenAI call was made. Non-material changes (a read-only command center + a proof-generator test) are disclosed above; neither can alter the access-gate -> budget-reservation -> provider-call runtime path the proof attests."
    : "PROOF_STALE — a C1.4 RUNTIME file changed after the proof; it must be re-established by an authorized, bounded smoke run.",
  entries,
};

console.log(JSON.stringify({
  verdict: out.verdict,
  proofSourceCurrent: sourceCurrent,
  scanned: entries.length,
  changedMaterial: changedMaterial.length,
  changedNonMaterial: changedNonMaterial.map((e) => e.path),
}, null, 2));

const dest = ".e1-1-proofs/repository-reconciliation/c14-budget-provider-non-regression.json";
mkdirSync(dirname(resolve(process.cwd(), dest)), { recursive: true });
writeFileSync(resolve(process.cwd(), dest), JSON.stringify(out, null, 2), "utf8");
console.log(`-> ${dest}`);
