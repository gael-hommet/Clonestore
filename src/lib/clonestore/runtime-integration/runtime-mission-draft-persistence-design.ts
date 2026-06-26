// src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-design.ts
// PHASE 4.4 — Runtime Mission Draft Persistence — Record Mapper / Design
//
// DESIGN-ONLY. Aucun write. Aucun Supabase. Aucun fetch. Aucun localStorage write.
// db_write_performed TOUJOURS false en P4.4. Ne mute jamais le draft original.

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";
import type {
  RuntimeMissionDraftPersistencePayload,
  RuntimeMissionDraftPersistenceSafetyFlags,
  RuntimeMissionDraftPersistenceRecord,
  RuntimeMissionDraftPersistenceWritePlan,
  RuntimeMissionDraftPersistenceReadPlan,
  RuntimeMissionDraftPersistenceMode,
  RuntimeMissionDraftPersistenceStatus,
  RuntimeMissionDraftPersistenceIssue,
} from "./runtime-mission-draft-persistence-types";
import { RUNTIME_MISSION_DRAFT_TABLE_NAME } from "./runtime-mission-draft-persistence-types";
import { isRuntimeMissionDraftServerPersistenceEnabled } from "./runtime-mission-draft-persistence-flags";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistenceOptions = {
  user_id?: string;
  company_id?: string;
  mode?: RuntimeMissionDraftPersistenceMode;
  // État manuel (déclaré par l'opérateur) : table appliquée ? safe apply prêt ?
  sql_applied?: boolean;
  safe_apply_ready?: boolean;
};

// ── Safety flags ──────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftPersistenceSafetyFlags(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftPersistenceSafetyFlags {
  void draft;
  return {
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
  };
}

// ── Payload ───────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftPersistencePayload(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftPersistencePayload {
  return {
    draft_id: draft.draft_id,
    command_id: draft.command_id,
    intent_id: draft.intent_id,
    route_id: draft.route_id,
    plan_id: draft.plan_id,
    employee_key: draft.employee_key,
    kind: draft.kind,
    status: draft.status,
    source: draft.source,
    title: draft.title,
    objective: draft.objective,
    summary: draft.summary,
    domain: draft.domain,
    risk_level: draft.risk_level,
    validation_mode: draft.validation_mode,
    draft_payload: {
      steps: draft.steps,
      validation_requirements: draft.validation_requirements,
      missing_context: draft.missing_context,
      blocked_reasons: draft.blocked_reasons,
    },
    guard_snapshot: { ...draft.guard_snapshot },
    trace_snapshot: { ...draft.trace_snapshot },
    idempotency_snapshot: { ...draft.idempotency },
    queue_snapshot: { ...draft.queue_snapshot },
    cost_snapshot: { ...draft.cost_snapshot },
    scale_snapshot: { ...draft.scale_snapshot },
  };
}

// ── Record (forme future DB, jamais écrite) ───────────────────────────────────

export function buildRuntimeMissionDraftPersistenceRecord(
  draft: RuntimeMissionDraft,
  options?: RuntimeMissionDraftPersistenceOptions
): RuntimeMissionDraftPersistenceRecord {
  return {
    user_id: options?.user_id ?? draft.user_id ?? null,
    company_id: options?.company_id ?? draft.company_id ?? null,
    payload: buildRuntimeMissionDraftPersistencePayload(draft),
    safety_flags: buildRuntimeMissionDraftPersistenceSafetyFlags(draft),
    table_name: RUNTIME_MISSION_DRAFT_TABLE_NAME,
    read_only: true,
    db_write_performed: false,
  };
}

// ── Write plan (design — jamais exécuté) ──────────────────────────────────────

export function buildRuntimeMissionDraftPersistenceWritePlan(
  draft: RuntimeMissionDraft,
  options?: RuntimeMissionDraftPersistenceOptions
): RuntimeMissionDraftPersistenceWritePlan {
  const reasons: string[] = [];
  const userId = options?.user_id ?? draft.user_id ?? null;
  const flagEnabled = isRuntimeMissionDraftServerPersistenceEnabled();

  let status: RuntimeMissionDraftPersistenceStatus = "design_ready";
  let blocking = false;

  if (!userId) {
    status = "blocked";
    blocking = true;
    reasons.push("user_id_required — aucun write serveur possible sans utilisateur authentifié.");
  } else if (!flagEnabled) {
    status = "awaiting_flag";
    reasons.push("Flag serveur désactivé (default false) — brouillon local/in-memory uniquement.");
  } else if (options?.sql_applied !== true) {
    status = "awaiting_sql";
    reasons.push("SQL non appliqué manuellement — appliquer PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql.");
  } else if (options?.safe_apply_ready !== true) {
    status = "awaiting_safe_apply";
    reasons.push("Safe apply runtime non implémenté — prévu en PHASE 4.5.");
  } else {
    status = "ready_for_manual_activation";
    reasons.push("Conditions design réunies — activation manuelle gouvernée en PHASE 4.5.");
  }

  reasons.push("P4.4 = design only — db_write_performed false. Aucune écriture effectuée.");

  return {
    status,
    table_name: RUNTIME_MISSION_DRAFT_TABLE_NAME,
    would_insert: !blocking,
    would_update: !blocking,
    db_write_performed: false,
    api_execution_enabled: false,
    reasons,
    blocking,
  };
}

