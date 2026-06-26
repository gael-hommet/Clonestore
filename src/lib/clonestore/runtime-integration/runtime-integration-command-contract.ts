// src/lib/clonestore/runtime-integration/runtime-integration-command-contract.ts
// PHASE 4.1 — Runtime Operational Integration — Command Contract
//
// Module pur. Construit/normalise/valide une commande CloneOS → runtime.
// Pas de Supabase, pas d'API, pas de DB, pas d'import Pierre. Pas de throw brut.

import type {
  RuntimeIntegrationCommand,
  RuntimeIntegrationCommandSource,
  RuntimeIntegrationIssue,
  RuntimeIntegrationRecommendation,
} from "./runtime-integration-types";

// ── Patterns interdits (détection — jamais des secrets réels) ─────────────────

export const RUNTIME_INTEGRATION_FORBIDDEN_PATTERNS: string[] = [
  "sk_live_",
  "whsec_",
  "openai_api_key",
  "anthropic_api_key",
  "supabase_service_role_key",
  "private_key",
  "secret_key",
  "bearer token",
  "public launch go",
  "zéro erreur",
  "conformité garantie",
];

export function detectRuntimeIntegrationUnsafeText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  return RUNTIME_INTEGRATION_FORBIDDEN_PATTERNS.filter((p) => lower.includes(p));
}

// ── Normalisation texte ───────────────────────────────────────────────────────

export function normalizeRuntimeIntegrationCommandText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

// ── ID generator (non-crypto, déterministe-ish) ───────────────────────────────

export function generateRuntimeIntegrationCommandId(rawText: string): string {
  const normalized = normalizeRuntimeIntegrationCommandText(rawText).toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  const hashPart = Math.abs(hash).toString(36);
  return `rtcmd_${hashPart}`;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export type RuntimeIntegrationCommandInput = {
  raw_text: string;
  source?: RuntimeIntegrationCommandSource;
  user_id?: string;
  company_id?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
};

export function buildRuntimeIntegrationCommand(
  input: RuntimeIntegrationCommandInput
): RuntimeIntegrationCommand {
  const rawText = normalizeRuntimeIntegrationCommandText(input?.raw_text ?? "");
  return {
    command_id: generateRuntimeIntegrationCommandId(rawText),
    source: input?.source ?? "simulation",
    user_id: input?.user_id,
    company_id: input?.company_id,
    raw_text: rawText,
    locale: input?.locale ?? "fr-FR",
    created_at: new Date().toISOString(),
    metadata: { ...(input?.metadata ?? {}), plan_only: true },
  };
}

// ── Sanitization ──────────────────────────────────────────────────────────────

export function sanitizeRuntimeIntegrationCommand(
  command: RuntimeIntegrationCommand
): RuntimeIntegrationCommand {
  return {
    ...command,
    raw_text: normalizeRuntimeIntegrationCommandText(command.raw_text),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateRuntimeIntegrationCommand(
  command: RuntimeIntegrationCommand
): { valid: boolean; issues: RuntimeIntegrationIssue[] } {
  const issues = buildRuntimeIntegrationCommandIssues(command);
  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

// ── Issues ────────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationCommandIssues(
  command: RuntimeIntegrationCommand
): RuntimeIntegrationIssue[] {
  const issues: RuntimeIntegrationIssue[] = [];

  if (!command.raw_text?.trim()) {
    issues.push({ code: "raw_text_required", message: "raw_text requis.", severity: "blocking" });
  }
  const unsafe = detectRuntimeIntegrationUnsafeText(command.raw_text);
  for (const u of unsafe) {
    issues.push({ code: "unsafe_text_detected", message: `Motif interdit détecté : ${u}`, severity: "blocking" });
  }
  if (!command.company_id) {
    issues.push({ code: "company_context_missing", message: "company_id manquant — contexte tenant limité.", severity: "warning" });
  }
  if (!command.user_id) {
    issues.push({ code: "user_context_missing", message: "user_id manquant — contexte tenant limité.", severity: "warning" });
  }
  return issues;
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function buildRuntimeIntegrationCommandRecommendations(
  command: RuntimeIntegrationCommand
): RuntimeIntegrationRecommendation[] {
  const recs: RuntimeIntegrationRecommendation[] = [];
  if (!command.company_id) {
    recs.push({
      id: "rec-company-context",
      text: "Configurer l'Empreinte Entreprise pour enrichir le contexte tenant.",
      href: "/profile/onboarding",
      action_label: "Onboarding",
    });
  }
  recs.push({
    id: "rec-plan-only",
    text: "Cette commande est analysée en plan-only — aucune exécution.",
    href: "/profile/agents",
    action_label: "Mon espace",
  });
  return recs;
}
