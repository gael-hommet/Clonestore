// src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts
//
// P0 GOVERNANCE CLOSURE — tests d'intégration de la route legacy /api/pierre/execute.
// Prouve que : (1) chaque action reconnue passe par CloneGuard/gouvernance canonique avant
// toute exécution, (2) aucun appel externe (Make.com, provider) n'est jamais déclenché,
// (3) l'auth HMAC / tenant / entitlement restent inchangés, (4) l'idempotence tient.
//
// Fake Supabase client — même pattern que
// src/app/api/pierre/email/__tests__/p16d-email-send-truthful.test.ts.
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import crypto from "crypto";

const CLIENT_ID = "clonestore";
const SECRET = "test-router-hmac-secret";

// ── État en mémoire par table ────────────────────────────────────────────────
let agentConfigsRows: Array<Record<string, unknown>> = [];
let auditLogRows: Array<Record<string, unknown>> = [];
let documentsRows: Array<Record<string, unknown>> = [];

function makeFakeClient() {
  return {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let orderDesc = false;
      let limitN: number | null = null;

      const api: any = {
        select: () => api,
        eq(col: string, val: unknown) {
          filters.push((row) => row[col] === val);
          return api;
        },
        contains(col: string, val: Record<string, unknown>) {
          filters.push((row) => {
            const target = row[col];
            if (!target || typeof target !== "object") return false;
            return Object.entries(val).every(([k, v]) => (target as Record<string, unknown>)[k] === v);
          });
          return api;
        },
        order(_col: string, opts?: { ascending?: boolean }) {
          orderDesc = opts?.ascending === false;
          return api;
        },
        limit(n: number) {
          limitN = n;
          return api;
        },
        async maybeSingle() {
          const store = tableStore(table);
          const found = store.filter((row) => filters.every((f) => f(row)));
          return { data: found[0] ?? null, error: null };
        },
        // Used by the idempotency SELECT chain (no maybeSingle/single there).
        then(resolve: (v: { data: unknown; error: null }) => void) {
          const store = tableStore(table);
          let found = store.filter((row) => filters.every((f) => f(row)));
          if (orderDesc) found = [...found].reverse();
          if (limitN != null) found = found.slice(0, limitN);
          resolve({ data: found, error: null });
        },
        insert(payload: Record<string, unknown>) {
          const store = tableStore(table);
          const row = { id: `${table}-${store.length + 1}`, ...payload };
          store.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
      return api;
    },
  };
}

function tableStore(table: string): Array<Record<string, unknown>> {
  if (table === "agent_configs") return agentConfigsRows;
  if (table === "audit_log") return auditLogRows;
  if (table === "documents") return documentsRows;
  throw new Error(`Unexpected table in test: ${table}`);
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeFakeClient(),
}));

// P0.1 RE-CLOSURE (2026-07-24) — route.ts lit désormais les variables d'env de façon
// PARESSEUSE (getRuntime(), jamais au chargement du module — pattern introduit par les
// commits externes "fix(build): defer/isolate lazy API runtime initialization" et
// délibérément conservé ici, voir P0_1_GIT_FORENSIC_TIMELINE.md). Seules 3 variables
// sont désormais nécessaires (Supabase + HMAC) : les 3 MAKE_*_WEBHOOK_URL ont disparu
// avec le connecteur Make direct, retiré du fichier (Phase 6 de la re-clôture) puisque
// plus aucune action ne peut aujourd'hui atteindre ALLOW sur cette route. L'import
// dynamique en beforeAll est conservé (positionne les env vars avant le premier appel à
// getRuntime(), qui les met en cache pour la durée du process de test).
let POST: typeof import("@/app/api/pierre/execute/route").POST;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  process.env.ROUTER_HMAC_SECRET = SECRET;
  ({ POST } = await import("@/app/api/pierre/execute/route"));
});

function signedRequest(body: Record<string, unknown>, opts?: { badSignature?: boolean; clientIdHeader?: string }) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const clientIdHeader = opts?.clientIdHeader ?? CLIENT_ID;
  const signature = opts?.badSignature
    ? "0".repeat(64)
    : crypto.createHmac("sha256", SECRET).update(`${clientIdHeader}.${timestamp}.${rawBody}`).digest("hex");

  return new Request("http://localhost/api/pierre/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": clientIdHeader,
      "x-timestamp": timestamp,
      "x-signature": signature,
    },
    body: rawBody,
  });
}

