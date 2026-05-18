// Pierre HR Engine — CloneTrust Runtime (Bloc 15)
// Pure module: no Supabase, no Next, no async, no side effects
// Role: gradual autonomy calculation — trust level, history, risk, CloneGuard, ClonePolicy

import {
  type PierreHrRiskLevel,
  normalizePierreHrRiskLevel,
  getPierreHrRiskRank,
} from "./contracts";

// ══════════════════════════════════════════════════════════
// 1. TYPES
// ══════════════════════════════════════════════════════════

export type PierreCloneTrustLevel =
  | "manual_only"
  | "approval_first"
  | "supervised"
  | "limited_auto"
  | "standard_auto"
  | "high_trust";

export type PierreCloneTrustDecision =
  | "manual_only"
  | "approval_required"
  | "supervised_execution"
  | "auto_allowed";

export type PierreCloneTrustRiskLevel = PierreHrRiskLevel;

export type PierreCloneTrustFactor = {
  name: string;
  value: number;
  raw_value: unknown;
  note: string;
};

export type PierreCloneTrustContext = {
  task_type?: string | null;
  task_title?: string | null;
  task_description?: string | null;
  domain?: string | null;
  action_kind?: string | null;
  risk_level_hint?: string | null;
  autonomy_level?: string | null;
  approval_required?: boolean | null;
  employee_id?: string | null;
  employee_name?: string | null;
  mission_id?: string | null;
  company_trust_score?: number | null;
  historical_success_rate?: number | null;
  historical_task_count?: number | null;
  cloneguard_decision?: string | null;
  clonepolicy_decision?: string | null;
  employee_file_risk?: string | null;
  company_memory?: Record<string, unknown> | null;
  now?: string | null;
};

export type PierreCloneTrustEvaluation = {
  trust_level: PierreCloneTrustLevel;
  trust_score: number;
  decision: PierreCloneTrustDecision;
  factors: PierreCloneTrustFactor[];
  hard_blocks: string[];
  allowed_to_auto_execute: boolean;
  requires_human: boolean;
  explanation: string;
  human_note: string;
  evaluated_at: string;
};

export type PierreCloneTrustPreview = {
  trust_level: PierreCloneTrustLevel;
  trust_score: number;
  decision: PierreCloneTrustDecision;
  allowed_to_auto_execute: boolean;
  hard_blocks_count: number;
  summary: string;
};

export type PierreCloneTrustAuditEvent = {
  event_type:
    | "clonetrust_evaluation"
    | "clonetrust_hard_block"
    | "clonetrust_auto_allowed";
  message: string;
  meta_json: {
    trust_level: PierreCloneTrustLevel;
    trust_score: number;
    decision: PierreCloneTrustDecision;
    hard_blocks: string[];
    allowed_to_auto_execute: boolean;
    task_type?: string | null;
    domain?: string | null;
    employee_id?: string | null;
    mission_id?: string | null;
  };
};

// ══════════════════════════════════════════════════════════
// 2. CONSTANTS
// ══════════════════════════════════════════════════════════

// Score thresholds — descending so first match wins
const TRUST_LEVEL_THRESHOLDS: { level: PierreCloneTrustLevel; min: number }[] = [
  { level: "high_trust", min: 81 },
  { level: "standard_auto", min: 61 },
  { level: "limited_auto", min: 46 },
  { level: "supervised", min: 31 },
  { level: "approval_first", min: 16 },
  { level: "manual_only", min: 0 },
];

// PierreAutonomyLevel caps on trust level (can only restrict, never boost)
const AUTONOMY_LEVEL_CAPS: Record<string, PierreCloneTrustLevel> = {
  draft_only: "approval_first",
  low_risk_execution: "supervised",
  validation_smart: "limited_auto",
  advanced_operations: "standard_auto",
  enterprise_rules: "high_trust",
};

