// src/app/api/assistant/__tests__/clonecare-route-c1-8.test.ts
// C1.8 §4/§7/§16 — CLONECARE À TRAVERS LA VRAIE ROUTE.
//
// Les modules purs peuvent être irréprochables et la route quand même vulnérable : ce qui
// compte, c'est ce qui traverse RÉELLEMENT `POST /api/assistant/chat`. Ces tests attaquent la
// route elle-même — usurpation d'identité par le corps de requête, effets externes, pertinence.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const USER = "aaaaaaaa-1111-4111-8111-111111111111";
const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "99999999-9999-4999-8999-999999999999";

let authedUserId: string | null = null;
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }),
}));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn() }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn() }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));
vi.mock("@/lib/clonechat/openai", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/openai")>();
  return {
    ...real,
    createRealOpenAIResponder: vi.fn(() => ({
      respond: async () => ({
        ok: true,
        structured: { answer: "Réponse.", honesty: "answered" as const, tool_call: null, citations: [] },
        usage: { inputTokens: 10, outputTokens: 5 },
      }),
    })),
  };
});

import { hasPierreAccess } from "@/lib/pierre/access";
import { resolveCloneChatCompany } from "@/lib/clonechat/server/company";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { __resetAnonymousRateLimit } from "@/lib/clonechat/server/anonymous-rate-limit";
import { POST } from "@/app/api/assistant/chat/route";

function stores() {
  return {
    durable: false,
    budget: {
      reserve: vi.fn(async () => ({ granted: true, reason: null, scopes: ["g:day"], reservedTokens: 500, maxOutputTokens: 500 })),
      commit: vi.fn(async () => {}), release: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}), snapshot: vi.fn(async () => ({})),
    },
    conversations: { appendMessage: vi.fn(async () => {}) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => {}) },
  };
}

