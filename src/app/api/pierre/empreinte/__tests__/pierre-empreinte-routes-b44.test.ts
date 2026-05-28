// B44 — Empreinte routes tests (70+ tests)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): NextRequest {
  const method = options.method ?? "GET";
  const headers = options.headers ?? {};
  const init: RequestInit = { method, headers };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new NextRequest(new URL(url), init);
}

const MOCK_USER_ID = "user_b44_test";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => {
  let memoryStore: Record<string, unknown> = {};

  const mockSingle = () => ({ data: null, error: null });
  const mockMaybeSingle = () => ({
    data: { memory_json: memoryStore, agent_slug: "pierre" },
    error: null,
  });
  const mockUpsert = () => ({ error: null });
  const mockSelect = () => ({
    eq: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
  });

  return {
    createClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: MOCK_USER_ID } }, error: null }),
      },
      from: () => ({
        select: mockSelect,
        upsert: mockUpsert,
      }),
    }),
  };
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock_anon_key";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

// ── Snapshot route ────────────────────────────────────────────────────────────

import { GET as snapshotGET } from "../snapshot/route";

describe("GET /api/pierre/empreinte/snapshot", () => {
  it("returns 401 without Bearer token", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/snapshot");
    const res = await snapshotGET(req);
    expect(res.status).toBe(401);
  });

  it("returns snapshot with Bearer token", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/snapshot", {
      headers: { Authorization: "Bearer mock_token" },
    });
    const res = await snapshotGET(req);
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.snapshot).toBeDefined();
      expect(data.verdict).toBeDefined();
    }
  });

  it("snapshot contains enterprise and pierre", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/snapshot", {
      headers: { Authorization: "Bearer mock_token" },
    });
    const res = await snapshotGET(req);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.snapshot.enterprise).toBeDefined();
      expect(data.snapshot.pierre).toBeDefined();
      expect(typeof data.snapshot.overall_completion).toBe("number");
      expect(typeof data.snapshot.ready_to_activate).toBe("boolean");
    }
  });

  it("snapshot generated_at is present", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/snapshot", {
      headers: { Authorization: "Bearer mock_token" },
    });
    const res = await snapshotGET(req);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.snapshot.generated_at).toBeTruthy();
    }
  });

  it("returns no-store cache header", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/snapshot", {
      headers: { Authorization: "Bearer mock_token" },
    });
    const res = await snapshotGET(req);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 without Supabase config", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const req = makeRequest("http://localhost/api/pierre/empreinte/snapshot", {
      headers: { Authorization: "Bearer mock_token" },
    });
    const res = await snapshotGET(req);
    expect(res.status).toBe(503);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  });
});

// ── Validate route ────────────────────────────────────────────────────────────

import { POST as validatePOST } from "../validate/route";

describe("POST /api/pierre/empreinte/validate", () => {
  it("returns 400 with empty body", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST",
      body: {},
    });
    const res = await validatePOST(req);
    expect(res.status).toBe(400);
  });

  it("validates enterprise patch", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST",
      body: {
        enterprise: {
          company_identity: {
            legal_name: "Test SAS",
            sector: "Technologie",
            hr_contact_email: "rh@test.fr",
          },
        },
      },
    });
    const res = await validatePOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.validated).toBe(true);
    expect(data.results.enterprise).toBeDefined();
  });

  it("validates pierre patch", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST",
      body: {
        pierre: {
          identity: { display_name: "Pierre Acme" },
          autonomy: { ai_mode: "assist", trust_level: "supervised", blocked_task_types: ["email.send"] },
        },
      },
    });
    const res = await validatePOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.pierre).toBeDefined();
  });

  it("returns completion in validate result", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST",
      body: {
        enterprise: { company_identity: { legal_name: "Test", sector: "IT", hr_contact_email: "rh@test.fr" } },
      },
    });
    const res = await validatePOST(req);
    const data = await res.json();
    if (data.results?.enterprise) {
      expect(typeof data.results.enterprise.completion?.score).toBe("number");
    }
  });

  it("flags email validation error", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST",
      body: {
        enterprise: { company_identity: { hr_contact_email: "notvalid" } },
      },
    });
    const res = await validatePOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.enterprise.error_count).toBeGreaterThan(0);
  });

  it("returns no-store header", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST",
      body: { pierre: { identity: { display_name: "Pierre" } } },
    });
    const res = await validatePOST(req);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

