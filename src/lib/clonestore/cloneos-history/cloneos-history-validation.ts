// src/lib/clonestore/cloneos-history/cloneos-history-validation.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Validation
//
// 21 règles de validation pour CloneOSHistoryItem et les payloads persistables.
// Ces fonctions sont pures — aucun side effect.

import type {
  CloneOSHistoryItem,
  CloneOSHistoryPersistablePayload,
  CloneOSHistoryValidationIssue,
  CloneOSHistoryValidationReport,
} from "./cloneos-history-types";
import {
  CLONEOS_HISTORY_MAX_SUMMARY_LENGTH,
  CLONEOS_HISTORY_UNSAFE_PATTERNS,
  CLONEOS_HISTORY_REDACT_KEYS,
} from "./cloneos-history-types";

// ── Statuts et domaines valides ───────────────────────────────────────────────

const VALID_STATUSES = new Set([
  "received", "classified", "routed", "planned", "guarded",
  "trace_ready", "ready_for_execution", "requires_validation",
  "blocked", "refused", "failed", "unknown",
]);

const VALID_DOMAINS = new Set([
  "hr", "support", "finance", "admin", "legal",
  "sales", "marketing", "ops", "engineering", "general", "unknown",
]);

const VALID_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

// ── Détection de secrets ──────────────────────────────────────────────────────

export function detectUnsafeCloneOSHistoryWording(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const pattern of CLONEOS_HISTORY_UNSAFE_PATTERNS) {
    if (lower.includes(pattern)) return pattern;
  }
  return null;
}

function detectSecretInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of CLONEOS_HISTORY_REDACT_KEYS) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return null;
}

// ── Validation d'un item ──────────────────────────────────────────────────────
// 21 règles numérotées (V01 → V21)

export function validateCloneOSHistoryItem(
  item: CloneOSHistoryItem
): CloneOSHistoryValidationReport {
  const issues: CloneOSHistoryValidationIssue[] = [];

  // V01 — command_id non vide
  if (!item.command_id || !item.command_id.trim()) {
    issues.push({ field: "command_id", message: "V01: command_id est requis et non vide", severity: "error" });
  }

  // V02 — company_id non vide
  if (!item.company_id || !item.company_id.trim()) {
    issues.push({ field: "company_id", message: "V02: company_id est requis", severity: "error" });
  }

  // V03 — status valide
  if (!VALID_STATUSES.has(item.status)) {
    issues.push({ field: "status", message: `V03: status invalide: "${item.status}"`, severity: "error" });
  }

  // V04 — domain valide ou unknown
  if (!VALID_DOMAINS.has(item.domain)) {
    issues.push({ field: "domain", message: `V04: domain invalide: "${item.domain}"`, severity: "warning" });
  }

  // V05 — intent présent
  if (!item.intent || !item.intent.trim()) {
    issues.push({ field: "intent", message: "V05: intent est requis", severity: "error" });
  }

  // V06 — risk_level valide
  if (!VALID_RISK_LEVELS.has(item.risk_level)) {
    issues.push({ field: "risk_level", message: `V06: risk_level invalide: "${item.risk_level}"`, severity: "error" });
  }

  // V07 — raw_request_summary ≤ 280 chars (warning si dépassé, error si > 500)
  const summaryLen = (item.raw_request_summary ?? "").length;
  if (summaryLen === 0) {
    issues.push({ field: "raw_request_summary", message: "V07: raw_request_summary est vide", severity: "error" });
  } else if (summaryLen > 500) {
    issues.push({ field: "raw_request_summary", message: `V07: raw_request_summary trop long (${summaryLen} chars, max 500)`, severity: "error" });
  } else if (summaryLen > CLONEOS_HISTORY_MAX_SUMMARY_LENGTH) {
    issues.push({ field: "raw_request_summary", message: `V07: raw_request_summary dépasse 280 chars (${summaryLen})`, severity: "warning" });
  }

  // V08 — read_only = true
  if (item.read_only !== true) {
    issues.push({ field: "read_only", message: "V08: read_only doit être true pour affichage UI", severity: "error" });
  }

  // V09 — pas de secret dans raw_request_summary
  const secretInSummary = detectSecretInText(item.raw_request_summary ?? "");
  if (secretInSummary) {
    issues.push({ field: "raw_request_summary", message: `V09: secret potentiel détecté : "${secretInSummary}"`, severity: "error" });
  }

  // V10 — pas de sk_live_
  const allText = JSON.stringify(item);
  if (allText.toLowerCase().includes("sk_live_")) {
    issues.push({ field: "metadata", message: "V10: sk_live_ détecté — clé Stripe live interdite", severity: "error" });
  }

  // V11 — pas de whsec_
  if (allText.toLowerCase().includes("whsec_")) {
    issues.push({ field: "metadata", message: "V11: whsec_ détecté — webhook secret interdit", severity: "error" });
  }

  // V12 — pas de OPENAI_API_KEY
  if (allText.toLowerCase().includes("openai_api_key")) {
    issues.push({ field: "metadata", message: "V12: OPENAI_API_KEY détectée", severity: "error" });
  }

  // V13 — pas de ANTHROPIC_API_KEY
  if (allText.toLowerCase().includes("anthropic_api_key")) {
    issues.push({ field: "metadata", message: "V13: ANTHROPIC_API_KEY détectée", severity: "error" });
  }

  // V14 — raw_request_summary pas trop long (raw_request complet interdit)
  // déjà couvert en V07 — vérification complémentaire
  if (summaryLen > 280) {
    issues.push({ field: "raw_request_summary", message: "V14: résumé trop long — ne pas stocker la demande complète si sensible", severity: "warning" });
  }

  // V15 — pas de public launch GO
  const unsafeWording = detectUnsafeCloneOSHistoryWording(allText);
  if (unsafeWording === "public launch go") {
    issues.push({ field: "metadata", message: "V15: wording interdit : 'public launch go'", severity: "error" });
  }

  // V16 — pas de zéro erreur
  if (detectUnsafeCloneOSHistoryWording(allText)?.includes("zéro erreur") ||
      detectUnsafeCloneOSHistoryWording(allText)?.includes("zero erreur")) {
    issues.push({ field: "metadata", message: "V16: wording interdit : 'zéro erreur'", severity: "error" });
  }

  // V17 — pas de conformité garantie
  if (allText.toLowerCase().includes("conformité garantie") ||
      allText.toLowerCase().includes("conformite garantie")) {
    issues.push({ field: "metadata", message: "V17: wording interdit : 'conformité garantie'", severity: "error" });
  }

  // V18 — pas de CloneVoice actif production
  if (allText.toLowerCase().includes("clonevoice actif production")) {
    issues.push({ field: "metadata", message: "V18: wording interdit : 'CloneVoice actif production'", severity: "error" });
  }

  // V19 — pas de "mission exécutée" si plan-only
  if (allText.toLowerCase().includes("mission exécutée avec succès")) {
    issues.push({ field: "metadata", message: "V19: 'mission exécutée avec succès' interdit si plan-only", severity: "error" });
  }

  // V20 — pas de "document généré" si prévu seulement
  if (allText.toLowerCase().includes("document généré avec succès")) {
    issues.push({ field: "metadata", message: "V20: 'document généré avec succès' interdit si prévu seulement", severity: "error" });
  }

  // V21 — pas de "email envoyé" si prévu seulement
  if (allText.toLowerCase().includes("email envoyé avec succès")) {
    issues.push({ field: "metadata", message: "V21: 'email envoyé avec succès' interdit si prévu seulement", severity: "error" });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    issue_count: issues.length,
  };
}

