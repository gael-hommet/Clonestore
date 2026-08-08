// src/app/api/assistant/chat/__tests__/hardening-route-body.test.ts
//
// BLOC 13 — BODY GUARD prouvé sur la VRAIE route ACTIVE. Content-Length n'est qu'un signal PRÉCOCE : la
// limite réelle est prouvée par lecture cumulative bornée (corps mensonger/absent/chunké). Nombre BRUT de
// pièces jointes vérifié AVANT slice. Toute entrée refusée ne lance JAMAIS le provider (seams à 0).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn(async () => ({ ok: false, reason: "NO_ENTITLEMENT", error: null })) }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn(async () => ({ ok: false, code: "MEMBERSHIP_REQUIRED" })) }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));
vi.mock("@/lib/pierre/v1/e2e-test-identity", () => ({ isE2EModeEnabled: () => true, readE2EIdentityFromRequest: () => null }));
vi.mock("openai", () => ({ default: class { responses = { create: async () => ({ output_text: "x", output: [], usage: {}, model: "m" }) }; } }));
vi.mock("@/lib/clonechat/core/responder", () => ({
  respondUnified: vi.fn(async () => ({ ok: true, answer: "HISTORICAL", webSources: [], suggestCard: false, usedWebSearch: false })),
  loadResponderConfig: () => ({}),
  readOpenAIKeyLazy: () => "sk-lazy-" + "x".repeat(32),
}));

import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { __resetAnonymousRateLimit } from "@/lib/clonechat/server/anonymous-rate-limit";
import { __setActiveStreamProduceForTests, __setActiveUnaryCallForTests, __resetActiveHardeningForTests } from "@/lib/clonechat/hardening";
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

let streamCalls = 0;
let unaryCalls = 0;
const ENV_KEY = process.env.OPENAI_API_KEY;
const MAXB = ["CLONECHAT_HARDENING_MAX_BODY_BYTES", "CLONECHAT_HARDENING_MAX_MESSAGE_CHARS"];

beforeEach(() => {
  streamCalls = 0; unaryCalls = 0;
  __resetAnonymousRateLimit();
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(async (emit) => { streamCalls++; emit("x"); return { donePayload: { ok: true } }; });
  __setActiveUnaryCallForTests(async () => { unaryCalls++; return { answer: "ok", citations: [] }; });
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  process.env.CLONECHAT_HARDENING_MODE = "active";
  delete process.env.CLONECHAT_HARDENING_KILL_SWITCH;
  for (const k of MAXB) delete process.env[k];
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
});
afterEach(() => {
  if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY;
  delete process.env.CLONECHAT_HARDENING_MODE;
  for (const k of MAXB) delete process.env[k];
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(null);
  __setActiveUnaryCallForTests(null);
});

const LIMIT = 2048;
function jsonBodyOfSize(bytes: number, message = "hi"): string {
  let pad = "";
  const build = () => JSON.stringify({ message, stream: false, pad });
  while (Buffer.byteLength(build(), "utf8") < bytes) pad += "x".repeat(Math.max(1, bytes - Buffer.byteLength(build(), "utf8")));
  while (Buffer.byteLength(build(), "utf8") > bytes) pad = pad.slice(0, -1);
  return build();
}
const jsonReq = (bodyStr: string, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: bodyStr }));
function streamReq(totalBytes: number, headers: Record<string, string> = {}, chunk = 512) {
  const body = new ReadableStream<Uint8Array>({
    start(c) { let sent = 0; const enc = new TextEncoder(); while (sent < totalBytes) { const n = Math.min(chunk, totalBytes - sent); c.enqueue(enc.encode("x".repeat(n))); sent += n; } c.close(); },
  });
  return POST(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body, duplex: "half" } as RequestInit & { duplex: "half" }));
}
const noProviderCalled = () => expect(streamCalls + unaryCalls).toBe(0);
const jsonOf = async (r: Response) => r.json().catch(() => ({} as Record<string, unknown>));

