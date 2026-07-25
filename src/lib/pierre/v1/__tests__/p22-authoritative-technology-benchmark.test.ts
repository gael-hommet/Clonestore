import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { getRuntimeActionDefinition } from "../runtime-action-registry";
import { packToRuntimePlan, isRuntimeActionStep } from "../hr-mission-packs/runtime-map";
import { RECRUITMENT_PACKS } from "../hr-mission-packs/domains/recruitment";
import { ONBOARDING_PACKS } from "../hr-mission-packs/domains/onboarding";
import { OFFBOARDING_PACKS } from "../hr-mission-packs/domains/offboarding";
import type { HrMissionPackDefinition, StepBinding } from "../hr-mission-packs/types";

// ─────────────────────────────────────────────────────────────────────────────
// P22 continuation — AUTHORITATIVE technology-execution benchmark.
//
// Measures the AUTHORITATIVE runtime action layer (registry + handlers), NOT the V0 pure path the
// first P22 benchmark measured. It compiles real mission packs to runtime plans and executes each
// artifact-producing action (document.generate, analytics.compute) for real against an in-memory
// SqlExecutor, then classifies the remaining governed actions. It proves the concrete advance:
// document-producing steps that used to be `mission.noop` now persist a real document artifact.
//
// It does NOT claim full E2E mission completion / human-time / browser — those need embedded PG +
// the mode layer + a browser and stay external-gated (documented in the P22 report).
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeDb() {
  const documents: Row[] = [];
  const versions: Row[] = [];
  const analytics: Row[] = [];
  const run = async (text: string, params: readonly unknown[] = []): Promise<{ rows: Row[] }> => {
    const t = text.trim();
    if (t.startsWith("insert into pierre_rt_documents")) {
      const doc = { id: params[0], company_id: params[1], document_type: params[2], title: params[3], mission_id: params[9], employee_id: params[6], current_version: 0, status: "draft", deleted_at: null };
      documents.push(doc); return { rows: [doc] };
    }
    if (t.startsWith("select * from pierre_rt_documents")) { const d = documents.find((x) => x.id === params[1]); return { rows: d ? [d] : [] }; }
    if (t.startsWith("insert into pierre_rt_document_versions")) { const v = { id: params[0], document_id: params[2], content_hash: params[7] }; versions.push(v); return { rows: [v] }; }
    if (t.startsWith("update pierre_rt_documents")) { const d = documents.find((x) => x.id === params[1]); if (d) d.current_version = params[2]; return { rows: [] }; }
    if (t.startsWith("insert into pierre_rt_analytics_artifacts")) { analytics.push({ id: params[0], metric: params[3] }); return { rows: [] }; }
    return { rows: [] };
  };
  const db: SqlExecutor = {
    query: async <T = Row>(text: string, params?: readonly unknown[]) => (await run(text, params ?? [])) as { rows: T[] },
    transaction: async <T>(fn: (tx: SqlExecutor) => Promise<T>) => fn(db),
  };
  return { db, documents, versions, analytics };
}

function ctxFor(db: SqlExecutor, payload: Record<string, unknown>): RuntimeActionContext {
  const tenant = {
    company_id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    role_keys: ["OWNER"],
    permissions: ["document.write", "document.read", "document.sensitive.write", "document.sensitive.read", "audit.read"],
  } as unknown as TenantContext;
  return {
    appDb: db, tenant, companyId: tenant.company_id,
    missionId: "33333333-3333-3333-3333-333333333333", missionRunId: "44444444-4444-4444-4444-444444444444",
    stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666",
    idempotencyKey: "idem", payload, deps: {}, assertLease: async () => {}, checkpoint: async () => {},
  };
}

const PACKS: HrMissionPackDefinition[] = [...RECRUITMENT_PACKS, ...ONBOARDING_PACKS, ...OFFBOARDING_PACKS];

