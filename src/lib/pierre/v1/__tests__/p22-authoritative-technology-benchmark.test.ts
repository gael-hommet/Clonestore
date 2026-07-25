import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { getRuntimeActionDefinition } from "../runtime-action-registry";
import { packToRuntimePlan } from "../hr-mission-packs/runtime-map";
import { HR_MISSION_PACKS } from "../hr-mission-packs/registry";

// ─────────────────────────────────────────────────────────────────────────────
// P22 reprise — AUTHORITATIVE technology-execution benchmark over ALL mission packs.
//
// Measures the authoritative runtime action layer after eliminating every mission.noop. It compiles
// each pack to a runtime plan and EXECUTES the DB-persisting handlers (document.generate,
// hr.record.append, hr.data.collect, analytics.compute) for real against an in-memory SqlExecutor,
// asserting each success writes a real row (SUCCESS_WITHOUT_EFFECT = FAIL). Governed wait/human/
// external actions are classified (they legitimately pause; they are NOT counted as incompletions).
//
// Honest scope: this proves the ACTION LAYER produces effects with 0 remaining noops. It is NOT a
// full E2E proof against real Postgres + migrations, nor a browser/human-time proof — those stay
// external-gated (documented in the P22 report).
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeDb() {
  const documents: Row[] = [];
  const versions: Row[] = [];
  const analytics: Row[] = [];
  const events: Row[] = [];
  const run = async (text: string, params: readonly unknown[] = []): Promise<{ rows: Row[] }> => {
    const t = text.trim();
    if (t.startsWith("insert into pierre_rt_documents")) { const d = { id: params[0], mission_id: params[9], current_version: 0, status: "draft", deleted_at: null, document_type: params[2] }; documents.push(d); return { rows: [d] }; }
    if (t.startsWith("select * from pierre_rt_documents")) { const d = documents.find((x) => x.id === params[1]); return { rows: d ? [d] : [] }; }
    if (t.startsWith("insert into pierre_rt_document_versions")) { const v = { id: params[0], document_id: params[2] }; versions.push(v); return { rows: [v] }; }
    if (t.startsWith("update pierre_rt_documents")) { const d = documents.find((x) => x.id === params[1]); if (d) d.current_version = params[2]; return { rows: [] }; }
    if (t.startsWith("insert into pierre_rt_analytics_artifacts")) { analytics.push({ id: params[0], metric: params[3] }); return { rows: [] }; }
    if (t.startsWith("insert into pierre_rt_events")) { events.push({ id: params[0], type: params[3] }); return { rows: [] }; }
    return { rows: [] };
  };
  const db: SqlExecutor = {
    query: async <T = Row>(text: string, params?: readonly unknown[]) => (await run(text, params ?? [])) as { rows: T[] },
    transaction: async <T>(fn: (tx: SqlExecutor) => Promise<T>) => fn(db),
  };
  return { db, documents, analytics, events };
}

function ctxFor(db: SqlExecutor, missionId: string, payload: Record<string, unknown>): RuntimeActionContext {
  const tenant = {
    company_id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    role_keys: ["OWNER"],
    permissions: ["document.write", "document.read", "document.sensitive.write", "document.sensitive.read", "audit.read", "validation.read"],
  } as unknown as TenantContext;
  return {
    appDb: db, tenant, companyId: tenant.company_id,
    missionId, missionRunId: "44444444-4444-4444-4444-444444444444",
    stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666",
    idempotencyKey: "idem", payload, deps: {}, assertLease: async () => {}, checkpoint: async () => {},
  };
}

const PERSISTING = new Set(["document.generate", "hr.record.append", "hr.data.collect", "analytics.compute"]);
const GOVERNED_AUTOEXEC = new Set(["communication.create_intent", "follow_up.schedule"]);
const WAIT_HUMAN_EXTERNAL = new Set(["approval.request", "signature.prepare", "wait.until_time", "wait.for_event"]);
const TERMINAL = new Set(["mission.complete", "mission.block"]);

