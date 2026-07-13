// src/app/api/assistant/__tests__/no-company-public-fallback-c1-3.test.ts
// C1.3 — Preuve NIVEAU ROUTE : un utilisateur AUTHENTIFIÉ SANS entreprise active peut poser
// des questions PUBLIQUES (produit/Pierre/prix/vente/navigation) et reçoit une VRAIE réponse
// groundée — il ne reçoit PLUS « Aucune entreprise active… ». Les demandes touchant aux
// DONNÉES/ACTIONS de l'entreprise restent bloquées (aucun modèle, aucune mission, aucune
// proposition, aucune fausse entreprise). Les échecs SENSIBLES restent fail-closed.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const USER = "aaaaaaaa-1111-4111-8111-111111111111";
const COMPANY = "11111111-1111-4111-8111-111111111111";

// ── Auth : utilisateur authentifié (ou anonyme selon le test) ─────────────────
let authedUserId: string | null = USER;
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }),
}));
// C1.4 — le contrat d'accès est désormais une union discriminée (plus de booléen/objet truthy).
// Ces tests C1.3 supposent un utilisateur AVEC droit Pierre : le droit est accordé explicitement.
vi.mock("@/lib/pierre/access", async (orig) => {
  const real = await orig<typeof import("@/lib/pierre/access")>();
  return {
    ...real,
    hasPierreAccess: async () => ({ ok: true as const, status: "active" as const, orderId: "order-c13", error: null }),
  };
});

// ── Résolution d'entreprise : pilotée par test ────────────────────────────────
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn() }));

// ── Stores : budget espionné (scope !), pas de DB ─────────────────────────────
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));

// ── OpenAI : responder RÉEL remplacé par un stub (aucun appel réseau) ─────────
const modelCalls: Array<{ system: string; userText: string }> = [];
let modelShouldThrow = false;
vi.mock("@/lib/clonechat/openai", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/openai")>();
  return {
    ...real,
    createRealOpenAIResponder: vi.fn(() => ({
      respond: async (r: { system: string; userText: string }) => {
        modelCalls.push({ system: r.system, userText: r.userText });
        if (modelShouldThrow) throw new Error("model_down");
        return {
          ok: true,
          structured: { answer: "Pierre est un employé IA RH. La réservation se fait sur /reserver/pierre.", honesty: "answered" as const, tool_call: null, citations: [] },
          usage: { inputTokens: 20, outputTokens: 10 },
        };
      },
    })),
  };
});

import { resolveCloneChatCompany } from "@/lib/clonechat/server/company";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { POST } from "@/app/api/assistant/chat/route";

// ── Espions budget ────────────────────────────────────────────────────────────
type Scope = { userId: string | null; companyId: string | null };
let reserveCalls: Array<{ scope: Scope; order: number }> = [];
let commitCalls: number[] = [];
let releaseCalls = 0;
let proposalCalls = 0;
let seq = 0;

function makeStores(granted = true) {
  return {
    durable: false,
    budget: {
      reserve: vi.fn(async (_cfg: unknown, scope: Scope) => {
        reserveCalls.push({ scope, order: ++seq });
        return granted
          ? { granted: true, reason: null, scopes: ["u:x"], reservedTokens: 500, maxOutputTokens: 500 }
          : { granted: false, reason: "user_daily", scopes: [], reservedTokens: 0, maxOutputTokens: 0 };
      }),
      commit: vi.fn(async (_r: unknown, tokens: number) => { commitCalls.push(tokens); }),
      release: vi.fn(async () => { releaseCalls += 1; }),
      recordUsage: vi.fn(async () => {}),
      snapshot: vi.fn(async () => ({})),
    },
    conversations: { appendMessage: vi.fn(async () => {}) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => { proposalCalls += 1; }) },
  };
}

const ENV_FLAG = process.env.CLONECHAT_ENABLED;
const ENV_KEY = process.env.OPENAI_API_KEY;

beforeEach(() => {
  authedUserId = USER;
  reserveCalls = []; commitCalls = []; releaseCalls = 0; proposalCalls = 0; seq = 0;
  modelCalls.length = 0; modelShouldThrow = false;
  delete process.env.CLONECHAT_ENABLED; // C1.2 : actif par défaut
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32); // clé factice → responder stubé
  vi.mocked(getCloneChatStores).mockResolvedValue(makeStores() as never);
});
afterEach(() => {
  if (ENV_FLAG === undefined) delete process.env.CLONECHAT_ENABLED; else process.env.CLONECHAT_ENABLED = ENV_FLAG;
  if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY;
});

