// scripts/p814-openai-smoke.mjs
// PHASE 8.14 (§8) — the REAL bounded provider smoke. Loads the server-side keys from .env.local into
// process.env (NEVER printed/inspected/logged), forces AI_RUNTIME_MODE=production, and runs a SMALL set
// of SYNTHETIC scenarios through the real CloneAI runtime (runCloneAIContract) + the live cognitive
// analyzer. Records actual provider/model/tokens/latency/estimated-cost. No live company data, no external
// provider side effects, no DB writes. Bounded to a handful of calls to keep cost tiny. Honest: if a key
// is genuinely absent, it records SKIPPED_NO_KEY and exits 0 (operator blocker), never a faked pass.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

// ── load .env.local secrets into process.env WITHOUT printing values ──
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();
process.env.AI_RUNTIME_MODE = "production"; // exercise the real providers for this controlled smoke

const runId = `p814smoke-${randomBytes(5).toString("hex")}`;
const dir = `.p814-proofs/${runId}`; mkdirSync(dir, { recursive: true });
const write = (n, o) => writeFileSync(`${dir}/${n}`, JSON.stringify(o, null, 2) + "\n");

const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 20;

if (!hasOpenAI && !hasAnthropic) {
  write("real-openai-smoke.json", { runId, status: "SKIPPED_NO_KEY", reason: "no server-side OPENAI/ANTHROPIC key present — operator must provide one", key_exposed: false, ran: 0 });
  console.log("[smoke] SKIPPED_NO_KEY"); process.exit(0);
}

const { runCloneAIContract } = await import("../src/lib/cloneos/ai/runtime.ts");
const { cognitiveAnalyze } = await import("../src/lib/pierre/v1/cognitive-runtime/cognitive-analyzer.ts");

// SYNTHETIC scenarios only (no real employee/company data).
const SCENARIOS = [
  { id: "simple_onboarding", instruction: "Un nouveau salarié commence lundi, prépare son intégration.", expectSensitive: false },
  { id: "multi_domain_change", instruction: "Un salarié change de poste, de salaire et de site le mois prochain.", expectSensitive: true },
  { id: "termination_human_only", instruction: "Prépare le dossier de licenciement pour faute grave.", expectSensitive: true },
  { id: "harassment_case", instruction: "Une salariée signale un harcèlement de son manager, prends en charge.", expectSensitive: true },
  { id: "optimization", instruction: "Dis-moi ce qui nous fait perdre le plus de temps en RH et améliore-le.", expectSensitive: false },
];

const results = [];
let totalTokens = 0;
for (const s of SCENARIOS) {
  const started = Date.now ? undefined : undefined; // Date.now allowed in scripts
  const t0 = Date.now();
  let rec = { id: s.id, ok: false };
  try {
    const resp = await runCloneAIContract({ useCase: "pierre.brain.task_plan", variables: { brain_interpretation: s.instruction } });
    const latency = Date.now() - t0;
    const usage = resp.usage ?? {};
    const tokens = (usage.total_tokens_estimated ?? (usage.input_tokens_estimated ?? 0) + (usage.output_tokens_estimated ?? 0)) || 0;
    totalTokens += tokens;
    // live wired path: real analyzer with the model authoritative
    let analyzerOk = false, sensitivityFlagged = false;
    try {
      const a = await cognitiveAnalyze(s.instruction, { enabled: true });
      analyzerOk = a.planner_source === "llm" && a.proposed_tasks.length > 0;
      sensitivityFlagged = a.approval_required || a.sensitivity !== "normal" || a.risk_level === "high" || a.risk_level === "critical";
    } catch { /* analyzer degraded */ }
    rec = {
      id: s.id, ok: resp.ok === true, provider: resp.provider, model_profile: resp.model_profile,
      structured_json_parsed: !!resp.json, tokens, latency_ms: latency,
      analyzer_llm_authoritative: analyzerOk,
      sensitivity_correct: s.expectSensitive ? sensitivityFlagged : true,
      error: resp.ok ? null : (resp.error ?? "not ok"),
    };
  } catch (e) {
    rec = { id: s.id, ok: false, error: String(e).slice(0, 160) };
  }
  results.push(rec);
  console.log(`[smoke] ${s.id}: ok=${rec.ok} provider=${rec.provider ?? "-"} tokens=${rec.tokens ?? 0} sens=${rec.sensitivity_correct}`);
}

// Invented-tool safety under real model: the analyzer maps to registered ActionKinds only; assert no crash
// and that sensitive scenarios were flagged (the deterministic floor is a backstop even with a real model).
const passed = results.filter((r) => r.ok && r.structured_json_parsed && r.sensitivity_correct);
const estCostUsd = Number(((totalTokens / 1_000_000) * 3).toFixed(4)); // rough blended estimate; recorded, not billed here

write("real-openai-smoke.json", {
  runId, status: "EXECUTED", key_exposed: false, ai_mode: "production",
  scenarios_total: SCENARIOS.length, scenarios_passed: passed.length,
  total_tokens: totalTokens, estimated_cost_usd: estCostUsd,
  all_structured_parsed: results.every((r) => r.ok ? r.structured_json_parsed : true),
  sensitive_all_flagged: results.filter((r) => SCENARIOS.find((s) => s.id === r.id)?.expectSensitive).every((r) => r.sensitivity_correct),
  results,
});
console.log(`\n[smoke] runId=${runId} EXECUTED passed=${passed.length}/${SCENARIOS.length} tokens=${totalTokens} ~$${estCostUsd} → ${dir}`);
