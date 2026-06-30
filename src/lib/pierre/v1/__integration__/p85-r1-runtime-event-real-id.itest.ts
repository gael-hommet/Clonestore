// PHASE 8.5-R1 §R1.8 — a resolved wait references the REAL persisted runtime event (FK-enforced), never
// an arbitrary uuid. The ingestor records the event in the ledger and resolves the matching wait with
// that event's id; a replay with the same key is idempotent, a different hash is a conflict.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { ingestPierreRuntimeEvent } from "../runtime-scheduler";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("P8.5-R1 runtime event identity (real id + FK)", () => {
  it("the resolved wait points at the REAL ingested event id (FK-valid)", async () => {
    const m = await seedMission(h, owner);
    const objectId = newUuid();
    const runId = (await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "w", action_key: "wait.for_event", input: { event_kind: "signature.completed", object_type: "signature_request", object_id: objectId } },
    ] } })).mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });

    const ing = await ingestPierreRuntimeEvent(h.db, owner, { source: "p83", event_key: "evt-real", kind: "signature.completed", object_type: "signature_request", object_id: objectId, payload_hash: "hash1" });
    expect(ing.status).toBe("received");
    expect(ing.resolved).toBe(1);
    expect(ing.event_id).toBeTruthy();

    const wait = (await h.db.query<{ resolved_by_event_id: string; status: string }>(`select resolved_by_event_id, status from pierre_rt_runtime_waits where company_id=$1 and mission_run_id=$2`, [h.companyA, runId])).rows[0];
    expect(wait.status).toBe("satisfied");
    expect(wait.resolved_by_event_id).toBe(ing.event_id); // the REAL event id, not a fabricated uuid
    // the referenced event genuinely exists in the ledger (the FK would have rejected anything else)
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_events where company_id=$1 and id=$2`, [h.companyA, wait.resolved_by_event_id])).rows[0].n).toBe(1);
  });

  it("replay is idempotent (same key+hash → duplicate; same key+different hash → conflict)", async () => {
    await ingestPierreRuntimeEvent(h.db, owner, { source: "p83", event_key: "k", kind: "signature.completed", object_type: "signature_request", object_id: newUuid(), payload_hash: "h1" });
    const dup = await ingestPierreRuntimeEvent(h.db, owner, { source: "p83", event_key: "k", kind: "signature.completed", object_type: "signature_request", object_id: newUuid(), payload_hash: "h1" });
    expect(dup.status).toBe("duplicate");
    const conflict = await ingestPierreRuntimeEvent(h.db, owner, { source: "p83", event_key: "k", kind: "signature.completed", object_type: "signature_request", object_id: newUuid(), payload_hash: "h2" });
    expect(conflict.status).toBe("conflict");
  });
});