describe("P22 authoritative technology-execution benchmark (all packs, 0 noop)", () => {
  it("executes real persisting actions across every pack and records final metrics", async () => {
    let totalSteps = 0;
    let noopRemaining = 0;
    let persistingExecuted = 0;
    let effectRows = 0;
    let governedAutoexec = 0;
    let waitHumanExternal = 0;
    let terminal = 0;
    let needsInfo = 0;
    let falseSuccess = 0;
    let missionId = 100000;

    for (const pack of HR_MISSION_PACKS) {
      const plan = packToRuntimePlan(pack);
      const { db, documents, analytics, events } = makeDb();
      const mid = `00000000-0000-0000-0000-${String(missionId++).padStart(12, "0")}`;

      for (const step of plan.steps) {
        totalSteps += 1;
        const key = step.action_key;
        expect(getRuntimeActionDefinition(key)).not.toBeNull(); // non-divergence: every action is registered

        if (key === "mission.noop") { noopRemaining += 1; continue; }
        if (WAIT_HUMAN_EXTERNAL.has(key)) { waitHumanExternal += 1; continue; }
        if (TERMINAL.has(key)) { terminal += 1; continue; }
        if (GOVERNED_AUTOEXEC.has(key)) { governedAutoexec += 1; continue; } // real governed actions (proven elsewhere; not executed here to avoid stubbing provider deps)

        if (PERSISTING.has(key)) {
          const rowsBefore = documents.length + analytics.length + events.length;
          const res = await RUNTIME_ACTION_HANDLERS[key](ctxFor(db, mid, step.input));
          const rowsAfter = documents.length + analytics.length + events.length;
          if (res.status === "succeeded") {
            persistingExecuted += 1;
            if (rowsAfter === rowsBefore + 1) effectRows += 1;
            else falseSuccess += 1; // succeeded without an effect row → FAIL
          } else if (res.status === "blocked" && res.blockerCode === "needs_information") {
            needsInfo += 1; // legitimate governed pause, not a false success
          }
        }
      }
    }

    // Auto-executable = everything Pierre can do without a human/external boundary.
    const autoExecutable = persistingExecuted + governedAutoexec + needsInfo;
    // Operational completion among auto-executable steps: 0 remain unbound (noop), every persisting
    // action that ran produced an effect, needs_information is a legitimate governed outcome.
    const operationalCompletion = autoExecutable > 0
      ? Number((((persistingExecuted + governedAutoexec) / autoExecutable) * 100).toFixed(1))
      : 0;
    const artifactPersistenceRate = persistingExecuted > 0
      ? Number(((effectRows / persistingExecuted) * 100).toFixed(1))
      : 0;

    // Invariants.
    expect(noopRemaining).toBe(0);
    expect(falseSuccess).toBe(0);
    expect(artifactPersistenceRate).toBe(100);

    const summary = {
      generated_for: "P22_REAL_TECHNOLOGY_EXECUTION",
      note: "Authoritative runtime action layer over ALL mission packs after eliminating every mission.noop. Persisting handlers executed for real vs in-memory SqlExecutor; governed wait/human/external steps classified. Not a full embedded-PG/browser proof.",
      CORRECTION:
        "The earlier 'operational_completion_rate: 100%' was MISLEADING and is REJECTED. Persisting an event via hr.record.append is a TRACE, not a business effect. This field is renamed 'action_binding_completion_rate' (every step binds to a real registered action) and is NOT business completion. See P22_ACTION_SEMANTIC_GAP_MATRIX.json for BUSINESS_EFFECT_COMPLETION_RATE (the honest metric).",
      packs_measured: HR_MISSION_PACKS.length,
      total_runtime_action_steps: totalSteps,
      mission_noop_remaining: noopRemaining,
      persisting_actions_executed: persistingExecuted,
      persisting_effect_rows: effectRows,
      trace_or_record_persistence_rate: artifactPersistenceRate,
      governed_autoexec_actions: governedAutoexec,
      needs_information_pauses: needsInfo,
      wait_human_external_steps: waitHumanExternal,
      terminal_steps: terminal,
      false_success: falseSuccess,
      auto_executable_steps: autoExecutable,
      action_binding_completion_rate: operationalCompletion,
      business_effect_completion_rate_note: "NOT computed here — see P22_ACTION_SEMANTIC_GAP_MATRIX.json (72.9% at persistence level; only absence.record.create proven on real SQL).",
    };
    const outDir = path.join(process.cwd(), "docs", "reports");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "P22_REAL_TECHNOLOGY_EXECUTION_RESULTS.json"), JSON.stringify(summary, null, 2), "utf8");
  });
});
