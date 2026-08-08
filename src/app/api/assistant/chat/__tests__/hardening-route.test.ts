// src/app/api/assistant/chat/__tests__/hardening-route.test.ts
//
// BLOC 13 — preuves du CHEMIN ACTIF SERVI de /api/assistant/chat :
//  • streaming durci réel (delta+done hardened) via provider synthétique (seam fail-closed) ;
//  • FAIL-CLOSED absolu quand `active` est demandé mais NON prêt (config invalide / circuit ouvert /
//    evidence manquante) → AUCUN appel provider (ni durci ni HISTORIQUE), réponse sûre + code exact ;
//  • circuit ouvert → readiness dégradée → fail-closed, jamais de bypass vers le provider historique ;
//  • chemin UNAIRE durci avec RETRY BORNÉ réel (config.retry) ; non-retryable → une seule tentative ;
//  • matrice readiness servie (active-ready / active-not-ready / off) ;
//  • limites d'entrée (nombre BRUT de pièces jointes) + kill switch inerte.
// Provider SYNTHÉTIQUE injecté → aucun appel payant. Le provider HISTORIQUE (respondUnified) est MOCKÉ
// et espionné pour prouver qu'il n'est JAMAIS appelé sur les chemins actifs. Off mode reste couvert par
// universal-clonechat (comportement historique inchangé) et par le test "off" ci-dessous.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.setConfig({ testTimeout: 30_000 });

let authedUserId: string | null = null;
vi.mock("@/lib/supabase-server", () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }) }));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn(async () => ({ ok: false, reason: "NO_ENTITLEMENT", error: null })) }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn(async () => ({ ok: false, code: "MEMBERSHIP_REQUIRED" })) }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));
// Seam actif (fail-closed) : isE2EModeEnabled true → AUTORISE l'injection des providers synthétiques et
// la réinitialisation des breakers/limiteur du chemin actif.
vi.mock("@/lib/pierre/v1/e2e-test-identity", () => ({ isE2EModeEnabled: () => true, readE2EIdentityFromRequest: () => null }));
vi.mock("openai", () => ({ default: class { responses = { create: async () => ({ output_text: "x", output: [], usage: {}, model: "m" }) }; } }));
// Provider HISTORIQUE espionné : il ne doit JAMAIS être appelé sur les chemins actifs (durci ou fail-closed).
vi.mock("@/lib/clonechat/core/responder", () => ({
  respondUnified: vi.fn(async () => ({ ok: true, answer: "HISTORICAL-ANSWER", webSources: [], suggestCard: false, usedWebSearch: false })),
  loadResponderConfig: () => ({}),
  readOpenAIKeyLazy: () => "sk-lazy-" + "x".repeat(32),
}));

import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { respondUnified } from "@/lib/clonechat/core/responder";
import { __resetAnonymousRateLimit } from "@/lib/clonechat/server/anonymous-rate-limit";
import {
  __setActiveStreamProduceForTests, __setActiveUnaryCallForTests, __resetActiveHardeningForTests,
  activeBreakerSnapshotForTests, HardeningError,
} from "@/lib/clonechat/hardening";
import { POST } from "@/app/api/assistant/chat/route";

function stores() {
  return {
    durable: false,
    budget: { reserve: vi.fn(async () => ({ granted: true, reason: null, scopes: ["g:day"], reservedTokens: 500, maxOutputTokens: 500 })), commit: vi.fn(async () => {}), release: vi.fn(async () => {}), recordUsage: vi.fn(async () => {}), snapshot: vi.fn(async () => ({})) },
    conversations: { appendMessage: vi.fn(async () => {}) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => {}) },
  };
}

