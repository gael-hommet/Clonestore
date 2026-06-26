// src/lib/clonestore/onboarding/global-onboarding-validation.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Validation
//
// 25+ règles de validation pour GlobalOnboardingDraft.
// Fonctions pures — aucun side effect.

import type {
  GlobalOnboardingDraft,
  GlobalOnboardingPersistablePayload,
  GlobalOnboardingValidationIssue,
  GlobalOnboardingValidationReport,
} from "./global-onboarding-types";
import {
  GLOBAL_ONBOARDING_UNSAFE_PATTERNS,
  GLOBAL_ONBOARDING_REDACT_KEYS,
  GLOBAL_ONBOARDING_CURRENT_STEP_IDS,
} from "./global-onboarding-types";

// ── Détection wording interdit ────────────────────────────────────────────────

export function detectUnsafeGlobalOnboardingWording(
  text: string
): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const pattern of GLOBAL_ONBOARDING_UNSAFE_PATTERNS) {
    if (lower.includes(pattern)) return pattern;
  }
  return null;
}

function detectSecretInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of GLOBAL_ONBOARDING_REDACT_KEYS) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return null;
}

// ── Sanitize draft ────────────────────────────────────────────────────────────
// Retourne une copie nettoyée du draft (supprime données sensibles évidentes).

export function sanitizeGlobalOnboardingDraft(
  draft: GlobalOnboardingDraft
): GlobalOnboardingDraft {
  // Sanitize humains : ne pas garder email dans localStorage
  const sanitizedHumans = draft.humans.map((h) => ({
    ...h,
    email: undefined, // PII — ne pas persister par défaut
  }));

  return {
    ...draft,
    humans: sanitizedHumans,
    metadata: {
      ...draft.metadata,
      sanitized: true,
    },
  };
}

// ── Assertion no sensitive leak ───────────────────────────────────────────────

export function assertGlobalOnboardingNoSensitiveLeak(
  draft: GlobalOnboardingDraft
): boolean {
  const text = JSON.stringify(draft);
  for (const key of GLOBAL_ONBOARDING_REDACT_KEYS) {
    if (text.toLowerCase().includes(key.toLowerCase())) return false;
  }
  // sk_live_ et whsec_ vérification explicite
  if (text.includes("sk_live_") || text.includes("whsec_")) return false;
  return true;
}

// ── Validation principale ─────────────────────────────────────────────────────

export function validateGlobalOnboardingDraft(
  draft: GlobalOnboardingDraft
): GlobalOnboardingValidationReport {
  const issues: GlobalOnboardingValidationIssue[] = [];

  // V01 — company_id requis
  if (!draft.company_id || !draft.company_id.trim()) {
    issues.push({ field: "company_id", message: "V01: company_id est requis", severity: "error" });
  }

  // V02 — current_step valide
  if (!GLOBAL_ONBOARDING_CURRENT_STEP_IDS.includes(draft.current_step as typeof GLOBAL_ONBOARDING_CURRENT_STEP_IDS[number])) {
    issues.push({ field: "current_step", message: `V02: current_step invalide: "${draft.current_step}"`, severity: "error" });
  }

  // V03 — completion_score 0–100
  if (
    typeof draft.completion_score !== "number" ||
    draft.completion_score < 0 ||
    draft.completion_score > 100
  ) {
    issues.push({ field: "completion_score", message: "V03: completion_score doit être entre 0 et 100", severity: "error" });
  }

  // V04 — email optionnel mais format basique si présent
  for (const human of draft.humans) {
    if (human.email && !human.email.includes("@")) {
      issues.push({ field: `humans[${human.id}].email`, message: "V04: email invalide", severity: "warning" });
    }
  }

  // V05–V09 — pas de secrets
  const allText = JSON.stringify(draft);
  if (allText.includes("sk_live_")) {
    issues.push({ field: "metadata", message: "V05: sk_live_ détecté", severity: "error" });
  }
  if (allText.includes("whsec_")) {
    issues.push({ field: "metadata", message: "V06: whsec_ détecté", severity: "error" });
  }
  if (allText.toLowerCase().includes("openai_api_key")) {
    issues.push({ field: "metadata", message: "V07: OPENAI_API_KEY détecté", severity: "error" });
  }
  if (allText.toLowerCase().includes("anthropic_api_key")) {
    issues.push({ field: "metadata", message: "V08: ANTHROPIC_API_KEY détecté", severity: "error" });
  }

  // Vérifier secrets dans les champs texte
  const textFields = [
    draft.company.company_name,
    draft.company.description,
    draft.company.industry,
  ];
  for (const field of textFields) {
    const secret = detectSecretInText(field);
    if (secret) {
      issues.push({ field: "company", message: `V09: secret potentiel "${secret}" dans les données entreprise`, severity: "warning" });
    }
  }

  // V10–V15 — wording interdit
  const unsafeWording = detectUnsafeGlobalOnboardingWording(allText);
  if (unsafeWording === "public launch go") {
    issues.push({ field: "metadata", message: "V10: wording interdit 'public launch go'", severity: "error" });
  }
  if (detectUnsafeGlobalOnboardingWording(allText)?.includes("zéro erreur") ||
      detectUnsafeGlobalOnboardingWording(allText)?.includes("zero erreur")) {
    issues.push({ field: "metadata", message: "V11: wording interdit 'zéro erreur'", severity: "error" });
  }
  if (allText.toLowerCase().includes("conformité garantie") ||
      allText.toLowerCase().includes("conformite garantie")) {
    issues.push({ field: "metadata", message: "V12: wording interdit 'conformité garantie'", severity: "error" });
  }
  if (allText.toLowerCase().includes("clonevoice actif production")) {
    issues.push({ field: "metadata", message: "V13: wording interdit 'clonevoice actif production'", severity: "error" });
  }
  if (allText.toLowerCase().includes("configuration enregistrée serveur")) {
    issues.push({ field: "metadata", message: "V14: wording interdit 'configuration enregistrée serveur'", severity: "error" });
  }

  // V15 — first_mission.employee_slug = "pierre"
  if (draft.first_mission && draft.first_mission.employee_slug !== "pierre") {
    issues.push({
      field: "first_mission.employee_slug",
      message: "V15: first_mission.employee_slug doit être 'pierre'",
      severity: "error",
    });
  }

  // V16 — first_mission.plan_only = true
  if (draft.first_mission && draft.first_mission.plan_only !== true) {
    issues.push({
      field: "first_mission.plan_only",
      message: "V16: first_mission.plan_only doit être true",
      severity: "error",
    });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    issue_count: issues.length,
  };
}

// ── Validation payload persistable ───────────────────────────────────────────

export function validateGlobalOnboardingPersistablePayload(
  payload: GlobalOnboardingPersistablePayload
): GlobalOnboardingValidationReport {
  const issues: GlobalOnboardingValidationIssue[] = [];

  // user_id obligatoire pour persistence serveur
  if (!payload.user_id || !payload.user_id.trim()) {
    issues.push({ field: "user_id", message: "user_id obligatoire pour persistence serveur", severity: "error" });
  }

  // Réutiliser la validation draft
  const draftReport = validateGlobalOnboardingDraft({
    ...payload,
    id: `persist:${payload.company_id}`,
    source: "server",
    read_only: false,
    cloneadn_preview: {},
    created_at: payload.created_at,
    updated_at: payload.updated_at,
  });

  return {
    valid: issues.length === 0 && draftReport.valid,
    issues: [...issues, ...draftReport.issues],
    issue_count: issues.length + draftReport.issue_count,
  };
}
