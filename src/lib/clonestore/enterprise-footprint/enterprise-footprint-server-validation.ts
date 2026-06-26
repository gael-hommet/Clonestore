// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-validation.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Validation Serveur
//
// Valide et sanitise les payloads avant persistence serveur.
//
// INVARIANTS :
//   - jamais de write
//   - pas d'import Supabase client
//   - pas de service role
//   - jamais de throw brut
//   - validation déterministe

import type {
  EnterpriseFootprintServerPayload,
  EnterpriseFootprintServerRow,
  EnterpriseFootprintServerStatus,
  EnterpriseFootprintServerSource,
} from "./enterprise-footprint-server-types";
import {
  ENTERPRISE_FOOTPRINT_SERVER_VALID_STATUSES,
  ENTERPRISE_FOOTPRINT_SERVER_VALID_SOURCES,
} from "./enterprise-footprint-server-schema";

// ── Patterns interdits ────────────────────────────────────────────────────────
// Interdit dans tout texte persisté côté serveur.

const UNSAFE_SERVER_PATTERNS: Array<{ pattern: string; reason: string }> = [
  { pattern: "sk_live_",            reason: "Clé Stripe live détectée" },
  { pattern: "whsec_",              reason: "Webhook secret Stripe détecté" },
  { pattern: "OPENAI_API_KEY",      reason: "Clé API OpenAI détectée" },
  { pattern: "ANTHROPIC_API_KEY",   reason: "Clé API Anthropic détectée" },
  { pattern: "public launch go",    reason: "Phrase de lancement public interdite" },
  { pattern: "zéro erreur",         reason: "Formulation absolue interdite" },
  { pattern: "zero erreur",         reason: "Formulation absolue interdite" },
  { pattern: "conformité garantie", reason: "Formulation de garantie interdite" },
  { pattern: "conformite garantie", reason: "Formulation de garantie interdite" },
  { pattern: "CloneVoice actif production", reason: "Formulation produit interdite" },
];

export type EnterpriseFootprintServerValidationResult = {
  valid: boolean;
  issues: string[];
};

// ── Détection contenu dangereux ────────────────────────────────────────────────

export function detectUnsafeEnterpriseFootprintServerText(
  text: string
): { safe: boolean; reason: string | null } {
  if (!text?.trim()) return { safe: true, reason: null };
  const lowered = text.toLowerCase();
  for (const { pattern, reason } of UNSAFE_SERVER_PATTERNS) {
    if (lowered.includes(pattern.toLowerCase())) {
      return { safe: false, reason };
    }
  }
  return { safe: true, reason: null };
}

// ── Validation payload ────────────────────────────────────────────────────────

export function validateEnterpriseFootprintServerPayload(
  payload: EnterpriseFootprintServerPayload | null
): EnterpriseFootprintServerValidationResult {
  const issues: string[] = [];

  if (!payload) {
    return { valid: false, issues: ["Payload absent."] };
  }

  if (!payload.user_id?.trim()) {
    issues.push("user_id requis.");
  }

  if (!payload.company_id?.trim()) {
    issues.push("company_id requis.");
  }

  if (!payload.footprint) {
    issues.push("footprint requis.");
  }

  if (!payload.source) {
    issues.push("source requis.");
  } else if (!ENTERPRISE_FOOTPRINT_SERVER_VALID_SOURCES.includes(
    payload.source as EnterpriseFootprintServerSource
  )) {
    issues.push(`source invalide: "${payload.source}".`);
  }

  // Vérification contenu dangereux dans company_name
  const companyName = payload.footprint?.company?.company_name ?? "";
  if (companyName) {
    const check = detectUnsafeEnterpriseFootprintServerText(companyName);
    if (!check.safe) {
      issues.push(`Contenu dangereux dans company_name: ${check.reason}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

// ── Validation row ────────────────────────────────────────────────────────────

export function validateEnterpriseFootprintServerRow(
  row: Partial<EnterpriseFootprintServerRow>
): EnterpriseFootprintServerValidationResult {
  const issues: string[] = [];

  if (!row.user_id?.trim()) issues.push("user_id requis.");
  if (!row.company_id?.trim()) issues.push("company_id requis.");

  if (row.coverage_score !== undefined) {
    if (row.coverage_score < 0 || row.coverage_score > 100) {
      issues.push("coverage_score doit être entre 0 et 100.");
    }
  }

  if (row.readiness_score !== undefined) {
    if (row.readiness_score < 0 || row.readiness_score > 100) {
      issues.push("readiness_score doit être entre 0 et 100.");
    }
  }

  if (row.status && !ENTERPRISE_FOOTPRINT_SERVER_VALID_STATUSES.includes(
    row.status as EnterpriseFootprintServerStatus
  )) {
    issues.push(`status invalide: "${row.status}".`);
  }

  if (row.source && !ENTERPRISE_FOOTPRINT_SERVER_VALID_SOURCES.includes(
    row.source as EnterpriseFootprintServerSource
  )) {
    issues.push(`source invalide: "${row.source}".`);
  }

  return { valid: issues.length === 0, issues };
}

// ── Sanitisation payload ──────────────────────────────────────────────────────

export function sanitizeEnterpriseFootprintServerPayload(
  payload: EnterpriseFootprintServerPayload
): EnterpriseFootprintServerPayload {
  return {
    ...payload,
    company_id: payload.company_id?.trim() ?? "",
    user_id: payload.user_id?.trim() ?? "",
    local_updated_at: payload.local_updated_at ?? null,
    metadata: payload.metadata ?? {},
  };
}

// ── Assertion no sensitive leak ───────────────────────────────────────────────

export type EnterpriseFootprintServerLeakCheckResult = {
  safe: boolean;
  issues: string[];
};

export function assertEnterpriseFootprintServerNoSensitiveLeak(
  payload: EnterpriseFootprintServerPayload
): EnterpriseFootprintServerLeakCheckResult {
  const issues: string[] = [];

  // Vérifier dans les métadonnées
  const metaStr = JSON.stringify(payload.metadata ?? {}).toLowerCase();
  for (const { pattern, reason } of UNSAFE_SERVER_PATTERNS) {
    if (metaStr.includes(pattern.toLowerCase())) {
      issues.push(`Donnée sensible dans metadata: ${reason}`);
    }
  }

  // Vérifier dans les champs texte de l'empreinte
  const footprintStr = JSON.stringify(payload.footprint ?? {}).toLowerCase();
  for (const { pattern, reason } of UNSAFE_SERVER_PATTERNS) {
    if (footprintStr.includes(pattern.toLowerCase())) {
      issues.push(`Donnée sensible dans footprint: ${reason}`);
    }
  }

  return { safe: issues.length === 0, issues };
}