const ENV_KEY = process.env.OPENAI_API_KEY;
beforeEach(() => {
  authedUserId = null;
  __resetAnonymousRateLimit();
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(null);
  __setActiveUnaryCallForTests(null);
  vi.mocked(respondUnified).mockClear();
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  process.env.CLONECHAT_HARDENING_MODE = "active"; // active local uniquement (jamais Production)
  delete process.env.CLONECHAT_HARDENING_KILL_SWITCH;
  delete process.env.CLONECHAT_HARDENING_TOTAL_MS;
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
});
afterEach(() => {
  if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY;
  delete process.env.CLONECHAT_HARDENING_MODE;
  delete process.env.CLONECHAT_HARDENING_KILL_SWITCH;
  delete process.env.CLONECHAT_HARDENING_TOTAL_MS;
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(null);
  __setActiveUnaryCallForTests(null);
});

const req = (payload: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
const askStream = (message: string) => POST(req({ message, stream: true }));
const askUnary = (message: string) => POST(req({ message, stream: false }));

describe("BLOC 13 — chemin ACTIF durci (streaming)", () => {
  it("active + stream : flux SSE DURCI (delta + done hardened), provider historique JAMAIS appelé", async () => {
    __setActiveStreamProduceForTests(async (emit) => { emit("Réponse "); emit("synthétique."); return { donePayload: { ok: true, hardened: true, structured: { answer: "Réponse synthétique.", honesty: "answered", tool_call: null, citations: [] } } }; });
    const res = await askStream("Quelle est la mission de CloneStore ?");
    expect(res.headers.get("content-type") ?? "").toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: delta");
    expect(text).toContain("event: done");
    expect(text).toContain("hardened");
    expect(vi.mocked(respondUnified).mock.calls.length).toBe(0); // provider historique jamais touché
  });
});

describe("BLOC 13 — FAIL-CLOSED : active demandé mais NON prêt ≠ off", () => {
  it("config invalide (env présent-invalide) → fail-closed config_invalid, AUCUN provider (durci ni historique)", async () => {
    process.env.CLONECHAT_HARDENING_TOTAL_MS = "not-a-number"; // présent-invalide → config invalide → blocked
    let seamCalls = 0;
    __setActiveStreamProduceForTests(async () => { seamCalls++; return { donePayload: {} }; });
    const res = await askStream("q");
    expect(res.status).toBe(500);
    const d = await res.json();
    expect(d.ok).toBe(false);
    expect(d.code).toBe("config_invalid");
    expect(d.runtime?.failClosed).toBe(true);
    expect(seamCalls).toBe(0); // provider durci jamais appelé
    expect(vi.mocked(respondUnified).mock.calls.length).toBe(0); // provider historique jamais appelé
  });

  it("circuit OUVERT → readiness dégradée → fail-closed circuit_open, JAMAIS de bypass vers l'historique", async () => {
    let calls = 0;
    __setActiveStreamProduceForTests(async () => { calls += 1; throw new Error("provider down sk-SECRET-should-not-leak"); });
    // failureThreshold=5 : 5 échecs via le chemin ACTIF ouvrent le breaker module.
    for (let i = 0; i < 5; i++) { const r = await askStream("q" + i); await r.text(); }
    expect(calls).toBe(5);
    expect(activeBreakerSnapshotForTests("openai:public-stream").state).toBe("open");
    // 6e requête : breaker ouvert → provider_healthy=failed → degraded → fail-closed.
    const r6 = await askStream("q6");
    expect(r6.status).toBe(503);
    const d6 = await r6.json();
    expect(d6.code).toBe("circuit_open");
    expect(calls).toBe(5); // provider durci NON rappelé
    expect(vi.mocked(respondUnified).mock.calls.length).toBe(0); // provider HISTORIQUE JAMAIS appelé (pas de bypass)
  });

  it("aucun secret ne fuit dans le flux d'erreur (échec provider durci)", async () => {
    __setActiveStreamProduceForTests(async () => { throw new Error("boom sk-SECRET-should-not-leak token=abcd"); });
    const res = await askStream("q");
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).not.toContain("sk-SECRET-should-not-leak");
    expect(text).not.toContain("token=abcd");
  });
});

