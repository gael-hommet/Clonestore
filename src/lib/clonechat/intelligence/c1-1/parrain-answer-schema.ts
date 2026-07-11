// src/lib/clonechat/intelligence/c1-1/parrain-answer-schema.ts
// C1.1 — Schéma de réponse Parrain : enveloppe SERVEUR enrichie autour de la sortie
// structurée modèle P9.4 EXISTANTE (answer/honesty/tool_call/citations — inchangée côté
// modèle). L'honnêteté 7-valeurs est dérivée serveur ; les citations sont validées ;
// la politique de claims C1 est appliquée en garde finale.

import type { CloneChatStructuredOutput } from "../../openai/structured-output";
import { guardAnswerText } from "../c1/clonechat-claims-policy";
import type { AnswerCategory } from "../c1/clonechat-knowledge-types";
import type { ParrainSupportArtifact } from "./parrain-support-runtime";
import type { ParrainPierreDelegationResult } from "./parrain-pierre-delegation";
import type { LearningCandidate } from "../c1/clonechat-knowledge-types";
import type { ParrainAttachment } from "./parrain-attachment-types";
import type { ParrainHonesty, ParrainLink } from "./parrain-types";

export interface ParrainAnswer {
  readonly answer: string;
  readonly honesty: ParrainHonesty;
  readonly confidence: "high" | "medium" | "low";
  readonly category: AnswerCategory;
  readonly citations: readonly string[];
  readonly citationLabels: readonly string[];
  readonly relevantLinks: readonly ParrainLink[];
  readonly suggestedCTA: ParrainLink | null;
  readonly knownLimitations: readonly string[];
  readonly needsHumanEscalation: boolean;
  readonly supportArtifact: ParrainSupportArtifact | null;
  readonly learningCandidate: LearningCandidate | null;
  readonly pierreDelegation: ParrainPierreDelegationResult | null;
  readonly attachments: readonly ParrainAttachment[];
  readonly documentFindings: readonly string[];
  readonly usageTokens: number;
  readonly source: "openai_parrain" | "deterministic_parrain" | "vision_parrain";
}

/** Honnêteté serveur dérivée de la sortie modèle 3-valeurs + signaux serveur. */
export function deriveHonesty(
  model: CloneChatStructuredOutput["honesty"] | null,
  signals: { readonly citationsKept: number; readonly permissionDenied?: boolean; readonly unsupported?: boolean; readonly escalated?: boolean },
): ParrainHonesty {
  if (signals.permissionDenied) return "permission_denied";
  if (signals.unsupported) return "unsupported";
  if (signals.escalated) return "escalated";
  if (model === "needs_clarification") return "clarification_required";
  if (model === "unknown") return "source_missing";
  if (model === "answered") return signals.citationsKept > 0 ? "answered" : "partially_answered";
  return "source_missing";
}

/** Garde finale : toute réponse Parrain passe la politique de claims C1 (fail-closed). */
export function finalizeAnswerText(text: string): { readonly safeText: string; readonly violated: boolean } {
  const guarded = guardAnswerText(text);
  return { safeText: guarded.safeText, violated: !guarded.safe };
}
