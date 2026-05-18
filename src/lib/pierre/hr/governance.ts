// Pierre HR Engine — Governance Runtime (Bloc 15)
// Pure module: no Supabase, no Next, no async, no side effects
// Role: unified orchestrator — CloneGuard + ClonePolicy + CloneTrust → final decision

import {
  type PierreHrRiskLevel,
  normalizePierreHrRiskLevel,
  getPierreHrRiskRank,
  getHighestPierreHrRiskLevel,
} from "./contracts";

import {
  type PierreCloneGuardContext,
  type PierreCloneGuardEvaluation,
  type PierreCloneGuardDecision,
  evaluatePierreCloneGuard,
  summarizeCloneGuardEvaluation,
} from "./cloneguard";

import {
  type PierreClonePolicyContext,
  type PierreClonePolicyEvaluation,
  type PierreClonePolicyDecision,
  type PierreClonePolicyRule,
  evaluatePierreClonePolicy,
  summarizeClonePolicyEvaluation,
} from "./clonepolicy";

import {
  type PierreCloneTrustContext,
  type PierreCloneTrustEvaluation,
  type PierreCloneTrustDecision,
  type PierreCloneTrustLevel,
  evaluatePierreCloneTrust,
  summarizeCloneTrustEvaluation,
} from "./clonetrust";

// ══════════════════════════════════════════════════════════
// 1. TYPES
// ══════════════════════════════════════════════════════════

// Governance adds "supervised" between allow_with_warning and require_approval
export type PierreGovernanceDecision =
  | "allow"
  | "allow_with_warning"
  | "supervised"
  | "require_approval"
  | "block"
  | "refuse";

export type PierreGovernanceRiskLevel = PierreHrRiskLevel;

export type PierreGovernanceContext = {
  // Shared task fields — forwarded to all three evaluators
  task_type?: string | null;
  task_title?: string | null;
  task_description?: string | null;
  payload_json?: Record<string, unknown> | null;
  domain?: string | null;
  action_kind?: string | null;
  risk_level_hint?: string | null;
  autonomy_level?: string | null;
  approval_required?: boolean | null;
  employee_id?: string | null;
  employee_name?: string | null;
  employee_site?: string | null;
  employee_department?: string | null;
  mission_id?: string | null;
  mission_summary?: string | null;
  text_corpus?: string | null;
  // CloneTrust-specific
  company_trust_score?: number | null;
  historical_success_rate?: number | null;
  historical_task_count?: number | null;
  employee_file_risk?: string | null;
  // Company data (forwarded to ClonePolicy)
  company_memory?: Record<string, unknown> | null;
  runtime_policy_rules?: PierreClonePolicyRule[] | null;
  // Pre-computed sub-evaluations (optional — governance computes missing ones)
  guard_evaluation?: PierreCloneGuardEvaluation | null;
  policy_evaluation?: PierreClonePolicyEvaluation | null;
  trust_evaluation?: PierreCloneTrustEvaluation | null;
  now?: string | null;
};

export type PierreGovernanceEvaluation = {
  decision: PierreGovernanceDecision;
  risk_level: PierreGovernanceRiskLevel;
  guard_decision: PierreCloneGuardDecision;
  policy_decision: PierreClonePolicyDecision;
  trust_decision: PierreCloneTrustDecision;
  trust_level: PierreCloneTrustLevel;
  trust_score: number;
  allowed_to_auto_execute: boolean;
  requires_human: boolean;
  explanation: string;
  audit_trail: string[];
  evaluated_at: string;
};

export type PierreGovernancePreview = {
  decision: PierreGovernanceDecision;
  risk_level: PierreGovernanceRiskLevel;
  guard_decision: PierreCloneGuardDecision;
  policy_decision: PierreClonePolicyDecision;
  trust_decision: PierreCloneTrustDecision;
  allowed_to_auto_execute: boolean;
  summary: string;
};

export type PierreGovernanceAuditEvent = {
  event_type:
    | "governance_evaluation"
    | "governance_execution_blocked"
    | "governance_auto_allowed";
  message: string;
  meta_json: {
    decision: PierreGovernanceDecision;
    risk_level: PierreGovernanceRiskLevel;
    guard_decision: PierreCloneGuardDecision;
    policy_decision: PierreClonePolicyDecision;
    trust_decision: PierreCloneTrustDecision;
    trust_level: PierreCloneTrustLevel;
    trust_score: number;
    allowed_to_auto_execute: boolean;
    task_type?: string | null;
    domain?: string | null;
    employee_id?: string | null;
    mission_id?: string | null;
  };
};