beforeEach(() => {
  agentConfigsRows = [{ client_id: CLIENT_ID, agent_key: "pierre" }];
  auditLogRows = [];
  documentsRows = [];
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("fetch() must never be called by /api/pierre/execute after the P0 governance closure");
  }));
});

describe("P0 governance closure — /api/pierre/execute", () => {
  it("requête sans signature HMAC -> 401, aucun effet", async () => {
    const req = new Request("http://localhost/api/pierre/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, action: "email.send", payload: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signature HMAC invalide -> 401, aucun effet", async () => {
    const req = signedRequest(
      { client_id: CLIENT_ID, action: "email.send", payload: {} },
      { badSignature: true },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("client_id du corps ne correspond pas au header signé -> 403 CLIENT_ID_MISMATCH", async () => {
    const req = signedRequest(
      { client_id: "autre_client", action: "email.send", payload: {} },
      { clientIdHeader: CLIENT_ID },
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("CLIENT_ID_MISMATCH");
  });

  it("client_id sans accès Pierre configuré (agent_configs vide) -> 403 FORBIDDEN", async () => {
    agentConfigsRows = [];
    const req = signedRequest({ client_id: CLIENT_ID, action: "email.send", payload: {} });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("email.send est bloqué par la gouvernance canonique -> jamais envoyé, aucun appel réseau", async () => {
    const req = signedRequest({
      client_id: CLIENT_ID,
      action: "email.send",
      payload: { to: ["salarie@example.com"], subject: "Fin de période d'essai", body_html: "<p>Bonjour</p>" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("GOVERNANCE_BLOCKED");
    expect(fetch).not.toHaveBeenCalled();

    const logged = auditLogRows.find((r) => r.action === "email.send");
    expect(logged?.ok).toBe(false);
  });

  it("doc.generate benin -> REQUIRE_APPROVAL (202), aucun document externe publié, aucun appel réseau", async () => {
    const req = signedRequest({
      client_id: CLIENT_ID,
      action: "doc.generate",
      payload: { title: "Note de bienvenue", html: "<p>Bienvenue dans l'équipe.</p>" },
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.decision).toBe("REQUIRE_APPROVAL");
    expect(fetch).not.toHaveBeenCalled();
    expect(documentsRows.length).toBe(0); // rien n'est écrit tant que ce n'est pas approuvé
  });

  it("hris.sync -> jamais exécuté directement, aucun appel réseau vers un provider externe", async () => {
    const req = signedRequest({
      client_id: CLIENT_ID,
      action: "hris.sync",
      payload: { vendor: "sap", mode: "import", payload: { note: "test" } },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(["GOVERNANCE_BLOCKED", "HUMAN_APPROVAL_REQUIRED"]).toContain(body.error.code);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("action inconnue -> 400 UNKNOWN_ACTION (fail-closed, inchangé)", async () => {
    const req = signedRequest({ client_id: CLIENT_ID, action: "employee.create", payload: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("UNKNOWN_ACTION");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("idempotence : un request_id déjà enregistré avec ok=true renvoie le résultat précédent sans ré-exécuter", async () => {
    auditLogRows.push({
      client_id: CLIENT_ID,
      action: "doc.generate",
      payload: { request_id: "replay-001", title: "X" },
      ok: true,
      result: { generated: true, document_id: "doc-cached-1" },
      created_at: new Date().toISOString(),
    });

    const req = signedRequest({
      client_id: CLIENT_ID,
      action: "doc.generate",
      payload: { request_id: "replay-001", title: "X", html: "<p>x</p>" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.idempotent).toBe(true);
    expect(body.result.document_id).toBe("doc-cached-1");
    expect(fetch).not.toHaveBeenCalled();
    expect(documentsRows.length).toBe(0); // aucune nouvelle insertion — résultat rejoué, pas ré-exécuté
  });

  it("double requête simultanée (même request_id, pas encore de résultat en cache) : la gouvernance est évaluée pour chacune, jamais d'exécution externe dans les deux cas", async () => {
    const body = {
      client_id: CLIENT_ID,
      action: "hris.sync",
      payload: { request_id: "concurrent-001", vendor: "sap", mode: "import", payload: {} },
    };
    const [res1, res2] = await Promise.all([
      POST(signedRequest(body)),
      POST(signedRequest(body)),
    ]);
    expect(res1.status).not.toBe(200);
    expect(res2.status).not.toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });
});