const TRUST_LEVEL_RANK: Record<PierreCloneTrustLevel, number> = {
  manual_only: 0,
  approval_first: 1,
  supervised: 2,
  limited_auto: 3,
  standard_auto: 4,
  high_trust: 5,
};

// Task types that force manual_only regardless of score
const MANUAL_ONLY_TYPES = new Set([
  "decision_licenciement",
  "decision_discriminatoire",
  "envoi_juridique_sensible",
  "interpretation_droit",
  "modification_politique_rh",
  "decision_salariale_finale",
  "decision_sanction",
  "resolution_conflit_humain",
]);

// Email send — never auto-executable
const EMAIL_SEND_TYPES = new Set(["email.send", "send_email"]);

// Task types that carry a -20 score penalty (approval-class)
const APPROVAL_CLASS_TYPES = new Set([
  "contrat",
  "avenant",
  "document_contractuel",
  "refus_candidat_formel",
  "prepaie_prep",
  "remuneration",
  "absence_sensible",
  "sujet_medical",
  "offboarding_sensible",
  "conflit_prelim",
  "courrier_disciplinaire_prep",
  "employee_relations_doc",
]);

// Domain penalties
const DOMAIN_PENALTIES: Record<string, number> = {
  sensitive_case: -15,
  employee_relations: -10,
  offboarding: -10,
  compliance_workflow: -5,
  contract: -5,
  amendment: -5,
};

// ══════════════════════════════════════════════════════════
// 3. NORMALIZERS
// ══════════════════════════════════════════════════════════

export function normalizeCloneTrustLevel(value: unknown): PierreCloneTrustLevel {
  if (typeof value !== "string") return "supervised";
  const t = value.trim().toLowerCase();
  if (t === "manual_only") return "manual_only";
  if (t === "approval_first") return "approval_first";
  if (t === "supervised") return "supervised";
  if (t === "limited_auto") return "limited_auto";
  if (t === "standard_auto") return "standard_auto";
  if (t === "high_trust") return "high_trust";
  return "supervised";
}

export function normalizeCloneTrustDecision(value: unknown): PierreCloneTrustDecision {
  if (typeof value !== "string") return "approval_required";
  const t = value.trim().toLowerCase();
  if (t === "manual_only") return "manual_only";
  if (t === "approval_required") return "approval_required";
  if (t === "supervised_execution") return "supervised_execution";
  if (t === "auto_allowed") return "auto_allowed";
  return "approval_required";
}

export function normalizeCloneTrustRiskLevel(value: unknown): PierreCloneTrustRiskLevel {
  return normalizePierreHrRiskLevel(value);
}

