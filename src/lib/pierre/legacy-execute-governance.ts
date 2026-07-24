// src/lib/pierre/legacy-execute-governance.ts
// P0 GOVERNANCE CLOSURE (2026-07-23) — pont de gouvernance pour la route legacy
// src/app/api/pierre/execute/route.ts ("V0", auth HMAC externe).
//
// Réutilise TEL QUEL les évaluateurs purs du moteur v1/hr (aucune nouvelle architecture de
// gouvernance créée) : evaluatePierreCloneGuard (hr/cloneguard.ts) puis evaluateGovernance
// (hr/governance.ts) — exactement le même enchaînement que src/lib/pierre/tasks/execute-task.ts
// pour le pipeline mission/tâche canonique.
//
// Pure module : no Supabase, no Next, no side effects — testable en isolation.
import {
  evaluatePierreCloneGuard,
  buildCloneGuardAuditEvent,
  type PierreCloneGuardContext,
  type PierreCloneGuardAuditEvent,
} from "./hr/cloneguard";
import {
  evaluateGovernance,
  buildGovernanceAuditEvent,
  type PierreGovernanceAuditEvent,
} from "./hr/governance";

export type LegacyExecuteOutcome = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";

export type LegacyExecuteDecision = {
  outcome: LegacyExecuteOutcome;
  allowed_to_auto_execute: boolean;
  explanation: string;
  summary: {
    guard_decision: string;
    governance_decision: string;
    risk_level: string;
  };
  cloneGuardAudit: PierreCloneGuardAuditEvent;
  governanceAudit: PierreGovernanceAuditEvent;
};

/**
 * L'action legacy ("email.send" / "doc.generate" / "hris.sync") est utilisée directement
 * comme task_type : ce vocabulaire en dot-notation est déjà reconnu par
 * normalizeCloneGuardActionKind() (cloneguard.ts) — email.send est bloqué de façon
 * non-contournable, et hris.sync est couvert par la règle additive
 * "integration_sync_require" ajoutée dans ce même correctif. Aucune table de correspondance
 * séparée n'est donc nécessaire.
 */
export function evaluateLegacyExecuteGovernance(params: {
  action: string;
  payload: Record<string, unknown> | null;
  now: string;
}): LegacyExecuteDecision {
  const ctx: PierreCloneGuardContext = {
    task_type: params.action,
    payload_json: params.payload ?? null,
    approval_required: false,
    now: params.now,
  };

  const cgEval = evaluatePierreCloneGuard(ctx);
  const govEval = evaluateGovernance({
    task_type: params.action,
    payload_json: params.payload ?? null,
    approval_required: false,
    guard_evaluation: cgEval,
    now: params.now,
  });

  const cloneGuardAudit = buildCloneGuardAuditEvent(cgEval, {
    task_type: params.action,
    now: params.now,
  });
  const governanceAudit = buildGovernanceAuditEvent(govEval, {
    task_type: params.action,
    now: params.now,
  });

  let outcome: LegacyExecuteOutcome;
  if (govEval.decision === "refuse" || govEval.decision === "block") {
    outcome = "DENY";
  } else if (!govEval.allowed_to_auto_execute) {
    outcome = "REQUIRE_APPROVAL";
  } else {
    outcome = "ALLOW";
  }

  return {
    outcome,
    allowed_to_auto_execute: govEval.allowed_to_auto_execute,
    explanation: govEval.explanation,
    summary: {
      guard_decision: cgEval.decision,
      governance_decision: govEval.decision,
      risk_level: govEval.risk_level,
    },
    cloneGuardAudit,
    governanceAudit,
  };
}