describe("BLOC 13 — body guard (transport) sur la route ACTIVE", () => {
  it("1. body EXACTEMENT à maxBodyBytes → accepté (pas de 413)", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await jsonReq(jsonBodyOfSize(LIMIT));
    expect(res.status).not.toBe(413);
    const d = await jsonOf(res);
    expect(d.code).not.toBe("payload_too_large");
  });

  it("2. body maxBodyBytes+1 → 413 payload_too_large, provider non appelé", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await jsonReq(jsonBodyOfSize(LIMIT + 1));
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("payload_too_large");
    noProviderCalled();
  });

  it("3. Content-Length déclaré > limite → rejet immédiat (413)", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await streamReq(64, { "content-length": String(LIMIT + 5000) }); // CL ment vers le HAUT
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("payload_too_large");
    noProviderCalled();
  });

  it("4. Content-Length mensonger (bas) mais corps réel > limite → 413 (lecture cumulative)", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await streamReq(LIMIT + 4096, { "content-length": "10" }); // CL ment vers le BAS
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("payload_too_large");
    noProviderCalled();
  });

  it("5. Content-Length ABSENT + corps réel > limite → 413 (lecture bornée)", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await streamReq(LIMIT + 4096); // pas de content-length (corps stream)
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("payload_too_large");
    noProviderCalled();
  });

  it("6. corps CHUNKÉ dépassant la limite → lecture ARRÊTÉE, 413", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await streamReq(LIMIT * 4, {}, 256); // nombreux petits chunks
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("payload_too_large");
    noProviderCalled();
  });

  it("7. JSON INVALIDE sous la limite → erreur sûre, aucun crash (400 EMPTY, pas 500)", async () => {
    process.env.CLONECHAT_HARDENING_MAX_BODY_BYTES = String(LIMIT);
    const res = await jsonReq('{"message": ');  // JSON invalide, court
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).code).toBe("EMPTY");
    noProviderCalled();
  });

  it("8. raw attachments = max (4) → accepté par cette garde (pas too_many_attachments)", async () => {
    const attachments = Array.from({ length: 4 }, (_, i) => ({ filename: `f${i}.txt`, mime_type: "text/plain", transport: "inline", data: Buffer.from("hi").toString("base64") }));
    const res = await jsonReq(JSON.stringify({ message: "ok", stream: false, attachments }));
    expect((await jsonOf(res)).code).not.toBe("too_many_attachments");
  });

  it("9. raw attachments = max+1 (5) → too_many_attachments AVANT slice (413), provider non appelé", async () => {
    const attachments = Array.from({ length: 5 }, (_, i) => ({ filename: `f${i}.txt`, mime_type: "text/plain", transport: "inline", data: Buffer.from("hi").toString("base64") }));
    const res = await jsonReq(JSON.stringify({ message: "ok", stream: false, attachments }));
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("too_many_attachments");
    noProviderCalled();
  });

  it("10. UNE pièce jointe trop volumineuse → attachment_too_large (413), provider non appelé", async () => {
    const attachments = [{ filename: "big.bin", mime_type: "application/octet-stream", transport: "inline", size_bytes: 7 * 1024 * 1024, data: "AA==" }];
    const res = await jsonReq(JSON.stringify({ message: "ok", stream: false, attachments }));
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("attachment_too_large");
    noProviderCalled();
  });

  it("11. TOTAL des pièces jointes trop volumineux → attachment_too_large (413)", async () => {
    const attachments = [
      { filename: "a.bin", mime_type: "application/octet-stream", transport: "inline", size_bytes: 4 * 1024 * 1024, data: "AA==" },
      { filename: "b.bin", mime_type: "application/octet-stream", transport: "inline", size_bytes: 4 * 1024 * 1024, data: "AA==" },
    ];
    const res = await jsonReq(JSON.stringify({ message: "ok", stream: false, attachments }));
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("attachment_too_large");
    noProviderCalled();
  });

  it("12. message trop long → message_too_long (413), provider non appelé", async () => {
    process.env.CLONECHAT_HARDENING_MAX_MESSAGE_CHARS = "10";
    const res = await jsonReq(JSON.stringify({ message: "a".repeat(50), stream: false }));
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).code).toBe("message_too_long");
    noProviderCalled();
  });

  it("13. entrée valide (sous toutes les limites) → PAS de rejet body/attachment (provider peut être appelé)", async () => {
    const res = await jsonReq(JSON.stringify({ message: "question courte", stream: false }));
    const d = await jsonOf(res);
    expect(["payload_too_large", "too_many_attachments", "attachment_too_large", "message_too_long"]).not.toContain(d.code);
  });
});
