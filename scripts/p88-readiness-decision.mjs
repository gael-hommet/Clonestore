// scripts/p88-readiness-decision.mjs
// PHASE 8.8 — READ-ONLY final Production-unblock decision aggregator. It reads gate results and prints
// READY_FOR_OWNER_UNBLOCK_DECISION or BLOCKED. It NEVER modifies a flag, deploys, or touches a
// provider/DB write. P8.7.4 verification is auto-derived from the latest final-report on disk and the
// deploy-block from the environment; the remaining gates are read from P8_8_GATES_STATUS.json (the
// operator's aggregation source, populated by running the individual read-only gates).
//
// Usage:  node scripts/p88-readiness-decision.mjs [--status <path>]
// Exit:   0 = READY_FOR_OWNER_UNBLOCK_DECISION   1 = BLOCKED

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const { evaluateReadiness, renderDecision } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/p88-readiness-decision.mjs")).href);

const argv = process.argv.slice(2);
const statusPath = (argv.find((a) => a.startsWith("--status=")) || "").split("=")[1] || join(ROOT, "P8_8_GATES_STATUS.json");

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; } };

// ── operator-maintained gate status (fail-closed: absent → all engineering gates false) ────────────
const status = readJson(statusPath) || {};

// ── auto-derive P8.7.4 verification from the LATEST final-report on disk (source of truth) ──────────
function latestP874() {
  const base = join(ROOT, ".p87-proofs", "step4", "final");
  if (!existsSync(base)) return { verified_24_24: false, final_report_ok: false, run: null };
  let best = null, bestT = 0;
  for (const d of readdirSync(base)) {
    const fr = join(base, d, "final-report.json"); if (!existsSync(fr)) continue;
    const t = statSync(fr).mtimeMs; if (t > bestT) { bestT = t; best = fr; }
  }
  if (!best) return { verified_24_24: false, final_report_ok: false, run: null };
  const j = readJson(best) || {};
  const stepsAll = j.steps ? Object.values(j.steps).every(Boolean) : false;
  return { verified_24_24: j.ok === true && j.verdict === "VERIFIED" && stepsAll, final_report_ok: j.ok === true, run: j.run_id || null, verdict: j.verdict };
}

const p874 = latestP874();
const deployBlockActive = process.env.NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE === "1" || process.env.NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE === "true" || status.deployBlock?.active === true;

const gates = {
  tests: status.tests,
  build: status.build,
  preflight: status.preflight,
  providers: status.providers,
  p874: { verified_24_24: p874.verified_24_24, final_report_ok: p874.final_report_ok },
  externalBlockers: status.externalBlockers || [],
  deployBlock: { active: deployBlockActive },
  residue: status.residue,
  rollback: status.rollback,
  observability: status.observability,
  ownerApproval: status.ownerApproval,
};

const result = evaluateReadiness(gates);
process.stdout.write("\n=== P8.8 FINAL PRODUCTION UNBLOCK DECISION (read-only) ===\n");
process.stdout.write(`P8.7.4 latest run: ${p874.run || "none"} verdict=${p874.verdict || "?"} verified_24_24=${p874.verified_24_24}\n`);
process.stdout.write(`deploy-block active: ${deployBlockActive}\n`);
process.stdout.write(renderDecision(result) + "\n");
process.exit(result.ready ? 0 : 1);
