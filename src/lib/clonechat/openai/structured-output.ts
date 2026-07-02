// src/lib/clonechat/openai/structured-output.ts
// P9.4 — Sortie STRUCTURÉE STRICTE du modèle. Le modèle ne renvoie JAMAIS de texte
// libre exécutable : il renvoie un objet validé (Zod) = réponse + honnêteté +
// éventuelle proposition d'outil (allowlist). Une sortie invalide n'exécute rien ;
// une seule tentative de réparation, puis repli sûr.

import { z } from "zod";
import { ALL_TOOL_NAMES } from "./tool-registry";

export const ToolCallSchema = z.object({
  name: z.enum(ALL_TOOL_NAMES as [string, ...string[]]),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export const CloneChatStructuredOutputSchema = z.object({
  /** Réponse humaine, sans jargon technique, jamais un JSON brut. */
  answer: z.string().min(1),
  /** Honnêteté explicite : réponse / inconnu / clarification. Jamais de fausse certitude. */
  honesty: z.enum(["answered", "unknown", "needs_clarification"]),
  /** Proposition d'outil (facultative) — gouvernée serveur avant toute exécution. */
  tool_call: ToolCallSchema.nullable().optional(),
  /** Sources/citations (clés de connaissance), jamais de contenu secret. */
  citations: z.array(z.string()).max(8).optional().default([]),
});

export type CloneChatStructuredOutput = z.infer<typeof CloneChatStructuredOutputSchema>;

export interface ParseResult {
  readonly ok: boolean;
  readonly value: CloneChatStructuredOutput | null;
  readonly error: string | null;
}

/** Parse défensif d'une sortie modèle (string JSON ou objet). Jamais throw. */
export function parseStructuredOutput(raw: unknown): ParseResult {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(extractJson(raw));
    } catch {
      return { ok: false, value: null, error: "invalid_json" };
    }
  }
  const parsed = CloneChatStructuredOutputSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, value: null, error: "schema_mismatch" };
  return { ok: true, value: parsed.data, error: null };
}

/** Extrait le premier objet JSON d'une chaîne (robustesse si le modèle entoure de texte). */
function extractJson(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

/** Le schéma JSON envoyé au modèle (Responses API text.format json_schema). */
export const STRUCTURED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "honesty", "tool_call", "citations"],
  properties: {
    answer: { type: "string", description: "Réponse humaine, claire, sans jargon technique." },
    honesty: { type: "string", enum: ["answered", "unknown", "needs_clarification"] },
    tool_call: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["name", "arguments"],
          properties: {
            name: { type: "string", enum: [...ALL_TOOL_NAMES] },
            arguments: { type: "object", additionalProperties: true },
          },
        },
      ],
    },
    citations: { type: "array", items: { type: "string" } },
  },
} as const;
