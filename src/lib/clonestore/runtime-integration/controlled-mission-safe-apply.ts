// src/lib/clonestore/runtime-integration/controlled-mission-safe-apply.ts
// PHASE 5.1 — Controlled Mission Safe Apply (localStorage-first)
//
// Transforme une promotion preview validée (P4.8/4.9) en Controlled Mission LOCALE
// stockée uniquement en localStorage. JAMAIS exécutée, JAMAIS envoyée, JAMAIS
// persistée serveur, JAMAIS connectée à Pierre runtime.
// Aucun appel réseau. Pas de base de données. Pas d'import Pierre. Pas d'appel IA.

import type {
  RuntimeMissionPromotionContract,
  ControlledMission,
} from "./runtime-mission-promotion-types";
import type {
  LocalControlledMission,
  LocalControlledMissionStatus,
  LocalControlledMissionExecutionStatus,
  LocalControlledMissionPriority,
  LocalControlledMissionRiskLevel,
  LocalControlledMissionStep,
  LocalControlledMissionValidationRequirement,
  LocalControlledMissionTimelineItem,
  LocalControlledMissionBuildOptions,
  ControlledMissionSafeApplyInputCheck,
  ControlledMissionSafeApplyResult,
  ControlledMissionSafeApplyStatus,
} from "./controlled-mission-safe-apply-types";
import {
  loadLocalControlledMissions,
  getLocalControlledMissionById,
  upsertLocalControlledMission,
} from "./controlled-mission-local-storage";

// ── Sanitization ──────────────────────────────────────────────────────────────

const REDACT_PATTERNS = [
  "sk_live_", "whsec_", "api_key", "service_role",
  "private_key", "secret_key", "bearer ",
];

export function sanitizeControlledMissionText(text: string): string {
  if (!text || typeof text !== "string") return "";
  let out = text
    // Retire balises HTML / <script> / chevrons.
    .replace(/<[^>]*>/g, " ")
    .replace(/<|>/g, " ")
    // Neutralise les schémas dangereux.
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/on\w+\s*=/gi, "");
  const lower = out.toLowerCase();
  for (const p of REDACT_PATTERNS) {
    if (lower.includes(p)) out = out.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted]");
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 2000);
}

// ── Status / exec status / priority ───────────────────────────────────────────

function deriveStatus(contract: RuntimeMissionPromotionContract): LocalControlledMissionStatus {
  const v = contract.decision.verdict;
  if (v === "blocked") return "blocked_by_guard";
  if (v === "not_eligible") return "blocked_by_missing_information";
  if (v === "requires_human_validation") return "waiting_manual_review";
  return "local_controlled_created";
}

function deriveExecutionStatus(status: LocalControlledMissionStatus): LocalControlledMissionExecutionStatus {
  if (status === "blocked_by_guard" || status === "blocked_by_missing_information" || status === "archived_local") return "not_executable";
  if (status === "waiting_manual_review") return "pending_manual_review";
  return "local_only";
}

function derivePriority(risk: LocalControlledMissionRiskLevel): LocalControlledMissionPriority {
  if (risk === "high" || risk === "sensitive" || risk === "blocked") return "high";
  if (risk === "medium") return "normal";
  return "low";
}

// ── Validation de l'input ─────────────────────────────────────────────────────

export function validateControlledMissionSafeApplyInput(
  contract: RuntimeMissionPromotionContract | null | undefined
): ControlledMissionSafeApplyInputCheck {
  if (!contract || !contract.promotion_id?.trim() || !contract.draft_id?.trim()) {
    return { valid: false, reason: "Aperçu de promotion indisponible.", can_safe_apply: false };
  }
  // Invariants no-execution du contrat préservés.
  if (contract.decision.promotion_applied !== false || contract.safety_flags.execution_enabled !== false) {
    return { valid: false, reason: "Contrat non sûr (invariants no-execution).", can_safe_apply: false };
  }
  const v = contract.decision.verdict;
  if (v === "blocked") {
    return { valid: false, reason: "Safe apply impossible : risque trop élevé / décision humaine exclusive (CloneGuard).", can_safe_apply: false };
  }
  if (v === "not_eligible") {
    return { valid: false, reason: "Safe apply impossible : informations manquantes / domaine non supporté.", can_safe_apply: false };
  }
  if (!contract.controlled_mission) {
    return { valid: false, reason: "Safe apply impossible : aucune mission contrôlée dans l'aperçu.", can_safe_apply: false };
  }
  return { valid: true, reason: null, can_safe_apply: true };
}

// ── Build (pur) ───────────────────────────────────────────────────────────────

