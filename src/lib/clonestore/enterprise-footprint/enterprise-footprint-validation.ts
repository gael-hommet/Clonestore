// src/lib/clonestore/enterprise-footprint/enterprise-footprint-validation.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Validation
//
// Validation et sanitization de l'EnterpriseFootprint.
// Fonctions pures — aucun side effect.

import type {
  EnterpriseFootprint,
  EnterpriseFootprintPersistablePayload,
  EnterpriseFootprintValidationIssue,
  EnterpriseFootprintValidationReport,
} from "./enterprise-footprint-types";
import {
  ENTERPRISE_FOOTPRINT_UNSAFE_PATTERNS,
  ENTERPRISE_FOOTPRINT_REDACT_KEYS,
} from "./enterprise-footprint-types";

// ── Détection wording interdit ────────────────────────────────────────────────

export function detectUnsafeEnterpriseFootprintWording(
  text: string
): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const pattern of ENTERPRISE_FOOTPRINT_UNSAFE_PATTERNS) {
    if (lower.includes(pattern)) return pattern;
  }
  return null;
}

function detectSecretInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of ENTERPRISE_FOOTPRINT_REDACT_KEYS) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return null;
}

// ── Sanitize ──────────────────────────────────────────────────────────────────

export function sanitizeEnterpriseFootprint(
  footprint: EnterpriseFootprint
): EnterpriseFootprint {
  // Supprimer email des humains (PII)
  const sanitizedHumans = footprint.humans.map((h) => ({
    ...h,
    email: undefined,
  }));

  return {
    ...footprint,
    humans: sanitizedHumans,
    metadata: {
      ...footprint.metadata,
      sanitized: true,
    },
  };
}

// ── Assertion no sensitive leak ───────────────────────────────────────────────

export function assertEnterpriseFootprintNoSensitiveLeak(
  footprint: EnterpriseFootprint
): boolean {
  const text = JSON.stringify(footprint);
  if (text.includes("sk_live_") || text.includes("whsec_")) return false;
  for (const key of ENTERPRISE_FOOTPRINT_REDACT_KEYS) {
    if (text.toLowerCase().includes(key.toLowerCase())) return false;
  }
  return true;
}

// ── Validation principale ─────────────────────────────────────────────────────

export function validateEnterpriseFootprint(
  footprint: EnterpriseFootprint
): EnterpriseFootprintValidationReport {
  const issues: EnterpriseFootprintValidationIssue[] = [];

  // V01 — company_id requis
  if (!footprint.company_id || !footprint.company_id.trim()) {
    issues.push({ field: "company_id", message: "V01: company_id est requis", severity: "error" });
  }

  // V02 — company_name recommandé (warning)
  if (!footprint.company.company_name) {
    issues.push({ field: "company.company_name", message: "V02: company_name manquant", severity: "warning" });
  }

  // V03 — language recommandé
  if (!footprint.company.language) {
    issues.push({ field: "company.language", message: "V03: language manquant", severity: "warning" });
  }

  // V04 — timezone recommandé
  if (!footprint.company.timezone) {
    issues.push({ field: "company.timezone", message: "V04: timezone manquant", severity: "warning" });
  }

  // V05 — au moins un humain recommandé
  if (footprint.humans.length === 0) {
    issues.push({ field: "humans", message: "V05: aucun humain défini", severity: "warning" });
  }

  // V06 — au moins un approbateur recommandé
  if (footprint.humans.length > 0 && !footprint.humans.some((h) => h.is_approver)) {
    issues.push({ field: "humans", message: "V06: aucun approbateur défini", severity: "warning" });
  }

  // V07 — au moins une règle d'approbation recommandée
  if (footprint.approval_rules.length === 0) {
    issues.push({ field: "approval_rules", message: "V07: aucune règle d'approbation", severity: "warning" });
  }

  // V08 — email optionnel mais format basique si présent
  for (const human of footprint.humans) {
    if (human.email && !human.email.includes("@")) {
      issues.push({ field: `humans[${human.id}].email`, message: "V08: email invalide", severity: "warning" });
    }
  }

  // V09–V13 — pas de secrets
  const allText = JSON.stringify(footprint);
  if (allText.includes("sk_live_")) {
    issues.push({ field: "metadata", message: "V09: sk_live_ détecté — secret potentiel", severity: "error" });
  }
  if (allText.includes("whsec_")) {
    issues.push({ field: "metadata", message: "V10: whsec_ détecté — secret potentiel", severity: "error" });
  }
  if (allText.toLowerCase().includes("openai_api_key")) {
    issues.push({ field: "metadata", message: "V11: OPENAI_API_KEY détecté", severity: "error" });
  }
  if (allText.toLowerCase().includes("anthropic_api_key")) {
    issues.push({ field: "metadata", message: "V12: ANTHROPIC_API_KEY détecté", severity: "error" });
  }

  // V14–V18 — wording interdit
  if (allText.toLowerCase().includes("zéro erreur") || allText.toLowerCase().includes("zero erreur")) {
    issues.push({ field: "metadata", message: "V14: wording interdit 'zéro erreur'", severity: "error" });
  }
  if (allText.toLowerCase().includes("conformité garantie") || allText.toLowerCase().includes("conformite garantie")) {
    issues.push({ field: "metadata", message: "V15: wording interdit 'conformité garantie'", severity: "error" });
  }
  if (allText.toLowerCase().includes("clonevoice actif production")) {
    issues.push({ field: "metadata", message: "V16: wording interdit 'clonevoice actif production'", severity: "error" });
  }
  if (allText.toLowerCase().includes("public launch go")) {
    issues.push({ field: "metadata", message: "V17: wording interdit — lancement externe non validé", severity: "error" });
  }
  if (allText.toLowerCase().includes("configuration serveur confirmée")) {
    issues.push({ field: "metadata", message: "V18: wording interdit 'configuration serveur confirmée'", severity: "error" });
  }

  // V19 — secrets dans les champs texte
  const textFields = [
    footprint.company.company_name,
    footprint.company.description,
    footprint.company.industry,
  ];
  for (const field of textFields) {
    const secret = detectSecretInText(field);
    if (secret) {
      issues.push({ field: "company", message: `V19: secret potentiel "${secret}"`, severity: "warning" });
    }
  }

  // V20 — coverage_score 0–100
  if (footprint.coverage_score < 0 || footprint.coverage_score > 100) {
    issues.push({ field: "coverage_score", message: "V20: coverage_score hors bornes (0–100)", severity: "error" });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    issue_count: issues.length,
  };
}

// ── Validation payload persistable ────────────────────────────────────────────

export function validateEnterpriseFootprintPersistablePayload(
  payload: EnterpriseFootprintPersistablePayload
): EnterpriseFootprintValidationReport {
  const issues: EnterpriseFootprintValidationIssue[] = [];

  if (!payload.user_id || !payload.user_id.trim()) {
    issues.push({ field: "user_id", message: "user_id obligatoire pour persistence serveur", severity: "error" });
  }

  const footprintReport = validateEnterpriseFootprint({
    ...payload,
    id: `persist:${payload.company_id}`,
    read_only: false,
    // cloneadn_summary exclu du payload — fournir un défaut pour validation
    cloneadn_summary: {
      tone: null, operating_rules_count: 0, approval_rules_count: 0,
      humans_count: 0, documents_count: 0, technologies_count: 0, coverage_score: 0, warnings: [],
    },
  } as EnterpriseFootprint);

  return {
    valid: issues.length === 0 && footprintReport.valid,
    issues: [...issues, ...footprintReport.issues],
    issue_count: issues.length + footprintReport.issue_count,
  };
}
