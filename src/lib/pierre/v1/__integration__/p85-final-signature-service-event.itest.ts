// PHASE 8.5-FINAL §4 — the SIGNATURE completion is SERVICE-DRIVEN. A runtime step waiting on a real
// signature_request resumes ONLY because the REAL P8.3 terminal service (finalizeSignedContract, reached
// through the genuine submit → provider webhook → processPendingSignatureEvents path with the Fake
// provider injected) emitted a durable runtime event IN ITS OWN TRANSACTION. The runtime never imports the
// provider adapter. A duplicate webhook yields one transition / one event; a DECLINED signature never
// resumes the step (it is recorded for an operator). No raw UPDATE, no terminal pre-seed, no manual ingest.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";
import { seedMission, runtimeTick, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";

let h: Harness; let owner: TenantContext; let emp: string; let provider: FakeSignatureProvider;
let storage: InMemoryStorage; const scanner = new DeterministicTestScanProvider();
const sd = () => ({ storage, scanner, deps: () => ({ storage, scanner }) });
const deps = () => ({ provider, storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });

/** submit a REAL contract for signature and start a runtime run that durably WAITS on that real request. */
async function runWaitingOnSignature(): Promise<{ runId: string; contractId: string; reqId: string; provReqId: string }> {
  const contractId = await readyForSignatureContract(h, owner, sd() as never, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, contractId, {}, deps());
  const mission = await seedMission(h, owner, "Signer puis poursuivre");
  const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
    { step_key: "sign", action_key: "wait.for_event", input: { event_kind: "signature.completed", object_type: "signature_request", object_id: sub.signature_request_id } },
    { step_key: "done", action_key: "mission.complete", depends_on: ["sign"] },
  ] } });
  await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
  return { runId: created.mission_run_id!, contractId, reqId: sub.signature_request_id, provReqId: sub.provider_request_id };
}
const completedEmissions = (reqId: string) => h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='runtime.event' and payload->>'source'='p83_signature' and payload->>'event_key'=$2`, [owner.company_id, `sig:${reqId}:completed`]).then((r) => r.rows[0].n);

describe("P8.5-FINAL signature service event", () => {
  it("a REAL signature completion resumes the waiting step (genuine provider webhook → finalize → emit)", async () => {
    const { runId, reqId, provReqId } = await runWaitingOnSignature();
    expect((await stepStatuses(h, runId)).sign).toBe("waiting");

    // the REAL terminal path: the provider signs, a webhook is ingested, the worker finalizes → emits
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d1", eventType: "request.completed", requestId: reqId });
    const r = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(r.finalized).toBe(1);
    expect(await completedEmissions(reqId)).toBe(1); // the service emitted exactly one durable event

    for (let i = 0; i < 4 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).sign).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("a duplicate webhook yields ONE transition and ONE durable event (idempotent)", async () => {
    const { runId, reqId, provReqId } = await runWaitingOnSignature();
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d1", eventType: "request.completed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    // a replayed webhook (same event id) is deduped; finalize is idempotent on the already-signed request
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d1", eventType: "request.completed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(await completedEmissions(reqId)).toBe(1); // never two events
    for (let i = 0; i < 4 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("a DECLINED signature never resumes the step (recorded, not a completion)", async () => {
    const { runId, reqId } = await runWaitingOnSignature();
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "x1", eventType: "request.declined", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    for (let i = 0; i < 3; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).sign).toBe("waiting"); // declined is not a completion → no wake
    expect((await runState(h, runId)).status).not.toBe("completed");
    expect(await completedEmissions(reqId)).toBe(0);
    // the declined fact IS recorded as a durable runtime event for the operator
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='runtime.event' and payload->>'event_key'=$2`, [owner.company_id, `sig:${reqId}:declined`])).rows[0].n).toBe(1);
  });
});
