// src/app/api/assistant/__tests__/access-gate-c1-4.test.ts
// C1.4 §13.B/C/D/F — Preuve NIVEAU ROUTE.
//
// ⚠ SUPPLANTÉ EN PARTIE PAR C1.6 (CloneChat universel). La doctrine d'ENTRÉE de C1.4
// (« opérationnel sans droit ⇒ refus sec `pierre_access_required`, aucun appel modèle ») est
// remplacée : CloneChat RÉPOND toujours, et le prérequis manquant s'attache à la DEMANDE.
// Ce qui reste PLEINEMENT valide — et ce que ce fichier continue de verrouiller — c'est la
// SÉCURITÉ : aucune donnée d'entreprise, aucune proposition, aucune action, aucun faux tenant
// sans droit vérifié. La matrice d'entrée complète vit désormais dans
// `universal-clonechat-c1-6.test.ts`.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const USER = "aaaaaaaa-1111-4111-8111-111111111111";
const COMPANY = "11111111-1111-4111-8111-111111111111";

let authedUserId: string | null = USER;
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }),
}));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn() }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn() }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));

const modelCalls: string[] = [];
vi.mock("@/lib/clonechat/openai", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/openai")>();
  return {
    ...real,
    createRealOpenAIResponder: vi.fn(() => ({
      respond: async (r: { userText: string }) => {
        modelCalls.push(r.userText);
        return { ok: true, structured: { answer: "Pierre est un employé IA RH.", honesty: "answered" as const, tool_call: null, citations: [] }, usage: { inputTokens: 12, outputTokens: 8 } };
      },
    })),
  };
});

import { hasPierreAccess } from "@/lib/pierre/access";
import { resolveCloneChatCompany } from "@/lib/clonechat/server/company";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { POST } from "@/app/api/assistant/chat/route";

let reserveScopes: Array<{ userId: string | null; companyId: string | null }> = [];
let proposalCalls = 0;

function stores() {
  return {
    durable: false,
    budget: {
      reserve: vi.fn(async (_c: unknown, scope: { userId: string | null; companyId: string | null }) => {
        reserveScopes.push(scope);
        return { granted: true, reason: null, scopes: ["u:x"], reservedTokens: 500, maxOutputTokens: 500 };
      }),
      commit: vi.fn(async () => {}), release: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}), snapshot: vi.fn(async () => ({})),
    },
    conversations: { appendMessage: vi.fn(async () => {}) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => { proposalCalls += 1; }) },
  };
}

const GRANTED = { ok: true as const, status: "active" as const, orderId: "o1", error: null };
const NO_ENTITLEMENT = { ok: false as const, reason: "NO_ENTITLEMENT" as const, error: null };
const LOOKUP_FAILED = { ok: false as const, reason: "LOOKUP_FAILED" as const, error: "PIERRE_ACCESS_LOOKUP_FAILED" as const };

const WITH_COMPANY = { ok: true, companyId: COMPANY, role: "owner", siteIds: [], real: true };
const NO_COMPANY = { ok: false, code: "MEMBERSHIP_REQUIRED" };
const SUSPENDED = { ok: false, code: "MEMBERSHIP_SUSPENDED" };

const ENV_KEY = process.env.OPENAI_API_KEY;
beforeEach(() => {
  authedUserId = USER; reserveScopes = []; proposalCalls = 0; modelCalls.length = 0;
  delete process.env.CLONECHAT_ENABLED;
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
});
afterEach(() => { if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY; });

const ask = async (message: string) =>
  POST(new Request("http://localhost/api/assistant/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
  }));

const setup = (entitlement: unknown, tenant: unknown) => {
  vi.mocked(hasPierreAccess).mockResolvedValue(entitlement as never);
  vi.mocked(resolveCloneChatCompany).mockResolvedValue(tenant as never);
};

