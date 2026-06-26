// src/lib/clonestore/runtime-integration/runtime-controlled-mission-persistence-design.ts
// PHASE 4.10 — Controlled Mission Persistence — Record Mapper / Design
//
// DESIGN-ONLY. Aucun write. Aucun Supabase. Aucun réseau. Aucun localStorage write.
// db_write_performed TOUJOURS false en P4.10. Ne mute jamais le contrat original.
// promotion_applied false. mission_created false. execution_enabled false.
// human_validation_required true.

import type {
  RuntimeMissionPromotionContract,
  ControlledMission,
} from "./runtime-mission-promotion-types";
import type {
  RuntimeControlledMissionPersistencePayload,
  RuntimeControlledMissionPersistenceSafetyFlags,
  RuntimeControlledMissionPersistenceRecord,
  RuntimeControlledMissionPersistenceWritePlan,
  RuntimeControlledMissionPersistenceReadPlan,
  RuntimeControlledMissionPersistenceMode,
  RuntimeControlledMissionPersistenceSource,
  RuntimeControlledMissionPersistenceStatus,
  RuntimeControlledMissionPersistenceIssue,
} from "./runtime-controlled-mission-persistence-types";
import { RUNTIME_CONTROLLED_MISSION_TABLE_NAME } from "./runtime-controlled-mission-persistence-types";
import { isRuntimeControlledMissionServerPersistenceEnabled } from "./runtime-controlled-mission-persistence-flags";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeControlledMissionPersistenceOptions = {
  user_id?: string;
  company_id?: string;
  mode?: RuntimeControlledMissionPersistenceMode;
  source?: RuntimeControlledMissionPersistenceSource;
  // État manuel (déclaré par l'opérateur)
  sql_applied?: boolean;
  human_validation_design_ready?: boolean;
  safe_apply_ready?: boolean;
};

// ── Safety flags ──────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionPersistenceSafetyFlags(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionPersistenceSafetyFlags {
  void contract;
  return {
    promotion_applied: false,
    execution_enabled: false,
    mission_executed: false,
    autonomous_execution: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    db_write_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    requires_human_validation: true,
    controlled: true,
    scale_80k_not_proven: true,
  };
}

// ── Mapping status / verdict ──────────────────────────────────────────────────

function mapPersistenceStatus(contract: RuntimeMissionPromotionContract): string {
  switch (contract.status) {
    case "promotion_contract_ready":
    case "eligible_for_promotion":
      return "promotable_preview";
    case "requires_human_validation":
      return "awaiting_human_validation";
    case "not_eligible":
      return "unsupported";
    case "blocked":
      return "blocked";
    default:
      return "draft_review";
  }
}

function mapPersistenceVerdict(contract: RuntimeMissionPromotionContract): string {
  // Les verdicts du contrat (eligible/requires_human_validation/not_eligible/blocked)
  // sont tous des valeurs autorisées de la colonne verdict.
  return contract.decision.verdict;
}

// ── Payload ───────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionPersistencePayload(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionPersistencePayload {
  const cm: ControlledMission | null = contract.controlled_mission;
  const draftId = cm?.draft_id ?? contract.draft_id;
  return {
    candidate_id: `cand_${contract.promotion_id}`,
    promotion_id: contract.promotion_id,
    controlled_mission_id: cm?.controlled_mission_id ?? null,
    draft_id: draftId,
    command_id: cm?.command_id ?? draftId,
    intent_id: cm?.intent_id ?? draftId,
    route_id: cm?.route_id ?? draftId,
    plan_id: cm?.plan_id ?? draftId,
    employee_key: cm?.employee_key ?? null,
    source: "runtime_mission_promotion_contract",
    status: mapPersistenceStatus(contract),
    verdict: mapPersistenceVerdict(contract),
    title: cm?.title ?? "Candidat de mission contrôlée (non promu)",
    objective: cm?.objective ?? "Aperçu de promotion — aucune mission réelle.",
    summary: cm?.summary ?? contract.decision.message,
    domain: cm?.domain ?? "unknown",
    risk_level: cm?.risk_level ?? "low",
    validation_mode: cm?.validation_mode ?? "human_validation_required",
    candidate_payload: {
      promotion_id: contract.promotion_id,
      draft_id: draftId,
      verdict: contract.decision.verdict,
      controlled_mission_present: cm !== null,
    },
    promotion_contract: { ...(contract as unknown as Record<string, unknown>) },
    controlled_mission_payload: cm ? { ...(cm as unknown as Record<string, unknown>) } : {},
    guard_snapshot: cm ? { ...cm.guard_snapshot } : {},
    trace_snapshot: cm ? { ...cm.trace_snapshot } : {},
    validation_gates: [...contract.gates],
    blockers: [...contract.decision.blocking_gates],
    idempotency_snapshot: cm ? { ...cm.idempotency } : {},
    queue_snapshot: cm ? { ...cm.queue_snapshot } : {},
    cost_snapshot: cm ? { ...cm.cost_snapshot } : {},
    scale_snapshot: cm ? { ...cm.scale_snapshot } : {},
  };
}