export type PierreGovernanceBriefing = {
  decision: PierreGovernanceDecision;
  risk_level: PierreGovernanceRiskLevel;
  summary: string;
  guard_summary: string;
  policy_summary: string;
  trust_summary: string;
  human_actions: string[];
  allowed_to_auto_execute: boolean;
};

export type PierreGovernanceCard = {
  task_id?: string | null;
  task_type?: string | null;
  domain?: string | null;
  decision: PierreGovernanceDecision;
  risk_level: PierreGovernanceRiskLevel;
  allowed_to_auto_execute: boolean;
  requires_human: boolean;
  trust_level: PierreCloneTrustLevel;
  trust_score: number;
  guard_decision: PierreCloneGuardDecision;
  policy_decision: PierreClonePolicyDecision;
  trust_decision: PierreCloneTrustDecision;
  explanation: string;
  evaluated_at: string;
};

// ══════════════════════════════════════════════════════════
// 2. DECISION RANKING
// ══════════════════════════════════════════════════════════

// Governance adds "supervised" (rank 2) between allow_with_warning (1) and require_approval (3)
const GOVERNANCE_DECISION_RANK: Record<PierreGovernanceDecision, number> = {
  allow: 0,
  allow_with_warning: 1,
  supervised: 2,
  require_approval: 3,
  block: 4,
  refuse: 5,
};

function worstGovernanceDecision(
  a: PierreGovernanceDecision,
  b: PierreGovernanceDecision,
): PierreGovernanceDecision {
  return GOVERNANCE_DECISION_RANK[a] >= GOVERNANCE_DECISION_RANK[b] ? a : b;
}

// ══════════════════════════════════════════════════════════
// 3. DECISION CONVERTERS
// ══════════════════════════════════════════════════════════

function guardDecisionToGovernance(d: PierreCloneGuardDecision): PierreGovernanceDecision {
  if (d === "allow") return "allow";
  if (d === "allow_with_warning") return "allow_with_warning";
  if (d === "require_approval") return "require_approval";
  if (d === "block") return "block";
  if (d === "refuse") return "refuse";
  return "allow_with_warning";
}

function policyDecisionToGovernance(d: PierreClonePolicyDecision): PierreGovernanceDecision {
  if (d === "allow") return "allow";
  if (d === "allow_with_warning") return "allow_with_warning";
  if (d === "require_approval") return "require_approval";
  if (d === "block") return "block";
  if (d === "refuse") return "refuse";
  return "allow_with_warning";
}

function trustDecisionToGovernance(d: PierreCloneTrustDecision): PierreGovernanceDecision {
  if (d === "auto_allowed") return "allow";
  if (d === "supervised_execution") return "supervised";
  if (d === "approval_required") return "require_approval";
  if (d === "manual_only") return "refuse";
  return "require_approval";
}

// ══════════════════════════════════════════════════════════
// 4. NORMALIZERS
// ══════════════════════════════════════════════════════════

export function normalizeGovernanceDecision(value: unknown): PierreGovernanceDecision {
  if (typeof value !== "string") return "allow_with_warning";
  const t = value.trim().toLowerCase();
  if (t === "allow") return "allow";
  if (t === "allow_with_warning") return "allow_with_warning";
  if (t === "supervised") return "supervised";
  if (t === "require_approval") return "require_approval";
  if (t === "block") return "block";
  if (t === "refuse") return "refuse";
  return "allow_with_warning";
}

export function normalizeGovernanceRiskLevel(value: unknown): PierreGovernanceRiskLevel {
  return normalizePierreHrRiskLevel(value);
}

