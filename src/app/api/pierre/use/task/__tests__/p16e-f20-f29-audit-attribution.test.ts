// src/app/api/pierre/use/task/__tests__/p16e-f20-f29-audit-attribution.test.ts
// P16E §3 (F20/F29) — les événements d'audit d'une action HUMAINE sont attribués à l'acteur.
//
// DÉFAUT CORRIGÉ — approve/cancel/reschedule écrivaient `pierre_task_logs` avec `payload: null`
// (aucune identité d'acteur) ; la génération de document écrivait `meta_json` sans user_id. Un
// événement « user » sans actor_id est inexploitable en investigation. Correctif : chaque audit
// d'action humaine porte { actor_type:"user", user_id } dans son payload. Aucune donnée sensible
// (pas de salaire, pas de corps de document, pas de secret) n'est ajoutée.

import { describe, it, expect, vi, beforeEach } from "vitest";

const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];

function makeFakeClient(taskStatus: string) {
  const api: Record<string, unknown> = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-42" } }, error: null })) },
    from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: { id: "task-1", status: taskStatus, mission_id: "m-1", pierre_missions: { id: "m-1", user_id: "user-42" } }, error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
        insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
      };
      return q;
    },
  };
  return api;
}

let currentStatus = "awaiting_approval";
vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeFakeClient(currentStatus) }));

function req(action: string, body: Record<string, unknown> = {}): import("next/server").NextRequest {
  const r = new Request(`http://localhost/api/pierre/use/task/task-1/${action}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
  (r as unknown as { cookies: unknown }).cookies = { get: () => undefined, getAll: () => [] };
  return r as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  inserts.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
});

function auditRow(): Record<string, unknown> | undefined {
  return inserts.find((i) => i.table === "pierre_task_logs")?.row;
}

describe("P16E §3 F20/F29 — attribution de l'acteur dans l'audit", () => {
  it("approve : l'audit porte actor_type='user' + user_id (jamais actor_id null)", async () => {
    currentStatus = "awaiting_approval";
    const { POST } = await import("@/app/api/pierre/use/task/[taskId]/approve/route");
    const res = await POST(req("approve"), { params: Promise.resolve({ taskId: "task-1" }) });
    expect(res.status).toBe(200);
    const payload = auditRow()?.payload as Record<string, unknown>;
    expect(payload).toBeTruthy();
    expect(payload.actor_type).toBe("user");
    expect(payload.user_id).toBe("user-42");
    expect(payload.action).toBe("approve");
    // aucune donnée sensible dans l'audit
    expect(JSON.stringify(payload)).not.toMatch(/salaire|salary|iban|secret|password/i);
  });

  it("cancel : l'audit attribue l'utilisateur", async () => {
    currentStatus = "queued";
    const { POST } = await import("@/app/api/pierre/use/task/[taskId]/cancel/route");
    await POST(req("cancel"), { params: Promise.resolve({ taskId: "task-1" }) });
    const payload = auditRow()?.payload as Record<string, unknown>;
    expect(payload?.actor_type).toBe("user");
    expect(payload?.user_id).toBe("user-42");
    expect(payload?.action).toBe("cancel");
  });

  it("reschedule : l'audit attribue l'utilisateur + conserve la date", async () => {
    currentStatus = "queued";
    const { POST } = await import("@/app/api/pierre/use/task/[taskId]/reschedule/route");
    await POST(req("reschedule", { scheduledFor: "2026-08-01T09:00:00.000Z" }), { params: Promise.resolve({ taskId: "task-1" }) });
    const payload = auditRow()?.payload as Record<string, unknown>;
    expect(payload?.actor_type).toBe("user");
    expect(payload?.user_id).toBe("user-42");
    expect(payload?.scheduled_for).toBeTruthy();
  });
});