// ── Read plan (design) ────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftPersistenceReadPlan(
  options?: RuntimeMissionDraftPersistenceOptions
): RuntimeMissionDraftPersistenceReadPlan {
  const flagEnabled = isRuntimeMissionDraftServerPersistenceEnabled();
  return {
    table_name: RUNTIME_MISSION_DRAFT_TABLE_NAME,
    source: "local_in_memory",
    localstorage_first: true,
    server_read_designed: flagEnabled && options?.sql_applied === true,
    db_read_performed: false,
    notes: [
      "Lecture localStorage-first. Lecture serveur uniquement si flag + table + safe apply (PHASE 4.5).",
      "Aucune lecture DB effectuée en P4.4.",
    ],
  };
}

// ── Validation / sanitization record ──────────────────────────────────────────

export function validateRuntimeMissionDraftPersistenceRecord(
  record: RuntimeMissionDraftPersistenceRecord
): { valid: boolean; issues: RuntimeMissionDraftPersistenceIssue[] } {
  const issues: RuntimeMissionDraftPersistenceIssue[] = [];

  if (!record.payload?.draft_id?.trim()) issues.push({ code: "draft_id_required", message: "draft_id requis.", severity: "blocking" });
  if (!record.payload?.command_id?.trim()) issues.push({ code: "command_id_required", message: "command_id requis.", severity: "blocking" });
  if (!record.payload?.plan_id?.trim()) issues.push({ code: "plan_id_required", message: "plan_id requis.", severity: "blocking" });
  if (record.read_only !== true) issues.push({ code: "read_only_required", message: "read_only doit être true.", severity: "blocking" });
  if (record.db_write_performed !== false) issues.push({ code: "no_db_write", message: "db_write_performed doit être false.", severity: "blocking" });
  if (record.table_name !== RUNTIME_MISSION_DRAFT_TABLE_NAME) issues.push({ code: "table_name_mismatch", message: "table_name incohérent.", severity: "warning" });

  const f = record.safety_flags;
  const allFalse = f &&
    f.execution_enabled === false && f.db_write_enabled === false && f.api_execution_enabled === false &&
    f.pierre_engine_called === false && f.ai_call_performed === false && f.email_sent === false &&
    f.message_sent === false && f.document_generated === false && f.clonevoice_active === false &&
    f.public_launch_external_validated === false;
  if (!allFalse) issues.push({ code: "safety_flags_violation", message: "Tous les safety_flags doivent être false.", severity: "blocking" });

  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

export function sanitizeRuntimeMissionDraftPersistenceRecord(
  record: RuntimeMissionDraftPersistenceRecord
): RuntimeMissionDraftPersistenceRecord {
  return {
    ...record,
    read_only: true,
    db_write_performed: false,
    table_name: RUNTIME_MISSION_DRAFT_TABLE_NAME,
    safety_flags: {
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
    },
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeMissionDraftPersistenceDesign(
  recordOrPlan: RuntimeMissionDraftPersistenceRecord | RuntimeMissionDraftPersistenceWritePlan
): string {
  if ("payload" in recordOrPlan) {
    return [
      `[Persistence Record] table=${recordOrPlan.table_name}`,
      `  draft_id : ${recordOrPlan.payload.draft_id}`,
      `  db_write_performed : ${recordOrPlan.db_write_performed} · read_only : ${recordOrPlan.read_only}`,
      `  Design only — aucune écriture. Brouillon local. Scale 80k non prouvé.`,
    ].join("\n");
  }
  return [
    `[Persistence Write Plan] status=${recordOrPlan.status}`,
    `  db_write_performed : ${recordOrPlan.db_write_performed} · blocking : ${recordOrPlan.blocking}`,
    ...recordOrPlan.reasons.map((r) => `  - ${r}`),
  ].join("\n");
}
