// PHASE 8.5-FINAL §8 (E2E C — Nora) — a contract amendment threaded through the REAL services. The
// amendment is RE-APPROVED via the REAL decideValidationAction (emits the approval event), then SIGNED via
// the genuine P8.3 path (submit → provider webhook → processPendingSignatureEvents → finalizeSignedContract,
// which emits the signature event). The runtime resumes each step only from those service-emitted events.
// A STALE approval (wrong content fingerprint) must never advance the amendment. No pre-seed, no UPDATE.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";
import { seedMission, runtimeTick, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { decideValidationAction } from "../mission-service";

let h: Harness; let owner: TenantContext; let emp: string; let provider: FakeSignatureProvider;
let storage: InMemoryStorage; const scanner = new DeterministicTestScanProvider();
const sd = () => ({ storage, scanner, deps: () => ({ storage, scanner }) });
const deps = () => ({ provider, storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "nora@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });

describe("P8.5-FINAL amendment E2E (Nora)", () => {
  it("re-approve (real decision) → sign the amendment (real P8.3) → complete, resumed by service events", async () => {
    // the REAL amendment contract is prepared + submitted for signature
    const contractId = await readyForSignatureContract(h, owner, sd() as never, emp);
    const sub = await S.submitContractToSignatureProvider(h.db, owner, contractId, {}, deps());
    const reqId = sub.signature_request_id;

    const mission = await seedMission(h, owner, "Avenant au contrat de Nora");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
      { step_key: "reapprove", action_key: "approval.request", input: { reason: "Approuver l'avenant de Nora", fingerprint: "AVENANT_V2" } },
      { step_key: "sign", action_key: "wait.for_event", depends_on: ["reapprove"], input: { event_kind: "signature.completed", object_type: "signature_request", object_id: reqId } },
      { step_key: "done", action_key: "mission.complete", depends_on: ["sign"] },
    ] } });
    const runId = created.mission_run_id!;

    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect((await stepStatuses(h, runId)).reapprove).toBe("waiting");

    // 1) re-approve through the REAL decision service (emits the approval event with the pinned fingerprint)
    const v = (await h.db.query<{ validation_id: string }>(`select validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and object_type='validation'`, [runId])).rows[0];
    const ver = (await h.db.query<{ version: number }>(`select version from pierre_rt_validations where id=$1`, [v.validation_id])).rows[0].version;
    await decideValidationAction(h.db, owner, v.validation_id, "approve", ver);
    for (let i = 0; i < 5 && (await stepStatuses(h, runId)).sign !== "waiting"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).reapprove).toBe("succeeded");
    expect((await stepStatuses(h, runId)).sign).toBe("waiting");

    // 2) the amendment is SIGNED through the genuine P8.3 path (provider webhook → finalize → emits the event)
    provider.__sign(sub.provider_request_id);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d1", eventType: "request.completed", requestId: reqId });
    expect((await S.processPendingSignatureEvents(h.db, owner, {}, deps())).finalized).toBe(1);

    for (let i = 0; i < 5 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).sign).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
    // the amendment contract is really signed (the REAL terminal state, not a seed)
    expect((await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [contractId])).rows[0].ws).toBe("signed");
  });
});