// ── Record (forme future DB, jamais écrite) ───────────────────────────────────

export function buildRuntimeControlledMissionPersistenceRecord(
  contract: RuntimeMissionPromotionContract,
  options?: RuntimeControlledMissionPersistenceOptions
): RuntimeControlledMissionPersistenceRecord {
  return {
    user_id: options?.user_id ?? null,
    company_id: options?.company_id ?? null,
    payload: buildRuntimeControlledMissionPersistencePayload(contract),
    safety_flags: buildRuntimeControlledMissionPersistenceSafetyFlags(contract),
    human_validation_required: true,
    promotion_applied: false,
    controlled_mission_created: false,
    mission_created: false,
    execution_enabled: false,
    execution_started: false,
    preview_only: true,
    read_only: true,
    table_name: RUNTIME_CONTROLLED_MISSION_TABLE_NAME,
    db_write_performed: false,
  };
}

// ── Write plan (design — jamais exécuté) ──────────────────────────────────────

export function buildRuntimeControlledMissionPersistenceWritePlan(
  contract: RuntimeMissionPromotionContract,
  options?: RuntimeControlledMissionPersistenceOptions
): RuntimeControlledMissionPersistenceWritePlan {
  void contract;
  const reasons: string[] = [];
  const userId = options?.user_id ?? null;
  const flagEnabled = isRuntimeControlledMissionServerPersistenceEnabled();

  let status: RuntimeControlledMissionPersistenceStatus = "design_ready";
  let blocking = false;

  if (!userId) {
    status = "blocked";
    blocking = true;
    reasons.push("user_id_required — aucun write serveur possible sans utilisateur authentifié.");
  } else if (!flagEnabled) {
    status = "awaiting_flag";
    reasons.push("Flag serveur désactivé (default false) — candidate local/in-memory uniquement.");
  } else if (options?.sql_applied !== true) {
    status = "awaiting_sql";
    reasons.push("SQL non appliqué manuellement — appliquer PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql.");
  } else if (options?.human_validation_design_ready !== true) {
    status = "awaiting_human_validation_design";
    reasons.push("Workflow de validation humaine non conçu — prévu en PHASE 4.11.");
  } else if (options?.safe_apply_ready !== true) {
    status = "awaiting_safe_apply";
    reasons.push("Safe apply runtime non implémenté — prévu en PHASE 4.11+.");
  } else {
    status = "ready_for_manual_activation";
    reasons.push("Conditions design réunies — activation manuelle gouvernée future.");
  }

  reasons.push("P4.10 = design only — db_write_performed false. Aucune écriture effectuée.");
  reasons.push("promotion_applied false. mission_created false. human_validation_required true.");

  return {
    status,
    table_name: RUNTIME_CONTROLLED_MISSION_TABLE_NAME,
    would_insert: !blocking,
    would_update: !blocking,
    db_write_performed: false,
    promotion_applied: false,
    mission_created: false,
    execution_enabled: false,
    human_validation_required: true,
    reasons,
    blocking,
  };
}

// ── Read plan (design) ────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionPersistenceReadPlan(
  options?: RuntimeControlledMissionPersistenceOptions
): RuntimeControlledMissionPersistenceReadPlan {
  const flagEnabled = isRuntimeControlledMissionServerPersistenceEnabled();
  return {
    table_name: RUNTIME_CONTROLLED_MISSION_TABLE_NAME,
    source: options?.source ?? "controlled_mission_preview",
    localstorage_first: true,
    server_read_designed: flagEnabled && options?.sql_applied === true,
    db_read_performed: false,
    notes: [
      "Lecture localStorage-first. Lecture serveur uniquement si flag + table + validation humaine + safe apply (PHASE 4.11+).",
      "Aucune lecture DB effectuée en P4.10.",
    ],
  };
}

// ── Validation / sanitization record ──────────────────────────────────────────

