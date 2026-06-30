// src/lib/pierre/v1/onboarding-service.ts
// PHASE 8.6 — onboarding read + governed mutations. The SERVER decides completeness: the client never
// sends a percentage or marks a step complete. These wrappers call the SECURITY DEFINER functions; the
// caller binds the app role + app.current_company (via withTenantTransaction / asRole). Completion of a
// required step recomputes progress server-side; completing the session enforces the READY gate
// (every required step done + active entitlement + active owner).

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./tenant-context";
import { Errors } from "./errors";
import { getOnboardingRegistry, getOnboardingStep, type OnboardingStepDefinition } from "./onboarding-registry";
import { getCompletionRule, computeEvidenceHash, unmetDependencies, assertKnownProduct } from "./onboarding-completion-rules";

export type OnboardingSessionRow = {
  id: string; company_id: string; product_key: string; status: string; schema_version: string;
  progress_percent: number; current_step_key: string | null; started_at: string | null;
  completed_at: string | null; reopened_at: string | null; version: number;
};
export type OnboardingStepRow = {
  id: string; session_id: string; step_key: string; step_ordinal: number; status: string;
  required: boolean; completed_by: string | null; completed_at: string | null; evidence_hash: string | null;
  blocked_reason: string | null; version: number;
};

export type OnboardingState = {
  session: OnboardingSessionRow | null;
  steps: Array<OnboardingStepRow & { definition: OnboardingStepDefinition | null }>;
  ready_blockers: string[];
};

/** Full onboarding state for the active tenant (session + steps merged with the registry). */
export async function getOnboardingState(db: SqlExecutor, ctx: TenantContext, productKey = "pierre"): Promise<OnboardingState> {
  const session = (await db.query<OnboardingSessionRow>(
    `select * from pierre_rt_onboarding_sessions where company_id=$1 and product_key=$2 order by created_at desc limit 1`,
    [ctx.company_id, productKey],
  )).rows[0] ?? null;
  let steps: OnboardingStepRow[] = [];
  if (session) {
    steps = (await db.query<OnboardingStepRow>(
      `select * from pierre_rt_onboarding_steps where company_id=$1 and session_id=$2 order by step_ordinal asc`,
      [ctx.company_id, session.id],
    )).rows;
  }
  const ready_blockers: string[] = [];
  const pendingRequired = steps.filter((s) => s.required && s.status !== "completed");
  if (pendingRequired.length > 0) ready_blockers.push(`pending_required_steps:${pendingRequired.length}`);
  return {
    session,
    steps: steps.map((s) => ({ ...s, definition: getOnboardingStep(s.step_key, productKey) })),
    ready_blockers,
  };
}

/**
 * Complete a step — SERVER-AUTHORITATIVE. The server: (1) refuses an unknown product/step; (2) enforces
 * the step permission; (3) enforces declared dependencies; (4) runs the step's REAL completion rule
 * against persisted tenant data; (5) computes the evidence hash itself from the verified facts (the client
 * never supplies completed/progress/evidence_hash); (6) records completion via the governed function.
 * The client may submit `data` that some rules consult (e.g. an explicit "no employees yet" decision), but
 * it is never the authority for completion.
 */
export async function completeOnboardingStep(
  db: SqlExecutor, ctx: TenantContext,
  input: { session_id: string; step_key: string; data?: Record<string, unknown>; expected_version?: number | null; product_key?: string },
): Promise<string> {
  const productKey = input.product_key ?? "pierre";
  assertKnownProduct(productKey); // unknown product → refused (never defaults to Pierre)
  const def = getOnboardingStep(input.step_key, productKey);
  if (!def) throw Errors.validation(`Unknown onboarding step: ${input.step_key}`);
  requirePermission(ctx, def.permission);

  // dependencies must be completed first
  const unmet = await unmetDependencies(db, ctx.company_id, input.session_id, input.step_key, productKey);
  if (unmet.length) throw Errors.guardBlocked(`Unmet onboarding dependencies: ${unmet.join(",")}`, { unmet });

  // real, server-side completion verification against persisted data
  const rule = getCompletionRule(input.step_key, productKey);
  const verdict = rule ? await rule(db, ctx, input.data ?? {}) : { ok: true, evidence: {} };
  if (!verdict.ok) throw Errors.guardBlocked(`Onboarding step not satisfied: ${verdict.reason ?? "incomplete"}`, { step: input.step_key, reason: verdict.reason });

  // the SERVER computes the evidence hash from the verified facts
  const evidenceHash = computeEvidenceHash(input.step_key, productKey, verdict.evidence);
  const { rows } = await db.query<{ result: string }>(
    `select pierre_rt_complete_onboarding_step($1,$2,$3,$4,$5,$6) as result`,
    [ctx.company_id, input.session_id, input.step_key, ctx.user_id, evidenceHash, input.expected_version ?? null],
  );
  if (rows[0].result === "version_conflict") throw Errors.versionConflict();
  return rows[0].result;
}

/** Re-open a previously completed step (governance / invariant loss). */
export async function reopenOnboardingStep(
  db: SqlExecutor, ctx: TenantContext, input: { session_id: string; step_key: string; reason: string; product_key?: string },
): Promise<void> {
  const def = getOnboardingStep(input.step_key, input.product_key ?? "pierre");
  if (def && !def.can_reopen) throw Errors.forbidden(`Step ${input.step_key} cannot be reopened`);
  requirePermission(ctx, "company.admin");
  await db.query(`select pierre_rt_reopen_onboarding_step($1,$2,$3,$4)`, [ctx.company_id, input.session_id, input.step_key, input.reason]);
}

/** Complete the session (READY gate). Returns 'completed' or a blocker reason. */
export async function completeOnboardingSession(db: SqlExecutor, ctx: TenantContext, sessionId: string): Promise<string> {
  requirePermission(ctx, "company.admin");
  const { rows } = await db.query<{ result: string }>(
    `select pierre_rt_complete_onboarding_session($1,$2,$3) as result`, [ctx.company_id, sessionId, ctx.user_id]);
  return rows[0].result;
}

export { getOnboardingRegistry };