// ═══════════ C — Requête opérationnelle SANS droit Pierre ════════════════════
// C1.6 : la demande reçoit une VRAIE réponse conversationnelle + les prérequis manquants.
// Ce qui doit rester VRAI pour toujours : aucune donnée d'entreprise, aucune proposition.
describe("C1.6 — opérationnel SANS droit Pierre : on parle, mais on n'agit pas", () => {
  const OPERATIONAL = [
    "Prépare l'onboarding de Sarah.",
    "Montre-moi mes salariés.",
    "Crée une mission.",
    "Analyse les données de mon entreprise.",
  ];

  for (const q of OPERATIONAL) {
    it(`« ${q} » sans droit → prérequis annoncé, AUCUNE proposition, AUCUNE action`, async () => {
      setup(NO_ENTITLEMENT, NO_COMPANY);
      const res = await ask(q);
      const data = await res.json();
      expect(res.status).toBe(200);
      // La conversation vit (C1.6) …
      expect(data.structured.answer.length).toBeGreaterThan(0);
      // … mais rien n'est exécuté ni proposé, et le prérequis est explicite.
      expect(Array.isArray(data.prerequisites)).toBe(true);
      expect(data.prerequisites.length).toBeGreaterThan(0);
      expect(data.structured.tool_call).toBeNull();
      expect(proposalCalls).toBe(0);
      expect(reserveScopes.every((s) => s.companyId === null)).toBe(true); // jamais de faux tenant
    });
  }

  it("24. le CTA provient du REGISTRE de routes réel (jamais inventé)", async () => {
    setup(NO_ENTITLEMENT, NO_COMPANY);
    const data = await (await ask("Crée une mission.")).json();
    expect(data.cta?.route).toMatch(/^\//);
  });

  it("25. une ENTREPRISE ACTIVE seule NE contourne PAS le droit Pierre pour AGIR", async () => {
    setup(NO_ENTITLEMENT, WITH_COMPANY);
    const data = await (await ask("Envoie l'avenant de Paul.")).json();
    expect(data.prerequisites).toContain("pierre_entitlement"); // l'entreprise n'accorde rien
    expect(proposalCalls).toBe(0);
  });
});

// ═══════════ D — Droit sans entreprise ══════════════════════════════════════
describe("C1.4 — droit Pierre SANS entreprise", () => {
  it("27. C1.6 — l'entreprise manquante est annoncée comme PRÉREQUIS, jamais fabriquée", async () => {
    setup(GRANTED, NO_COMPANY);
    const data = await (await ask("Montre-moi mes salariés.")).json();
    expect(data.prerequisites).toEqual(["active_company"]);
    expect(reserveScopes.every((s) => s.companyId === null)).toBe(true); // aucun faux tenant
    expect(proposalCalls).toBe(0);
  });
  it("26. question publique → découverte", async () => {
    setup(GRANTED, NO_COMPANY);
    const data = await (await ask("Quels sont les prix ?")).json();
    expect(data.discovery).toBe(true);
  });
});

// ═══════════ E — Droit + entreprise = mode entreprise ═══════════════════════
describe("C1.4 — droit + entreprise = mode entreprise (inchangé)", () => {
  it("30. le budget est scopé sur la VRAIE entreprise", async () => {
    setup(GRANTED, WITH_COMPANY);
    await ask("Quels sont les prix ?");
    expect(reserveScopes.length).toBe(1);
    expect(reserveScopes[0].companyId).toBe(COMPANY);
    expect(reserveScopes[0].userId).toBe(USER);
  });
});

// ═══════════ F — Erreurs d'accès / sécurité ═════════════════════════════════
describe("C1.4 — pannes et sécurité", () => {
  it("34. C1.6 — panne de vérification du droit : on n'ACCORDE rien, mais on ne coupe pas le chat", async () => {
    setup(LOOKUP_FAILED, NO_COMPANY);
    const res = await ask("Crée une mission.");
    const data = await res.json();
    expect(res.status).toBe(200); // le chat reste ouvert (C1.6)
    // Une panne n'accorde JAMAIS un droit : l'action reste impossible.
    expect(data.prerequisites).toContain("pierre_entitlement");
    expect(proposalCalls).toBe(0);
    expect(data.structured.tool_call).toBeNull();
    // 47 — jamais le message brut de la base (fuite d'info corrigée en C1.4, conservée).
    expect(JSON.stringify(data)).not.toMatch(/clonechat_app|does not exist|pg_|role "/i);
  });

  it("35. panne de vérification du droit + question publique → découverte (n'accorde rien)", async () => {
    setup(LOOKUP_FAILED, NO_COMPANY);
    const data = await (await ask("Quels sont les prix ?")).json();
    expect(data.discovery).toBe(true);
    expect(data.runtime.entitlementKnown).toBe(false);
    expect(reserveScopes[0].companyId).toBeNull();
  });

  it("36. C1.6 — membership suspendu : les DONNÉES restent coupées, la conversation reste ouverte", async () => {
    setup(GRANTED, SUSPENDED);
    // Une question publique reste une question publique : un accès suspendu n'a jamais
    // interdit de demander les prix.
    const pub = await (await ask("Quels sont les prix ?")).json();
    expect(pub.structured.answer.length).toBeGreaterThan(0);
    expect(reserveScopes.every((s) => s.companyId === null)).toBe(true); // aucune donnée tenant

    // Mais toute demande privée/opérationnelle est refusée, explicitement.
    const priv = await (await ask("Montre-moi mes salariés.")).json();
    expect(priv.source).toBe("company_access_suspended");
    expect(priv.structured.answer).toMatch(/suspendu/i);
    expect(priv.structured.tool_call).toBeNull();
    expect(proposalCalls).toBe(0);
  });

  it("38. C1.6 — anonyme : PLUS DE 401 pour une conversation publique (la porte est supprimée)", async () => {
    authedUserId = null;
    setup(NO_ENTITLEMENT, NO_COMPANY);
    const res = await ask("Quels sont les prix ?");
    const data = await res.json();
    expect(res.status).toBe(200); // ← C1.4 renvoyait 401 : c'était LA porte d'entrée
    expect(data.anonymous).toBe(true);
    expect(data.structured.answer.length).toBeGreaterThan(0);
    expect(reserveScopes[0]).toEqual({ userId: null, companyId: null }); // aucune identité fabriquée
  });

  it("39. CLONECHAT_ENABLED=false → 503 (kill switch C1.2 intact)", async () => {
    process.env.CLONECHAT_ENABLED = "false";
    setup(GRANTED, WITH_COMPANY);
    const res = await ask("Quels sont les prix ?");
    expect(res.status).toBe(503);
    expect(modelCalls.length).toBe(0);
    delete process.env.CLONECHAT_ENABLED;
  });

  // RÉGRESSION : une pièce jointe avec une demande AMBIGUË ne doit jamais glisser vers une
  // simple clarification — un document RH n'est analysable qu'en MODE ENTREPRISE.
  it("C1.7 — pièce jointe hors mode entreprise : ÉPHÉMÈRE (analysée), jamais liée à un tenant", async () => {
    const withFile = (message: string) =>
      POST(new Request("http://localhost/api/assistant/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, attachments: [{ filename: "note.txt", mime_type: "text/plain", size_bytes: 3, data: "YWJj" }] }),
      }));

    // Sans entreprise, l'utilisateur peut analyser SON fichier — mais il n'obtient AUCUN tenant.
    setup(NO_ENTITLEMENT, NO_COMPANY);
    const data = await (await withFile("Que contient ce fichier ?")).json();
    expect(data.ok).toBe(true);
    expect(data.public).toBe(true);
    expect(reserveScopes.every((s) => s.companyId === null)).toBe(true); // jamais de faux tenant
    expect(proposalCalls).toBe(0);                                        // aucune action
    expect(data.structured.tool_call).toBeNull();
  });

  it("46/49. budget refusé → AUCUN appel modèle (invariant)", async () => {
    setup(NO_ENTITLEMENT, NO_COMPANY);
    const denied = stores();
    denied.budget.reserve = vi.fn(async (_c: unknown, scope: never) => { reserveScopes.push(scope); return { granted: false, reason: "user_daily", scopes: [], reservedTokens: 0, maxOutputTokens: 0 }; }) as never;
    vi.mocked(getCloneChatStores).mockResolvedValue(denied as never);
    const data = await (await ask("Quels sont les prix ?")).json();
    expect(modelCalls.length).toBe(0); // ← aucune réservation ⇒ aucun provider
    expect(data.source).toBe("public_fallback");
    expect(data.runtime.provider).toBe("deterministic");
  });
});

// ═══════════ G — RÉFUTABILITÉ DE LA PREUVE RUNTIME (revue adverse C1.4) ═══════
// Une preuve qui ne peut jamais être fausse ne prouve rien. Le bloc `runtime` doit être
// MESURÉ : `reservedBeforeProvider` était codé en dur à `true` — corrigé en horloge logique.
describe("C1.4 — le bloc runtime est mesuré, jamais auto-certifié", () => {
  it("sans appel provider, reservedBeforeProvider est null (et non `true`)", async () => {
    setup(NO_ENTITLEMENT, NO_COMPANY);
    delete process.env.OPENAI_API_KEY; // pas de clé ⇒ aucun provider, réservation quand même accordée
    const data = await (await ask("Quels sont les prix ?")).json();
    expect(modelCalls.length).toBe(0);
    expect(data.runtime.providerCalled).toBe(false);
    expect(data.runtime.reservedBeforeProvider).toBeNull(); // ← eût été `true` avec la constante
    expect(data.runtime.provider).toBe("deterministic");
    expect(data.runtime.model).toBeNull(); // jamais de modèle annoncé sans appel réel
  });

  it("avec appel provider, l'ordonnancement réservation→provider est mesuré vrai", async () => {
    setup(NO_ENTITLEMENT, NO_COMPANY);
    const data = await (await ask("Quels sont les prix ?")).json();
    expect(modelCalls.length).toBe(1);
    expect(data.runtime.providerCalled).toBe(true);
    expect(data.runtime.reservedBeforeProvider).toBe(true); // mesuré : reservedSeq < providerSeq
  });

  it("le modèle annoncé est celui RAPPORTÉ PAR LE PROVIDER, jamais le modèle configuré", async () => {
    setup(NO_ENTITLEMENT, NO_COMPANY);
    const data = await (await ask("Quels sont les prix ?")).json();
    // Le responder simulé ne rapporte AUCUN modèle → le champ reste null, il n'emprunte
    // pas `cfg.model`. Seul un vrai provider peut le remplir (preuve navigateur réelle).
    expect(data.runtime.model).toBeNull();
    expect(data.runtime.requestedModel).toBeTruthy(); // le modèle DEMANDÉ est distinct et étiqueté
  });
});
