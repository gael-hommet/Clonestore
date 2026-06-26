// src/lib/pierre/cockpit/__tests__/cockpit-v1-only.test.ts
// PHASE 8.2-C — the ACTIVE cockpit mission/task/validation path is V1-only.
// (1) Static scan: the active hook + page + api-client never import/call a legacy
//     task function nor touch /api/pierre/use/{task,mission,continuity,submit}.
// (2) Behavioral: drive the api-client orchestration with a mocked fetch and assert
//     every mission/validation/worker call hits /api/pierre/v1/* and NEVER legacy.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf-8");

const HOOK = "src/app/agents/pierre/use/hooks/usePierreCockpit.ts";
const PAGE = "src/app/agents/pierre/employees/page.tsx";
const API = "src/lib/pierre/cockpit/api-client.ts";

const LEGACY_FUNCS = ["approvePierreTask", "cancelPierreTask", "runPierreTask", "reschedulePierreTask"];
const LEGACY_URLS = ["/api/pierre/use/task", "/api/pierre/use/mission", "/api/pierre/use/continuity", "/api/pierre/use/submit"];

describe("PHASE 8.2-C — cockpit V1-only (static)", () => {
  const hook = read(HOOK);
  const page = read(PAGE);
  const api = read(API);

  it("the active hook does NOT import or call any legacy task function", () => {
    for (const fn of LEGACY_FUNCS) {
      expect(hook.includes(fn), `hook must not reference ${fn}`).toBe(false);
    }
  });

  it("the active hook contains NO legacy /api/pierre/use/{task,mission,continuity,submit} URL", () => {
    for (const url of LEGACY_URLS) {
      expect(hook.includes(url), `hook must not contain ${url}`).toBe(false);
    }
  });

  it("the active hook imports the V1 mission/validation/worker functions", () => {
    for (const fn of ["fetchPierreMission", "fetchPierreMissionTasks", "fetchPierreMissionTimeline", "fetchPierreMissionValidations", "approvePierreValidation", "rejectPierreValidation", "requestPierreValidationChanges", "cancelPierreMission", "fetchPierreWorkerState"]) {
      expect(hook.includes(fn), `hook must import ${fn}`).toBe(true);
    }
  });

  it("the legacy task functions are DECOMMISSIONED from api-client.ts", () => {
    for (const fn of LEGACY_FUNCS) {
      expect(api.includes(`export async function ${fn}`), `${fn} must not be exported`).toBe(false);
    }
  });

  it("api-client mission reads route through the V1 callV1 seam", () => {
    const missionBody = api.split("export async function fetchPierreMission")[1]?.split("export ")[0] ?? "";
    expect(missionBody).toContain("callV1");
    expect(missionBody.includes("/api/pierre/use/mission") && !missionBody.includes("legacyEndpoint")).toBe(false);
  });

  it("the Employee 360 page calls only /api/pierre/v1 (no legacy use endpoints)", () => {
    expect(page.includes("/api/pierre/use/")).toBe(false);
    expect(page.includes("/api/pierre/v1")).toBe(true);
  });
});

// ── Behavioral: orchestration layer with a mocked fetch ───────────────────────
vi.mock("@/lib/auth/session-client", () => ({ getCurrentAccessToken: async () => "test-token" }));
import * as client from "@/lib/pierre/cockpit/api-client";

type MockRes = { ok: boolean; status: number; headers: { get: () => string | null }; text: () => Promise<string>; json: () => Promise<unknown> };
function res(body: unknown, ok = true, status = 200): MockRes {
  return { ok, status, headers: { get: () => "req-1" }, text: async () => JSON.stringify(body), json: async () => body };
}
const MISSION_VIEW = { mission_id: "m1", status: "in_progress", summary: "S", risk: "low", tasks: [], approvals: [], queued_actions: 0, next_action: null, trace_reference: "t", idempotent_replay: false };
const DECIDE = { validation_id: "v1", status: "approved", unlocked_task: null };

function routeBody(url: string): unknown {
  if (url.includes("/missions/m1/tasks")) return [];
  if (url.includes("/missions/m1/timeline")) return [];
  if (url.includes("/missions/m1/validations")) return [];
  if (url.includes("/missions/m1/cancel")) return { mission_id: "m1", status: "cancelled" };
  if (/\/missions\/m1(\?|$)/.test(url)) return MISSION_VIEW;
  if (url.includes("/missions?")) return { items: [], next_cursor: null };
  if (url.includes("/validations/")) return DECIDE;
  if (url.includes("/worker/tick")) return { ok: true, processed: 0 };
  if (url.includes("/health")) return { status: "ok" };
  return {};
}

describe("PHASE 8.2-C — cockpit V1-only (behavioral fetch mock)", () => {
  let urls: string[];
  beforeEach(() => {
    urls = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return res(routeBody(url)) as unknown as Response;
    }) as unknown as typeof fetch;
  });

  it("open mission → tasks → timeline → validations → approve → cancel → worker → history all hit V1 only", async () => {
    await client.fetchPierreMission("m1");
    await client.fetchPierreMissionTasks("m1");
    await client.fetchPierreMissionTimeline("m1");
    await client.fetchPierreMissionValidations("m1");
    await client.approvePierreValidation("v1", 1);
    await client.rejectPierreValidation("v1", 1);
    await client.requestPierreValidationChanges("v1", 1);
    await client.cancelPierreMission("m1");
    await client.fetchPierreWorkerState();
    await client.tickPierreWorker({ batch: 5 });
    await client.fetchPierreHistory({ limit: 5 });

    expect(urls.length).toBeGreaterThan(0);
    // NO legacy URL anywhere in the active orchestration.
    for (const u of urls) {
      for (const legacy of LEGACY_URLS) expect(u.includes(legacy), `legacy URL hit: ${u}`).toBe(false);
      expect(u.includes("/api/pierre/v1/"), `non-v1 URL: ${u}`).toBe(true);
    }
    // The decisions actually targeted the V1 validation + worker routes.
    expect(urls.some((u) => /\/api\/pierre\/v1\/validations\/v1\/approve/.test(u))).toBe(true);
    expect(urls.some((u) => /\/api\/pierre\/v1\/missions\/m1\/cancel/.test(u))).toBe(true);
    expect(urls.some((u) => /\/api\/pierre\/v1\/worker\/tick/.test(u))).toBe(true);
  });
});