export function validateRuntimeControlledMissionPersistenceRecord(
  record: RuntimeControlledMissionPersistenceRecord
): { valid: boolean; issues: RuntimeControlledMissionPersistenceIssue[] } {
  const issues: RuntimeControlledMissionPersistenceIssue[] = [];
  const p = record.payload;

  if (!p?.candidate_id?.trim()) issues.push({ code: "candidate_id_required", message: "candidate_id requis.", severity: "blocking" });
  if (!p?.promotion_id?.trim()) issues.push({ code: "promotion_id_required", message: "promotion_id requis.", severity: "blocking" });
  if (!p?.draft_id?.trim()) issues.push({ code: "draft_id_required", message: "draft_id requis.", severity: "blocking" });
  if (!p?.command_id?.trim()) issues.push({ code: "command_id_required", message: "command_id requis.", severity: "blocking" });
  if (!p?.plan_id?.trim()) issues.push({ code: "plan_id_required", message: "plan_id requis.", severity: "blocking" });

  if (record.read_only !== true) issues.push({ code: "read_only_required", message: "read_only doit être true.", severity: "blocking" });
  if (record.db_write_performed !== false) issues.push({ code: "no_db_write", message: "db_write_performed doit être false.", severity: "blocking" });
  if (record.human_validation_required !== true) issues.push({ code: "human_validation_required", message: "human_validation_required doit être true.", severity: "blocking" });
  if (record.promotion_applied !== false) issues.push({ code: "promotion_not_applied", message: "promotion_applied doit être false.", severity: "blocking" });
  if (record.controlled_mission_created !== false) issues.push({ code: "no_controlled_mission_created", message: "controlled_mission_created doit être false.", severity: "blocking" });
  if (record.mission_created !== false) issues.push({ code: "no_mission_created", message: "mission_created doit être false.", severity: "blocking" });
  if (record.execution_enabled !== false) issues.push({ code: "no_execution_enabled", message: "execution_enabled doit être false.", severity: "blocking" });
  if (record.execution_started !== false) issues.push({ code: "no_execution_started", message: "execution_started doit être false.", severity: "blocking" });
  if (record.preview_only !== true) issues.push({ code: "preview_only_required", message: "preview_only doit être true.", severity: "blocking" });
  if (record.table_name !== RUNTIME_CONTROLLED_MISSION_TABLE_NAME) issues.push({ code: "table_name_mismatch", message: "table_name incohérent.", severity: "warning" });

  const f = record.safety_flags;
  const allCorrect = f &&
    f.promotion_applied === false && f.execution_enabled === false && f.mission_executed === false &&
    f.autonomous_execution === false && f.pierre_engine_called === false && f.ai_call_performed === false &&
    f.db_write_performed === false && f.email_sent === false && f.message_sent === false &&
    f.document_generated === false && f.clonevoice_active === false &&
    f.public_launch_external_validated === false &&
    f.requires_human_validation === true && f.controlled === true && f.scale_80k_not_proven === true;
  if (!allCorrect) issues.push({ code: "safety_flags_violation", message: "safety_flags incohérents (no-execution / gouvernance).", severity: "blocking" });

  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

export function sanitizeRuntimeControlledMissionPersistenceRecord(
  record: RuntimeControlledMissionPersistenceRecord
): RuntimeControlledMissionPersistenceRecord {
  return {
    ...record,
    human_validation_required: true,
    promotion_applied: false,
    controlled_mission_created: false,
    mission_created: false,
    execution_enabled: false,
    execution_started: false,
    preview_only: true,
    read_only: true,
    db_write_performed: false,
    table_name: RUNTIME_CONTROLLED_MISSION_TABLE_NAME,
    safety_flags: {
      promotion_applied: false,
      execution_enabled: false,
      mission_executed: false,
      autonomous_execution: false,
      pierre_engine_called: false,
      ai_call_performed: false,
      db_write_performed: false,
      email_sent: false,
      message_sent: false,
      document_generated: false,
      clonevoice_active: false,
      public_launch_external_validated: false,
      requires_human_validation: true,
      controlled: true,
      scale_80k_not_proven: true,
    },
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeControlledMissionPersistenceDesign(
  recordOrPlan: RuntimeControlledMissionPersistenceRecord | RuntimeControlledMissionPersistenceWritePlan
): string {
  if ("payload" in recordOrPlan) {
    return [
      `[Controlled Mission Persistence Record] table=${recordOrPlan.table_name}`,
      `  candidate_id : ${recordOrPlan.payload.candidate_id} · verdict : ${recordOrPlan.payload.verdict}`,
      `  db_write_performed : ${recordOrPlan.db_write_performed} · read_only : ${recordOrPlan.read_only}`,
      `  promotion_applied : ${recordOrPlan.promotion_applied} · mission_created : ${recordOrPlan.mission_created}`,
      `  human_validation_required : ${recordOrPlan.human_validation_required}`,
      `  Design only — aucune écriture. Aucune mission réelle. Scale 80k non prouvé.`,
    ].join("\n");
  }
  return [
    `[Controlled Mission Persistence Write Plan] status=${recordOrPlan.status}`,
    `  db_write_performed : ${recordOrPlan.db_write_performed} · blocking : ${recordOrPlan.blocking}`,
    ...recordOrPlan.reasons.map((r) => `  - ${r}`),
  ].join("\n");
}
