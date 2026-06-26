// src/lib/clonestore/runtime-integration/runtime-mission-promotion-contract.ts
// PHASE 4.8 — Runtime Mission Promotion Contract / Draft → Controlled Mission
//
// Module PUR / design-only. Évalue l'éligibilité d'un RuntimeMissionDraft à devenir
// une « Controlled Mission » (gouvernée, validation humaine, sans exécution) et
// produit le contrat de promotion. NE PROMEUT RIEN, NE CRÉE AUCUNE MISSION RÉELLE,
// N'EXÉCUTE RIEN, N'APPELLE PAS Pierre, N'ÉCRIT PAS en base.
//
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";
import {
  validateRuntimeMissionDraft,
  assertRuntimeMissionDraftNoExecution,
} from "./runtime-mission-draft-validation";
import type {
  RuntimeMissionPromotionGate,
  RuntimeMissionPromotionGateId,
  RuntimeMissionPromotionSafetyFlags,
  RuntimeMissionPromotionPlanStep,
  ControlledMission,
  ControlledMissionStatus,
  ControlledMissionValidationRequirement,
  RuntimeMissionPromotionDecision,
  RuntimeMissionPromotionVerdict,
  RuntimeMissionPromotionStatus,
  RuntimeMissionPromotionValidationMode,
  RuntimeMissionPromotionContract,
  RuntimeMissionPromotionIssue,
  RuntimeMissionPromotionRecommendation,
  RuntimeMissionPromotionAction,
} from "./runtime-mission-promotion-types";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeMissionPromotionOptions = {
  now?: string;
  requested_by_role?: string;
};

// ── Safety flags ──────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionSafetyFlags(): RuntimeMissionPromotionSafetyFlags {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function draftNeedsHumanValidation(draft: RuntimeMissionDraft): boolean {
  return (
    draft.guard_snapshot?.human_validation_required === true ||
    draft.validation_mode === "human_validation_required" ||
    draft.risk_level === "sensitive" ||
    draft.status === "awaiting_validation"
  );
}

// ── Gates (éligibilité) ───────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionGates(
  draft: RuntimeMissionDraft
): RuntimeMissionPromotionGate[] {
  const validation = validateRuntimeMissionDraft(draft);
  const noExec = assertRuntimeMissionDraftNoExecution(draft);
  const needsHuman = draftNeedsHumanValidation(draft);

  const employeePresent = Boolean(draft.employee_key) && draft.kind !== "unsupported_domain_draft";
  const notBlocked = draft.kind !== "blocked_draft" && draft.status !== "blocked";

  return [
    {
      id: "draft_valid",
      label: "Brouillon valide",
      description: "Le brouillon passe la validation no-execution P4.3.",
      required: true,
      passed: validation.valid,
      severity: "blocking",
      reason: validation.valid ? undefined : "Brouillon non conforme.",
    },
    {
      id: "draft_no_execution_flags",
      label: "Aucun flag d'exécution",
      description: "Tous les flags d'exécution du brouillon sont false.",
      required: true,
      passed: noExec.safe,
      severity: "blocking",
      reason: noExec.safe ? undefined : "Flag d'exécution détecté.",
    },
    {
      id: "draft_not_blocked",
      label: "Brouillon non bloqué",
      description: "Le brouillon n'est pas bloqué par CloneGuard (action finale).",
      required: true,
      passed: notBlocked,
      severity: "blocking",
      reason: notBlocked ? undefined : "Brouillon bloqué — décision humaine exclusive requise.",
    },
    {
      id: "employee_route_present",
      label: "Employé IA routé",
      description: "Un employé IA actif (Pierre RH V1) est routé pour la mission.",
      required: true,
      passed: employeePresent,
      severity: "blocking",
      reason: employeePresent ? undefined : "Aucun employé IA actif pour ce domaine.",
    },
    {
      id: "guard_decision_present",
      label: "CloneGuard obligatoire",
      description: "La décision CloneGuard est présente dans le brouillon.",
      required: true,
      passed: draft.guard_snapshot?.cloneguard_required === true,
      severity: "blocking",
    },
    {
      id: "trace_contract_present",
      label: "CloneTrace obligatoire",
      description: "Le contrat CloneTrace est présent dans le brouillon.",
      required: true,
      passed: draft.trace_snapshot?.clonetrace_required === true,
      severity: "blocking",
    },
    {
      id: "idempotency_present",
      label: "Idempotency requise",
      description: "Une clé d'idempotency est présente.",
      required: true,
      passed: draft.idempotency?.required === true && Boolean(draft.idempotency?.idempotency_key),
      severity: "blocking",
    },
    {
      id: "human_validation_defined",
      label: "Validation humaine définie",
      description: "Si une validation humaine est requise, elle est définie.",
      required: true,
      passed: needsHuman ? draft.validation_requirements.length > 0 : true,
      severity: "blocking",
      reason: needsHuman && draft.validation_requirements.length === 0 ? "Validation humaine requise mais non définie." : undefined,
    },
    {
      id: "tenant_scope_strict",
      label: "Isolation tenant stricte",
      description: "La mission contrôlée reste isolée par user_id/company_id.",
      required: true,
      passed: true,
      severity: "info",
    },
    {
      id: "no_real_mission_side_effect",
      label: "Aucun effet de bord mission réelle",
      description: "La promotion ne crée aucune mission réelle, aucun write, aucune exécution.",
      required: true,
      passed: true,
      severity: "info",
    },
    {
      id: "scale_80k_not_proven_ack",
      label: "Scale 80k non prouvé",
      description: "Préparation scale uniquement — scale 80k non prouvé.",
      required: true,
      passed: true,
      severity: "info",
    },
  ];
}