export function buildControlledMissionFromPromotionPreview(
  contract: RuntimeMissionPromotionContract,
  options?: LocalControlledMissionBuildOptions
): LocalControlledMission {
  const now = options?.now ?? new Date().toISOString();
  const cm: ControlledMission | null = contract.controlled_mission;
  const status = deriveStatus(contract);
  const riskLevel = (cm?.risk_level ?? "low") as LocalControlledMissionRiskLevel;

  const steps: LocalControlledMissionStep[] = (cm?.steps ?? []).map((s, i) => ({
    id: `localstep_${i}_${s.id}`,
    label: sanitizeControlledMissionText(s.title),
    detail: sanitizeControlledMissionText(s.description),
    requires_human: s.requires_human,
    execution_enabled: false,
  }));

  const validationRequirements: LocalControlledMissionValidationRequirement[] = (cm?.required_validations ?? []).map((r) => ({
    requirement_id: r.requirement_id,
    label: sanitizeControlledMissionText(r.label),
    reason: sanitizeControlledMissionText(r.reason),
    required_role: r.required_approver_role,
  }));

  const blockedReasons = contract.decision.blocking_gates.map((g) => String(g));

  const timeline: LocalControlledMissionTimelineItem[] = [
    { id: "tl-created", event: "local_controlled_created", label: "Mission contrôlée préparée localement", detail: "Aucune exécution. Stockée uniquement en localStorage." },
    { id: "tl-validation", event: "human_validation_required", label: "Validation humaine requise", detail: "La mission n'est pas exécutée tant qu'elle n'est pas validée et activée (phase ultérieure)." },
    { id: "tl-no-exec", event: "execution_not_started", label: "Aucune exécution", detail: "Pierre ne travaille pas encore en autonomie sur cette mission." },
  ];

  return {
    id: `localcm_${contract.promotion_id}`,
    source_draft_id: contract.draft_id,
    source_promotion_id: contract.promotion_id,
    tenant_id: options?.tenant_id ?? options?.user_id ?? "local_demo_tenant",
    employee_id: cm?.employee_key ?? null,
    title: sanitizeControlledMissionText(cm?.title ?? "Mission contrôlée (préparée)"),
    summary: sanitizeControlledMissionText(cm?.summary ?? contract.decision.message),
    intent: sanitizeControlledMissionText(cm?.domain ?? "unknown"),
    category: sanitizeControlledMissionText(cm?.domain ?? "unknown"),
    priority: derivePriority(riskLevel),
    risk_level: riskLevel,
    status,
    steps,
    validation_requirements: validationRequirements,
    guard_summary: {
      decision: cm?.guard_snapshot?.decision ?? "require_human_validation",
      cloneguard_required: true,
      clonetrace_required: true,
      human_validation_required: true,
    },
    warnings: [],
    blocked_reasons: blockedReasons,
    human_readable_timeline: timeline,
    created_at: now,
    updated_at: now,
    source: "local_safe_apply",
    execution_status: deriveExecutionStatus(status),
    server_persistence: "disabled",
    runtime_execution: "disabled",
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    read_only: true,
  };
}

// ── Sanitize payload ──────────────────────────────────────────────────────────

export function sanitizeControlledMissionPayload(mission: LocalControlledMission): LocalControlledMission {
  return {
    ...mission,
    title: sanitizeControlledMissionText(mission.title),
    summary: sanitizeControlledMissionText(mission.summary),
    intent: sanitizeControlledMissionText(mission.intent),
    category: sanitizeControlledMissionText(mission.category),
    steps: mission.steps.map((s) => ({ ...s, label: sanitizeControlledMissionText(s.label), detail: sanitizeControlledMissionText(s.detail), execution_enabled: false })),
    // Invariants re-forcés.
    server_persistence: "disabled",
    runtime_execution: "disabled",
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    read_only: true,
  };
}

// ── User-facing warnings ──────────────────────────────────────────────────────

export function buildControlledMissionUserFacingWarnings(mission: LocalControlledMission): string[] {
  const warnings: string[] = [
    "Cette mission est préparée, pas exécutée.",
    "Aucune donnée n'est envoyée au serveur dans cette phase.",
    "Pierre ne travaille pas encore en autonomie sur cette mission.",
  ];
  if (mission.status === "waiting_manual_review") warnings.push("Validation humaine requise avant toute activation future.");
  if (mission.blocked_reasons.length > 0) warnings.push("Des points de gouvernance restent à revoir.");
  return warnings;
}

// ── Result builder ────────────────────────────────────────────────────────────

export function buildControlledMissionSafeApplyResult(
  status: ControlledMissionSafeApplyStatus,
  mission: LocalControlledMission | null,
  extra?: { already_existed?: boolean; blocked_reasons?: string[]; now?: string }
): ControlledMissionSafeApplyResult {
  return {
    ok: status === "created" || status === "already_exists",
    status,
    mission,
    already_existed: extra?.already_existed ?? false,
    warnings: mission ? buildControlledMissionUserFacingWarnings(mission) : [],
    blocked_reasons: extra?.blocked_reasons ?? mission?.blocked_reasons ?? [],
    server_persistence_performed: false,
    runtime_execution_performed: false,
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    applied_at: extra?.now ?? new Date().toISOString(),
  };
}

// ── Create (localStorage write, idempotent) ───────────────────────────────────

export function createLocalControlledMission(
  contract: RuntimeMissionPromotionContract,
  options?: LocalControlledMissionBuildOptions
): ControlledMissionSafeApplyResult {
  const now = options?.now ?? new Date().toISOString();
  const check = validateControlledMissionSafeApplyInput(contract);
  if (!check.can_safe_apply) {
    return buildControlledMissionSafeApplyResult("blocked", null, {
      blocked_reasons: [check.reason ?? "Safe apply impossible."],
      now,
    });
  }

  const built = sanitizeControlledMissionPayload(buildControlledMissionFromPromotionPreview(contract, options));

  // Idempotence : si déjà créée localement, ne pas dupliquer.
  const existing = getLocalControlledMissionById(built.id);
  if (existing) {
    return buildControlledMissionSafeApplyResult("already_exists", existing, { already_existed: true, now });
  }

  const saved = upsertLocalControlledMission(built, now);
  if (!saved.ok) {
    return buildControlledMissionSafeApplyResult("local_save_failed", null, {
      blocked_reasons: saved.issues,
      now,
    });
  }
  return buildControlledMissionSafeApplyResult("created", built, { already_existed: false, now });
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeLocalControlledMissions(): string {
  const missions = loadLocalControlledMissions();
  const active = missions.filter((m) => m.status !== "archived_local");
  return [
    `[Controlled Missions locales] ${missions.length} (dont ${active.length} actives)`,
    "  Local uniquement · Non exécuté · Serveur désactivé · Validation humaine requise.",
    "  Aucune mission réelle · Aucune exécution · Aucun appel Pierre / IA.",
  ].join("\n");
}