// ══════════════════════════════════════════════════════════
// 5. CONTEXT BUILDER
// ══════════════════════════════════════════════════════════

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function buildGovernanceContext(
  raw: Record<string, unknown>,
): PierreGovernanceContext {
  if (!isObject(raw)) return {};

  return {
    task_type: asString(raw.task_type),
    task_title: asString(raw.task_title),
    task_description: asString(raw.task_description),
    payload_json: isObject(raw.payload_json) ? raw.payload_json : null,
    domain: asString(raw.domain),
    action_kind: asString(raw.action_kind),
    risk_level_hint: asString(raw.risk_level_hint),
    autonomy_level: asString(raw.autonomy_level),
    approval_required:
      typeof raw.approval_required === "boolean" ? raw.approval_required : null,
    employee_id: asString(raw.employee_id),
    employee_name: asString(raw.employee_name),
    employee_site: asString(raw.employee_site),
    employee_department: asString(raw.employee_department),
    mission_id: asString(raw.mission_id),
    mission_summary: asString(raw.mission_summary),
    text_corpus: asString(raw.text_corpus),
    company_trust_score:
      typeof raw.company_trust_score === "number" ? raw.company_trust_score : null,
    historical_success_rate:
      typeof raw.historical_success_rate === "number" ? raw.historical_success_rate : null,
    historical_task_count:
      typeof raw.historical_task_count === "number" ? raw.historical_task_count : null,
    employee_file_risk: asString(raw.employee_file_risk),
    company_memory: isObject(raw.company_memory) ? raw.company_memory : null,
    runtime_policy_rules: Array.isArray(raw.runtime_policy_rules)
      ? (raw.runtime_policy_rules as PierreClonePolicyRule[])
      : null,
    now: asString(raw.now),
  };
}

// ══════════════════════════════════════════════════════════
// 6. SUB-CONTEXT BUILDERS
// ══════════════════════════════════════════════════════════

function toGuardContext(ctx: PierreGovernanceContext): PierreCloneGuardContext {
  return {
    task_type: ctx.task_type,
    task_title: ctx.task_title,
    task_description: ctx.task_description,
    payload_json: ctx.payload_json,
    approval_required: ctx.approval_required,
    domain: ctx.domain,
    risk_level_hint: ctx.risk_level_hint,
    text_corpus: ctx.text_corpus,
    autonomy_level: ctx.autonomy_level,
    now: ctx.now,
  };
}

function toPolicyContext(ctx: PierreGovernanceContext): PierreClonePolicyContext {
  return {
    task_type: ctx.task_type,
    task_title: ctx.task_title,
    task_description: ctx.task_description,
    payload_json: ctx.payload_json,
    domain: ctx.domain,
    action_kind: ctx.action_kind,
    risk_level_hint: ctx.risk_level_hint,
    autonomy_level: ctx.autonomy_level,
    approval_required: ctx.approval_required,
    employee_id: ctx.employee_id,
    employee_name: ctx.employee_name,
    employee_site: ctx.employee_site,
    employee_department: ctx.employee_department,
    mission_id: ctx.mission_id,
    mission_summary: ctx.mission_summary,
    text_corpus: ctx.text_corpus,
    company_memory: ctx.company_memory,
    runtime_rules: ctx.runtime_policy_rules,
    now: ctx.now,
  };
}

function toTrustContext(
  ctx: PierreGovernanceContext,
  guardEval: PierreCloneGuardEvaluation,
  policyEval: PierreClonePolicyEvaluation,
): PierreCloneTrustContext {
  return {
    task_type: ctx.task_type,
    task_title: ctx.task_title,
    task_description: ctx.task_description,
    domain: ctx.domain,
    action_kind: ctx.action_kind,
    risk_level_hint: ctx.risk_level_hint,
    autonomy_level: ctx.autonomy_level,
    approval_required: ctx.approval_required,
    employee_id: ctx.employee_id,
    employee_name: ctx.employee_name,
    mission_id: ctx.mission_id,
    company_trust_score: ctx.company_trust_score,
    historical_success_rate: ctx.historical_success_rate,
    historical_task_count: ctx.historical_task_count,
    employee_file_risk: ctx.employee_file_risk,
    cloneguard_decision: guardEval.decision,
    clonepolicy_decision: policyEval.decision,
    company_memory: ctx.company_memory,
    now: ctx.now,
  };
}

// ══════════════════════════════════════════════════════════
// 7. COMBINE DECISIONS
// ══════════════════════════════════════════════════════════

export function combineGovernanceDecisions(
  guardEval: PierreCloneGuardEvaluation,
  policyEval: PierreClonePolicyEvaluation,
  trustEval: PierreCloneTrustEvaluation,
): PierreGovernanceDecision {
  const gDec = guardDecisionToGovernance(guardEval.decision);
  const pDec = policyDecisionToGovernance(policyEval.decision);
  const tDec = trustDecisionToGovernance(trustEval.decision);
  return worstGovernanceDecision(worstGovernanceDecision(gDec, pDec), tDec);
}

