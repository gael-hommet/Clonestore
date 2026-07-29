// src/lib/clonechat/brain/parse.ts
//
// PARSING SÛR de la décision proposée par le modèle + VALIDATION STRICTE de la décision finale.
// Le modèle ne peut influencer QUE de la prose (answer / clarificationQuestion / intent). Toute
// autre valeur (route, action, permission, confirmation, escalade, truthIds…) est ignorée : le
// modèle n'est jamais l'autorité. Une entrée invalide/incomplète n'altère jamais la décision
// déterministe et ne produit JAMAIS un faux succès.

import { BRAIN_DECISION_VERSION, type BrainDecision, type BrainMode } from "./types";

const VALID_MODES: ReadonlySet<BrainMode> = new Set<BrainMode>([
  "answer", "explain", "orient", "diagnose", "guide", "act", "escalate", "clarify",
]);

/** Extrait sûrement les seules PROSES exploitables d'une décision modèle (jamais l'autorité). */
export interface ModelProse {
  readonly answer?: string;
  readonly clarificationQuestion?: string;
  readonly intent?: string;
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null; // JSON invalide → ignoré, jamais d'exception, jamais de faux succès
    }
  }
  return null;
}

function cleanString(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length === 0) return undefined;
  return t.slice(0, maxLen);
}

/** Récupère UNIQUEMENT la prose sûre d'une décision modèle. Tout le reste est ignoré. */
export function extractModelProse(raw: unknown): ModelProse {
  const obj = asObject(raw);
  if (!obj) return {};
  return {
    answer: cleanString(obj.answer, 4000),
    clarificationQuestion: cleanString(obj.clarificationQuestion ?? obj.clarification_question, 500),
    intent: cleanString(obj.intent, 120),
  };
}

// ── VALIDATION STRICTE de la décision finale ─────────────────────────────────

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/**
 * Valide qu'une BrainDecision est bien formée et cohérente. Sert de garde d'invariants : une
 * décision qui ne passe pas ne doit jamais être servie (le Brain renvoie alors une décision sûre).
 */
export function validateBrainDecision(d: unknown): ValidationResult {
  const errors: string[] = [];
  const o = d as Partial<BrainDecision> | null;
  if (!o || typeof o !== "object") return { ok: false, errors: ["not_an_object"] };

  if (o.version !== BRAIN_DECISION_VERSION) errors.push("bad_version");
  if (typeof o.mode !== "string" || !VALID_MODES.has(o.mode as BrainMode)) errors.push("bad_mode");
  if (typeof o.intent !== "string" || o.intent.length === 0) errors.push("bad_intent");
  if (typeof o.answer !== "string") errors.push("bad_answer");
  if (!["high", "medium", "low"].includes(o.confidence as string)) errors.push("bad_confidence");
  if (typeof o.needsClarification !== "boolean") errors.push("bad_needsClarification");
  if (o.clarificationQuestion !== null && typeof o.clarificationQuestion !== "string") errors.push("bad_clarificationQuestion");
  if (!Array.isArray(o.truthIds)) errors.push("bad_truthIds");
  if (o.suggestedRoute !== null && typeof o.suggestedRoute !== "string") errors.push("bad_suggestedRoute");
  if (typeof o.requiresAccountContext !== "boolean") errors.push("bad_requiresAccountContext");
  if (typeof o.requiresConfirmation !== "boolean") errors.push("bad_requiresConfirmation");
  if (typeof o.requiresEscalation !== "boolean") errors.push("bad_requiresEscalation");
  if (!Array.isArray(o.limitations)) errors.push("bad_limitations");
  if (!Array.isArray(o.evidence)) errors.push("bad_evidence");

  // Invariants croisés.
  if (o.mode === "clarify" && o.needsClarification !== true) errors.push("clarify_requires_needsClarification");
  if (o.needsClarification === true && !o.clarificationQuestion) errors.push("needsClarification_requires_question");
  if (o.mode === "act") {
    if (!o.requestedAction) errors.push("act_requires_requestedAction");
    else if (o.requestedAction.executed !== false) errors.push("act_never_executed");
    if (o.requiresConfirmation !== true) errors.push("act_requires_confirmation");
  }
  if (o.mode === "escalate" && o.requiresEscalation !== true) errors.push("escalate_requires_requiresEscalation");
  // Une route suggérée doit être un chemin (jamais une URL absolue inventée).
  if (typeof o.suggestedRoute === "string" && !o.suggestedRoute.startsWith("/")) errors.push("route_not_a_path");

  return { ok: errors.length === 0, errors };
}
