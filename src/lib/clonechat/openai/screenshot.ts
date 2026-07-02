// src/lib/clonechat/openai/screenshot.ts
// P9.4 — Chemin d'analyse de capture d'écran (SERVEUR uniquement). Réutilise la
// Responses API multimodale (input_image, detail:"low" = coût minimal) et parse une
// sortie STRUCTURÉE honnête (visibly_proven / inference / unknown / known_issue /
// next_action). Les images sont éphémères (jamais persistées) ; la clé reste serveur.

import { ScreenshotAnalysisSchema, buildScreenshotSystemPrompt, type ScreenshotAnalysis } from "./multimodal";
import type { OpenAIUsage } from "./client";

export interface ScreenshotRequest {
  readonly model: string;
  readonly userText: string;
  readonly imageDataUrls: readonly string[];
  readonly maxOutputTokens: number;
}

export interface ScreenshotResult {
  readonly ok: boolean;
  readonly analysis: ScreenshotAnalysis | null;
  readonly usage: OpenAIUsage;
  readonly error: string | null;
}

const ZERO = (model: string): OpenAIUsage => ({ model, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });

function extractJson(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}

/** Analyse RÉELLE d'une capture (serveur). `imageDataUrls` déjà validées/bornées. */
export async function analyzeScreenshotReal(apiKey: string, req: ScreenshotRequest): Promise<ScreenshotResult> {
  if (!req.imageDataUrls.length) return { ok: false, analysis: null, usage: ZERO(req.model), error: "no_image" };
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const userContent: Array<Record<string, unknown>> = [
      { type: "input_text", text: req.userText || "Analyse cette capture d'écran." },
    ];
    for (const url of req.imageDataUrls) userContent.push({ type: "input_image", image_url: url, detail: "low" });

    const system = buildScreenshotSystemPrompt() +
      '\n\nRéponds STRICTEMENT par un objet JSON de forme : {"summary": string, ' +
      '"visibly_proven": string[], "inference": string[], "unknown": string[], ' +
      '"known_issue": string|null, "next_action": string|null}.';

    const res = await client.responses.create({
      model: req.model,
      max_output_tokens: req.maxOutputTokens,
      input: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      text: { format: { type: "json_object" } },
    } as unknown as Parameters<typeof client.responses.create>[0]);

    const usage: OpenAIUsage = {
      model: (res as { model?: string }).model ?? req.model,
      inputTokens: (res as { usage?: { input_tokens?: number } }).usage?.input_tokens ?? 0,
      outputTokens: (res as { usage?: { output_tokens?: number } }).usage?.output_tokens ?? 0,
      cachedInputTokens: (res as { usage?: { input_tokens_details?: { cached_tokens?: number } } }).usage?.input_tokens_details?.cached_tokens ?? 0,
    };
    const textOut = (res as { output_text?: string }).output_text ?? "";
    let parsedJson: unknown;
    try { parsedJson = JSON.parse(extractJson(textOut)); } catch { return { ok: false, analysis: null, usage, error: "invalid_json" }; }
    const parsed = ScreenshotAnalysisSchema.safeParse(parsedJson);
    if (!parsed.success) return { ok: false, analysis: null, usage, error: "schema_mismatch" };
    return { ok: true, analysis: parsed.data, usage, error: null };
  } catch (e) {
    const status = (e as { status?: number }).status;
    return { ok: false, analysis: null, usage: ZERO(req.model), error: status ? `openai_http_${status}` : "openai_error" };
  }
}