// ══════════════════════════════════════════════════════════
// 8. MAIN EVALUATOR
// ══════════════════════════════════════════════════════════

export function evaluateGovernance(
  ctx: PierreGovernanceContext,
): PierreGovernanceEvaluation {
  if (!ctx || typeof ctx !== "object") {
    return {
      decision: "require_approval",
      risk_level: "red",
      guard_decision: "require_approval",
      policy_decision: "require_approval",
      trust_decision: "approval_required",
      trust_level: "supervised",
      trust_score: 50,
      allowed_to_auto_execute: false,
      requires_human: true,
      explanation: "Contexte vide — gouvernance par défaut: validation obligatoire.",
      audit_trail: [],
      evaluated_at: "",
    };
  }

  // Run sub-evaluators (use pre-computed if provided)
  let guardEval: PierreCloneGuardEvaluation;
  try {
    guardEval =
      ctx.guard_evaluation && typeof ctx.guard_evaluation === "object"
        ? ctx.guard_evaluation
        : evaluatePierreCloneGuard(toGuardContext(ctx));
  } catch (_e) {
    guardEval = {
      decision: "require_approval",
      risk_level: "red",
      signals: [],
      matched_rules: [],
      allowed_to_auto_execute: false,
      requires_human: true,
      explanation: "CloneGuard erreur interne.",
      human_note: "",
      evaluated_at: "",
    };
  }

  let policyEval: PierreClonePolicyEvaluation;
  try {
    policyEval =
      ctx.policy_evaluation && typeof ctx.policy_evaluation === "object"
        ? ctx.policy_evaluation
        : evaluatePierreClonePolicy(toPolicyContext(ctx));
  } catch (_e) {
    policyEval = {
      decision: "require_approval",
      risk_level: "red",
      matched_rules: [],
      allowed_to_auto_execute: false,
      requires_human: true,
      explanation: "ClonePolicy erreur interne.",
      human_note: "",
      evaluated_at: "",
    };
  }

  let trustEval: PierreCloneTrustEvaluation;
  try {
    trustEval =
      ctx.trust_evaluation && typeof ctx.trust_evaluation === "object"
        ? ctx.trust_evaluation
        : evaluatePierreCloneTrust(toTrustContext(ctx, guardEval, policyEval));
  } catch (_e) {
    trustEval = {
      trust_level: "supervised",
      trust_score: 50,
      decision: "approval_required",
      factors: [],
      hard_blocks: [],
      allowed_to_auto_execute: false,
      requires_human: true,
      explanation: "CloneTrust erreur interne.",
      human_note: "",
      evaluated_at: "",
    };
  }

  // Combine all three decisions — strictest wins
  const governanceDecision = combineGovernanceDecisions(guardEval, policyEval, trustEval);

  // Effective risk level — maximum across all three
  const guardRisk = normalizePierreHrRiskLevel(guardEval.risk_level);
  const policyRisk = normalizePierreHrRiskLevel(policyEval.risk_level);
  const trustRisk = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  const effectiveRisk = getHighestPierreHrRiskLevel(
    getHighestPierreHrRiskLevel(guardRisk, policyRisk),
    trustRisk,
  );

  // allowed_to_auto_execute only if ALL THREE sub-evaluators say yes
  const allowed_to_auto_execute =
    guardEval.allowed_to_auto_execute === true &&
    policyEval.allowed_to_auto_execute === true &&
    trustEval.allowed_to_auto_execute === true &&
    governanceDecision === "allow";

  const requires_human =
    governanceDecision === "require_approval" ||
    governanceDecision === "block" ||
    governanceDecision === "refuse";

  // Build audit trail
  const audit_trail: string[] = [
    `CloneGuard: ${guardEval.decision}`,
    `ClonePolicy: ${policyEval.decision}`,
    `CloneTrust: ${trustEval.decision} (niveau: ${trustEval.trust_level}, score: ${trustEval.trust_score})`,
    `Gouvernance finale: ${governanceDecision}`,
  ];

  // Build explanation
  let explanation: string;
  if (governanceDecision === "refuse") {
    const source = GOVERNANCE_DECISION_RANK[guardDecisionToGovernance(guardEval.decision)] >= 5
      ? "CloneGuard"
      : GOVERNANCE_DECISION_RANK[policyDecisionToGovernance(policyEval.decision)] >= 5
        ? "ClonePolicy"
        : "CloneTrust";
    explanation = `Action refusée (${source}). Intervention humaine exclusive.`;
  } else if (governanceDecision === "block") {
    explanation = `Exécution automatique bloquée. ${guardEval.decision === "block" ? guardEval.explanation : policyEval.explanation}`;
  } else if (governanceDecision === "require_approval") {
    explanation = `Validation humaine obligatoire (gouvernance). Guard: ${guardEval.decision} | Policy: ${policyEval.decision} | Trust: ${trustEval.decision}.`;
  } else if (governanceDecision === "supervised") {
    explanation = `Exécution supervisée. Niveau de confiance: ${trustEval.trust_level} (score: ${trustEval.trust_score}/100).`;
  } else if (governanceDecision === "allow_with_warning") {
    explanation = `Action autorisée avec avertissement. ${guardEval.explanation || policyEval.explanation}`;
  } else {
    explanation = `Action autorisée par la gouvernance. Guard: allow | Policy: allow | Trust: auto_allowed (${trustEval.trust_score}/100).`;
  }

  return {
    decision: governanceDecision,
    risk_level: effectiveRisk,
    guard_decision: guardEval.decision,
    policy_decision: policyEval.decision,
    trust_decision: trustEval.decision,
    trust_level: trustEval.trust_level,
    trust_score: trustEval.trust_score,
    allowed_to_auto_execute,
    requires_human,
    explanation,
    audit_trail,
    evaluated_at: typeof ctx.now === "string" ? ctx.now : "",
  };
}

