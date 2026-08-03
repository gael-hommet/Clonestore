// src/lib/clonechat/inspector/vision-provider.ts
//
// Interface PROVIDER VISION abstraite + mock DÉTERMINISTE (gate sans clé) + validation stricte de la
// sortie provider. Réutilise le schéma d'analyse de capture existant (ScreenshotAnalysisSchema). Une
// sortie invalide/partielle/hallucinée est traitée honnêtement : jamais présentée comme un fait.

import { ScreenshotAnalysisSchema, type ScreenshotAnalysis } from "@/lib/clonechat/openai/multimodal";

export interface VisionRequest {
  readonly imageBase64: string;
  readonly mime: string;
  readonly userText: string;
  readonly route: string | null;
}

export interface VisionOutcome {
  readonly ok: boolean;
  readonly analysis: ScreenshotAnalysis | null;
  readonly error: "timeout" | "provider" | "invalid" | null;
}

export interface VisionProvider {
  analyze(req: VisionRequest): Promise<VisionOutcome>;
}

/** Mock déterministe : renvoie exactement l'issue fournie (ou dérivée). Aucun réseau. */
export function mockVisionProvider(outcome: VisionOutcome | ((req: VisionRequest) => VisionOutcome)): VisionProvider {
  return { analyze: async (req) => (typeof outcome === "function" ? outcome(req) : outcome) };
}

/** Raccourci : analyse réussie déterministe. */
export function visionOf(a: Partial<ScreenshotAnalysis>): VisionProvider {
  const analysis = ScreenshotAnalysisSchema.parse({ summary: "capture analysée", ...a });
  return mockVisionProvider({ ok: true, analysis, error: null });
}

export type VisionValidation =
  | { readonly ok: true; readonly analysis: ScreenshotAnalysis }
  | { readonly ok: false; readonly reason: string };

/**
 * Valide une sortie provider BRUTE contre le schéma strict. Une sortie non conforme n'est JAMAIS
 * consommée comme un fait (elle est rejetée honnêtement).
 */
export function validateVisionOutput(raw: unknown): VisionValidation {
  const parsed = ScreenshotAnalysisSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "schema_mismatch" };
  return { ok: true, analysis: parsed.data };
}
