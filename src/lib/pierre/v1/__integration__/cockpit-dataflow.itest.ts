// src/lib/pierre/v1/__integration__/cockpit-dataflow.itest.ts
// PHASE 8.1 — Cockpit ↔ v1 end-to-end DATA-FLOW proof against real Postgres
// (PGlite). Drives the canonical typed client (`createPierreClient`) through an
// in-process router that mirrors the Next route layer exactly: it resolves the
// TenantContext from the active-company header via real membership (so cross-
// tenant is denied), dispatches to the v1 API handlers, and maps RuntimeErrors.
//
// This is the closest executable proof of the cockpit's real behavior without a
// headless browser (which the sandbox lacks). It exercises the E2E checklist:
// create, visible, tasks, timeline, validations, approve→status, double-click
// no-duplicate, cross-tenant denied, refresh preserves, worker continues.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext } from "../tenant-context";
import { toRuntimeError, errorBody } from "../errors";
import { drainQueue } from "../worker";
import {
  apiCreateMission, apiListMissions, apiGetMission, apiGetMissionTasks,
  apiGetMissionTimeline, apiListValidations, apiDecideValidation, apiCancelMission,
} from "../api";
import { createPierreClient, PierreClientError } from "../client";
import type { SqlExecutor } from "../sql";

/** In-process fetch that mirrors src/app/api/pierre/v1/_runtime.ts + routes. */
function makeRouterFetch(db: SqlExecutor, userId: string): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://t");
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const company = headers.get("x-pierre-company");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (data: unknown, status = 200, requestId = "req-test") =>
      new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "x-request-id": requestId } });
    try {
      // health needs no tenant
      if (url.pathname === "/api/pierre/v1/health") return json({ status: "ok", db: "reachable", queue: { ready: 0, leased: 0, dead: 0 } });
      const ctx = await resolveTenantContext(db, { user_id: userId, company_id: company });
      const p = url.pathname;
      const seg = p.split("/").filter(Boolean); // ['api','pierre','v1', ...]
      if (p === "/api/pierre/v1/missions" && method === "POST") return json(await apiCreateMission(db, ctx, { instruction: body.instruction, source: body.source, idempotency_key: body.idempotency_key, autonomy_mode: body.autonomy_mode }));
      if (p === "/api/pierre/v1/missions" && method === "GET") return json(await apiListMissions(db, ctx, { limit: Number(url.searchParams.get("limit") ?? 20), cursor: url.searchParams.get("cursor"), status: url.searchParams.get("status") }));
      if (seg[3] === "missions" && seg[4] && !seg[5] && method === "GET") return json(await apiGetMission(db, ctx, seg[4]));
      if (seg[3] === "missions" && seg[5] === "tasks") return json(await apiGetMissionTasks(db, ctx, seg[4]));
      if (seg[3] === "missions" && seg[5] === "timeline") return json(await apiGetMissionTimeline(db, ctx, seg[4]));
      if (seg[3] === "missions" && seg[5] === "validations") return json(await apiListValidations(db, ctx, seg[4]));
      if (seg[3] === "missions" && seg[5] === "cancel") return json(await apiCancelMission(db, ctx, seg[4]));
      if (seg[3] === "validations" && seg[5]) {
        const action = seg[5] === "request-changes" ? "request_changes" : seg[5];
        return json(await apiDecideValidation(db, ctx, seg[4], action as "approve" | "reject" | "request_changes", Number(body.version ?? 1)));
      }
      return json({ error: { code: "not_found", message: "no route" } }, 404);
    } catch (e) {
      const re = toRuntimeError(e);
      return json(errorBody(re), re.status);
    }
  }) as typeof fetch;
}

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

describe("Cockpit ↔ v1 data flow (real Postgres)", () => {
  it("create → visible → tasks → timeline (real v1 data)", async () => {
    const client = createPierreClient({ companyId: h.companyA, fetchImpl: makeRouterFetch(h.db, h.userA) });
    const m = await client.createMission({ instruction: "Relancer le manager pour le rapport mensuel" });
    expect(m.mission_id).toBeTruthy();
    const got = await client.getMission(m.mission_id);
    expect(got.mission_id).toBe(m.mission_id);
    const tasks = await client.getMissionTasks(m.mission_id);
    expect(tasks.length).toBeGreaterThan(0);
    const tl = await client.getMissionTimeline(m.mission_id);
    expect(tl.some((e) => e.type === "mission_received")).toBe(true);
  });

  it("double-click create → no duplicate (idempotency key)", async () => {
    const client = createPierreClient({ companyId: h.companyA, fetchImpl: makeRouterFetch(h.db, h.userA) });
    const input = { instruction: "Classer le dossier de l'équipe" };
    const [a, b] = await Promise.all([client.createMission(input), client.createMission(input)]);
    expect(a.mission_id).toBe(b.mission_id);
    const list = await client.listMissions({ limit: 50 });
    expect(list.items.filter((x) => x.id === a.mission_id).length).toBe(1);
  });

  it("validation approve via client updates status (real CloneTrace)", async () => {
    const client = createPierreClient({ companyId: h.companyA, fetchImpl: makeRouterFetch(h.db, h.userA) });
    const m = await client.createMission({ instruction: "Préparer un avenant au contrat de Mme Leroy" });
    const vals = await client.listMissionValidations(m.mission_id);
    expect(vals.length).toBeGreaterThan(0);
    const r = await client.approveValidation(vals[0].id, vals[0].version);
    expect(r.status).toBe("approved");
  });

  it("cross-tenant access is denied at the route layer (403)", async () => {
    // userA tries to act as company B → no membership → tenant_access_denied.
    const rogue = createPierreClient({ companyId: h.companyB, fetchImpl: makeRouterFetch(h.db, h.userA) });
    await expect(rogue.createMission({ instruction: "x" })).rejects.toBeInstanceOf(PierreClientError);
    await expect(rogue.createMission({ instruction: "x" })).rejects.toMatchObject({ status: 403, code: "tenant_access_denied" });
  });

  it("refresh preserves mission; worker continues then cockpit reflects result", async () => {
    const client = createPierreClient({ companyId: h.companyA, fetchImpl: makeRouterFetch(h.db, h.userA) });
    const m = await client.createMission({ instruction: "Faire une synthèse opérationnelle de l'équipe" });
    // "browser closed": worker runs server-side (no client involved)
    await drainQueue(h.db, { worker_id: "srv", batch: 10, lease_ms: 60000 });
    // "refresh": a brand-new client re-fetches and sees the persisted, progressed mission
    const fresh = createPierreClient({ companyId: h.companyA, fetchImpl: makeRouterFetch(h.db, h.userA) });
    const after = await fresh.getMission(m.mission_id);
    expect(after.mission_id).toBe(m.mission_id);
    expect(["done", "in_progress", "partially_completed"]).toContain(after.status);
    const tasks = await fresh.getMissionTasks(m.mission_id);
    expect(tasks.some((t) => t.status === "succeeded")).toBe(true);
  });

  it("health endpoint needs no tenant", async () => {
    const client = createPierreClient({ companyId: "ignored", fetchImpl: makeRouterFetch(h.db, h.userA) });
    const hh = await client.getRuntimeHealth();
    expect(hh.status).toBe("ok");
  });
});