// ══════════════════════════════════════════════════════════
// 9. BUILD PREVIEW
// ══════════════════════════════════════════════════════════

export function buildGovernancePreview(
  evaluation: PierreGovernanceEvaluation,
): PierreGovernancePreview {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      decision: "require_approval",
      risk_level: "red",
      guard_decision: "require_approval",
      policy_decision: "require_approval",
      trust_decision: "approval_required",
      allowed_to_auto_execute: false,
      summary: "Évaluation gouvernance non disponible.",
    };
  }

  const summaryMap: Record<PierreGovernanceDecision, string> = {
    allow: "Action autorisée par la gouvernance.",
    allow_with_warning: "Action autorisée — validation recommandée (gouvernance).",
    supervised: "Exécution supervisée autorisée (gouvernance).",
    require_approval: "Validation humaine obligatoire (gouvernance).",
    block: "Exécution automatique bloquée (gouvernance).",
    refuse: "Action refusée — intervention humaine exclusive (gouvernance).",
  };

  return {
    decision: evaluation.decision,
    risk_level: evaluation.risk_level,
    guard_decision: evaluation.guard_decision,
    policy_decision: evaluation.policy_decision,
    trust_decision: evaluation.trust_decision,
    allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
    summary: summaryMap[evaluation.decision] ?? "Évaluation gouvernance.",
  };
}

// ══════════════════════════════════════════════════════════
// 10. BUILD AUDIT EVENT
// ══════════════════════════════════════════════════════════

export function buildGovernanceAuditEvent(
  evaluation: PierreGovernanceEvaluation,
  ctx?: PierreGovernanceContext,
): PierreGovernanceAuditEvent {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      event_type: "governance_evaluation",
      message: "Gouvernance évaluation — données manquantes.",
      meta_json: {
        decision: "require_approval",
        risk_level: "red",
        guard_decision: "require_approval",
        policy_decision: "require_approval",
        trust_decision: "approval_required",
        trust_level: "supervised",
        trust_score: 50,
        allowed_to_auto_execute: false,
      },
    };
  }

  const eventType: PierreGovernanceAuditEvent["event_type"] =
    evaluation.decision === "block" || evaluation.decision === "refuse"
      ? "governance_execution_blocked"
      : evaluation.allowed_to_auto_execute
        ? "governance_auto_allowed"
        : "governance_evaluation";

  return {
    event_type: eventType,
    message: evaluation.explanation || "Gouvernance évaluation complète.",
    meta_json: {
      decision: evaluation.decision,
      risk_level: evaluation.risk_level,
      guard_decision: evaluation.guard_decision,
      policy_decision: evaluation.policy_decision,
      trust_decision: evaluation.trust_decision,
      trust_level: evaluation.trust_level,
      trust_score: evaluation.trust_score,
      allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
      task_type: ctx?.task_type ?? null,
      domain: ctx?.domain ?? null,
      employee_id: ctx?.employee_id ?? null,
      mission_id: ctx?.mission_id ?? null,
    },
  };
}