describe("P22 authoritative technology-execution benchmark", () => {
  it("executes real artifact-producing actions and records the advance", async () => {
    const perPack: Array<Record<string, unknown>> = [];
    let totalRtSteps = 0;
    let artifactSteps = 0;
    let artifactsPersisted = 0;
    let noopRemaining = 0;
    let governedReal = 0; // approval/communication/signature/follow_up/wait — real governed actions (not noop)
    let falseSuccess = 0;

    for (const pack of PACKS) {
      const plan = packToRuntimePlan(pack);
      const { db, documents, analytics } = makeDb();
      let packArtifacts = 0;
      let packDocSteps = 0;

      for (const step of plan.steps) {
        totalRtSteps += 1;
        const actionKey = step.action_key;
        const def = getRuntimeActionDefinition(actionKey);
        expect(def).not.toBeNull(); // non-divergence: every bound action is registered

        if (actionKey === "document.generate") {
          artifactSteps += 1; packDocSteps += 1;
          const handler = RUNTIME_ACTION_HANDLERS["document.generate"];
          const before = documents.length;
          const res = await handler(ctxFor(db, step.input));
          if (res.status === "succeeded" && documents.length === before + 1) { artifactsPersisted += 1; packArtifacts += 1; }
          // false success = claims succeeded but nothing persisted
          if (res.status === "succeeded" && documents.length === before) falseSuccess += 1;
        } else if (actionKey === "analytics.compute") {
          artifactSteps += 1;
          const handler = RUNTIME_ACTION_HANDLERS["analytics.compute"];
          const before = analytics.length;
          const res = await handler(ctxFor(db, step.input));
          if (res.status === "succeeded" && analytics.length === before + 1) { artifactsPersisted += 1; }
          if (res.status === "succeeded" && analytics.length === before) falseSuccess += 1;
        } else if (actionKey === "mission.noop") {
          noopRemaining += 1;
        } else if (["approval.request", "communication.create_intent", "signature.prepare", "follow_up.schedule", "wait.until_time", "wait.for_event", "mission.complete", "mission.block"].includes(actionKey)) {
          governedReal += 1;
        }
      }

      // Non-divergence at the PACK level: no step of kind "prepare_document" may still be mission.noop.
      const docStepsStillNoop = pack.steps
        .filter(isRuntimeActionStep)
        .filter((s) => s.kind === "prepare_document")
        .filter((s) => (s.binding as Extract<StepBinding, { type: "runtime_action" }>).actionKey === "mission.noop");
      expect(docStepsStillNoop).toHaveLength(0);

      perPack.push({ pack: pack.id, rt_steps: plan.steps.length, document_steps: packDocSteps, artifacts_persisted: packArtifacts });
    }

    const artifactPersistenceRate = artifactSteps > 0 ? Number(((artifactsPersisted / artifactSteps) * 100).toFixed(1)) : 0;

    // Invariants for THIS measured layer.
    expect(falseSuccess).toBe(0);
    expect(artifactSteps).toBeGreaterThan(0);
    expect(artifactPersistenceRate).toBe(100); // every artifact-producing action actually persisted

    const summary = {
      generated_for: "P22_REAL_TECHNOLOGY_EXECUTION",
      note: "Authoritative runtime action layer benchmark. Executes document.generate + analytics.compute for real against an in-memory SqlExecutor. Not a full E2E/browser/embedded-PG proof.",
      packs_measured: PACKS.length,
      total_runtime_action_steps: totalRtSteps,
      artifact_producing_steps: artifactSteps,
      artifacts_persisted: artifactsPersisted,
      artifact_persistence_rate: artifactPersistenceRate,
      governed_real_actions: governedReal,
      mission_noop_remaining: noopRemaining,
      false_success: falseSuccess,
      per_pack: perPack,
    };
    const outDir = path.join(process.cwd(), "docs", "reports");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "P22_REAL_TECHNOLOGY_EXECUTION_RESULTS.json"), JSON.stringify(summary, null, 2), "utf8");
  });
});
