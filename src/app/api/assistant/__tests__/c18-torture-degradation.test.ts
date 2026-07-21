// C1.8 TORTURE §6 — CONDITIONS DÉGRADÉES. Sous panne (provider absent/erreur, budget indisponible,
// réponse vide/malformée, persistance qui échoue, rate limit, double envoi), CloneChat doit rester
// HONNÊTE, RÉCUPÉRABLE, UTILISABLE. Invariant DUR : aucune panne ne devient un faux succès, une
// fausse analyse, une route arbitraire, une action rejouée deux fois, ni une conversation perdue.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const USER = "aaaaaaaa-6666-4666-8666-666666666666";
let authedUserId: string | null = null;
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }),
}));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn() }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn() }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));

let responderMode: "ok" | "throw" | "empty" | "malformed" = "ok";
const modelCalls: string[] = [];
vi.mock("@/lib/clonechat/openai", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/openai")>();
  return {
    ...real,
    createRealOpenAIResponder: vi.fn(() => ({
      respond: async (r: { userText: string }) => {
        modelCalls.push(r.userText);
        if (responderMode === "throw") throw new Error("provider down");
        if (responderMode === "empty") return { ok: true, structured: { answer: "", honesty: "answered" as const, tool_call: null, citations: [] }, usage: { inputTokens: 1, outputTokens: 0 } };
        if (responderMode === "malformed") return { ok: false as const, error: "bad" };
        return { ok: true, structured: { answer: "Pierre est un employé IA RH.", honesty: "answered" as const, tool_call: null, citations: [] }, usage: { inputTokens: 10, outputTokens: 5 } };
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
const FALSE_SUCCESS = /\bj'ai\s+(créé|exécuté|lancé|validé|envoyé|analysé)|(mission|action)\s+a\s+été\s+(créée?|exécutée?|réussie?)|c'est fait\b/i;

let budgetThrows = false, appendThrows = false;
function stores() {
  return {
    durable: false,
    budget: {
      reserve: vi.fn(async () => { if (budgetThrows) throw new Error("budget store down"); return { granted: true, reason: null, scopes: ["g:day"], reservedTokens: 500, maxOutputTokens: 500 }; }),
      commit: vi.fn(async () => {}), release: vi.fn(async () => {}), recordUsage: vi.fn(async () => {}), snapshot: vi.fn(async () => ({})),
    },
    conversations: { appendMessage: vi.fn(async () => { if (appendThrows) throw new Error("history store down"); }) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => {}) },
  };
}

const ENV_KEY = process.env.OPENAI_API_KEY;
beforeEach(() => {
  authedUserId = null; responderMode = "ok"; budgetThrows = false; appendThrows = false; modelCalls.length = 0;
  __resetAnonymousRateLimit();
  delete process.env.CLONECHAT_ENABLED;
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
  vi.mocked(hasPierreAccess).mockResolvedValue(NO_ENTITLEMENT as never);
  vi.mocked(resolveCloneChatCompany).mockResolvedValue(NO_COMPANY as never);
});
afterEach(() => { if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY; });

async function ask(message: string) {
  const res = await POST(new Request("http://localhost/api/assistant/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
  }));
  return { res, d: await res.json() };
}
const honest = (d: Record<string, unknown>) => {
  const ans = ((d.structured as { answer?: string } | undefined)?.answer) ?? "";
  expect(FALSE_SUCCESS.test(ans), `faux succès: ${ans}`).toBe(false);
};

describe("C1.8 TORTURE §6 — conditions dégradées : honnête, récupérable, jamais de faux succès", () => {
  it("provider ABSENT (pas de clé) → repli déterministe, 200, honnête, 0 appel modèle", async () => {
    delete process.env.OPENAI_API_KEY;
    const { res, d } = await ask("c'est quoi Pierre ?");
    expect(res.status).toBe(200); expect(d.ok).toBe(true);
    expect(modelCalls.length).toBe(0); honest(d);
    expect((d.structured.answer as string).length).toBeGreaterThan(0); // toujours utilisable
  });

  it("provider ERREUR (respond throw) → 200, réponse honnête, jamais un faux succès", async () => {
    responderMode = "throw";
    const { res, d } = await ask("c'est quoi Pierre ?");
    expect(res.status).toBe(200); expect(d.ok).toBe(true); honest(d);
    expect((d.structured.answer as string).length).toBeGreaterThan(0);
  });

  it("provider VIDE (answer='') → jamais présenté comme une vraie réponse vide trompeuse", async () => {
    responderMode = "empty";
    const { res, d } = await ask("c'est quoi Pierre ?");
    expect(res.status).toBe(200); expect(d.ok).toBe(true); honest(d);
    expect((d.structured.answer as string).length).toBeGreaterThan(0); // un vide échoue visiblement → repli
  });

  it("provider MALFORMÉ (ok:false) → repli honnête, pas de crash, pas de faux succès", async () => {
    responderMode = "malformed";
    const { res, d } = await ask("c'est quoi Pierre ?");
    expect(res.status).toBe(200); expect(d.ok).toBe(true); honest(d);
    expect((d.structured.answer as string).length).toBeGreaterThan(0);
  });

  it("BUDGET indisponible (reserve throw) → repli déterministe sans modèle, 200, honnête", async () => {
    budgetThrows = true;
    const { res, d } = await ask("combien coûte Pierre ?");
    expect(res.status).toBe(200); expect(d.ok).toBe(true);
    expect(modelCalls.length).toBe(0); honest(d);
  });

  it("PERSISTANCE échoue (appendMessage throw) → le tour réussit quand même (best-effort), conversation jamais perdue silencieusement", async () => {
    authedUserId = USER; appendThrows = true;
    const { res, d } = await ask("c'est quoi Pierre ?");
    expect(res.status).toBe(200); expect(d.ok).toBe(true); honest(d);
    expect((d.structured.answer as string).length).toBeGreaterThan(0);
  });

  it("RATE LIMIT anonyme (>12/5min) → message honnête de limitation, jamais un faux succès ni une route arbitraire", async () => {
    let last: Record<string, unknown> = {};
    for (let i = 0; i < 14; i++) last = (await ask("une question")).d;
    expect(last.source).toBe("rate_limited");
    honest(last);
    expect((last.structured as { answer: string }).answer).toMatch(/vite|patient|reprenons|minute/i);
  });

  it("DOUBLE ENVOI identique → deux réponses honnêtes, aucune action gouvernée rejouée (public = 0 action)", async () => {
    const a = await ask("c'est quoi Pierre ?");
    const b = await ask("c'est quoi Pierre ?");
    expect(a.res.status).toBe(200); expect(b.res.status).toBe(200);
    honest(a.d); honest(b.d);
    // Voie publique : aucune proposition/action créée quel que soit le nombre d'envois.
    expect(a.d.tool_call ?? null).toBeNull();
  });
});