// ── Decision ──────────────────────────────────────────────────────────────────

export function evaluateRuntimeMissionPromotionEligibility(
  gates: RuntimeMissionPromotionGate[],
  needsHuman: boolean
): RuntimeMissionPromotionDecision {
  const blockingFailed = gates.filter((g) => g.severity === "blocking" && g.required && !g.passed);
  const notBlockedGate = gates.find((g) => g.id === "draft_not_blocked");
  const employeeGate = gates.find((g) => g.id === "employee_route_present");

  let verdict: RuntimeMissionPromotionVerdict;
  if (blockingFailed.length === 0) {
    verdict = needsHuman ? "requires_human_validation" : "eligible";
  } else if (notBlockedGate && !notBlockedGate.passed) {
    verdict = "blocked";
  } else if (employeeGate && !employeeGate.passed) {
    verdict = "not_eligible";
  } else {
    verdict = "blocked";
  }

  const decision: RuntimeMissionPromotionDecision = {
    verdict,
    promotion_applied: false,
    controlled: true,
    blocking_gates: blockingFailed.map((g) => g.id),
    human_validation_required: true,
    message: "",
  };
  decision.message = summarizeRuntimeMissionPromotionDecision(decision);
  return decision;
}

function summarizeRuntimeMissionPromotionDecision(decision: RuntimeMissionPromotionDecision): string {
  const map: Record<RuntimeMissionPromotionVerdict, string> = {
    eligible: "Éligible à la promotion en mission contrôlée (validation humaine ensuite).",
    requires_human_validation: "Éligible — validation humaine requise avant toute mission contrôlée.",
    not_eligible: "Non éligible — aucun employé IA actif pour ce domaine.",
    blocked: "Bloqué — décision humaine exclusive requise (CloneGuard).",
  };
  return `${map[decision.verdict]} promotion_applied : false. Aucune exécution.`;
}

// ── Plan-only promotion steps ─────────────────────────────────────────────────

export function buildRuntimeMissionPromotionPlanSteps(
  draft: RuntimeMissionDraft
): RuntimeMissionPromotionPlanStep[] {
  void draft;
  return [
    {
      id: "promo_step_governance_review",
      order: 1,
      title: "Revue CloneGuard",
      description: "Revue de gouvernance obligatoire avant toute promotion (plan-only).",
      kind: "governance_review",
      requires_human: true,
      plan_only: true,
      execution_enabled: false,
    },
    {
      id: "promo_step_human_validation",
      order: 2,
      title: "Validation humaine",
      description: "Approbation humaine requise — aucune exécution autonome.",
      kind: "human_validation",
      requires_human: true,
      plan_only: true,
      execution_enabled: false,
    },
    {
      id: "promo_step_controlled_preparation",
      order: 3,
      title: "Préparation mission contrôlée",
      description: "Préparation du cadre de mission contrôlée (aucune mission réelle créée).",
      kind: "controlled_preparation",
      requires_human: false,
      plan_only: true,
      execution_enabled: false,
    },
    {
      id: "promo_step_trace_registration",
      order: 4,
      title: "Enregistrement CloneTrace",
      description: "Enregistrement du contrat d'audit CloneTrace (design — aucun write).",
      kind: "trace_registration",
      requires_human: false,
      plan_only: true,
      execution_enabled: false,
    },
    {
      id: "promo_step_controlled_handoff",
      order: 5,
      title: "Handoff contrôlé",
      description: "Handoff vers la file de mission contrôlée (aucune exécution déclenchée).",
      kind: "controlled_handoff",
      requires_human: true,
      plan_only: true,
      execution_enabled: false,
    },
  ];
}

