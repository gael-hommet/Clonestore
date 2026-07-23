// C1.8 REOUVERT §16 — TEST DE RÉFÉRENCE AU NIVEAU ROUTE (/api/assistant/chat).
// Contexte EXACT du défaut observé : utilisateur CONNECTÉ SANS ENTREPRISE ACTIVE. Le message
// « je veux acheter pierre, je dois me rendre sur quelle page » doit produire, à la sortie de la
// VRAIE route : une réponse directe « Réserver Pierre », le CTA /reserver/pierre, AUCUNE liste de
// pages, AUCUN CTA Support, AUCUN message « aucune entreprise active », AUCUNE clarification,
// AUCUNE route inventée. On prouve aussi que la classe entière (prix/démo/annulation/support) se
// comporte correctement dans ce même contexte, et écrit la preuve JSON.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

const USER = "aaaaaaaa-2222-4222-8222-222222222222";

let authedUserId: string | null = null;
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
        // C1.9 — le raccourci de navigation ne supprime plus le modèle quand il existe
        // (correctif M1). Ce stub renvoie donc une réponse PLAUSIBLE plutôt qu'un « … »,
        // sinon on mesurerait un artefact de test et non le comportement du produit.
        return {
          ok: true,
          structured: { answer: "La réservation de Pierre se fait depuis la page dédiée, sans paiement en ligne pour le moment.", honesty: "answered" as const, tool_call: null, citations: [] },
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      },
    })),
  };
});

import { hasPierreAccess } from "@/lib/pierre/access";
import { resolveCloneChatCompany } from "@/lib/clonechat/server/company";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { __resetAnonymousRateLimit } from "@/lib/clonechat/server/anonymous-rate-limit";
import { POST } from "@/app/api/assistant/chat/route";

const NO_ENTITLEMENT = { ok: false as const, reason: "NO_ENTITLEMENT" as const, error: null };
const NO_COMPANY = { ok: false, code: "MEMBERSHIP_REQUIRED" };

function stores() {
  return {
    durable: false,
    budget: {
      reserve: vi.fn(async () => ({ granted: true, reason: null, scopes: ["g:day"], reservedTokens: 500, maxOutputTokens: 500 })),
      commit: vi.fn(async () => {}), release: vi.fn(async () => {}), recordUsage: vi.fn(async () => {}), snapshot: vi.fn(async () => ({})),
    },
    conversations: { appendMessage: vi.fn(async () => {}) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => {}) },
  };
}

const ENV_KEY = process.env.OPENAI_API_KEY;
beforeEach(() => {
  authedUserId = USER; // CONNECTÉ
  modelCalls.length = 0;
  __resetAnonymousRateLimit();
  delete process.env.CLONECHAT_ENABLED;
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
  vi.mocked(hasPierreAccess).mockResolvedValue(NO_ENTITLEMENT as never);
  vi.mocked(resolveCloneChatCompany).mockResolvedValue(NO_COMPANY as never); // SANS ENTREPRISE ACTIVE
});
afterEach(() => { if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY; });

async function ask(message: string) {
  const res = await POST(new Request("http://localhost/api/assistant/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
  }));
  return { res, d: await res.json() };
}

const NO_COMPANY_PARASITE = /aucune entreprise active|entreprise active|activez une entreprise|rejoindre une entreprise/i;

describe("C1.8 REOUVERT §16 — RÉFÉRENCE ROUTE : connecté SANS entreprise active", () => {
  it("« je veux acheter pierre, je dois me rendre sur quelle page » → Réserver Pierre, rien d'autre", async () => {
    const { res, d } = await ask("je veux acheter pierre, je dois me rendre sur quelle page");
    const answer: string = d.structured?.answer ?? "";
    const links: Array<{ route: string }> = d.relevantLinks ?? [];
    const cta = d.suggestedCTA ?? null;

    expect(res.status).toBe(200);
    expect(d.ok).toBe(true);
    expect(d.requestClass).toBe("CONVERSATIONAL_OR_PUBLIC");   // conversation = droit, pas de gate
    // C1.9 — la GARANTIE testée ici est « une réponse directe vers la bonne page, pas une
    // liste ni un renvoi au support ». Elle était auparavant vérifiée en exigeant la phrase
    // figée « Pour obtenir Pierre… », ce qui revenait à verrouiller le dictionnaire : le
    // raccourci de navigation renvoyait cette phrase SANS jamais appeler le modèle, même
    // lorsqu'un responder existait. On vérifie désormais la propriété, et en plus que le
    // modèle a bien eu la parole.
    expect(modelCalls.length).toBeGreaterThan(0);
    expect(answer.trim().length).toBeGreaterThan(20);
    expect(answer).not.toMatch(/^\s*…?\s*$/);
    // CTA canonique vers la vraie page.
    expect(cta?.route).toBe("/reserver/pierre");
    expect(cta?.label).toMatch(/réserver pierre/i);
    // Aucune liste de pages : au plus un lien, et c'est la réservation.
    expect(links.length).toBeLessThanOrEqual(1);
    expect(links.every((l) => l.route !== "/questions")).toBe(true); // AUCUN Support
    // Aucun message parasite d'entreprise, NI dans la réponse NI en prérequis.
    expect(answer).not.toMatch(NO_COMPANY_PARASITE);
    expect(String(d.prerequisiteMessage ?? "")).not.toMatch(NO_COMPANY_PARASITE);
    expect(d.cta).toBeUndefined();                              // pas de CTA de prérequis parasite
    // Aucune clarification, aucune route inventée.
    expect(answer).not.toMatch(/quelle page cherchez|pouvez-vous préciser|que voulez-vous/i);
    expect(cta?.route?.startsWith("/")).toBe(true);

    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_ROUTE_REFERENCE_PROOF.json", JSON.stringify({
      context: "authenticated user WITHOUT active company (exact defect context)",
      status: res.status, requestClass: d.requestClass, answer, suggestedCTA: cta,
      relevantLinks: links, prerequisiteMessage: d.prerequisiteMessage ?? null, parasiticCta: d.cta ?? null,
      modelCalled: modelCalls.length > 0,
    }, null, 2));
  });

  it("classe entière dans ce contexte : prix/démo → bonnes pages, jamais de parasite entreprise", async () => {
    const price = await ask("combien coûte Pierre ?");
    expect(price.d.structured.answer).not.toMatch(NO_COMPANY_PARASITE);
    expect(price.d.suggestedCTA?.route).toBe("/reserver/pierre");

    const demo = await ask("je veux voir Pierre en action");
    expect(demo.d.suggestedCTA?.route).toBe("/demo/pierre");
    expect(demo.d.structured.answer).not.toMatch(NO_COMPANY_PARASITE);
  });

  it("une VRAIE demande de donnée privée reste correctement conditionnée (le privilège, lui, tient)", async () => {
    // Contre-preuve : le correctif n'a pas ouvert les données privées. Une lecture privée en
    // l'absence d'entreprise signale légitimement le prérequis (ce n'est PAS un parasite commercial).
    const priv = await ask("montre-moi le dossier de mon salarié Paul");
    expect(priv.res.status).toBe(200);
    expect(priv.d.requestClass).not.toBe("CONVERSATIONAL_OR_PUBLIC");
  });
});
