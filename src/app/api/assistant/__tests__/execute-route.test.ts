// src/app/api/assistant/__tests__/execute-route.test.ts
// P9.4.2 r2 (§3/§7) — Preuve NIVEAU ROUTE du flux d'exécution AUTHORITATIVE côté serveur :
// CONFIRM (proposalId) → charge la proposition persistée → identité SHA-256 → CLAIM atomique
// → effet gouverné (V1 loopback stubé / support durable) → RE-READ → COMMIT. Prouve les 4
// actions (mission/annulation/validation/support), l'exécution UNIQUE sous confirmation
// concurrente, le DOUBLON qui renvoie le résultat existant, la référence ÉTRANGÈRE qui ne
// révèle rien, l'échec TERMINAL, et que l'idempotency_key transmis à V1 = fingerprint SHA-256.
// La lane P8 n'est jamais touchée : l'API V1 est STUBÉE au niveau fetch (consommation simulée).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { commandFingerprint } from "@/lib/clonechat/durable/command-ledger";
import { POST } from "@/app/api/assistant/execute/route";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const USER = "aaaaaaaa-1111-4111-8111-111111111111";
const OTHER_USER = "bbbbbbbb-2222-4222-8222-222222222222";

// Auth + tenant résolus : identité fixe (la résolution fail-closed est prouvée ailleurs).
vi.mock("@/lib/clonechat/server/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/server/auth")>();
  return { ...real, requireCloneChatUser: vi.fn(async () => ({ identity: { userId: USER, companyId: COMPANY, role: "owner", siteIds: [] as string[], realCompany: true } })) };
});

type Call = { url: string; method: string; body: Record<string, unknown> | undefined };
const calls: Call[] = [];
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }); }

function installFetch(opts?: { createStatus?: number }) {
  calls.length = 0;
  global.fetch = vi.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
    const u = String(url); const method = init?.method ?? "GET"; const body = init?.body ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ url: u, method, body });
    if (u.endsWith("/api/pierre/v1/missions") && method === "POST") {
      if (opts?.createStatus && opts.createStatus >= 400) return json({ error: "denied" }, opts.createStatus);
      return json({ mission_id: "m-real-1", status: "queued" });
    }
    if (/\/api\/pierre\/v1\/missions\/[^/]+$/.test(u) && method === "GET") return json({ mission_id: "m-real-1", status: "queued" });
    if (u.includes("/cancel") && method === "POST") return json({ ok: true, status: "cancelled" });
    if (/\/validations\/[^/]+\/(approve|reject|request-changes)$/.test(u) && method === "POST") return json({ ok: true });
    if (/\/missions\/[^/]+\/validations$/.test(u) && method === "GET") return json([{ id: "val-1", status: "approved", version: 2 }]);
    return json({}, 404);
  }) as unknown as typeof fetch;
}