const ask = (body: Record<string, unknown>) =>
  POST(new Request("http://x/api/assistant/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));

const care = async (body: Record<string, unknown>) => (await (await ask(body)).json()).care;

beforeEach(() => {
  authedUserId = USER;
  __resetAnonymousRateLimit();
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
  vi.mocked(hasPierreAccess).mockResolvedValue({ ok: false, reason: "NO_ENTITLEMENT", error: null } as never);
  vi.mocked(resolveCloneChatCompany).mockResolvedValue({ ok: true, companyId: COMPANY, role: "member", siteIds: [], real: true } as never);
  process.env.CLONECHAT_ENABLED = "true";
});
afterEach(() => { vi.clearAllMocks(); });

describe("C1.8 §16 — la route ne croit PAS le navigateur sur son identité", () => {
  it("un contexte d'écran qui prétend une AUTRE entreprise est rejeté, signalé, et sans effet", async () => {
    const c = await care({
      message: "je ne peux pas créer de mission",
      page_context: {
        app_area: "employee_use", page_id: "pierre_use", route: "/agents/pierre/use",
        page_title: "Pierre", page_version: "v1", visible_sections: [], active_section: null,
        visible_panels: [], focused_entity: { type: null, id: null, label: null },
        surfaced_errors: [], client_observed_at: "2026-07-13T10:00:00Z",
        // ── L'ATTAQUE ──
        company_id: OTHER_COMPANY, user_id: "root", permissions: ["tenancy.admin"], roles: ["OWNER"],
        subscription_state: "active", entitlement: "active",
      },
    });

    // Le serveur a VU la tentative…
    expect(c.page_context_rejected_fields).toEqual(
      expect.arrayContaining(["company_id", "user_id", "permissions", "roles", "subscription_state"]),
    );
    // …et n'a rien cru : le contexte reste celui du VRAI compte (sans droit Pierre).
    expect(c.context_version).toContain(COMPANY);
    expect(c.context_version).not.toContain(OTHER_COMPANY);
    expect(c.viewer_kind).toBe("company_member");
    // L'entitlement forgé n'a accordé AUCUN droit : le blocage réel tient.
    expect(c.blockers.map((b: { code: string }) => b.code)).toContain("pierre_not_active");
  });

  it("aucune donnée d'un autre tenant n'apparaît nulle part dans la réponse", async () => {
    const res = await ask({ message: "montre les salariés", page_context: { company_id: OTHER_COMPANY, route: "/x", app_area: "unknown", page_id: "x", page_title: "x", page_version: "v1", visible_sections: [], active_section: null, visible_panels: [], focused_entity: { type: null, id: null, label: null }, surfaced_errors: [], client_observed_at: "2026-07-13T10:00:00Z" } });
    expect(JSON.stringify(await res.json())).not.toContain(OTHER_COMPANY);
  });
});

describe("C1.8 §7 — aucun effet externe réel ne peut être déclenché depuis la route", () => {
  it("le portail de facturation est PROPOSÉ mais DÉSACTIVÉ, avec sa raison", async () => {
    vi.mocked(hasPierreAccess).mockResolvedValue({ ok: true, status: "active", orderId: "o1", error: null } as never);
    const c = await care({ message: "ma facture est fausse, je veux gérer mon abonnement" });

    const portal = c.actions.find((a: { id: string }) => a.id === "act.portal");
    expect(portal).toBeDefined();
    expect(portal.enabled).toBe(false);                       // aucun effet externe possible
    expect(portal.effect_category).toBe("provider_effect");
    expect(portal.disabled_reason).toMatch(/effet EXTERNE réel/i); // et il DIT pourquoi
  });

  it("toute action à effet est soit désactivée, soit à confirmer — jamais déjà exécutée", async () => {
    vi.mocked(hasPierreAccess).mockResolvedValue({ ok: true, status: "active", orderId: "o1", error: null } as never);
    const c = await care({ message: "ma mission est bloquée" });
    for (const a of c.actions) {
      if (a.effect_category === "client_navigation") continue;
      expect(a.enabled === false || a.requires_confirmation === true).toBe(true);
    }
  });
});

describe("C1.8 — la pertinence : on ne répond pas à une question qu'on n'a pas posée", () => {
  // Verrou anti-régression C1.6. J'ai introduit exactement ce défaut en câblant l'enveloppe :
  // une question sur les PRIX renvoyait « Aucune entreprise active ». C'est le contraire de C1.6.
  it("une question PUBLIQUE ne fait remonter aucun blocage de compte", async () => {
    vi.mocked(resolveCloneChatCompany).mockResolvedValue({ ok: false, code: "MEMBERSHIP_REQUIRED" } as never);
    const c = await care({ message: "Quels sont les prix ?" });

    expect(c.blockers).toEqual([]);                 // rien sur le compte n'est volontairement affiché
    expect(c.diagnosis.status).not.toBe("blocked"); // et l'utilisateur n'est PAS déclaré « bloqué »
  });

  it("la MÊME lacune de compte est dite, en revanche, dès qu'elle EMPÊCHE la demande", async () => {
    vi.mocked(resolveCloneChatCompany).mockResolvedValue({ ok: false, code: "MEMBERSHIP_REQUIRED" } as never);
    const c = await care({ message: "Montre-moi mes salariés." });

    expect(c.blockers.map((b: { code: string }) => b.code)).toContain("no_active_company");
    expect(c.blockers[0].next_step_href).toBe("/mon-clonestore"); // avec l'étape concrète
  });
});

describe("C1.8 §12 — l'aveu d'ignorance et l'escalade traversent bien la route", () => {
  it("une question de SÉCURITÉ exige un humain, et n'ouvre aucune action à effet", async () => {
    const c = await care({ message: "je pense qu'il y a eu une fuite de données sur mon compte" });
    expect(c.human_required).toBe(true);
    expect(c.diagnosis.escalation_required).toBe(true);
    expect(c.actions.every((a: { effect_category: string; enabled: boolean }) =>
      a.effect_category === "client_navigation" || a.effect_category === "reversible_self_service" || !a.enabled)).toBe(true);
  });

  it("sur un compte SAIN, une plainte vague reste un aveu : « je ne sais pas »", async () => {
    vi.mocked(hasPierreAccess).mockResolvedValue({ ok: true, status: "active", orderId: "o1", error: null } as never);
    const c = await care({ message: "ça ne marche pas" });
    expect(c.diagnosis.confidence).toBe("unknown");
    expect(c.diagnosis.reason).toMatch(/pas de preuve suffisante/i);
  });

  // Sur un compte dont le blocage est PROUVÉ, se taire serait bête ; affirmer serait mentir.
  // La bonne réponse est la troisième : PROPOSER la cause probable, et demander confirmation.
  it("sur un compte BLOQUÉ, la même plainte devient une HYPOTHÈSE à confirmer — jamais une certitude", async () => {
    const c = await care({ message: "ça ne marche pas" }); // profil : Pierre non activé (prouvé)
    expect(c.diagnosis.confidence).toBe("medium");
    expect(c.diagnosis.reason).toMatch(/je n'en ai pas la preuve/i);
    // Une hypothèse n'autorise AUCUN effet : `medium` ne franchit pas la porte d'action.
    expect(c.actions.every((a: { effect_category: string; enabled: boolean; requires_confirmation: boolean }) =>
      a.effect_category === "client_navigation" || !a.enabled || a.requires_confirmation)).toBe(true);
  });

  it("chaque preuve porte sa SOURCE (aucune affirmation sans origine)", async () => {
    const c = await care({ message: "je ne peux pas créer de mission" });
    expect(c.diagnosis.evidence.length).toBeGreaterThan(0);
    for (const e of c.diagnosis.evidence) expect(typeof e.source).toBe("string");
    expect(c.diagnosis.evidence.some((e: { source: string }) => e.source.startsWith("server:"))).toBe(true);
  });

  it("la vérité de support est VERSIONNÉE (un support non daté n'est pas vérifiable)", async () => {
    const c = await care({ message: "bonjour" });
    expect(c.support_truth_version).toBe("c1.8-support-1");
  });
});