// ══════════════════════════════════════════════════════════
// 11. APPLY TO TASK
// ══════════════════════════════════════════════════════════

export function applyGovernanceToTask(
  task: Record<string, unknown>,
  evaluation: PierreGovernanceEvaluation,
): Record<string, unknown> {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return { governance: null };
  }

  const evalData =
    evaluation && typeof evaluation === "object"
      ? {
          decision: evaluation.decision,
          risk_level: evaluation.risk_level,
          guard_decision: evaluation.guard_decision,
          policy_decision: evaluation.policy_decision,
          trust_decision: evaluation.trust_decision,
          trust_level: evaluation.trust_level,
          trust_score: evaluation.trust_score,
          allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
          requires_human: evaluation.requires_human,
          explanation: evaluation.explanation,
        }
      : null;

  return { ...task, governance: evalData };
}

// ══════════════════════════════════════════════════════════
// 12. FAST PATH
// ══════════════════════════════════════════════════════════

export function isGovernanceAutoExecutable(ctx: PierreGovernanceContext): boolean {
  if (!ctx || typeof ctx !== "object") return false;

  // Fast-path absolute blocks
  const taskType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : "";
  if (taskType === "email.send" || taskType === "send_email") return false;
  if (ctx.approval_required === true) return false;

  const riskLevel = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  if (getPierreHrRiskRank(riskLevel) >= getPierreHrRiskRank("red")) return false;

  const employeeRisk = normalizePierreHrRiskLevel(ctx.employee_file_risk);
  if (getPierreHrRiskRank(employeeRisk) >= getPierreHrRiskRank("red")) return false;

  return evaluateGovernance(ctx).allowed_to_auto_execute;
}

// ══════════════════════════════════════════════════════════
// 13. SUMMARIZE
// ══════════════════════════════════════════════════════════

export function summarizeGovernanceEvaluation(
  evaluation: PierreGovernanceEvaluation,
): string {
  if (!evaluation || typeof evaluation !== "object") {
    return "Évaluation gouvernance non disponible.";
  }

  const decisionLabels: Record<PierreGovernanceDecision, string> = {
    allow: "Autorisé",
    allow_with_warning: "Autorisé (avec avertissement)",
    supervised: "Exécution supervisée",
    require_approval: "Validation obligatoire",
    block: "Bloqué",
    refuse: "Refusé",
  };

  const riskLabels: Record<PierreHrRiskLevel, string> = {
    green: "Vert",
    orange: "Orange",
    red: "Rouge",
    black: "Noir",
  };

  const lines: string[] = [
    `Décision: ${decisionLabels[evaluation.decision] ?? evaluation.decision}`,
    `Risque: ${riskLabels[evaluation.risk_level] ?? evaluation.risk_level}`,
    `Guard: ${evaluation.guard_decision} | Policy: ${evaluation.policy_decision} | Trust: ${evaluation.trust_decision}`,
    `Confiance: ${evaluation.trust_level} (${evaluation.trust_score}/100)`,
  ];

  if (!evaluation.allowed_to_auto_execute) {
    lines.push("Auto-exécution: non autorisée");
  }

  return lines.join(" | ");
}

// ══════════════════════════════════════════════════════════
// 14. BUILD BRIEFING
// ══════════════════════════════════════════════════════════

