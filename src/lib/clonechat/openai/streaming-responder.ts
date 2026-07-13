// src/lib/clonechat/openai/streaming-responder.ts
// C1.7 §8 — RESPONDER STREAMING.
//
// Il implémente le MÊME port (`ParrainResponderPort`) que le responder existant : le tour Parrain
// conserve donc TOUTES ses garanties (grounding, validation des citations, garde de claims C1).
// La seule différence : les morceaux RÉELS du provider sont poussés au client au fur et à mesure.
//
// Ce n'est PAS un faux streaming : rien n'est révélé lettre par lettre à partir d'une réponse déjà
// complète. Les deltas viennent du réseau, au rythme du réseau.

import type { ParrainResponderPort } from "@/lib/clonechat/intelligence/c1-1/parrain-turn-runtime";
import { createJsonStringFieldExtractor } from "./streaming";
import { ALL_TOOL_NAMES } from "./tool-registry";

export interface StreamingResponderResult {
  /** Usage réel rapporté par le provider (jamais fabriqué). */
  usage: { model: string; inputTokens: number; outputTokens: number; cachedInputTokens: number } | null;
  /** Le provider a-t-il réellement été appelé ? (preuve réfutable) */
  providerCalled: boolean;
}

/**
 * @param onAnswerDelta reçoit les fragments RÉELS du champ `answer`, dans l'ordre.
 * @param signal        annulation (AbortController) — l'appel provider est réellement coupé.
 */
export function createStreamingOpenAIResponder(
  apiKey: string,
  onAnswerDelta: (text: string) => void,
  signal: AbortSignal | undefined,
  sink: StreamingResponderResult,
): ParrainResponderPort {
  return {
    async respond(req) {
      const { default: OpenAI } = await import("openai"); // le SDK reste hors bundle client
      const client = new OpenAI({ apiKey });

      // MÊME contrat de sortie que le responder canonique (client.ts). Sans lui, le modèle
      // répondrait en PROSE : l'extracteur de champ `answer` ne trouverait rien, aucun delta ne
      // partirait, et le tour retomberait en silence sur la réponse déterministe — tout en étant
      // étiqueté « openai_public ». Un faux label de provider est inacceptable.
      const jsonContract = [
        "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de forme : ",
        '{"answer": string, "honesty": "answered"|"unknown"|"needs_clarification", ',
        '"tool_call": null | {"name": <un outil de l’allowlist>, "arguments": object}, "citations": string[]}. ',
        "Outils autorisés (allowlist) : " + ALL_TOOL_NAMES.join(", ") + ". ",
        "Ne propose jamais un outil hors de cette liste. N’invente aucune donnée.",
      ].join("");

      const systemFull = req.system + "\n\n" + jsonContract;

      const input: Array<Record<string, unknown>> = [
        { role: "system", content: systemFull },
        ...(req.history ?? []).map((h) => ({ role: h.role, content: h.text })),
        {
          role: "user",
          content: [
            { type: "input_text", text: req.userText },
            // C1.7 — images RÉELLES ; détail économique sauf justification.
            ...(req.imageDataUrls ?? []).map((url) => ({ type: "input_image", image_url: url, detail: req.imageDetail ?? "low" })),
          ],
        },
      ];

      sink.providerCalled = true;
      const stream = await client.responses.create(
        {
          model: req.model,
          input: input as never,
          max_output_tokens: req.maxOutputTokens,
          text: { format: { type: "json_object" } }, // sortie structurée, comme le chemin canonique
          stream: true,
        } as never,
        { signal },
      );

      const extractor = createJsonStringFieldExtractor("answer");
      let full = "";

      for await (const event of stream as unknown as AsyncIterable<Record<string, unknown>>) {
        const type = String(event.type ?? "");
        if (type === "response.output_text.delta") {
          const delta = String(event.delta ?? "");
          full += delta;
          const answerDelta = extractor.push(delta); // ne restitue QUE la prose du champ `answer`
          if (answerDelta) onAnswerDelta(answerDelta);
        } else if (type === "response.completed") {
          const r = (event.response ?? {}) as { usage?: Record<string, number>; model?: string };
          const u = r.usage ?? {};
          sink.usage = {
            model: String(r.model ?? req.model),
            inputTokens: Number(u.input_tokens ?? 0),
            outputTokens: Number(u.output_tokens ?? 0),
            cachedInputTokens: Number((u as { input_tokens_details?: { cached_tokens?: number } }).input_tokens_details?.cached_tokens ?? 0),
          };
        }
      }

      // Le tour Parrain a besoin de la sortie STRUCTURÉE : on l'analyse une fois le flux terminé.
      // Les citations et la garde de claims sont ensuite appliquées par le runtime, comme d'habitude.
      let structured: unknown = null;
      try {
        const start = full.indexOf("{");
        const end = full.lastIndexOf("}");
        if (start >= 0 && end > start) structured = JSON.parse(full.slice(start, end + 1));
      } catch {
        structured = null;
      }

      if (!structured || typeof structured !== "object") {
        return { ok: false, structured: null, usage: { inputTokens: sink.usage?.inputTokens ?? 0, outputTokens: sink.usage?.outputTokens ?? 0 } };
      }

      return {
        ok: true,
        structured: structured as never,
        usage: { inputTokens: sink.usage?.inputTokens ?? 0, outputTokens: sink.usage?.outputTokens ?? 0 },
      };
    },
  };
}