// ── Controlled mission validation requirements ────────────────────────────────

export function buildControlledMissionValidationRequirements(
  draft: RuntimeMissionDraft
): ControlledMissionValidationRequirement[] {
  const reqs: ControlledMissionValidationRequirement[] = draft.validation_requirements.map((r) => ({
    requirement_id: `ctrl_${r.requirement_id}`,
    label: r.label,
    reason: r.reason,
    risk_level: r.risk_level,
    required_approver_role: r.required_approver_role,
    blocks_execution: r.blocks_execution,
  }));

  // Une mission contrôlée requiert toujours au moins une validation humaine.
  if (reqs.length === 0) {
    reqs.push({
      requirement_id: "ctrl_req_human_validation",
      label: "Validation humaine de la mission contrôlée",
      reason: "Une mission contrôlée requiert une validation humaine avant toute exécution future.",
      risk_level: draft.risk_level,
      required_approver_role: "hr_manager",
      blocks_execution: false,
    });
  }
  return reqs;
}

// ── Controlled mission status ─────────────────────────────────────────────────

export function deriveControlledMissionStatus(
  verdict: RuntimeMissionPromotionVerdict
): ControlledMissionStatus {
  if (verdict === "eligible") return "controlled_ready";
  if (verdict === "requires_human_validation") return "awaiting_validation";
  return "blocked";
}

function deriveControlledMissionValidationMode(
  draft: RuntimeMissionDraft
): RuntimeMissionPromotionValidationMode {
  if (draft.status === "blocked" || draft.kind === "blocked_draft") return "blocked";
  if (draft.risk_level === "sensitive") return "dual_control_required";
  if (draftNeedsHumanValidation(draft)) return "human_validation_required";
  return "human_review_recommended";
}

// ── Controlled mission builder ────────────────────────────────────────────────

export function buildControlledMissionFromDraft(
  draft: RuntimeMissionDraft,
  options?: { status?: ControlledMissionStatus }
): ControlledMission {
  return {
    controlled_mission_id: `ctrlmission_${draft.draft_id}`,
    draft_id: draft.draft_id,
    command_id: draft.command_id,
    intent_id: draft.intent_id,
    route_id: draft.route_id,
    plan_id: draft.plan_id,
    employee_key: draft.employee_key,
    title: draft.title,
    objective: draft.objective,
    summary: draft.summary,
    domain: draft.domain,
    status: options?.status ?? "awaiting_validation",
    risk_level: draft.risk_level,
    validation_mode: deriveControlledMissionValidationMode(draft),
    steps: buildRuntimeMissionPromotionPlanSteps(draft),
    required_validations: buildControlledMissionValidationRequirements(draft),
    guard_snapshot: draft.guard_snapshot,
    trace_snapshot: draft.trace_snapshot,
    scale_snapshot: draft.scale_snapshot,
    queue_snapshot: draft.queue_snapshot,
    cost_snapshot: draft.cost_snapshot,
    idempotency: draft.idempotency,
    safety_flags: buildRuntimeMissionPromotionSafetyFlags(),
    controlled: true,
    promotion_applied: false,
    execution_enabled: false,
    read_only: true,
  };
}

// ── Issues / recommendations / actions ────────────────────────────────────────

