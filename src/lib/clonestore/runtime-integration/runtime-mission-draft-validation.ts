// src/lib/clonestore/runtime-integration/runtime-mission-draft-validation.ts
// PHASE 4.3 — Runtime Mission Draft — Validation / Sanitization
//
// Module pur. Vérifie les invariants no-execution et anti-secrets du brouillon.
// Pas de Supabase, pas de réseau, pas de write, pas d'import Pierre.

import type {
  RuntimeMissionDraft,
  RuntimeMissionDraftIssue,
} from "./runtime-mission-draft-types";

// ── Patterns interdits (détection — jamais des secrets réels) ─────────────────

export const RUNTIME_MISSION_DRAFT_FORBIDDEN_PATTERNS: string[] = [
  "sk_live_",
  "whsec_",
  "openai_api_key",
  "anthropic_api_key",
  "supabase_service_role_key",
  "private_key",
  "secret_key",
  "api_key",
  "bearer token",
  "public launch go",
  "zéro erreur",
  "conformité garantie",
  "80k scale proven",
  "80k clients guaranteed",
  "clonevoice actif production",
];

export function detectRuntimeMissionDraftUnsafeText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  return RUNTIME_MISSION_DRAFT_FORBIDDEN_PATTERNS.filter((p) => lower.includes(p));
}

export function normalizeRuntimeMissionDraftText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

// ── No-secrets assertion ──────────────────────────────────────────────────────

export function assertRuntimeMissionDraftNoSecrets(
  draft: RuntimeMissionDraft
): { safe: boolean; issues: RuntimeMissionDraftIssue[] } {
  const issues: RuntimeMissionDraftIssue[] = [];
  let serialized = "";
  try { serialized = JSON.stringify(draft); } catch { serialized = ""; }
  for (const f of detectRuntimeMissionDraftUnsafeText(serialized)) {
    issues.push({ code: "secret_like_pattern_detected", message: `Motif interdit détecté : ${f}`, severity: "blocking" });
  }
  return { safe: issues.length === 0, issues };
}

// ── No-execution assertion ────────────────────────────────────────────────────

export function assertRuntimeMissionDraftNoExecution(
  draft: RuntimeMissionDraft
): { safe: boolean; issues: RuntimeMissionDraftIssue[] } {
  const issues: RuntimeMissionDraftIssue[] = [];
  const mustBeFalse: Array<[string, boolean]> = [
    ["execution_enabled", draft.execution_enabled],
    ["db_write_enabled", draft.db_write_enabled],
    ["api_execution_enabled", draft.api_execution_enabled],
    ["pierre_engine_called", draft.pierre_engine_called],
    ["ai_call_performed", draft.ai_call_performed],
    ["email_sent", draft.email_sent],
    ["message_sent", draft.message_sent],
    ["document_generated", draft.document_generated],
    ["clonevoice_active", draft.clonevoice_active],
    ["public_launch_external_validated", draft.public_launch_external_validated],
  ];
  for (const [name, value] of mustBeFalse) {
    if (value !== false) {
      issues.push({ code: "no_execution_violation", message: `${name} doit être false.`, severity: "blocking" });
    }
  }
  if (draft.read_only !== true) issues.push({ code: "read_only_violation", message: "read_only doit être true.", severity: "blocking" });
  if (draft.plan_only !== true) issues.push({ code: "plan_only_violation", message: "plan_only doit être true.", severity: "blocking" });
  return { safe: issues.length === 0, issues };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateRuntimeMissionDraft(
  draft: RuntimeMissionDraft
): { valid: boolean; issues: RuntimeMissionDraftIssue[] } {
  const issues: RuntimeMissionDraftIssue[] = [];

  if (!draft.draft_id?.trim()) issues.push({ code: "draft_id_required", message: "draft_id requis.", severity: "blocking" });
  if (!draft.command_id?.trim()) issues.push({ code: "command_id_required", message: "command_id requis.", severity: "blocking" });
  if (!draft.plan_id?.trim()) issues.push({ code: "plan_id_required", message: "plan_id requis.", severity: "blocking" });

  // CloneGuard / CloneTrace / idempotency obligatoires
  if (!draft.guard_snapshot || draft.guard_snapshot.cloneguard_required !== true) {
    issues.push({ code: "cloneguard_snapshot_required", message: "CloneGuard snapshot obligatoire.", severity: "blocking" });
  }
  if (!draft.trace_snapshot || draft.trace_snapshot.clonetrace_required !== true) {
    issues.push({ code: "clonetrace_snapshot_required", message: "CloneTrace snapshot obligatoire.", severity: "blocking" });
  }
  if (!draft.idempotency || draft.idempotency.required !== true || !draft.idempotency.idempotency_key) {
    issues.push({ code: "idempotency_required", message: "Idempotency obligatoire.", severity: "blocking" });
  }

  if (draft.status === "blocked" && draft.blocked_reasons.length === 0) {
    issues.push({ code: "blocked_reasons_required", message: "blocked_reasons non vide si status blocked.", severity: "blocking" });
  }
  if (draft.status === "awaiting_validation" && draft.validation_requirements.length === 0) {
    issues.push({ code: "validation_requirements_required", message: "validation_requirements non vide si awaiting_validation.", severity: "blocking" });
  }

  issues.push(...assertRuntimeMissionDraftNoExecution(draft).issues);
  issues.push(...assertRuntimeMissionDraftNoSecrets(draft).issues);

  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

// ── Safe check ────────────────────────────────────────────────────────────────

export function isRuntimeMissionDraftSafe(draft: RuntimeMissionDraft): boolean {
  return (
    assertRuntimeMissionDraftNoExecution(draft).safe &&
    assertRuntimeMissionDraftNoSecrets(draft).safe
  );
}

// ── Sanitization ──────────────────────────────────────────────────────────────

export function sanitizeRuntimeMissionDraft(draft: RuntimeMissionDraft): RuntimeMissionDraft {
  return {
    ...draft,
    title: normalizeRuntimeMissionDraftText(draft.title),
    objective: normalizeRuntimeMissionDraftText(draft.objective),
    summary: normalizeRuntimeMissionDraftText(draft.summary),
    read_only: true,
    plan_only: true,
    execution_enabled: false,
    db_write_enabled: false,
    api_execution_enabled: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    steps: draft.steps.map((s) => ({ ...s, execution_enabled: false, plan_only: true, read_only: true })),
  };
}
