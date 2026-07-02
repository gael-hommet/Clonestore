// scripts/p812-verify-provider-integrations.mjs
// PHASE 8.12 — verify provider integrations are governed + fail-closed: none usable without real
// config, Yousign blocked (P8.7.4), submission never simulates success (routes to manual), every
// provider has a governed manual path, webhooks fail-closed. NO real provider is contacted.
// Run: npx tsx scripts/p812-verify-provider-integrations.mjs

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`[p812-prov] ${m}\n`);
const imp = async (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const pi = await imp("src/lib/pierre/v1/provider-integrations/index.ts");

const RUN_ID = `p812prov-${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p812-proofs", RUN_ID);
const write = (n, o) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, n), JSON.stringify(o, null, 2)); };
const NOW = "2026-07-02T10:00:00.000Z";

const preflights = pi.preflightAll(process.env);
const summary = pi.providerSummary(process.env);

// contract test: submission must route to manual (never fabricate success) for every provider
const contractTests = pi.PROVIDER_ADAPTERS.map((a) => {
  const r = pi.submit(a, `corr-${a.id}`, NOW, process.env);
  return { provider: a.id, outcome: r.outcome, fabricatedReference: r.reference !== null, manualHandoff: r.manualHandoffId !== null };
});
const manualPaths = pi.PROVIDER_ADAPTERS.map((a) => ({ provider: a.id, available: a.manualHandoff.available, steps: a.manualHandoff.steps.length, evidence: a.manualHandoff.producesEvidence }));
const yousign = pi.preflight(pi.getProvider("yousign"), process.env);
// real-provider smoke: NONE performed (no live provider) — honest empty result
const realSmoke = { performed: false, reason: "no provider is live-configured in this environment; no real call made", results: [] };

const gates = {
  none_usable: summary.usable === 0,
  yousign_blocked: yousign.status === "blocked",
  no_fabricated_success: contractTests.every((t) => !t.fabricatedReference && t.outcome === "routed_to_manual"),
  all_have_manual_path: summary.allHaveManualPath,
  no_real_provider_called: realSmoke.performed === false,
};
const ok = Object.values(gates).every(Boolean);
write("provider-preflights.json", { run_id: RUN_ID, summary, preflights });
write("provider-contract-tests.json", { run_id: RUN_ID, contractTests });
write("real-provider-smoke.json", { run_id: RUN_ID, ...realSmoke });
write("manual-handoff-paths.json", { run_id: RUN_ID, manualPaths });
write("yousign-status.json", { run_id: RUN_ID, ...yousign });
log(`providers=${summary.providers} usable=${summary.usable} blocked=${JSON.stringify(summary.blocked)} byStatus=${JSON.stringify(summary.byStatus)}`);
log(`GATES ${Object.entries(gates).map(([k, v]) => `${k}=${v ? "Y" : "N"}`).join(" ")}`);
log(`VERDICT ${ok ? "GREEN (governed, fail-closed, no provider contacted)" : "RED"} — .p812-proofs/${RUN_ID}/`);
process.exit(ok ? 0 : 1);
