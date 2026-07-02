#!/usr/bin/env node
// scripts/check-p87-controlled-live-journey.mjs
// PHASE 8.7.4 — STAGE 2 — THIN CLI for the controlled-live-customer-journey verifier. It loads the freshest
// proof bundle under .p87-proofs/step4/final/<run_id>/ (or a specific --run=/--resume=<run_id>), wires it into
// the injectable engine, and reports the verdict. Read-only. Never prints a secret. It refuses to go green off
// the old governed-core pass, off a partial bundle, off a provider call without a webhook, or off any fabricated
// status — the engine encodes every refusal.
//
//   --json            JSON only (no human summary)
//   --strict          exit 2 unless VERIFIED  (the `check:` script)   default/report mode exits 0
//   --run=<run_id>    verify a specific run    (alias: --resume=<run_id>)
//
// Exit codes:  0 VERIFIED (or report mode);  2 strict & not VERIFIED.

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const engine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/controlled-live-journey-check.mjs")).href);

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes("--json");
const STRICT = argv.includes("--strict");
const WANT_RUN = (argv.find((a) => a.startsWith("--run=") || a.startsWith("--resume=")) || "").split("=")[1] || null;

const FINAL_DIR = join(ROOT, ".p87-proofs", "step4", "final");

function readJson(p) { try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; } }

// Pick the run directory: the explicit --run/--resume, else the most recently modified non-empty run dir.
function pickRunDir() {
  if (!existsSync(FINAL_DIR)) return null;
  const dirs = readdirSync(FINAL_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (!dirs.length) return null;
  if (WANT_RUN) return dirs.includes(WANT_RUN) ? join(FINAL_DIR, WANT_RUN) : null;
  let best = null, bestMtime = -1;
  for (const name of dirs) {
    const full = join(FINAL_DIR, name);
    const manifest = join(full, "run-manifest.json");
    const ref = existsSync(manifest) ? manifest : full;
    const mt = statSync(ref).mtimeMs;
    if (mt > bestMtime) { bestMtime = mt; best = full; }
  }
  return best;
}

function loadBundle() {
  const dir = pickRunDir();
  if (!dir) return null;
  const files = {};
  const present = [];
  const missing = [];
  for (const name of engine.REQUIRED_PROOFS) {
    const p = join(dir, name);
    if (existsSync(p)) { const obj = readJson(p); files[name] = obj; present.push(name); if (obj == null) missing.push(name); }
    else missing.push(name);
  }
  // run_id is taken from the manifest if present, else from the directory name.
  const manifest = files["run-manifest.json"];
  const run_id = (manifest && manifest.run_id) || dir.split(/[\\/]/).pop();
  return { run_id, dir, files, present, missing };
}

const report = engine.runControlledLiveJourneyCheck({ loadBundle, now: new Date().toISOString() });

if (!JSON_ONLY) {
  process.stderr.write(`\n== P8.7.4 STAGE 2 — CONTROLLED LIVE CUSTOMER JOURNEY CHECK ==\n`);
  process.stderr.write(`   run_id : ${report.run_id || "(none)"}\n   verdict: ${report.verdict}\n`);
  if (report.missing.length) process.stderr.write(`   missing: ${report.missing.join(", ")}\n`);
  if (report.steps.length) {
    process.stderr.write(`   requirements:\n`);
    for (const s of report.steps) process.stderr.write(`     ${s.ok ? "PASS" : "FAIL"}  ${s.key}  (${s.detail})\n`);
  }
  if (report.refusals.length) {
    process.stderr.write(`   REFUSALS:\n`);
    for (const r of report.refusals) process.stderr.write(`     - ${r.rule}: ${r.reason}\n`);
  }
  if (report.human_signature_action_required) process.stderr.write(`   NOTE: human Yousign signature_request.activated action still required.\n`);
  process.stderr.write(`\n   ${report.summary}\n   mode: ${STRICT ? "strict" : "report"}\n\n`);
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(STRICT && !report.ok ? 2 : 0);