const ask = async (message: string) =>
  POST(new Request("http://localhost/api/assistant/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
  }));

const noCompany = (code: string, companies?: Array<{ id: string; name: string }>) =>
  vi.mocked(resolveCloneChatCompany).mockResolvedValue({ ok: false, code, ...(companies ? { companies } : {}) } as never);

// ═══════════════════ B. Comportement de route (pas d'entreprise) ═════════════
describe("C1.3 — authentifié SANS entreprise : questions PUBLIQUES", () => {
  const PUBLIC_QS = [
    "Comment payer Pierre ?",
    "Est-ce que tu me recommandes Pierre pour me libérer de la charge RH ?",
    "Quels sont les prix ?",
    "Comment fonctionne CloneStore ?",
    "Que peut faire Pierre ?",
  ];

  for (const q of PUBLIC_QS) {
    it(`« ${q} » → réponse publique RÉELLE (jamais NO_ACTIVE_COMPANY)`, async () => {
      noCompany("MEMBERSHIP_REQUIRED");
      const res = await ask(q);
      const data = await res.json();
      expect(res.status).toBe(200);
      // Ne renvoie PAS le blocage entreprise.
      expect(data.source).not.toBe("company_required");
      expect(JSON.stringify(data)).not.toMatch(/Aucune entreprise active n'est associée/i);
      // Mode découverte + réponse publique réelle.
      expect(data.discovery).toBe(true);
      expect(["openai_public", "public_fallback"]).toContain(data.source);
      expect(typeof data.structured.answer).toBe("string");
      expect(data.structured.answer.length).toBeGreaterThan(20);
      // Aucune action exécutable sans entreprise.
      expect(data.structured.tool_call).toBeNull();
      expect(data.proposal).toBeUndefined();
      expect(proposalCalls).toBe(0);
    });
  }

  it("le responder OpenAI EXISTANT est utilisé (aucun second client)", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    const res = await ask("Comment payer Pierre ?");
    const data = await res.json();
    expect(modelCalls.length).toBe(1); // le responder stubé (= le vrai, mocké) a été appelé
    expect(data.source).toBe("openai_public");
    // Le prompt système est le prompt PUBLIC groundé C1.1.
    expect(modelCalls[0].system).toMatch(/CloneChat/);
  });

  it("BUDGET : réservé AVANT le modèle, scope userId + companyId NULL (aucune fausse entreprise)", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    await ask("Quels sont les prix ?");
    expect(reserveCalls.length).toBe(1);
    expect(reserveCalls[0].scope.userId).toBe(USER);
    expect(reserveCalls[0].scope.companyId).toBeNull(); // ← JAMAIS de faux tenant
    // Aucun `u:<userId>` fabriqué comme entreprise.
    expect(String(reserveCalls[0].scope.companyId ?? "")).not.toMatch(/^u:/);
    // Réservation (ordre 1) avant l'appel modèle.
    expect(reserveCalls[0].order).toBe(1);
    expect(modelCalls.length).toBe(1);
    // Succès → commit.
    expect(commitCalls.length).toBe(1);
    expect(commitCalls[0]).toBe(30); // 20 in + 10 out
  });

  it("échec du modèle → réservation RÉGLÉE à 0 token (aucune fuite) + repli public honnête", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    modelShouldThrow = true;
    const res = await ask("Comment fonctionne CloneStore ?");
    const data = await res.json();
    // Le tour public rattrape l'échec modèle en interne → repli déterministe honnête.
    expect(data.source).toBe("public_fallback");
    expect(data.structured.answer.length).toBeGreaterThan(20);
    // Invariant budget : la réservation est réglée EXACTEMENT une fois, 0 token débité.
    expect(commitCalls.length + releaseCalls).toBe(1);
    expect(commitCalls[0] ?? 0).toBe(0);
    expect(data.usageTokens).toBe(0);
  });

  it("prix canoniques (résolveur réel) servis sans entreprise", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    delete process.env.OPENAI_API_KEY; // force le repli DÉTERMINISTE (moteur C1 canonique)
    const res = await ask("Quels sont les prix ?");
    const data = await res.json();
    expect(data.source).toBe("public_fallback");
    expect(data.structured.answer).toMatch(/449/);
    expect(data.structured.answer).toMatch(/499/);
  });

  // RÉGRESSION (trouvée par le QA navigateur) : le magasin de budget DURABLE peut être
  // indisponible (rôle PG non provisionné). Une question PUBLIQUE doit quand même recevoir
  // une vraie réponse — jamais un 500 — et AUCUN appel modèle sans réservation.
  it("budget indisponible (throw) → réponse publique déterministe, jamais 500, aucun modèle", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    const broken = makeStores();
    broken.budget.reserve = vi.fn(async () => { throw new Error('role "clonechat_app" does not exist'); }) as never;
    vi.mocked(getCloneChatStores).mockResolvedValue(broken as never);

    const res = await ask("Quels sont les prix ?");
    const data = await res.json();
    expect(res.status).toBe(200); // ← plus de 500
    expect(data.discovery).toBe(true);
    expect(data.source).toBe("public_fallback");
    // Réponse canonique réelle malgré le budget HS.
    expect(data.structured.answer).toMatch(/449/);
    expect(data.structured.answer).toMatch(/499/);
    // INVARIANT : aucun appel modèle sans réservation accordée.
    expect(modelCalls.length).toBe(0);
    expect(data.usageTokens).toBe(0);
  });

  it("aucune persistance durable sans entreprise (jamais de faux tenant)", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    const res = await ask("Que peut faire Pierre ?");
    const data = await res.json();
    expect(data.durable).toBe(false);
  });
});

