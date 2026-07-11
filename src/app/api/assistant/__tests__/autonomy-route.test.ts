// src/app/api/assistant/__tests__/autonomy-route.test.ts
// P9.5 — Prouve que le réglage d'autonomie est AUTORITATIF CÔTÉ SERVEUR : le client envoie un
// mode PRODUIT ; le serveur le mappe au mode MOTEUR P8 et PATCH la colonne P8 (source unique).
// Aucune escalade forgée par le client ; la permission d'écriture est imposée par P8 (403).
// La lane P8 est STUBÉE au niveau fetch (consommation simulée) — jamais modifiée.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/assistant/autonomy/route";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const USER = "aaaaaaaa-1111-4111-8111-111111111111";

vi.mock("@/lib/clonechat/server/auth", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/server/auth")>();
  return { ...real, requireCompanyUser: vi.fn(async () => ({ identity: { userId: USER, companyId: COMPANY, role: "owner", siteIds: [] as string[], realCompany: true } })) };
});

let companyState = { default_autonomy_mode: "normal", version: 3 };
type Call = { url: string; method: string; body: Record<string, unknown> | undefined };
const calls: Call[] = [];
function json(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } }); }
function installFetch(opts?: { patchStatus?: number }) {
  calls.length = 0;
  global.fetch = vi.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
    const u = String(url); const method = init?.method ?? "GET"; const body = init?.body ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ url: u, method, body });
    if (u.endsWith("/api/pierre/v1/company") && method === "GET") return json({ ...companyState });
    if (u.endsWith("/api/pierre/v1/company") && method === "PATCH") {
      if (opts?.patchStatus) return json({ error: "denied" }, opts.patchStatus);
      companyState = { default_autonomy_mode: String(body?.default_autonomy_mode), version: Number(body?.version ?? companyState.version) + 1 };
      return json({ ...companyState });
    }
    return json({}, 404);
  }) as unknown as typeof fetch;
}
const req = (method: string, body?: unknown) => new Request("http://localhost:3000/api/assistant/autonomy", { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => { companyState = { default_autonomy_mode: "normal", version: 3 }; installFetch(); });

describe("P9.5 autonomy route — server-authoritative", () => {
  it("GET : mode courant (dérivé de la colonne P8) + 5 modes + matrice dérivée de decideValidation", async () => {
    const d = await (await GET(req("GET"))).json() as Record<string, unknown>;
    expect(d.ok).toBe(true);
    const current = d.current as Record<string, unknown>;
    expect(current.engineMode).toBe("normal");
    expect(current.productModeId).toBe("validation");     // normal → validation
    expect((d.modes as unknown[]).length).toBe(5);
    const entries = (d.matrix as { entries: Array<{ key: string; bucket: string }> }).entries;
    expect(entries.find((e) => e.key === "contract")?.bucket).toBe("validation");     // garde dure (dérivée)
    expect(entries.find((e) => e.key === "termination")?.bucket).toBe("human_only");
  });

  it("POST : mode PRODUIT → mode MOTEUR → PATCH colonne P8 (uniquement default_autonomy_mode + version)", async () => {
    const d = await (await POST(req("POST", { productModeId: "controlled" }))).json() as Record<string, unknown>;
    expect(d.ok).toBe(true);
    expect((d.current as Record<string, unknown>).engineMode).toBe("high_autonomy");   // controlled → high_autonomy
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toEqual({ default_autonomy_mode: "high_autonomy", version: 3 }); // AUCUN autre champ
  });

  it("PAS d'escalade forgée : un mode moteur injecté dans le corps est IGNORÉ (serveur utilise productModeId)", async () => {
    const d = await (await POST(req("POST", { productModeId: "validation", default_autonomy_mode: "enterprise_autonomous", engineMode: "enterprise_autonomous", version: 999 }))).json() as Record<string, unknown>;
    expect((d.current as Record<string, unknown>).engineMode).toBe("normal");           // validation → normal, PAS l'injecté
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body?.default_autonomy_mode).toBe("normal");
    expect(patch.body?.version).toBe(3);                                                 // version lue serveur, pas 999
  });

  it("mode produit inconnu → 400", async () => {
    expect((await POST(req("POST", { productModeId: "hacker_autonome" }))).status).toBe(400);
  });

  it("permission imposée par P8 : PATCH 403 → FORBIDDEN (aucune escalade possible côté client)", async () => {
    installFetch({ patchStatus: 403 });
    const res = await POST(req("POST", { productModeId: "governed" }));
    expect(res.status).toBe(403);
    expect((await res.json() as Record<string, unknown>).code).toBe("FORBIDDEN");
  });

  it("persistance : après POST controlled, un GET renvoie bien le nouveau mode", async () => {
    await POST(req("POST", { productModeId: "governed" }));
    const d = await (await GET(req("GET"))).json() as Record<string, unknown>;
    expect((d.current as Record<string, unknown>).engineMode).toBe("enterprise_autonomous");
    expect((d.current as Record<string, unknown>).productModeId).toBe("governed");
  });

  it("'dirigeant' : conservé juste après enregistrement (écho) ; au rechargement la colonne P8 (mode moteur) réaffiche 'governed'", async () => {
    const d = await (await POST(req("POST", { productModeId: "dirigeant" }))).json() as Record<string, unknown>;
    expect((d.current as Record<string, unknown>).productModeId).toBe("dirigeant");           // écho immédiat du choix
    expect((d.current as Record<string, unknown>).engineMode).toBe("enterprise_autonomous");   // même mode moteur que governed
    const g = await (await GET(req("GET"))).json() as Record<string, unknown>;
    expect((g.current as Record<string, unknown>).engineMode).toBe("enterprise_autonomous");
    expect((g.current as Record<string, unknown>).productModeId).toBe("governed");             // rechargement : présentation canonique (documenté)
  });
});
