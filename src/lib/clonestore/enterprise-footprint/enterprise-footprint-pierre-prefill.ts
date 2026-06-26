// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-prefill.ts
// PHASE 3.12 — Pierre Use Mission Composer Footprint Prefill QA
//
// Helper pur pour le préremplissage du composer Pierre depuis les suggestions
// de l'Empreinte Entreprise.
//
// INVARIANTS ABSOLUS :
//   - plan_only: true invariant — refus de tout payload sans plan_only: true
//   - requires_user_submit: true invariant — jamais d'auto-submit
//   - aucun appel API
//   - aucun write DB
//   - aucun import src/lib/pierre/**
//   - pas de réseau
//   - helper pur — résultats déterministes

import type { PierreUseFootprintMissionSuggestion } from "./enterprise-footprint-pierre-use";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierreFootprintPrefillSource = "enterprise_footprint_suggestion";

export type PierreFootprintPrefillStatus =
  | "valid"          // payload prêt à préremplir le composer
  | "disabled"       // suggestion désactivée, préremplissage interdit
  | "invalid_prompt" // prompt vide ou invalide
  | "unsafe_content" // contenu dangereux détecté
  | "missing_plan_only"; // plan_only !== true

/** Payload transmis au composer pour préremplissage. Jamais auto-soumis. */
export type PierreFootprintPrefillPayload = {
  prompt: string;
  suggestion_id: string;
  title: string;
  source: PierreFootprintPrefillSource;
  plan_only: true;             // invariant — toujours true
  requires_user_submit: true;  // invariant — jamais d'auto-submit
  created_at: string;
};

export type PierreFootprintPrefillGuard = {
  allowed: boolean;
  reason: string | null;
  status: PierreFootprintPrefillStatus;
};

export type PierreFootprintPrefillResult = {
  valid: boolean;
  status: PierreFootprintPrefillStatus;
  issues: string[];
};

export type PierreFootprintPrefillConfirmation = {
  message: string;
  sub_message: string;
  tone: "success" | "warning" | "neutral";
};

// ── Patterns interdits dans les prompts ───────────────────────────────────────
// Protège contre l'injection de clés API, phrases interdites, etc.

const UNSAFE_PATTERNS: Array<{ pattern: string; reason: string }> = [
  { pattern: "sk_live_",           reason: "Clé Stripe live détectée" },
  { pattern: "whsec_",             reason: "Webhook secret Stripe détecté" },
  { pattern: "OPENAI_API_KEY",     reason: "Clé API OpenAI détectée" },
  { pattern: "ANTHROPIC_API_KEY",  reason: "Clé API Anthropic détectée" },
  { pattern: "public launch go",   reason: "Phrase de lancement public interdite" },
  { pattern: "zéro erreur",        reason: "Formulation interdite" },
  { pattern: "zero erreur",        reason: "Formulation interdite" },
  { pattern: "conformité garantie", reason: "Formulation interdite" },
];

// ── Guards et validators ───────────────────────────────────────────────────────

/** Vérifie qu'une suggestion est autorisée à préremplir le composer. */
export function shouldAllowPierreFootprintPrefill(
  suggestion: PierreUseFootprintMissionSuggestion
): PierreFootprintPrefillGuard {
  if (suggestion.disabled) {
    return {
      allowed: false,
      reason: suggestion.disabled_reason ?? "Suggestion désactivée.",
      status: "disabled",
    };
  }

  if (!suggestion.plan_only) {
    return {
      allowed: false,
      reason: "plan_only doit être true pour le préremplissage.",
      status: "missing_plan_only",
    };
  }

  if (!suggestion.prompt?.trim()) {
    return {
      allowed: false,
      reason: "Prompt vide — préremplissage interdit.",
      status: "invalid_prompt",
    };
  }

  const unsafeHit = UNSAFE_PATTERNS.find((p) =>
    suggestion.prompt.toLowerCase().includes(p.pattern.toLowerCase())
  );
  if (unsafeHit) {
    return {
      allowed: false,
      reason: unsafeHit.reason,
      status: "unsafe_content",
    };
  }

  return { allowed: true, reason: null, status: "valid" };
}

/** Explication lisible si le préremplissage est interdit. */
export function explainPierreFootprintPrefillDisabled(
  suggestion: PierreUseFootprintMissionSuggestion
): string {
  const guard = shouldAllowPierreFootprintPrefill(suggestion);
  if (guard.allowed) return "";
  return guard.reason ?? "Préremplissage non disponible pour cette suggestion.";
}

// ── Builder payload ───────────────────────────────────────────────────────────

/** Construit un payload de préremplissage. Retourne null si non autorisé. */
export function buildPierreFootprintPrefillPayload(
  suggestion: PierreUseFootprintMissionSuggestion
): PierreFootprintPrefillPayload | null {
  const guard = shouldAllowPierreFootprintPrefill(suggestion);
  if (!guard.allowed) return null;

  return {
    prompt: sanitizePierreFootprintPrefillPrompt(suggestion.prompt),
    suggestion_id: suggestion.id,
    title: suggestion.title,
    source: "enterprise_footprint_suggestion",
    plan_only: true,
    requires_user_submit: true,
    created_at: new Date().toISOString(),
  };
}

// ── Sanitization ──────────────────────────────────────────────────────────────

/** Sanitise un prompt avant préremplissage. Retrait d'espaces excessifs, trim. */
export function sanitizePierreFootprintPrefillPrompt(prompt: string): string {
  if (!prompt?.trim()) return "";
  // Trim + réduction des espaces multiples + suppression de newlines excessifs
  return prompt
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{3,}/g, " ");
}

// ── Validation ────────────────────────────────────────────────────────────────

/** Valide un payload avant de l'envoyer au composer. */
export function validatePierreFootprintPrefillPayload(
  payload: PierreFootprintPrefillPayload | null
): PierreFootprintPrefillResult {
  const issues: string[] = [];

  if (!payload) {
    return {
      valid: false,
      status: "invalid_prompt",
      issues: ["Payload absent."],
    };
  }

  // Invariants obligatoires
  if (payload.plan_only !== true) {
    issues.push("plan_only doit être true.");
  }

  if (payload.requires_user_submit !== true) {
    issues.push("requires_user_submit doit être true.");
  }

  if (payload.source !== "enterprise_footprint_suggestion") {
    issues.push("source invalide.");
  }

  // Prompt checks
  if (!payload.prompt?.trim()) {
    issues.push("Prompt vide.");
    return { valid: false, status: "invalid_prompt", issues };
  }

  // Unsafe patterns
  for (const { pattern, reason } of UNSAFE_PATTERNS) {
    if (payload.prompt.toLowerCase().includes(pattern.toLowerCase())) {
      issues.push(reason);
      return { valid: false, status: "unsafe_content", issues };
    }
  }

  if (issues.length > 0) {
    return { valid: false, status: "missing_plan_only", issues };
  }

  return { valid: true, status: "valid", issues: [] };
}

// ── Confirmation ──────────────────────────────────────────────────────────────

/** Construit la confirmation à afficher après préremplissage. */
export function buildPierreFootprintPrefillConfirmation(
  payload: PierreFootprintPrefillPayload
): PierreFootprintPrefillConfirmation {
  return {
    message: "Suggestion ajoutée au composer — relisez puis envoyez manuellement.",
    sub_message: "Préremplit uniquement le composer. Aucun envoi automatique.",
    tone: "success",
  };
}
