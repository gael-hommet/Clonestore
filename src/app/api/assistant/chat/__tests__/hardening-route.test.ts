// src/app/api/assistant/chat/__tests__/hardening-route.test.ts
//
// BLOC 13 — preuve que le CHEMIN ACTIF SERVI de /api/assistant/chat utilise réellement le runtime
// durci : streaming via la machinerie stream-guard, circuit breaker module réel, et limites d'entrée
// (nombre BRUT de pièces jointes). Provider SYNTHÉTIQUE injecté (seam fail-closed) → aucun appel payant,
// aucun effet réel. Off mode reste couvert par universal-clonechat (comportement historique inchangé).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.setConfig({ testTimeout: 30_000 });

let authedUserId: string | null = null;
vi.mock("@/lib/supabase-server", () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: authedUserId ? { id: authedUserId } : null } }) } }) }));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn(async () => ({ ok: false, reason: "NO_ENTITLEMENT", error: null })) }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn(async () => ({ ok: false, code: "MEMBERSHIP_REQUIRED" })) }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));
// Seam actif (fail-closed) : ce mock rend isE2EModeEnabled true pour AUTORISER l'injection du provider
// synthétique ET la réinitialisation des breakers du chemin actif.
vi.mock("@/lib/pierre/v1/e2e-test-identity", () => ({ isE2EModeEnabled: () => true, readE2EIdentityFromRequest: () => null }));
vi.mock("openai", () => ({ default: class { responses = { create: async () => ({ output_text: "x", output: [], usage: {}, model: "m" }) }; } }));

import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { __resetAnonymousRateLimit } from "@/lib/clonechat/server/anonymous-rate-limit";
import { __setActiveStreamProduceForTests, __resetActiveHardeningForTests, activeBreakerSnapshotForTests } from "@/lib/clonechat/hardening";
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
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  process.env.CLONECHAT_HARDENING_MODE = "active"; // active local uniquement (jamais Production)
  delete process.env.CLONECHAT_HARDENING_KILL_SWITCH;
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
});
afterEach(() => {
  if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY;
  delete process.env.CLONECHAT_HARDENING_MODE;
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(null);
});

const askStream = (message: string) =>
  POST(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, stream: true }) }));

describe("BLOC 13 — /api/assistant/chat chemin ACTIF durci (provider synthétique)", () => {
  it("active + stream : flux SSE DURCI (delta + done hardened), provider synthétique (aucun appel payant)", async () => {
    __setActiveStreamProduceForTests(async (emit) => { emit("Réponse "); emit("synthétique."); return { donePayload: { ok: true, hardened: true, structured: { answer: "Réponse synthétique.", honesty: "answered", tool_call: null, citations: [] } } }; });
    const res = await askStream("Quelle est la mission de CloneStore ?");
    expect(res.headers.get("content-type") ?? "").toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: delta");
    expect(text).toContain("event: done");
    expect(text).toContain("hardened");
  });

  it("le CHEMIN ACTIF utilise réellement le CIRCUIT BREAKER module : les échecs du provider l'OUVRENT", async () => {
    let calls = 0;
    __setActiveStreamProduceForTests(async () => { calls += 1; throw new Error("provider down sk-SECRET-should-not-leak"); });
    // failureThreshold = 5 (DEFAULT_CIRCUIT). Chaque échec via le chemin ACTIF incrémente le breaker.
    let lastText = "";
    for (let i = 0; i < 5; i++) { const r = await askStream("q" + i); lastText = await r.text(); }
    expect(calls).toBe(5); // le chemin actif a bien appelé le provider synthétique à travers le breaker
    expect(activeBreakerSnapshotForTests("openai:public-stream").state).toBe("open"); // ouvert par les échecs du chemin actif
    // Erreur provider mappée en event sûr, aucun secret ne fuit dans le flux.
    expect(lastText).toContain("event: error");
    expect(lastText).not.toContain("sk-SECRET-should-not-leak");
    // Circuit ouvert → readiness dégradée → le chemin actif se retire (fail-closed) : plus d'appel seam.
    const r6 = await askStream("q6"); await r6.text();
    expect(calls).toBe(5);
  });

  it("active : nombre BRUT de pièces jointes > max → 413 too_many_attachments (avant tout slice)", async () => {
    const attachments = Array.from({ length: 9 }, (_, i) => ({ filename: `f${i}.txt`, mime_type: "text/plain", transport: "inline", data: Buffer.from("hi").toString("base64") }));
    const res = await POST(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "voici", attachments }) }));
    expect(res.status).toBe(413);
    const d = await res.json();
    expect(d.code).toBe("too_many_attachments");
  });

  it("kill switch (même en active) → chemin actif désactivé : pas de 413 sur pièces jointes brutes (comportement historique)", async () => {
    process.env.CLONECHAT_HARDENING_KILL_SWITCH = "1";
    const attachments = Array.from({ length: 9 }, (_, i) => ({ filename: `f${i}.txt`, mime_type: "text/plain", transport: "inline", data: Buffer.from("hi").toString("base64") }));
    const res = await POST(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "voici", attachments }) }));
    const d = await res.json().catch(() => ({}));
    expect(d.code).not.toBe("too_many_attachments"); // kill switch → garde durcie inerte
  });
});