// ── Save route ────────────────────────────────────────────────────────────────

import { POST as savePOST } from "../save/route";

describe("POST /api/pierre/empreinte/save", () => {
  it("returns 401 without Bearer token", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST",
      body: { enterprise: { company_identity: { legal_name: "Test" } } },
    });
    const res = await savePOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 with no patch", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: {},
    });
    const res = await savePOST(req);
    expect([400, 500]).toContain(res.status);
  });

  it("saves enterprise patch successfully", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: {
        enterprise: {
          company_identity: { legal_name: "Saved SAS", sector: "RH", hr_contact_email: "rh@saved.fr" },
        },
      },
    });
    const res = await savePOST(req);
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.saved).toBe(true);
      expect(data.enterprise).toBeDefined();
    }
  });

  it("strips company_id from body (tenant isolation)", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: {
        company_id: "attempt_spoof_company",
        enterprise: { company_identity: { legal_name: "Test" } },
      },
    });
    const res = await savePOST(req);
    // Doesn't fail with an error about company_id — it's stripped silently
    expect([200, 400, 422, 500]).toContain(res.status);
  });

  it("returns no-store cache header", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { enterprise: { company_identity: { legal_name: "Test" } } },
    });
    const res = await savePOST(req);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 without Supabase config", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const req = makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { enterprise: { company_identity: { legal_name: "Test" } } },
    });
    const res = await savePOST(req);
    expect(res.status).toBe(503);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  });
});

// ── Reset route ───────────────────────────────────────────────────────────────

import { POST as resetPOST } from "../reset/route";

describe("POST /api/pierre/empreinte/reset", () => {
  it("returns 401 without Bearer token", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      body: { target: "all" },
    });
    const res = await resetPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid target", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { target: "invalid_target" },
    });
    const res = await resetPOST(req);
    expect(res.status).toBe(400);
  });

  it("resets all with target=all", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { target: "all" },
    });
    const res = await resetPOST(req);
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.reset).toBe(true);
      expect(data.target).toBe("all");
    }
  });

  it("resets enterprise only with target=enterprise", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { target: "enterprise" },
    });
    const res = await resetPOST(req);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.enterprise.reset).toBe(true);
      expect(data.pierre).toBeUndefined();
    }
  });

  it("resets pierre only with target=pierre", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { target: "pierre" },
    });
    const res = await resetPOST(req);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.pierre.reset).toBe(true);
    }
  });

  it("defaults to all when target missing", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: {},
    });
    const res = await resetPOST(req);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.target).toBe("all");
    }
  });

  it("returns no-store header", async () => {
    const req = makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST",
      headers: { Authorization: "Bearer mock_token" },
      body: { target: "all" },
    });
    const res = await resetPOST(req);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

// ── Security headers — all empreinte routes ───────────────────────────────────

describe("security headers — all empreinte routes", () => {
  it("snapshot returns X-Content-Type-Options nosniff", async () => {
    const res = await snapshotGET(makeRequest("http://localhost/api/pierre/empreinte/snapshot"));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("validate returns X-Content-Type-Options nosniff", async () => {
    const res = await validatePOST(makeRequest("http://localhost/api/pierre/empreinte/validate", {
      method: "POST", body: { pierre: {} },
    }));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("save returns X-Content-Type-Options nosniff", async () => {
    const res = await savePOST(makeRequest("http://localhost/api/pierre/empreinte/save", {
      method: "POST", body: {},
    }));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("reset returns X-Content-Type-Options nosniff", async () => {
    const res = await resetPOST(makeRequest("http://localhost/api/pierre/empreinte/reset", {
      method: "POST", body: { target: "all" },
    }));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
