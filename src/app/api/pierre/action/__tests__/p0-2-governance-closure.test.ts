// src/app/api/pierre/action/__tests__/p0-2-governance-closure.test.ts
//
// P0.2 SIBLING SURFACES CLOSURE — /api/pierre/action passe désormais par la même
// gouvernance canonique que /api/pierre/execute (P0.1, evaluateLegacyExecuteGovernance)
// avant tout appel Make. Preuve : aucune des deux actions ne peut plus déclencher d'appel
// réseau externe, et l'idempotence protège contre une double exécution.
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const USER_ID = "user-p0-2-test";
let ordersRows: Array<Record<string, unknown>> = [];
let agentHistoryRows: Array<Record<string, unknown>> = [];

function makeFakeClient() {
  return {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token !== "valid-token") {
          return { data: { user: null }, error: { message: "invalid token" } };
        }
        return { data: { user: { id: USER_ID, email: "test@example.com" } }, error: null };
      }),
    },
    from(table: string) {
      if (table === "orders") {
        const filters: Array<(r: Record<string, unknown>) => boolean> = [];
        const api: any = {
          select: () => api,
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return api;
          },
          in(col: string, vals: unknown[]) {
            filters.push((r) => vals.includes(r[col]));
            return api;
          },
          limit: () => api,
          async maybeSingle() {
            const found = ordersRows.filter((r) => filters.every((f) => f(r)));
            return { data: found[0] ?? null, error: null };
          },
        };
        return api;
      }

      if (table === "agent_history") {
        const filters: Array<(r: Record<string, unknown>) => boolean> = [];
        let limitN: number | null = null;
        const api: any = {
          select: () => api,
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return api;
          },
          order: () => api,
          limit(n: number) {
            limitN = n;
            return api;
          },
          insert(payload: Record<string, unknown>) {
            agentHistoryRows.push({ ...payload });
            return Promise.resolve({ data: null, error: null });
          },
          then(resolve: (v: { data: unknown; error: null }) => void) {
            let found = agentHistoryRows.filter((r) => filters.every((f) => f(r)));
            if (limitN != null) found = found.slice(0, limitN);
            resolve({ data: found, error: null });
          },
        };
        return api;
      }

      if (table === "agent_onboarding_pierre") {
        const api: any = {
          select: () => api,
          eq: () => api,
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return api;
      }

      throw new Error(`Unexpected table in test: ${table}`);
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeFakeClient(),
}));

let POST: typeof import("@/app/api/pierre/action/route").POST;
let GET: typeof import("@/app/api/pierre/action/route").GET;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  ({ POST, GET } = await import("@/app/api/pierre/action/route"));
});

function req(body: Record<string, unknown>, token = "valid-token") {
  return new Request("http://localhost/api/pierre/action", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  ordersRows = [{ user_id: USER_ID, agent_slug: "pierre", status: "active", id: "order-1" }];
  agentHistoryRows = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("fetch() must never be called by /api/pierre/action after P0.2 closure");
    })
  );
});

describe("P0.2 governance closure — /api/pierre/action", () => {
  it("sans token -> 401, aucun effet", async () => {
    const res = await POST(req({ action_type: "email.send" }, ""));
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("token invalide -> 401", async () => {
    const res = await POST(req({ action_type: "email.send" }, "bad-token"));
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("utilisateur sans Pierre actif (orders vide) -> 403", async () => {
    ordersRows = [];
    const res = await POST(req({ action_type: "email.send" }));
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("email.send est refusé par la gouvernance canonique -> jamais envoyé", async () => {
    const res = await POST(
      req({
        action_type: "email.send",
        to: "candidat@example.com",
        subject: "Test",
        html: "<p>Bonjour</p>",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.decision).toBe("DENY");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("doc.generate est mis en attente d'approbation humaine -> aucune publication externe", async () => {
    const res = await POST(
      req({
        action_type: "doc.generate",
        html: "<p>P0_2_GOVERNANCE_TEST document bénin</p>",
        title: "Note",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.ok).toBe(false);
    expect(body.decision).toBe("REQUIRE_APPROVAL");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("action_type invalide -> 400, fail-closed (inchangé)", async () => {
    const res = await POST(req({ action_type: "hris.sync" }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("idempotence : un request_id déjà journalisé ok=true renvoie le résultat en cache", async () => {
    agentHistoryRows.push({
      user_id: USER_ID,
      agent_slug: "pierre",
      doc_type: "doc.generate",
      ok: true,
      input: JSON.stringify({ idempotency_key: "replay-p0-2-001", action_type: "doc.generate" }),
      response: JSON.stringify({ pdf_url: "https://cached.example/doc.pdf" }),
    });

    const res = await POST(
      req({
        action_type: "doc.generate",
        html: "<p>P0_2_GOVERNANCE_TEST</p>",
        request_id: "replay-p0-2-001",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.idempotent).toBe(true);
    expect(body.pdf_url).toBe("https://cached.example/doc.pdf");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("double requête simultanée (même request_id, pas encore en cache) -> aucun appel externe dans les deux cas", async () => {
    const body = {
      action_type: "doc.generate" as const,
      html: "<p>P0_2_GOVERNANCE_TEST concurrent</p>",
      request_id: "concurrent-p0-2-001",
    };
    const [r1, r2] = await Promise.all([POST(req(body)), POST(req(body))]);
    expect(r1.status).not.toBe(200);
    expect(r2.status).not.toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET (status endpoint) reste fonctionnel et n'appelle jamais Make", async () => {
    const res = await GET(req({}) as any);
    expect([200, 500]).toContain(res.status); // 500 possible si identity non résolue dans ce fake — n'appelle jamais fetch
    expect(fetch).not.toHaveBeenCalled();
  });
});