describe("BLOC 13 — chemin UNAIRE durci + RETRY BORNÉ réel", () => {
  it("unary : échec transitoire (retryable) → retry BORNÉ → succès (seam appelé 2 fois), hardened", async () => {
    let n = 0;
    __setActiveUnaryCallForTests(async () => {
      n += 1;
      if (n === 1) throw new HardeningError("provider_unavailable", "transient");
      return { answer: "ok après retry", citations: [] };
    });
    const res = await askUnary("q unaire");
    const d = await res.json();
    expect(n).toBe(2); // maxRetries=1 → 2 tentatives : le retry du chemin servi est RÉEL
    expect(d.ok).toBe(true);
    expect(d.runtime?.hardened).toBe(true);
    expect(d.runtime?.streamed).toBe(false);
    expect(d.structured?.answer).toContain("ok après retry");
    expect(vi.mocked(respondUnified).mock.calls.length).toBe(0);
  });

  it("unary : échec NON-retryable → une SEULE tentative, indisponibilité honnête (jamais inventé)", async () => {
    let n = 0;
    __setActiveUnaryCallForTests(async () => { n += 1; throw new HardeningError("invalid_request", "permanent"); });
    const res = await askUnary("q unaire 2");
    const d = await res.json();
    expect(n).toBe(1); // non-retryable → pas de relance
    expect(d.structured?.honesty).toBe("unknown");
    expect(d.runtime?.unavailable).toBe(true);
  });
});

describe("BLOC 13 — matrice readiness servie", () => {
  it("OFF : chemin historique STRICTEMENT inchangé (provider historique appelé, aucun marqueur hardened)", async () => {
    delete process.env.CLONECHAT_HARDENING_MODE; // off
    const res = await askStream("bonjour");
    expect(res.headers.get("content-type") ?? "").toContain("text/event-stream");
    const text = await res.text();
    expect(vi.mocked(respondUnified).mock.calls.length).toBeGreaterThan(0); // historique utilisé
    expect(text).toContain("HISTORICAL-ANSWER");
    expect(text).not.toContain('"hardened":true');
  });

  it("active + ready + stream : chemin durci utilisé (hardened), pas d'historique", async () => {
    __setActiveStreamProduceForTests(async (emit) => { emit("x"); return { donePayload: { ok: true, hardened: true, structured: { answer: "x", honesty: "answered", tool_call: null, citations: [] } } }; });
    const res = await askStream("q");
    const text = await res.text();
    expect(text).toContain("hardened");
    expect(vi.mocked(respondUnified).mock.calls.length).toBe(0);
  });
});

describe("BLOC 13 — limites d'entrée + kill switch", () => {
  it("active : nombre BRUT de pièces jointes > max → 413 too_many_attachments (avant tout slice)", async () => {
    const attachments = Array.from({ length: 9 }, (_, i) => ({ filename: `f${i}.txt`, mime_type: "text/plain", transport: "inline", data: Buffer.from("hi").toString("base64") }));
    const res = await POST(req({ message: "voici", attachments }));
    expect(res.status).toBe(413);
    const d = await res.json();
    expect(d.code).toBe("too_many_attachments");
    expect(vi.mocked(respondUnified).mock.calls.length).toBe(0);
  });

  it("kill switch (même en active) → chemin actif désactivé : comportement historique (pas de 413 brut)", async () => {
    process.env.CLONECHAT_HARDENING_KILL_SWITCH = "1";
    const attachments = Array.from({ length: 9 }, (_, i) => ({ filename: `f${i}.txt`, mime_type: "text/plain", transport: "inline", data: Buffer.from("hi").toString("base64") }));
    const res = await POST(req({ message: "voici", attachments }));
    const d = await res.json().catch(() => ({}));
    expect(d.code).not.toBe("too_many_attachments"); // kill switch → garde durcie inerte
  });
});