export function buildGovernanceBriefing(
  evaluation: PierreGovernanceEvaluation,
  guardEval: PierreCloneGuardEvaluation,
  policyEval: PierreClonePolicyEvaluation,
  trustEval: PierreCloneTrustEvaluation,
): PierreGovernanceBriefing {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      decision: "require_approval",
      risk_level: "red",
      summary: "Évaluation gouvernance non disponible.",
      guard_summary: "",
      policy_summary: "",
      trust_summary: "",
      human_actions: ["Vérifier le contexte de la tâche avant toute action."],
      allowed_to_auto_execute: false,
    };
  }

  const human_actions: string[] = [];
  if (evaluation.decision === "refuse") {
    human_actions.push(
      "Intervention humaine exclusive requise. Pierre ne peut pas agir sur cette demande.",
    );
  } else if (evaluation.decision === "block") {
    human_actions.push(
      "Exécution automatique interdite. Un humain doit prendre en charge cette action.",
    );
  } else if (evaluation.decision === "require_approval") {
    human_actions.push("Valider ou rejeter cette action avant toute exécution.");
  } else if (evaluation.decision === "supervised") {
    human_actions.push(
      "Surveiller l'exécution. Une notification sera envoyée après l'action.",
    );
  } else if (evaluation.decision === "allow_with_warning") {
    human_actions.push("Action autorisée — relecture recommandée avant usage ou diffusion.");
  }

  const decisionSummaryMap: Record<PierreGovernanceDecision, string> = {
    allow: "La gouvernance Pierre autorise cette action en auto-exécution.",
    allow_with_warning:
      "La gouvernance Pierre autorise cette action avec avertissement. Une relecture est recommandée.",
    supervised:
      "La gouvernance Pierre autorise une exécution supervisée. Niveau de confiance insuffisant pour une automation complète.",
    require_approval:
      "La gouvernance Pierre requiert une validation humaine avant toute exécution.",
    block: "La gouvernance Pierre bloque l'exécution automatique de cette action.",
    refuse:
      "La gouvernance Pierre refuse cette demande. L'action est réservée à un humain sans exception.",
  };

  let guardSummary = "";
  let policySummary = "";
  let trustSummary = "";
  try { guardSummary = summarizeCloneGuardEvaluation(guardEval); } catch (_e) { /* skip malformed row */ }
  try { policySummary = summarizeClonePolicyEvaluation(policyEval); } catch (_e) { /* skip malformed row */ }
  try { trustSummary = summarizeCloneTrustEvaluation(trustEval); } catch (_e) { /* skip malformed row */ }

  return {
    decision: evaluation.decision,
    risk_level: evaluation.risk_level,
    summary: decisionSummaryMap[evaluation.decision] ?? evaluation.explanation,
    guard_summary: guardSummary,
    policy_summary: policySummary,
    trust_summary: trustSummary,
    human_actions,
    allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
  };
}

// ══════════════════════════════════════════════════════════
// 15. BUILD GOVERNANCE CARD
// ══════════════════════════════════════════════════════════

export function buildGovernanceCard(
  evaluation: PierreGovernanceEvaluation,
  ctx?: PierreGovernanceContext,
): PierreGovernanceCard {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      task_id: null,
      task_type: null,
      domain: null,
      decision: "require_approval",
      risk_level: "red",
      allowed_to_auto_execute: false,
      requires_human: true,
      trust_level: "supervised",
      trust_score: 50,
      guard_decision: "require_approval",
      policy_decision: "require_approval",
      trust_decision: "approval_required",
      explanation: "Évaluation gouvernance non disponible.",
      evaluated_at: "",
    };
  }

  return {
    task_id: ctx?.mission_id ?? null,
    task_type: ctx?.task_type ?? null,
    domain: ctx?.domain ?? null,
    decision: evaluation.decision,
    risk_level: evaluation.risk_level,
    allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
    requires_human: evaluation.requires_human,
    trust_level: evaluation.trust_level,
    trust_score: evaluation.trust_score,
    guard_decision: evaluation.guard_decision,
    policy_decision: evaluation.policy_decision,
    trust_decision: evaluation.trust_decision,
    explanation: evaluation.explanation,
    evaluated_at: evaluation.evaluated_at,
  };
}

// ══════════════════════════════════════════════════════════
// 16. FILTER SAFE TO RUN
// ══════════════════════════════════════════════════════════

export function filterGovernanceSafeToRun<T extends Record<string, unknown>>(
  items: T[],
  getEvaluation: (item: T) => PierreGovernanceEvaluation | null | undefined,
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    try {
      const evaluation = getEvaluation(item);
      return (
        evaluation != null &&
        typeof evaluation === "object" &&
        evaluation.allowed_to_auto_execute === true
      );
    } catch (_e) {
      return false;
    }
  });
}
