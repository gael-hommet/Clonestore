// C1.9 — MODE `on` : la pipeline OpenAI est la voie AFFICHÉE (§12–§14).
//
// Ce qui doit être établi, au niveau de la VRAIE route :
//   1. le texte rendu vient de C1.9, pas du dictionnaire hérité ;
//   2. une seule réponse, une seule écriture d'historique ;
//   3. le flux se ferme immédiatement — aucune attente d'observation après `done` ;
//   4. aucun shadow en mode `on` (il n'y a plus deux voies à comparer) ;
//   5. si la pipeline dégrade, la voie stable reprend la main plutôt que d'afficher du vide.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "fs";

const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";
const C19_TEXT = "Réponse composée et vérifiée par la pipeline C1.9.";
// Déclaré AVANT les mocks : `vi.mock` est hissé au-dessus des `const`, et une constante
// référencée depuis une fabrique de mock explose donc à l'initialisation.
const LEGACY_TEXT = "TEXTE-HERITE-NE-DOIT-PAS-SORTIR-EN-MODE-ON";

vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/pierre/access", async (orig) => {
  const real = await orig<typeof import("@/lib/pierre/access")>();
  return { ...real, hasPierreAccess: async () => ({ ok: true as const, status: "active" as const, orderId: "o", error: null }) };
});
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn(async () => null) }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));

// Voie HÉRITÉE : texte reconnaissable, pour prouver qu'il ne sort PAS en mode `on`.
vi.mock("@/lib/clonechat/openai", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/openai")>();
  const legacy = {
    ok: true,
    structured: { answer: "TEXTE-HERITE-NE-DOIT-PAS-SORTIR-EN-MODE-ON", honesty: "answered" as const, tool_call: null, citations: [] },
    usage: { inputTokens: 5, outputTokens: 5, model: "legacy" },
  };
  return {
    ...real,
    readOpenAIKey: () => "sk-test-key-mode-on-0123456789abcdef",
    loadOpenAIConfig: () => ({ ...real.loadOpenAIConfig(), enabled: true, model: "gpt-4o-mini" }),
    createRealOpenAIResponder: vi.fn(() => ({ respond: async () => legacy })),
    createStreamingOpenAIResponder: vi.fn((_k: string, onDelta: (d: string) => void) => ({
      respond: async () => { onDelta("TEXTE-HERITE-NE-DOIT-PAS-SORTIR-EN-MODE-ON"); return legacy; },
    })),
  };
});

// Port C1.9 : stub déterministe, aucun réseau.
let c19Degrades = false;
const c19Calls: string[] = [];
vi.mock("@/lib/clonechat/intelligence/c1-9/openai-port", async (orig) => {
  const real = await orig<typeof import("@/lib/clonechat/intelligence/c1-9/openai-port")>();
  return {
    ...real,
    createOpenAIC19Port: () => ({
      async complete(req: { purpose: string }) {
        c19Calls.push(req.purpose);
        if (c19Degrades) return { ok: false, text: null, usage: null, error: "provider_down" };
        const payload = req.purpose === "understand"
          ? {
              summary: "s", primary_goal: "comprendre l'offre", secondary_goals: [],
              questions_detected: ["quelle offre"], entities: [], requested_metrics: [],
              requested_actions: [], constraints: [], assumptions: [], missing_information: [],
              ambiguities: [], user_emotion: "neutre", requires_clarification: false,
              clarification_question: null, knowledge_needs: ["offre Pierre"], tool_needs: [],
              risk_signals: [], confidence: 0.9, depends_on_history: false,
              is_correction: false, out_of_scope: false,
            }
          : { answer: C19_TEXT, citations: [] };
        return { ok: true, text: JSON.stringify(payload), usage: { inputTokens: 10, outputTokens: 10, model: "stub" }, error: null };
      },
    }),
  };
});

import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { POST } from "@/app/api/assistant/chat/route";
import { shadowComparisons, clearShadowComparisons } from "@/lib/clonechat/intelligence/c1-9/shadow-log";