export function buildRuntimeMissionPromotionIssues(
  verdict: RuntimeMissionPromotionVerdict,
  gates: RuntimeMissionPromotionGate[]
): RuntimeMissionPromotionIssue[] {
  const issues: RuntimeMissionPromotionIssue[] = [];
  if (verdict === "blocked") {
    issues.push({ code: "promotion_blocked", message: "Promotion bloquée par CloneGuard — décision humaine exclusive.", severity: "blocking" });
  }
  if (verdict === "not_eligible") {
    issues.push({ code: "promotion_not_eligible", message: "Aucun employé IA actif — promotion impossible.", severity: "warning" });
  }
  if (verdict === "requires_human_validation") {
    issues.push({ code: "promotion_requires_human", message: "Validation humaine requise avant toute mission contrôlée.", severity: "warning" });
  }
  for (const g of gates.filter((x) => x.severity === "blocking" && !x.passed)) {
    issues.push({ code: `gate_failed_${g.id}`, message: g.reason ?? `Gate ${g.id} non passé.`, severity: "blocking" });
  }
  return issues;
}

export function buildRuntimeMissionPromotionRecommendations(
  verdict: RuntimeMissionPromotionVerdict
): RuntimeMissionPromotionRecommendation[] {
  const recs: RuntimeMissionPromotionRecommendation[] = [];
  if (verdict === "requires_human_validation") {
    recs.push({ id: "rec-human", text: "Préparer un approbateur humain avant toute mission contrôlée.", href: "/profile/onboarding", action_label: "Onboarding" });
  }
  if (verdict === "not_eligible") {
    recs.push({ id: "rec-domain", text: "Pierre couvre le RH en V1 — reformuler une demande RH.", href: "/profile/agents", action_label: "Mon espace" });
  }
  recs.push({ id: "rec-contract", text: "Contrat de promotion design-only — aucune mission réelle, aucune exécution.", href: "/profile/messages", action_label: "Messages" });
  return recs;
}

export function buildRuntimeMissionPromotionActions(): RuntimeMissionPromotionAction[] {
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
  ];
}

// ── Status (contrat) ──────────────────────────────────────────────────────────