// ── Validation en lot ─────────────────────────────────────────────────────────

export function validateCloneOSHistoryItems(
  items: CloneOSHistoryItem[]
): CloneOSHistoryValidationReport {
  const allIssues: CloneOSHistoryValidationIssue[] = [];
  for (const item of items) {
    const report = validateCloneOSHistoryItem(item);
    allIssues.push(...report.issues.map((issue) => ({
      ...issue,
      field: `[${item.command_id}].${issue.field}`,
    })));
  }
  return {
    valid: allIssues.filter((i) => i.severity === "error").length === 0,
    issues: allIssues,
    issue_count: allIssues.length,
  };
}

// ── Validation payload persistable ───────────────────────────────────────────

export function validateCloneOSHistoryPersistablePayload(
  payload: CloneOSHistoryPersistablePayload
): CloneOSHistoryValidationReport {
  const issues: CloneOSHistoryValidationIssue[] = [];

  // user_id obligatoire pour persistence serveur
  if (!payload.user_id || !payload.user_id.trim()) {
    issues.push({ field: "user_id", message: "user_id est obligatoire pour la persistence serveur", severity: "error" });
  }

  // Réutiliser les validations item (sous-type partiel)
  const itemReport = validateCloneOSHistoryItem({
    ...payload,
    id: `persist:${payload.command_id}`,
    source: "server",
    read_only: true,
  });

  return {
    valid: issues.length === 0 && itemReport.valid,
    issues: [...issues, ...itemReport.issues],
    issue_count: issues.length + itemReport.issue_count,
  };
}

// ── Assertion UI read-only ────────────────────────────────────────────────────

export function assertCloneOSHistoryReadOnlyForUI(
  items: CloneOSHistoryItem[]
): boolean {
  return items.every((item) => item.read_only === true);
}
