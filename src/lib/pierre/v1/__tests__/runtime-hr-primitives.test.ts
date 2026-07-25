import { describe, it, expect } from "vitest";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { getRuntimeActionDefinition } from "../runtime-action-registry";

// P22 reprise — the two generic reusable HR primitives that replaced the bulk of mission.noop:
//   hr.record.append (persists a canonical event) and hr.data.collect (NEEDS_INFORMATION on missing).
// Faithful in-memory SqlExecutor captures pierre_rt_events inserts — SUCCESS ⇒ a real row exists.

function makeDb() {
  const events: Record<string, unknown>[] = [];
  const run = async (text: string, params: readonly unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> => {
    if (text.trim().startsWith("insert into pierre_rt_events")) {
      events.push({ id: params[0], company_id: params[1], mission_id: params[2], type: params[3] });
    }
    return { rows: [] };
  };
  const db: SqlExecutor = {
    query: async <T = Record<string, unknown>>(text: string, params?: readonly unknown[]) => (await run(text, params ?? [])) as { rows: T[] },
    transaction: async <T>(fn: (tx: SqlExecutor) => Promise<T>) => fn(db),
  };
  return { db, events };
}

function ctxFor(db: SqlExecutor, payload: Record<string, unknown>): RuntimeActionContext {
  const tenant = {
    company_id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    role_keys: ["OWNER"],
    permissions: ["document.read", "audit.read"],
  } as unknown as TenantContext;
  return {
    appDb: db, tenant, companyId: tenant.company_id,
    missionId: "33333333-3333-3333-3333-333333333333", missionRunId: "44444444-4444-4444-4444-444444444444",
    stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666",
    idempotencyKey: "idem", payload, deps: {}, assertLease: async () => {}, checkpoint: async () => {},
  };
}

describe("hr.record.append (P22 reprise)", () => {
  it("is registered and requires a record_type", () => {
    expect(getRuntimeActionDefinition("hr.record.append")).not.toBeNull();
    expect(getRuntimeActionDefinition("hr.record.append")!.validateInput({})).not.toHaveLength(0);
  });

  it("persists exactly one canonical event linked to the mission", async () => {
    const { db, events } = makeDb();
    const res = await RUNTIME_ACTION_HANDLERS["hr.record.append"](ctxFor(db, { record_type: "intake.classified", data: { domain: "absence" } }));
    expect(res.status).toBe("succeeded");
    expect(res.output?.kind).toBe("record");
    expect(events).toHaveLength(1);
    expect(events[0].mission_id).toBe("33333333-3333-3333-3333-333333333333");
    expect(String(events[0].type)).toContain("intake.classified");
  });
});

describe("hr.data.collect (P22 reprise)", () => {
  it("returns NEEDS_INFORMATION (governed blocker) when a required field is missing — no fake success", async () => {
    const { db, events } = makeDb();
    const res = await RUNTIME_ACTION_HANDLERS["hr.data.collect"](ctxFor(db, {
      required_fields: ["employee_id", "start_date"],
      provided: { employee_id: "e1" },
    }));
    expect(res.status).toBe("blocked");
    expect(res.blockerCode).toBe("needs_information");
    expect(res.output?.missing_fields).toEqual(["start_date"]);
    expect(events).toHaveLength(0); // nothing persisted while blocked
  });

  it("persists a collection record when all required fields are present", async () => {
    const { db, events } = makeDb();
    const res = await RUNTIME_ACTION_HANDLERS["hr.data.collect"](ctxFor(db, {
      required_fields: ["employee_id"],
      provided: { employee_id: "e1", note: "x" },
    }));
    expect(res.status).toBe("succeeded");
    expect(res.output?.kind).toBe("collection");
    expect(events).toHaveLength(1);
  });

  it("succeeds with no declared required fields (skeleton case)", async () => {
    const { db, events } = makeDb();
    const res = await RUNTIME_ACTION_HANDLERS["hr.data.collect"](ctxFor(db, {}));
    expect(res.status).toBe("succeeded");
    expect(events).toHaveLength(1);
  });
});
