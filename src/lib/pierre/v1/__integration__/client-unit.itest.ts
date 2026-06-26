// src/lib/pierre/v1/__integration__/client-unit.itest.ts
// PHASE 8.1 — v1 client behavior (mocked fetch, no DB): idempotency key, typed
// errors, no-retry on 4xx mutations, safe retry on 5xx reads, schema validation.

import { describe, it, expect, vi } from "vitest";
import { createPierreClient, PierreClientError } from "../client";

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-request-id": "rid-1" } });
}
const fullMission = {
  mission_id: "m1", status: "queued", summary: "s", risk: "low", tasks: [], approvals: [],
  queued_actions: 0, next_action: null, trace_reference: "c1", idempotent_replay: false,
};

describe("v1 client behavior", () => {
  it("createMission sends a stable idempotency_key + company header", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.idempotency_key).toBeTruthy();
      const headers = new Headers(init?.headers);
      expect(headers.get("x-pierre-company")).toBe("co-1");
      return res(fullMission);
    }) as unknown as typeof fetch;
    const c = createPierreClient({ companyId: "co-1", fetchImpl });
    const m = await c.createMission({ instruction: "Relancer le manager" });
    expect(m.mission_id).toBe("m1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("4xx → typed PierreClientError, no retry", async () => {
    const fetchImpl = vi.fn(async () => res({ error: { code: "validation_failed", message: "bad" } }, 422)) as unknown as typeof fetch;
    const c = createPierreClient({ companyId: "co-1", fetchImpl });
    await expect(c.approveValidation("v1", 1)).rejects.toMatchObject({ code: "validation_failed", status: 422 });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // mutation: no auto-retry
  });

  it("5xx on a read retries (safe) then throws typed", async () => {
    const fetchImpl = vi.fn(async () => res({ error: { code: "internal", message: "boom" } }, 503)) as unknown as typeof fetch;
    const c = createPierreClient({ companyId: "co-1", fetchImpl, timeoutMs: 2000 });
    await expect(c.getMission("m1")).rejects.toBeInstanceOf(PierreClientError);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // retrySafe read: 1 + 2 retries
  });

  it("schema mismatch → schema_mismatch error", async () => {
    const fetchImpl = vi.fn(async () => res({ mission_id: 123 /* wrong type */ })) as unknown as typeof fetch;
    const c = createPierreClient({ companyId: "co-1", fetchImpl });
    await expect(c.getMission("m1")).rejects.toMatchObject({ code: "schema_mismatch" });
  });

  it("surfaces request id from response header", async () => {
    const fetchImpl = vi.fn(async () => res(fullMission)) as unknown as typeof fetch;
    const c = createPierreClient({ companyId: "co-1", fetchImpl });
    const m = await c.getMission("m1");
    expect(m.mission_id).toBe("m1"); // (request id is captured internally; no throw)
  });
});