function deriveRuntimeMissionPromotionStatus(
  verdict: RuntimeMissionPromotionVerdict
): RuntimeMissionPromotionStatus {
  switch (verdict) {
    case "eligible":
      return "promotion_contract_ready";
    case "requires_human_validation":
      return "requires_human_validation";
    case "not_eligible":
      return "not_eligible";
    case "blocked":
      return "blocked";
    default:
      return "eligibility_pending";
  }
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionContract(
  draft: RuntimeMissionDraft,
  options?: RuntimeMissionPromotionOptions
): RuntimeMissionPromotionContract {
  const now = options?.now ?? new Date().toISOString();
  const gates = buildRuntimeMissionPromotionGates(draft);
  const needsHuman = draftNeedsHumanValidation(draft);
  const decision = evaluateRuntimeMissionPromotionEligibility(gates, needsHuman);
  const status = deriveRuntimeMissionPromotionStatus(decision.verdict);

  const controlledProducible =
    decision.verdict === "eligible" || decision.verdict === "requires_human_validation";
  const controlled_mission = controlledProducible
    ? buildControlledMissionFromDraft(draft, { status: deriveControlledMissionStatus(decision.verdict) })
    : null;

  return {
    phase: "4.8",
    mode: "design_only",
    promotion_id: `promo_${draft.draft_id}`,
    draft_id: draft.draft_id,
    status,
    gates,
    decision,
    controlled_mission,
    safety_flags: buildRuntimeMissionPromotionSafetyFlags(),
    issues: buildRuntimeMissionPromotionIssues(decision.verdict, gates),
    recommendations: buildRuntimeMissionPromotionRecommendations(decision.verdict),
    actions: buildRuntimeMissionPromotionActions(),
    scale_80k_not_proven: true,
    public_launch_external_validated: false,
    read_only: true,
    generated_at: now,
  };
}

// ── No-execution assertion ────────────────────────────────────────────────────

export function assertRuntimeMissionPromotionNoExecution(
  contract: RuntimeMissionPromotionContract
): { safe: boolean; issues: RuntimeMissionPromotionIssue[] } {
  const issues: RuntimeMissionPromotionIssue[] = [];
  const sf = contract.safety_flags;
  const mustBeFalse: Array<[string, boolean]> = [
    ["promotion_applied", sf.promotion_applied],
    ["execution_enabled", sf.execution_enabled],
    ["mission_executed", sf.mission_executed],
    ["autonomous_execution", sf.autonomous_execution],
    ["pierre_engine_called", sf.pierre_engine_called],
    ["ai_call_performed", sf.ai_call_performed],
    ["db_write_performed", sf.db_write_performed],
    ["email_sent", sf.email_sent],
    ["message_sent", sf.message_sent],
    ["document_generated", sf.document_generated],
    ["clonevoice_active", sf.clonevoice_active],
    ["public_launch_external_validated", sf.public_launch_external_validated],
  ];
  for (const [name, value] of mustBeFalse) {
    if (value !== false) {
      issues.push({ code: "promotion_no_execution_violation", message: `${name} doit être false.`, severity: "blocking" });
    }
  }
  if (contract.decision.promotion_applied !== false) {
    issues.push({ code: "promotion_applied_violation", message: "decision.promotion_applied doit être false.", severity: "blocking" });
  }
  if (contract.controlled_mission && contract.controlled_mission.execution_enabled !== false) {
    issues.push({ code: "controlled_execution_violation", message: "controlled_mission.execution_enabled doit être false.", severity: "blocking" });
  }
  return { safe: issues.length === 0, issues };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateRuntimeMissionPromotionContract(
  contract: RuntimeMissionPromotionContract
): { valid: boolean; issues: RuntimeMissionPromotionIssue[] } {
  const issues: RuntimeMissionPromotionIssue[] = [];
  if (!contract.promotion_id?.trim()) issues.push({ code: "promotion_id_required", message: "promotion_id requis.", severity: "blocking" });
  if (!contract.draft_id?.trim()) issues.push({ code: "draft_id_required", message: "draft_id requis.", severity: "blocking" });
  if (contract.mode !== "design_only" && contract.mode !== "contract_only") {
    issues.push({ code: "mode_invalid", message: "mode doit être design_only/contract_only.", severity: "blocking" });
  }
  if (contract.read_only !== true) issues.push({ code: "read_only_violation", message: "read_only doit être true.", severity: "blocking" });
  if (contract.safety_flags.requires_human_validation !== true) {
    issues.push({ code: "human_validation_required_flag", message: "requires_human_validation doit être true.", severity: "blocking" });
  }
  if (contract.safety_flags.controlled !== true) {
    issues.push({ code: "controlled_flag", message: "controlled doit être true.", severity: "blocking" });
  }

  // Si une mission contrôlée est produite, elle doit conserver CloneGuard/CloneTrace/idempotency.
  const cm = contract.controlled_mission;
  if (cm) {
    if (cm.guard_snapshot?.cloneguard_required !== true) {
      issues.push({ code: "controlled_cloneguard_required", message: "CloneGuard obligatoire dans la mission contrôlée.", severity: "blocking" });
    }
    if (cm.trace_snapshot?.clonetrace_required !== true) {
      issues.push({ code: "controlled_clonetrace_required", message: "CloneTrace obligatoire dans la mission contrôlée.", severity: "blocking" });
    }
    if (cm.idempotency?.required !== true) {
      issues.push({ code: "controlled_idempotency_required", message: "Idempotency obligatoire dans la mission contrôlée.", severity: "blocking" });
    }
    if (cm.required_validations.length === 0) {
      issues.push({ code: "controlled_validation_required", message: "Au moins une validation humaine requise.", severity: "blocking" });
    }
  }

  issues.push(...assertRuntimeMissionPromotionNoExecution(contract).issues);
  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeMissionPromotionContract(
  contract: RuntimeMissionPromotionContract
): string {
  return [
    `[Promotion Contract PHASE 4.8] ${contract.status} · verdict : ${contract.decision.verdict}`,
    `  Gates bloquants échoués : ${contract.decision.blocking_gates.length}`,
    `  Mission contrôlée produite : ${contract.controlled_mission ? contract.controlled_mission.status : "non"}`,
    `  promotion_applied : ${contract.safety_flags.promotion_applied} · execution_enabled : false`,
    `  Validation humaine requise · CloneGuard et CloneTrace obligatoires.`,
    `  Design-only — aucune mission réelle, aucun appel Pierre, aucun appel IA.`,
    `  Scale 80k non prouvé. Lancement public externe non validé.`,
  ].join("\n");
}
