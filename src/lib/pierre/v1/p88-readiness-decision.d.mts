// Type declarations for p88-readiness-decision.mjs (PHASE 8.8 final unblock decision engine).

export const READY: "READY_FOR_OWNER_UNBLOCK_DECISION";
export const BLOCKED: "BLOCKED";

export interface ReadinessGates {
  tests?: { passed?: boolean };
  build?: { passed?: boolean };
  preflight?: { green?: boolean };
  providers?: { stripe_test?: boolean; resend?: boolean; yousign_sandbox?: boolean };
  p874?: { verified_24_24?: boolean; final_report_ok?: boolean };
  externalBlockers?: Array<{ id: string; state: string; owner?: string }>;
  deployBlock?: { active?: boolean };
  residue?: { zero?: boolean };
  rollback?: { ready?: boolean };
  observability?: { ready?: boolean };
  ownerApproval?: { granted?: boolean };
}

export interface ReadinessBlocker { gate: string; reason: string; owner: string }
export interface ReadinessResult { decision: string; ready: boolean; blockers: ReadinessBlocker[]; gates: ReadinessGates }

export function evaluateReadiness(g?: ReadinessGates): ReadinessResult;
export function renderDecision(result: ReadinessResult): string;