const ctx = { companyId: COMPANY, userId: USER };
async function seed(actionKind: string, payload: Record<string, unknown>): Promise<string> {
  const stores = await getCloneChatStores();
  const p = await stores.proposals.create(ctx, { conversationId: null, actionKind, payload, at: new Date().toISOString() });
  return p.id;
}
function req(proposalId: string): Request {
  return new Request("http://localhost:3000/api/assistant/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalId }) });
}

beforeEach(() => installFetch());

describe("P9.4.2 §3 execute route — server-authoritative command execution", () => {
  it("create_mission : CONFIRM → claim → V1 create (idempotency_key = SHA-256) → re-read → commit", async () => {
    const instruction = "Préparer un CDI pour Marie";
    const proposalId = await seed("create_mission", { instruction });
    const res = await POST(req(proposalId));
    const d = await res.json() as Record<string, unknown>;
    expect(d.status).toBe("executed");
    expect(d.targetRef).toBe("m-real-1");
    expect(d.href).toContain("mission=m-real-1");
    // L'idempotency_key transmis à V1 == fingerprint canonique (identité serveur, pas client).
    const fp = commandFingerprint({ companyId: COMPANY, actorId: USER, conversationId: null, proposalId, actionKind: "create_mission", payload: { instruction } });
    const createCall = calls.find((c) => c.url.endsWith("/api/pierre/v1/missions") && c.method === "POST");
    expect(createCall?.body?.idempotency_key).toBe(fp);
    // RE-READ réel de la cible avant le succès.
    expect(calls.some((c) => /\/missions\/m-real-1$/.test(c.url) && c.method === "GET")).toBe(true);
  });

  it("DOUBLON : re-confirmer la même proposition renvoie le résultat existant, V1 non ré-appelé", async () => {
    const proposalId = await seed("create_mission", { instruction: "Doublon test" });
    const first = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(first.status).toBe("executed");
    installFetch(); // réinitialise le compteur d'appels
    const second = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(second.status).toBe("duplicate");
    expect(second.targetRef).toBe("m-real-1");
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/missions")).length).toBe(0); // aucune 2e création
  });

  it("CONCURRENCE : deux confirmations simultanées → une seule exécution réelle", async () => {
    const proposalId = await seed("create_mission", { instruction: "Concurrence CDI" });
    const [a, b] = await Promise.all([POST(req(proposalId)), POST(req(proposalId))]);
    const da = await a.json() as Record<string, unknown>; const db = await b.json() as Record<string, unknown>;
    const statuses = [da.status, db.status].sort();
    // une exécute, l'autre = in_flight (lease valide) ou duplicate (déjà committé)
    expect(statuses.includes("executed")).toBe(true);
    const createCount = calls.filter((c) => c.method === "POST" && c.url.endsWith("/missions")).length;
    expect(createCount).toBe(1); // V1 create appelé exactement une fois
  });

  it("référence ÉTRANGÈRE / inexistante → 404, ne révèle rien (aucun claim, aucun effet)", async () => {
    // proposition d'un AUTRE acteur : invisible pour USER → introuvable.
    const stores = await getCloneChatStores();
    const foreign = await stores.proposals.create({ companyId: COMPANY, userId: OTHER_USER }, { conversationId: null, actionKind: "create_mission", payload: { instruction: "secret" }, at: new Date().toISOString() });
    const res = await POST(req(foreign.id));
    expect(res.status).toBe(404);
    expect(calls.length).toBe(0); // aucun appel V1
    // UUID totalement inconnu → 404 aussi
    const res2 = await POST(req("99999999-9999-4999-8999-999999999999"));
    expect(res2.status).toBe(404);
  });

  it("create_support_case : effet SERVEUR direct (support durable) → cas ouvert", async () => {
    const proposalId = await seed("create_support_case", { summary: "Le bouton export ne répond pas" });
    const d = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(d.status).toBe("executed");
    expect(typeof d.targetRef).toBe("string");
    expect(d.href).toBe("/profile/messages");
  });

  it("cancel_mission : V1 cancel + re-read", async () => {
    const proposalId = await seed("cancel_mission", { missionId: "m-real-1" });
    const d = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(d.status).toBe("executed");
    expect(calls.some((c) => c.url.includes("/cancel") && c.method === "POST")).toBe(true);
  });

  it("decide_validation : V1 decide version-checké + re-read du statut", async () => {
    const proposalId = await seed("decide_validation", { validationId: "val-1", missionId: "m-real-1", decision: "approve", version: 2 });
    const d = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(d.status).toBe("executed");
    const decideCall = calls.find((c) => /\/validations\/val-1\/approve$/.test(c.url) && c.method === "POST");
    expect(decideCall?.body?.version).toBe(2);
  });

  it("échec TERMINAL (V1 refuse 403) → failed terminal, non rejoué", async () => {
    installFetch({ createStatus: 403 });
    const proposalId = await seed("create_mission", { instruction: "Action refusée" });
    const d = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(d.status).toBe("failed");
    expect(d.terminal).toBe(true);
    // re-confirm → toujours terminal, aucun nouvel appel de création
    installFetch({ createStatus: 403 });
    const d2 = await (await POST(req(proposalId))).json() as Record<string, unknown>;
    expect(d2.status).toBe("failed");
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/missions")).length).toBe(0);
  });
});

describe("P9.5 create_mission — mode d'autonomie transmis à V1 (server-authoritative)", () => {
  const createCall = () => calls.find((c) => c.url.endsWith("/api/pierre/v1/missions") && c.method === "POST");

  it("le mode d'autonomie PERSISTÉ dans la proposition est transmis à V1 createMission", async () => {
    const proposalId = await seed("create_mission", { instruction: "Préparer un CDI", autonomyMode: "high_autonomy" });
    await POST(req(proposalId));
    expect(createCall()?.body?.autonomy_mode).toBe("high_autonomy");
  });

  it("un autonomyMode FORGÉ dans le corps /execute est IGNORÉ (serveur lit la proposition persistée)", async () => {
    const proposalId = await seed("create_mission", { instruction: "Préparer un CDI 2", autonomyMode: "normal" });
    const forged = new Request("http://localhost:3000/api/assistant/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalId, autonomyMode: "enterprise_autonomous", payload: { autonomyMode: "enterprise_autonomous" } }) });
    await POST(forged);
    expect(createCall()?.body?.autonomy_mode).toBe("normal");   // persisté, jamais l'escalade forgée
  });

  it("un autonomyMode invalide dans la proposition est OMIS (garde-fou anti-mode-moteur-inconnu)", async () => {
    const proposalId = await seed("create_mission", { instruction: "Préparer un CDI 3", autonomyMode: "hacker_mode" });
    await POST(req(proposalId));
    expect("autonomy_mode" in (createCall()?.body ?? {})).toBe(false);
  });
});