// ⚠ C1.6 supplante la doctrine d'ENTRÉE : une demande d'entreprise n'est plus « bloquée »,
// elle reçoit une VRAIE réponse + le prérequis manquant. Ce qui reste verrouillé — et ce que
// ces tests continuent de garantir — c'est qu'AUCUNE donnée d'entreprise n'est lue et
// qu'AUCUNE mission/proposition n'est créée.
describe("C1.6 — authentifié SANS entreprise : demandes ENTREPRISE sans effet ni donnée", () => {
  const COMPANY_QS = [
    "Prépare l'onboarding de Sarah.",
    "Montre-moi mes salariés.",
    "Montre-moi les documents de Nora.",
    "Continue la mission.",
    "Pourquoi ma mission est bloquée ?",
    "Crée une mission.",
    "Envoie ce document.",
    "Analyse les données de mon entreprise.",
  ];

  for (const q of COMPANY_QS) {
    it(`« ${q} » → prérequis annoncé, AUCUNE donnée d'entreprise, AUCUNE mission`, async () => {
      noCompany("MEMBERSHIP_REQUIRED");
      const res = await ask(q);
      const data = await res.json();
      expect(res.status).toBe(200);
      // C1.6 : la conversation vit…
      expect(data.structured.answer.length).toBeGreaterThan(0);
      expect(Array.isArray(data.prerequisites)).toBe(true);
      expect(data.prerequisites).toContain("active_company");
      // …mais RIEN n'est lu ni exécuté sur une entreprise (l'invariant de sécurité tient).
      expect(proposalCalls).toBe(0);
      expect(data.structured.tool_call).toBeNull();
      expect(reserveCalls.every((c) => c.scope.companyId === null)).toBe(true); // jamais de faux tenant
    });
  }
});

describe("C1.3 — authentifié SANS entreprise : AMBIGU", () => {
  it("C1.6 — « Continue. » → on RÉPOND (plus de blocage), et aucune mission n'est créée", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    const res = await ask("Continue.");
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.structured.answer.length).toBeGreaterThan(0);
    expect(proposalCalls).toBe(0);
    expect(data.structured.tool_call).toBeNull();
  });
});

