// src/app/api/assistant/transcribe/__tests__/transcribe-hotfix.test.ts
// HOTFIX 2026-07-25 — couvre le comportement AJOUTÉ par ce correctif : timeout explicite
// (AbortSignal) → TRANSCRIPTION_TIMEOUT, et échec provider (401) → message honnête existant,
// sans jamais journaliser l'audio ni le transcript.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/features/product-availability", () => ({ isCloneChatEnabled: () => true }));
vi.mock("@/lib/clonechat/openai", () => ({ readOpenAIKey: () => "sk-test-fake-key-for-hotfix-tests-000000" }));
vi.mock("@/lib/clonechat/server/anonymous-rate-limit", () => ({
  checkAnonymousRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  anonymousFingerprint: () => "fp-test",
  anonymousRateLimitMessage: () => "Vous allez un peu vite.",
}));

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; vi.restoreAllMocks(); });

function audioForm(bytes = 5_000, mime = "audio/mp4") {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(bytes)], { type: mime }), "dictation.mp4");
  return form;
}

describe("HOTFIX — /api/assistant/transcribe : timeout et échec provider", () => {
  beforeEach(() => { vi.resetModules(); });

  it("un timeout OpenAI produit TRANSCRIPTION_TIMEOUT (jamais un plantage silencieux)", async () => {
    global.fetch = vi.fn(async (_url, init) => {
      const signal = (init as { signal?: AbortSignal })?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    }) as unknown as typeof fetch;

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/assistant/transcribe", { method: "POST", body: audioForm() });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TRANSCRIPTION_TIMEOUT");
  }, 25_000);

  it("un 401 du provider (clé Production invalide) reste un échec HONNÊTE, jamais un plantage", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "invalid api key" } }), { status: 401 })) as unknown as typeof fetch;

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/assistant/transcribe", { method: "POST", body: audioForm() });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TRANSCRIPTION_FAILED");
    // Jamais le corps brut du provider (pourrait contenir des indices sensibles).
    expect(JSON.stringify(json)).not.toMatch(/invalid api key/);
  });

  it("mp4 est accepté (préférence iPhone) et webm aussi — succès normal", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ text: "Explique-moi ce que Pierre peut gérer." }), { status: 200 })) as unknown as typeof fetch;

    const { POST } = await import("../route");
    for (const mime of ["audio/mp4", "audio/webm"]) {
      const req = new Request("http://localhost/api/assistant/transcribe", { method: "POST", body: audioForm(5_000, mime) });
      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.transcript).toBe("Explique-moi ce que Pierre peut gérer.");
      expect(json.autoSend).toBe(false);
    }
  });

  it("HOTFIX — le nom de fichier envoyé au provider suit le MIME réel (jamais figé à .webm)", async () => {
    // Défaut RÉEL trouvé par round-trip TTS→transcription : un audio mp4 envoyé sous
    // l'extension .webm est rejeté par le provider ("Audio file might be corrupted").
    const seenFilenames: string[] = [];
    global.fetch = vi.fn(async (_url, init) => {
      const body = (init as { body?: FormData })?.body;
      const file = body?.get("file") as File | null;
      seenFilenames.push(file?.name ?? "");
      return new Response(JSON.stringify({ text: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;

    const { POST } = await import("../route");
    const cases: Array<[string, string]> = [
      ["audio/mp4", "dictation.mp4"],
      ["audio/webm", "dictation.webm"],
      ["audio/ogg", "dictation.ogg"],
      ["audio/wav", "dictation.wav"],
    ];
    for (const [mime, expectedFilename] of cases) {
      const req = new Request("http://localhost/api/assistant/transcribe", { method: "POST", body: audioForm(5_000, mime) });
      await POST(req);
    }
    expect(seenFilenames).toEqual(cases.map(([, f]) => f));
  });

  it("un MIME interdit est refusé avant tout appel réseau", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/assistant/transcribe", { method: "POST", body: audioForm(5_000, "application/zip") });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un fichier vide est refusé avant tout appel réseau", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/assistant/transcribe", { method: "POST", body: audioForm(0, "audio/mp4") });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
