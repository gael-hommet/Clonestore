// PHASE 8.5-R1 §R1.5 — a handler re-asserts the lease BEFORE any external effect. If the lease was lost
// (a newer generation reclaimed the job), assertLease throws and the external send NEVER happens — no
// double email even when two workers raced. The DB-write is fencing-protected; this closes the
// in-flight-side-effect gap that fencing alone cannot.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedRuntimeDocument } from "./p85-helpers";
import { configureSignatory } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import { getRuntimeActionHandler, type RuntimeActionContext } from "../runtime-action-handlers";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

describe("P8.5-R1 pre-external-effect lease check", () => {
  it("a lost lease aborts the external send (no email) before the provider is called", async () => {
    const doc = await seedRuntimeDocument(h, owner);
    const provider = new FakeEmailProvider();
    const ctx: RuntimeActionContext = {
      appDb: h.db, tenant: owner, companyId: h.companyA, missionId: newUuid(), missionRunId: newUuid(),
      stepRunId: newUuid(), jobId: newUuid(), idempotencyKey: "k", payload: { event_kind: "document.approved", object_id: doc },
      deps: { comm: { provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" } },
      // the worker lost the lease (a newer generation reclaimed the job)
      assertLease: () => Promise.reject(new Error("stale fencing token")),
      checkpoint: async () => undefined,
    };
    const handler = getRuntimeActionHandler("communication.create_intent")!;
    await expect(handler(ctx)).rejects.toThrow(/stale/);
    expect(provider.sent.length).toBe(0); // the external email was NEVER sent
  });

  it("a held lease lets the external send proceed", async () => {
    const doc = await seedRuntimeDocument(h, owner);
    const provider = new FakeEmailProvider();
    const ctx: RuntimeActionContext = {
      appDb: h.db, tenant: owner, companyId: h.companyA, missionId: newUuid(), missionRunId: newUuid(),
      stepRunId: newUuid(), jobId: newUuid(), idempotencyKey: "k", payload: { event_kind: "document.approved", object_id: doc },
      deps: { comm: { provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" } },
      assertLease: async () => undefined, // lease held
      checkpoint: async () => undefined,
    };
    const res = await getRuntimeActionHandler("communication.create_intent")!(ctx);
    expect(res.status).toBe("succeeded");
    expect(provider.sent.length).toBe(1);
  });
});