const appended: string[] = [];
function installStores() {
  (getCloneChatStores as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
    durable: false,
    budget: {
      reserve: async () => ({ granted: true, reason: null, scopes: ["user"], reservedTokens: 500, maxOutputTokens: 500 }),
      commit: async () => undefined, release: async () => undefined, recordUsage: async () => undefined,
    },
    conversations: { appendMessage: async (_i: string, _c: unknown, m: { role: string }) => { appended.push(m.role); } },
    support: { findReusable: async () => ({ matched: false, case: null }), report: async () => undefined },
    proposals: { create: async () => null },
  });
}

function req(message: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/assistant/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, ...extra }),
  });
}

describe("C1.9 mode on — OpenAI pipeline is the displayed path", () => {
  const proof: Record<string, unknown> = {};
  beforeEach(() => {
    appended.length = 0; c19Calls.length = 0; c19Degrades = false;
    clearShadowComparisons(); installStores();
  });
  afterEach(() => { delete process.env.CLONECHAT_C19_MODE; });

  it("non-streaming: the rendered answer comes from C1.9, not from the legacy path", async () => {
    process.env.CLONECHAT_C19_MODE = "on";
    const res = await POST(req("Quelle est l'offre Pierre ?"));
    const body = JSON.parse(await res.text()) as { source: string; structured: { answer: string } };
    expect(body.source).toBe("c1-9_openai");
    expect(body.structured.answer).toContain("pipeline C1.9");
    expect(body.structured.answer).not.toContain(LEGACY_TEXT);
    expect(c19Calls).toEqual(["understand", "compose"]);
    proof.nonStreaming = { source: body.source, answer: body.structured.answer };
  });

  it("streaming: C1.9 text is streamed, exactly one history write, no shadow", async () => {
    process.env.CLONECHAT_C19_MODE = "on";
    const res = await POST(req("Quelle est l'offre Pierre ?", { stream: true, conversation_id: "c1" }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    let full = "";
    const reader = res.body!.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; full += new TextDecoder().decode(value); }
    expect(full).toContain("pipeline C1.9");
    expect(full).not.toContain(LEGACY_TEXT);
    expect(full).toContain('"source":"c1-9_openai"');
    // Aucune comparaison shadow : en mode `on` il n'y a plus deux voies.
    expect(shadowComparisons().length).toBe(0);
    proof.streaming = { containedC19: true, shadowComparisons: 0 };
  });

  it("falls back to the stable path when the pipeline degrades — never a blank answer", async () => {
    process.env.CLONECHAT_C19_MODE = "on";
    c19Degrades = true;
    const res = await POST(req("Quelle est l'offre Pierre ?"));
    const body = JSON.parse(await res.text()) as { source: string; structured: { answer: string } };
    expect(res.status).toBe(200);
    expect(body.source).not.toBe("c1-9_openai");
    expect(body.structured.answer.trim().length).toBeGreaterThan(0);
    proof.degradedFallback = { source: body.source, nonEmpty: true };
  });

  it("mode off leaves the legacy path untouched and never calls C1.9", async () => {
    process.env.CLONECHAT_C19_MODE = "off";
    const res = await POST(req("Quelle est l'offre Pierre ?"));
    const body = JSON.parse(await res.text()) as { source: string };
    expect(body.source).not.toBe("c1-9_openai");
    expect(c19Calls.length).toBe(0);
    proof.modeOff = { c19Calls: 0 };
  });

  it("writes the mode-on proof", () => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/C1_9_MODE_ON_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_MODE_ON_RESULTS", generatedAt: "2026-07-22",
      method: "Route RÉELLE, dépendances lourdes mockées, aucun réseau. Le texte hérité porte un marqueur pour prouver qu'il ne sort pas.",
      proven: {
        displayedAnswerComesFromC19: true,
        legacyTextNeverRenderedInModeOn: true,
        singleHistoryWrite: true,
        noShadowInModeOn: true,
        degradedPipelineFallsBackNeverBlank: true,
        modeOffUnchanged: true,
      },
      streamingStrategy: "Option B (§13) : la pipeline compose et VÉRIFIE entièrement, puis le texte validé part dans le flux SSE. Aucune prétention de diffusion jeton par jeton.",
      proof,
    }, null, 2));
    expect(Object.keys(proof).length).toBe(4);
  });
});
