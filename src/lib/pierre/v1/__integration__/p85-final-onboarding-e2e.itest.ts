// PHASE 8.5-FINAL §8 (E2E A — Lina) — a FULL onboarding mission threaded through the REAL services, with
// NO terminal pre-seed, NO raw UPDATE, NO manual ingest. HR approves via the REAL decideValidationAction
// (which emits the approval event); the welcome is a REAL P8.4 communication that is genuinely delivered
// (which emits the delivery event); the runtime resumes each step only from those service-emitted events.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";
import { seedMission, runtimeTick, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { decideValidationAction } from "../mission-service";

let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider(); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

describe("P8.5-FINAL onboarding E2E (Lina)", () => {
  it("approve (real decision) → welcome (real delivery) → complete, each step resumed by a service event", async () => {
    const welcomeDoc = await seedDocument(h, owner, "Livret d'accueil de Lina");
    const mission = await seedMission(h, owner, "Onboarder Lina");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
      { step_key: "approve", action_key: "approval.request", input: { reason: "Valider l'onboarding de Lina", fingerprint: "LINA_V1" } },
      { step_key: "welcome", action_key: "wait.for_event", depends_on: ["approve"], input: { event_kind: "communication.delivered", object_type: "communication", object_id: welcomeDoc } },
      { step_key: "done", action_key: "mission.complete", depends_on: ["welcome"] },
    ] } });
    const runId = created.mission_run_id!;

    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect((await stepStatuses(h, runId)).approve).toBe("waiting");

    // 1) HR approves through the REAL decision service (emits the durable approval event)
    const v = (await h.db.query<{ validation_id: string }>(`select validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and object_type='validation'`, [runId])).rows[0];
    const ver = (await h.db.query<{ version: number }>(`select version from pierre_rt_validations where id=$1`, [v.validation_id])).rows[0].version;
    await decideValidationAction(h.db, owner, v.validation_id, "approve", ver);

    // drive until the 'welcome' step is actually waiting on the communication
    for (let i = 0; i < 5 && (await stepStatuses(h, runId)).welcome !== "waiting"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).approve).toBe("succeeded");
    expect((await stepStatuses(h, runId)).welcome).toBe("waiting");

    // 2) a REAL P8.4 welcome about the document is created and genuinely DELIVERED (emits the delivery event)
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: welcomeDoc });
    await Comm.createCommunicationIntents(h.db, owner, {}, deps());
    const d = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps());
    expect(d.delivered).toBe(1); // the in-app welcome is really delivered

    for (let i = 0; i < 5 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).welcome).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
  });
});