// ══════════════════════════════════════════════════════════
// 4. INTERNAL HELPERS
// ══════════════════════════════════════════════════════════

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreToTrustLevel(score: number): PierreCloneTrustLevel {
  for (const { level, min } of TRUST_LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return "manual_only";
}

function applyAutonomyCap(
  level: PierreCloneTrustLevel,
  autonomyLevel: string | null | undefined,
): PierreCloneTrustLevel {
  if (!autonomyLevel) return level;
  const cap = AUTONOMY_LEVEL_CAPS[autonomyLevel.toLowerCase()];
  if (!cap) return level;
  return TRUST_LEVEL_RANK[level] > TRUST_LEVEL_RANK[cap] ? cap : level;
}

// Rank for CloneGuard / ClonePolicy decision strings
function guardPolicyRank(d: string): number {
  const ranks: Record<string, number> = {
    allow: 0,
    allow_with_warning: 1,
    require_approval: 2,
    block: 3,
    refuse: 4,
  };
  return ranks[d.toLowerCase()] ?? 0;
}

// CloneTrust cannot weaken CloneGuard or ClonePolicy:
// if guard/policy requires approval (or stronger), auto_allowed is not available.
function trustLevelToDecision(
  level: PierreCloneTrustLevel,
  riskLevel: PierreCloneTrustRiskLevel,
  guardDecision: string | null,
  policyDecision: string | null,
): PierreCloneTrustDecision {
  if (level === "manual_only") return "manual_only";
  if (level === "approval_first") return "approval_required";
  if (level === "supervised" || level === "limited_auto") return "supervised_execution";

  // standard_auto / high_trust — check if guard/policy permits auto
  if (getPierreHrRiskRank(riskLevel) >= getPierreHrRiskRank("red")) return "approval_required";

  const guardRank = guardDecision ? guardPolicyRank(guardDecision) : 0;
  const policyRank = policyDecision ? guardPolicyRank(policyDecision) : 0;

  // require_approval (rank 2) or stronger from guard/policy blocks auto_allowed
  if (guardRank >= 2 || policyRank >= 2) return "approval_required";

  return "auto_allowed";
}

// ══════════════════════════════════════════════════════════
// 5. FACTOR COLLECTION
// ══════════════════════════════════════════════════════════

export function collectCloneTrustFactors(
  ctx: PierreCloneTrustContext,
): PierreCloneTrustFactor[] {
  if (!ctx || typeof ctx !== "object") return [];
  const factors: PierreCloneTrustFactor[] = [];

  // Factor 1: company_trust_score (0-100) → -25 to +25
  const rawTrustScore =
    typeof ctx.company_trust_score === "number" && Number.isFinite(ctx.company_trust_score)
      ? clamp(ctx.company_trust_score, 0, 100)
      : null;
  if (rawTrustScore !== null) {
    const contribution = Math.round((rawTrustScore - 50) / 2);
    factors.push({
      name: "company_trust_score",
      value: contribution,
      raw_value: rawTrustScore,
      note: `Score confiance entreprise: ${rawTrustScore}/100 → ${contribution >= 0 ? "+" : ""}${contribution}`,
    });
  }

  // Factor 2: historical_success_rate (0-100) → 0 to +20
  const successRate =
    typeof ctx.historical_success_rate === "number" &&
    Number.isFinite(ctx.historical_success_rate)
      ? clamp(ctx.historical_success_rate, 0, 100)
      : null;
  if (successRate !== null) {
    let contribution = 0;
    if (successRate >= 95) contribution = 20;
    else if (successRate >= 90) contribution = 15;
    else if (successRate >= 80) contribution = 10;
    else if (successRate >= 70) contribution = 5;
    factors.push({
      name: "historical_success_rate",
      value: contribution,
      raw_value: successRate,
      note: `Taux succès historique: ${successRate}% → +${contribution}`,
    });
  }

  // Factor 3: historical_task_count → 0 to +10
  const taskCount =
    typeof ctx.historical_task_count === "number" &&
    Number.isFinite(ctx.historical_task_count)
      ? Math.max(0, Math.floor(ctx.historical_task_count))
      : null;
  if (taskCount !== null) {
    let contribution = 0;
    if (taskCount >= 100) contribution = 10;
    else if (taskCount >= 50) contribution = 7;
    else if (taskCount >= 20) contribution = 5;
    else if (taskCount >= 5) contribution = 2;
    factors.push({
      name: "historical_task_count",
      value: contribution,
      raw_value: taskCount,
      note: `Volume tâches historiques: ${taskCount} → +${contribution}`,
    });
  }

  // Factor 4: risk_level_penalty
  const riskLevel = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  const riskPenalties: Record<PierreHrRiskLevel, number> = {
    green: 0,
    orange: -10,
    red: -25,
    black: -40,
  };
  const riskContrib = riskPenalties[riskLevel];
  if (riskContrib !== 0) {
    factors.push({
      name: "risk_level_penalty",
      value: riskContrib,
      raw_value: ctx.risk_level_hint,
      note: `Risque ${riskLevel} → ${riskContrib}`,
    });
  }

  // Factor 5: domain_penalty
  const domain =
    typeof ctx.domain === "string" ? ctx.domain.trim().toLowerCase() : null;
  if (domain) {
    const domainPenalty = DOMAIN_PENALTIES[domain] ?? 0;
    if (domainPenalty !== 0) {
      factors.push({
        name: "domain_penalty",
        value: domainPenalty,
        raw_value: ctx.domain,
        note: `Domaine sensible ${ctx.domain} → ${domainPenalty}`,
      });
    }
  }

  // Factor 6: cloneguard_decision penalty
  const guardDec =
    typeof ctx.cloneguard_decision === "string"
      ? ctx.cloneguard_decision.trim().toLowerCase()
      : null;
  if (guardDec) {
    let guardPenalty = 0;
    if (guardDec === "allow_with_warning") guardPenalty = -5;
    else if (guardDec === "require_approval") guardPenalty = -20;
    else if (guardDec === "block" || guardDec === "refuse") guardPenalty = -40;
    if (guardPenalty !== 0) {
      factors.push({
        name: "cloneguard_penalty",
        value: guardPenalty,
        raw_value: ctx.cloneguard_decision,
        note: `CloneGuard ${guardDec} → ${guardPenalty}`,
      });
    }
  }

  // Factor 7: clonepolicy_decision penalty
  const policyDec =
    typeof ctx.clonepolicy_decision === "string"
      ? ctx.clonepolicy_decision.trim().toLowerCase()
      : null;
  if (policyDec) {
    let policyPenalty = 0;
    if (policyDec === "allow_with_warning") policyPenalty = -5;
    else if (policyDec === "require_approval") policyPenalty = -20;
    else if (policyDec === "block" || policyDec === "refuse") policyPenalty = -40;
    if (policyPenalty !== 0) {
      factors.push({
        name: "clonepolicy_penalty",
        value: policyPenalty,
        raw_value: ctx.clonepolicy_decision,
        note: `ClonePolicy ${policyDec} → ${policyPenalty}`,
      });
    }
  }

  // Factor 8: approval-class task type
  const taskType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : null;
  if (taskType && APPROVAL_CLASS_TYPES.has(taskType)) {
    factors.push({
      name: "task_type_penalty",
      value: -20,
      raw_value: ctx.task_type,
      note: `Type à validation ${ctx.task_type} → -20`,
    });
  }

  // Factor 9: approval_required flag
  if (ctx.approval_required === true) {
    factors.push({
      name: "approval_required_flag",
      value: -30,
      raw_value: true,
      note: "Tâche approval_required → -30",
    });
  }

  return factors;
}

// ══════════════════════════════════════════════════════════
// 6. BASE SCORE
// ══════════════════════════════════════════════════════════

export function computeCloneTrustBaseScore(ctx: PierreCloneTrustContext): number {
  if (!ctx || typeof ctx !== "object") return 50;
  const factors = collectCloneTrustFactors(ctx);
  const total = factors.reduce((acc, f) => acc + f.value, 50);
  return clamp(Math.round(total), 0, 100);
}

// ══════════════════════════════════════════════════════════
// 7. HARD BLOCK DETECTION
// ══════════════════════════════════════════════════════════

function detectHardBlocks(ctx: PierreCloneTrustContext): string[] {
  const blocks: string[] = [];
  const taskType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : null;

  if (taskType && EMAIL_SEND_TYPES.has(taskType)) {
    blocks.push("email.send/send_email ne peut jamais être auto-exécuté");
  }

  if (taskType && MANUAL_ONLY_TYPES.has(taskType)) {
    blocks.push(`Type ${ctx.task_type} réservé à l'humain sans exception`);
  }

  if (ctx.approval_required === true) {
    blocks.push("Tâche approval_required — validation humaine obligatoire");
  }

  const guardDec =
    typeof ctx.cloneguard_decision === "string"
      ? ctx.cloneguard_decision.trim().toLowerCase()
      : null;
  if (guardDec === "block" || guardDec === "refuse") {
    blocks.push(`CloneGuard: décision ${guardDec} — exécution interdite`);
  }

  const policyDec =
    typeof ctx.clonepolicy_decision === "string"
      ? ctx.clonepolicy_decision.trim().toLowerCase()
      : null;
  if (policyDec === "block" || policyDec === "refuse") {
    blocks.push(`ClonePolicy: décision ${policyDec} — exécution interdite`);
  }

  const riskLevel = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  if (riskLevel === "black") {
    blocks.push("Risque noir — intervention humaine exclusive");
  } else if (riskLevel === "red") {
    blocks.push("Risque rouge — validation humaine obligatoire");
  }

  const employeeRisk = normalizePierreHrRiskLevel(ctx.employee_file_risk);
  if (employeeRisk === "black") {
    blocks.push("Dossier employé noir — intervention humaine exclusive");
  } else if (employeeRisk === "red") {
    blocks.push("Dossier employé rouge — validation humaine obligatoire");
  }

  return blocks;
}

// ══════════════════════════════════════════════════════════
// 8. MAIN EVALUATOR
// ══════════════════════════════════════════════════════════

export function evaluatePierreCloneTrust(
  ctx: PierreCloneTrustContext,
): PierreCloneTrustEvaluation {
  if (!ctx || typeof ctx !== "object") {
    return {
      trust_level: "supervised",
      trust_score: 50,
      decision: "approval_required",
      factors: [],
      hard_blocks: [],
      allowed_to_auto_execute: false,
      requires_human: true,
      explanation: "Contexte vide — niveau de confiance par défaut: supervisé.",
      human_note: "",
      evaluated_at: "",
    };
  }

  const factors = collectCloneTrustFactors(ctx);
  const rawScore = clamp(
    Math.round(factors.reduce((acc, f) => acc + f.value, 50)),
    0,
    100,
  );
  const hardBlocks = detectHardBlocks(ctx);

  // Compute raw trust level from score
  let trustLevel = scoreToTrustLevel(rawScore);

  // Apply autonomy level cap (can only restrict, never boost)
  const autonomyLevel =
    typeof ctx.autonomy_level === "string" ? ctx.autonomy_level : null;
  trustLevel = applyAutonomyCap(trustLevel, autonomyLevel);

  // Classify hard block severity
  const taskType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : null;
  const hasAbsoluteBlock =
    (taskType !== null && EMAIL_SEND_TYPES.has(taskType)) ||
    (taskType !== null && MANUAL_ONLY_TYPES.has(taskType)) ||
    (typeof ctx.cloneguard_decision === "string" &&
      (ctx.cloneguard_decision.toLowerCase() === "block" ||
        ctx.cloneguard_decision.toLowerCase() === "refuse")) ||
    (typeof ctx.clonepolicy_decision === "string" &&
      (ctx.clonepolicy_decision.toLowerCase() === "block" ||
        ctx.clonepolicy_decision.toLowerCase() === "refuse")) ||
    normalizePierreHrRiskLevel(ctx.risk_level_hint) === "black" ||
    normalizePierreHrRiskLevel(ctx.employee_file_risk) === "black";

  const hasApprovalBlock =
    ctx.approval_required === true ||
    normalizePierreHrRiskLevel(ctx.risk_level_hint) === "red" ||
    normalizePierreHrRiskLevel(ctx.employee_file_risk) === "red";

  // Determine final decision
  let decision: PierreCloneTrustDecision;
  if (hasAbsoluteBlock) {
    decision = "manual_only";
    trustLevel = "manual_only";
  } else if (hasApprovalBlock) {
    if (TRUST_LEVEL_RANK[trustLevel] > TRUST_LEVEL_RANK["approval_first"]) {
      trustLevel = "approval_first";
    }
    decision = "approval_required";
  } else {
    decision = trustLevelToDecision(
      trustLevel,
      normalizePierreHrRiskLevel(ctx.risk_level_hint),
      ctx.cloneguard_decision ?? null,
      ctx.clonepolicy_decision ?? null,
    );
  }

  const allowed_to_auto_execute =
    decision === "auto_allowed" &&
    hardBlocks.length === 0 &&
    TRUST_LEVEL_RANK[trustLevel] >= TRUST_LEVEL_RANK["standard_auto"];

  const requires_human =
    decision === "manual_only" || decision === "approval_required";

  let explanation: string;
  if (hardBlocks.length > 0) {
    explanation = `CloneTrust bloqué. ${hardBlocks[0]}`;
  } else if (decision === "auto_allowed") {
    explanation = `Auto-exécution autorisée. Niveau: ${trustLevel} (score: ${rawScore}/100).`;
  } else if (decision === "supervised_execution") {
    explanation = `Exécution supervisée. Niveau: ${trustLevel} (score: ${rawScore}/100).`;
  } else if (decision === "approval_required") {
    explanation = `Validation humaine requise. Niveau: ${trustLevel} (score: ${rawScore}/100).`;
  } else {
    explanation = `Action réservée à l'humain. Niveau: ${trustLevel} (score: ${rawScore}/100).`;
  }

  const human_note =
    hardBlocks.length > 0
      ? hardBlocks.join(" | ")
      : factors
          .filter((f) => f.value < 0)
          .map((f) => f.note)
          .join(" | ");

  return {
    trust_level: trustLevel,
    trust_score: rawScore,
    decision,
    factors,
    hard_blocks: hardBlocks,
    allowed_to_auto_execute,
    requires_human,
    explanation,
    human_note,
    evaluated_at: typeof ctx.now === "string" ? ctx.now : "",
  };
}

// ══════════════════════════════════════════════════════════
// 9. BUILD PREVIEW
// ══════════════════════════════════════════════════════════

export function buildCloneTrustPreview(
  evaluation: PierreCloneTrustEvaluation,
): PierreCloneTrustPreview {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      trust_level: "supervised",
      trust_score: 50,
      decision: "approval_required",
      allowed_to_auto_execute: false,
      hard_blocks_count: 0,
      summary: "Évaluation CloneTrust non disponible.",
    };
  }

  const summaryMap: Record<PierreCloneTrustDecision, string> = {
    manual_only: "Action réservée à l'humain (CloneTrust).",
    approval_required: "Validation humaine obligatoire (CloneTrust).",
    supervised_execution: "Exécution supervisée autorisée (CloneTrust).",
    auto_allowed: "Auto-exécution autorisée (CloneTrust).",
  };

  return {
    trust_level: evaluation.trust_level,
    trust_score: evaluation.trust_score,
    decision: evaluation.decision,
    allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
    hard_blocks_count: Array.isArray(evaluation.hard_blocks)
      ? evaluation.hard_blocks.length
      : 0,
    summary: summaryMap[evaluation.decision] ?? "Évaluation CloneTrust.",
  };
}