// ═══════════════════ Matrice des raisons tenant ══════════════════════════════
describe("C1.3 — matrice des raisons de refus tenant", () => {
  it("MEMBERSHIP_REQUIRED → mode public autorisé", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    const data = await (await ask("Comment fonctionne CloneStore ?")).json();
    expect(data.discovery).toBe(true);
    expect(["openai_public", "public_fallback"]).toContain(data.source);
  });

  it("COMPANY_SELECTION_REQUIRED → mode public autorisé (question publique)", async () => {
    noCompany("COMPANY_SELECTION_REQUIRED", [{ id: COMPANY, name: "Acme" }]);
    const data = await (await ask("Quels sont les prix ?")).json();
    expect(["openai_public", "public_fallback"]).toContain(data.source);
    expect(data.discovery).toBe(true);
  });

  it("C1.6 — COMPANY_SELECTION_REQUIRED + demande entreprise → prérequis, aucune donnée", async () => {
    noCompany("COMPANY_SELECTION_REQUIRED", [{ id: COMPANY, name: "Acme" }]);
    const data = await (await ask("Montre-moi mes salariés.")).json();
    expect(data.prerequisites).toContain("active_company");
    expect(data.structured.tool_call).toBeNull();
    expect(proposalCalls).toBe(0);
  });

  it("C1.6 — MEMBERSHIP_SUSPENDED : données coupées, mais on peut toujours demander les prix", async () => {
    noCompany("MEMBERSHIP_SUSPENDED");
    // Demande privée → refusée explicitement, aucune donnée, aucune action.
    const priv = await (await ask("Montre-moi mes salariés.")).json();
    expect(priv.source).toBe("company_access_suspended");
    expect(priv.structured.tool_call).toBeNull();
    expect(proposalCalls).toBe(0);
    // Question publique → la conversation reste ouverte (doctrine C1.6).
    const pub = await (await ask("Quels sont les prix ?")).json();
    expect(pub.structured.answer.length).toBeGreaterThan(0);
    expect(reserveCalls.every((c) => c.scope.companyId === null)).toBe(true);
  });

  it("C1.6 — COMPANY_UNAVAILABLE : aucune donnée servie, la conversation ne tombe pas", async () => {
    noCompany("COMPANY_UNAVAILABLE");
    const priv = await (await ask("Montre-moi mes salariés.")).json();
    expect(priv.source).toBe("company_access_suspended"); // aucune donnée d'entreprise
    expect(priv.structured.tool_call).toBeNull();
    const pub = await (await ask("Quels sont les prix ?")).json();
    expect(pub.structured.answer.length).toBeGreaterThan(0);
  });
});

// ═══════════════════ Sécurité inchangée ══════════════════════════════════════
describe("C1.3 — sécurité inchangée", () => {
  it("C1.6 — anonyme : plus de 401 pour une conversation publique, et aucune identité fabriquée", async () => {
    authedUserId = null;
    noCompany("MEMBERSHIP_REQUIRED");
    const res = await ask("Quels sont les prix ?");
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.anonymous).toBe(true);
    expect(reserveCalls[0].scope).toEqual({ userId: null, companyId: null });
    expect(proposalCalls).toBe(0);
  });

  it("CLONECHAT_ENABLED=false → 503 fail-closed (arrêt d'urgence C1.2)", async () => {
    process.env.CLONECHAT_ENABLED = "false";
    noCompany("MEMBERSHIP_REQUIRED");
    const res = await ask("Comment payer Pierre ?");
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.code).toBe("CLONECHAT_DISABLED");
    expect(modelCalls.length).toBe(0);
  });

  it("C1.7 — pièce jointe SANS entreprise : ÉPHÉMÈRE, aucun tenant, aucune action", async () => {
    noCompany("MEMBERSHIP_REQUIRED");
    const res = await POST(new Request("http://localhost/api/assistant/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Que contient ce fichier ?", attachments: [{ filename: "note.txt", mime_type: "text/plain", size_bytes: 3, data: "YWJj" }] }),
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    // Le fichier est le SIEN : il peut être analysé. Mais rien de tenant n'est touché.
    expect(reserveCalls.every((c) => c.scope.companyId === null)).toBe(true);
    expect(proposalCalls).toBe(0);
    expect(data.structured.tool_call).toBeNull();
  });

  it("entreprise ACTIVE → mode entreprise inchangé (budget scopé à l'entreprise réelle)", async () => {
    vi.mocked(resolveCloneChatCompany).mockResolvedValue({ ok: true, companyId: COMPANY, role: "owner", siteIds: [], real: true } as never);
    await ask("Quels sont les prix ?");
    // Le budget est scopé sur la VRAIE entreprise (pas null) → mode entreprise préservé.
    expect(reserveCalls.length).toBe(1);
    expect(reserveCalls[0].scope.companyId).toBe(COMPANY);
    expect(reserveCalls[0].scope.userId).toBe(USER);
  });
});
