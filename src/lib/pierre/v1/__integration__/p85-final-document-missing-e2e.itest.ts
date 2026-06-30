// PHASE 8.5-FINAL §8 (E2E B — Marc) — a required document is missing. The runtime BLOCKS honestly (never a
// fabricated success) and never advances the dependent steps. When the real document IS present, a REAL
// P8.4 reminder is genuinely delivered (emitting the delivery event) and the mission proceeds to read it
// and complete. No terminal pre-seed, no raw UPDATE, no manual ingest.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";
import { seedMission, runtimeTick, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider(); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

describe("P8.5-FINAL missing-document E2E (Marc)", () => {
  it("a missing required document BLOCKS the mission and never advances the dependent step", async () => {
    const mission = await seedMission(h, owner, "Onboarder Marc (doc manquant)");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
      { step_key: "read_id", action_key: "document.read", input: { document_id: newUuid() } }, // absent
      { step_key: "finish", action_key: "mission.complete", depends_on: ["read_id"] },
    ] } });
    const runId = created.mission_run_id!;
    await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).read_id).toBe("blocked");
    expect((await stepStatuses(h, runId)).finish).not.toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("blocked");
  });

  it("with the document present, a REAL reminder is delivered and the mission reads it and completes", async () => {
    const idDoc = await seedDocument(h, owner, "Pièce d'identité de Marc");
    const mission = await seedMission(h, owner, "Onboarder Marc (doc présent)");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
      { step_key: "remind", action_key: "wait.for_event", input: { event_kind: "communication.delivered", object_type: "communication", object_id: idDoc } },
      { step_key: "read_id", action_key: "document.read", depends_on: ["remind"], input: { document_id: idDoc } },
      { step_key: "finish", action_key: "mission.complete", depends_on: ["read_id"] },
    ] } });
    const runId = created.mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect((await stepStatuses(h, runId)).remind).toBe("waiting");

    // a REAL reminder communication about the document is created and genuinely delivered
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: idDoc });
    await Comm.createCommunicationIntents(h.db, owner, {}, deps());
    expect((await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps())).delivered).toBe(1);

    for (let i = 0; i < 6 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).remind).toBe("succeeded");
    expect((await stepStatuses(h, runId)).read_id).toBe("succeeded"); // read the REAL present document
    expect((await runState(h, runId)).status).toBe("completed");
  });
});