// ══════════════════════════════════════════════════════════
// 10. BUILD AUDIT EVENT
// ══════════════════════════════════════════════════════════

export function buildCloneTrustAuditEvent(
  evaluation: PierreCloneTrustEvaluation,
  ctx?: PierreCloneTrustContext,
): PierreCloneTrustAuditEvent {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      event_type: "clonetrust_evaluation",
      message: "CloneTrust évaluation — données manquantes.",
      meta_json: {
        trust_level: "supervised",
        trust_score: 50,
        decision: "approval_required",
        hard_blocks: [],
        allowed_to_auto_execute: false,
      },
    };
  }

  const hardBlocks = Array.isArray(evaluation.hard_blocks) ? evaluation.hard_blocks : [];

  const eventType: PierreCloneTrustAuditEvent["event_type"] =
    hardBlocks.length > 0
      ? "clonetrust_hard_block"
      : evaluation.decision === "auto_allowed"
        ? "clonetrust_auto_allowed"
        : "clonetrust_evaluation";

  return {
    event_type: eventType,
    message: evaluation.explanation || "CloneTrust évaluation complète.",
    meta_json: {
      trust_level: evaluation.trust_level,
      trust_score: evaluation.trust_score,
      decision: evaluation.decision,
      hard_blocks: hardBlocks,
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

export function applyCloneTrustToTask(
  task: Record<string, unknown>,
  evaluation: PierreCloneTrustEvaluation,
): Record<string, unknown> {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return { clonetrust: null };
  }

  const evalData =
    evaluation && typeof evaluation === "object"
      ? {
          trust_level: evaluation.trust_level,
          trust_score: evaluation.trust_score,
          decision: evaluation.decision,
          allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
          requires_human: evaluation.requires_human,
          hard_blocks_count: Array.isArray(evaluation.hard_blocks)
            ? evaluation.hard_blocks.length
            : 0,
          explanation: evaluation.explanation,
        }
      : null;

  return { ...task, clonetrust: evalData };
}

// ══════════════════════════════════════════════════════════
// 12. FAST PATH
// ══════════════════════════════════════════════════════════

export function isCloneTrustAutoExecutable(ctx: PierreCloneTrustContext): boolean {
  if (!ctx || typeof ctx !== "object") return false;

  const taskType =
    typeof ctx.task_type === "string" ? ctx.task_type.trim().toLowerCase() : "";
  if (EMAIL_SEND_TYPES.has(taskType)) return false;
  if (MANUAL_ONLY_TYPES.has(taskType)) return false;
  if (ctx.approval_required === true) return false;

  const riskLevel = normalizePierreHrRiskLevel(ctx.risk_level_hint);
  if (riskLevel === "red" || riskLevel === "black") return false;

  const employeeRisk = normalizePierreHrRiskLevel(ctx.employee_file_risk);
  if (employeeRisk === "red" || employeeRisk === "black") return false;

  const guardDec =
    typeof ctx.cloneguard_decision === "string"
      ? ctx.cloneguard_decision.toLowerCase()
      : null;
  if (guardDec === "block" || guardDec === "refuse") return false;

  const policyDec =
    typeof ctx.clonepolicy_decision === "string"
      ? ctx.clonepolicy_decision.toLowerCase()
      : null;
  if (policyDec === "block" || policyDec === "refuse") return false;

  return evaluatePierreCloneTrust(ctx).allowed_to_auto_execute;
}

// ══════════════════════════════════════════════════════════
// 13. SUMMARIZE
// ══════════════════════════════════════════════════════════

export function summarizeCloneTrustEvaluation(
  evaluation: PierreCloneTrustEvaluation,
): string {
  if (!evaluation || typeof evaluation !== "object") {
    return "Évaluation CloneTrust non disponible.";
  }

  const levelLabels: Record<PierreCloneTrustLevel, string> = {
    manual_only: "Manuel uniquement",
    approval_first: "Approbation requise",
    supervised: "Supervisé",
    limited_auto: "Automation limitée",
    standard_auto: "Automation standard",
    high_trust: "Haute confiance",
  };

  const decisionLabels: Record<PierreCloneTrustDecision, string> = {
    manual_only: "Réservé à l'humain",
    approval_required: "Validation obligatoire",
    supervised_execution: "Exécution supervisée",
    auto_allowed: "Automation autorisée",
  };

  const lines: string[] = [
    `Niveau: ${levelLabels[evaluation.trust_level] ?? evaluation.trust_level}`,
    `Score: ${evaluation.trust_score}/100`,
    `Décision: ${decisionLabels[evaluation.decision] ?? evaluation.decision}`,
  ];

  const hardBlocks = Array.isArray(evaluation.hard_blocks) ? evaluation.hard_blocks : [];
  if (hardBlocks.length > 0) {
    lines.push(`Blocages: ${hardBlocks.length} (${hardBlocks[0].slice(0, 80)})`);
  }

  if (!evaluation.allowed_to_auto_execute) {
    lines.push("Auto-exécution: non autorisée");
  }

  return lines.join(" | ");
}
