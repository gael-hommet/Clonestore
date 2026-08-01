// src/lib/clonechat/actions/plan.ts
//
// Deux phases DISTINCTES :
//   1) planAction  : comprend la demande, résout une action RÉELLE du registre, valide les arguments,
//      applique CloneGuard, et renvoie un plan IMMUTABLE (ou une demande de confirmation) — SANS
//      RIEN EXÉCUTER.
//   2) executeAction : reçoit le plan immuable, revérifie tout (Guard + confirmation liée), vérifie
//      l'idempotence, n'appelle QUE l'adaptateur enregistré, produit CloneTrace et un résultat
//      HONNÊTE (jamais de faux succès).

import type { CloneChatContext } from "@/lib/clonechat/context";
import type { IdempotencyStore } from "@/lib/clonechat/durable/idempotency-store";
import { resolveActionDefinition } from "./registry";
import { getAdapter, type AdapterDeps } from "./adapters";
import { guardPlan, guardExecute } from "./guard";
import { type ConfirmationRegistry } from "./confirmation";
import { argsHashOf, planHashOf, idempotencyKeyOf } from "./keys";
import {
  CLONECHAT_ACTIONS_VERSION, type CloneActionPlan, type CloneActionRequest, type CloneActionResult,
  type ActionAuthorization, type ActionState, type StructuredActionError, type CloneTrace, type ConfirmationToken,
} from "./types";
import { buildTrace } from "./trace";

export interface PlanActionContext {
  readonly context: CloneChatContext;
  /** Refus de sécurité détecté en amont (injection / contournement de gouvernance). */
  readonly securityRefusal: boolean;
  readonly cancelled?: boolean;
}

function authorizationFrom(ctx: CloneChatContext, securityRefusal: boolean): ActionAuthorization {
  return {
    viewerKey: ctx.viewer.authenticated && ctx.viewer.userId ? `user:${ctx.viewer.userId}` : "anon",
    tenantKey: ctx.tenant.resolved && ctx.tenant.companyId ? `co:${ctx.tenant.companyId}` : "none",
    authenticated: ctx.viewer.authenticated,
    tenantResolved: ctx.tenant.resolved,
    tenantSecurityFailure: ctx.tenant.securityFailure,
    pierreGranted: ctx.pierre.granted,
    role: ctx.tenant.role,
    securityRefusal,
  };
}

/** PHASE 1 — construit un plan immuable. N'exécute rien. */
export function planAction(request: CloneActionRequest, planCtx: PlanActionContext): CloneActionPlan {
  const authorization = authorizationFrom(planCtx.context, planCtx.securityRefusal);
  const definition = resolveActionDefinition(request.actionId);

  // Validation stricte des arguments (uniquement si l'action est connue).
  let validatedArgs: Readonly<Record<string, unknown>> | null = null;
  let argsError: StructuredActionError | null = null;
  if (definition) {
    const v = definition.validate(request.args ?? {});
    if (v.ok) validatedArgs = v.args;
    else argsError = { code: v.code, message: v.message };
  }

  const argsForHash = validatedArgs ?? request.args ?? {};
  const argsHash = argsHashOf(argsForHash);
  const actionId = definition?.id ?? request.actionId;
  const actionVersion = definition?.version ?? "0";
  const planHash = planHashOf(actionId, actionVersion, argsHash, authorization.viewerKey, authorization.tenantKey);
  const route = definition ? definition.routeOf(argsForHash) : null;

  if (planCtx.cancelled) {
    return Object.freeze({
      version: CLONECHAT_ACTIONS_VERSION, state: "cancelled", request, definition, validatedArgs, authorization,
      guard: guardPlan({ definition, validatedArgs, argsError, authorization, route }),
      confirmationRequired: definition?.confirmationRequired === true,
      idempotencyKey: null, planHash, route, error: null,
    });
  }

  const guard = guardPlan({ definition, validatedArgs, argsError, authorization, route });
  const state: ActionState = guard.decision === "block" ? "blocked" : guard.decision === "needs_confirmation" ? "awaiting_confirmation" : "planned";
  const idempotencyKey = definition?.idempotency === "effect" ? idempotencyKeyOf(planHash) : null;
  const error: StructuredActionError | null = guard.decision === "block" ? { code: guard.blockCode ?? "BLOCKED", message: guard.reason ?? "Action bloquée." } : null;

  return Object.freeze({
    version: CLONECHAT_ACTIONS_VERSION, state, request, definition, validatedArgs, authorization,
    guard, confirmationRequired: guard.confirmationRequired, idempotencyKey, planHash, route, error,
  });
}

export interface ExecuteActionContext {
  readonly confirmation?: ConfirmationToken;
  readonly confirmationRegistry: ConfirmationRegistry;
  readonly idempotency: IdempotencyStore;
  readonly deps: AdapterDeps;
  readonly nowMs: number;
  /** Annulation AVANT exécution. (Pendant l'exécution : deps.cancelSignal.) */
  readonly cancelled?: boolean;
}

function resultOf(
  state: ActionState, observableSuccess: string | null, output: Readonly<Record<string, unknown>> | null,
  error: StructuredActionError | null, trace: CloneTrace,
): CloneActionResult {
  return Object.freeze({ version: CLONECHAT_ACTIONS_VERSION, state, observableSuccess, output, error, trace });
}

/** PHASE 2 — exécution contrôlée. N'appelle QUE l'adaptateur enregistré ; jamais de faux succès. */
export async function executeAction(plan: CloneActionPlan, exec: ExecuteActionContext): Promise<CloneActionResult> {
  const transitions: ActionState[] = ["requested", plan.state];
  const def = plan.definition;
  const actionId = def?.id ?? plan.request.actionId;
  const actionVersion = def?.version ?? "0";
  const confirmationTokenId = exec.confirmation?.token ?? null;

  const trace = (finalStatus: ActionState, guardDecision: CloneTrace["guardDecision"], observable: string | null, error: StructuredActionError | null): CloneTrace =>
    buildTrace({
      actionId, actionVersion, nowMs: exec.nowMs,
      viewerKey: plan.authorization.viewerKey, tenantKey: plan.authorization.tenantKey,
      guardDecision, confirmationToken: confirmationTokenId, idempotencyKey: plan.idempotencyKey,
      transitions, adapterId: def?.adapterId ?? null, observableResult: observable, error, finalStatus,
    });

  // Un plan déjà bloqué ne s'exécute pas.
  if (plan.state === "blocked") {
    return resultOf("blocked", null, null, plan.error ?? { code: "BLOCKED", message: "Plan bloqué." }, trace("blocked", "block", null, plan.error));
  }
  // Annulation avant exécution.
  if (plan.state === "cancelled" || exec.cancelled) {
    transitions.push("cancelled");
    return resultOf("cancelled", null, null, null, trace("cancelled", plan.guard.decision, null, null));
  }

  // Re-vérification COMPLÈTE au moment de l'exécution (Guard + confirmation liée + adaptateur runtime).
  const g = guardExecute(plan, { confirmation: exec.confirmation, confirmationRegistry: exec.confirmationRegistry, nowMs: exec.nowMs, deps: exec.deps });
  if (g.decision !== "allow") {
    transitions.push("blocked");
    const err: StructuredActionError = { code: g.blockCode ?? "BLOCKED", message: g.reason ?? "Action bloquée." };
    return resultOf("blocked", null, null, err, trace("blocked", g.decision, null, err));
  }
  if (def?.confirmationRequired) transitions.push("confirmed");
  transitions.push("executing");

  // Idempotence (actions à effet) : réserver AVANT tout effet.
  const effect = def?.idempotency === "effect" && plan.idempotencyKey;
  if (effect) {
    const claim = await exec.idempotency.claim(plan.idempotencyKey!, {
      companyId: plan.authorization.tenantKey, userId: plan.authorization.viewerKey, kind: actionId,
    });
    if (claim !== "new") {
      transitions.push("duplicate");
      return resultOf("duplicate", null, null, { code: "DUPLICATE", message: "Action déjà exécutée (idempotence)." }, trace("duplicate", "allow", null, null));
    }
  }

  const adapter = def ? getAdapter(def.adapterId) : null;
  if (!adapter) {
    if (effect) await exec.idempotency.fail(plan.idempotencyKey!);
    transitions.push("failed");
    const err: StructuredActionError = { code: "ADAPTER_UNKNOWN", message: "Adaptateur inconnu." };
    return resultOf("failed", null, null, err, trace("failed", "allow", null, err));
  }

  const outcome = await adapter(plan.validatedArgs ?? {}, { ...exec.deps, confirmed: true });

  if (outcome.status === "cancelled") {
    if (effect) await exec.idempotency.fail(plan.idempotencyKey!);
    transitions.push("cancelled");
    return resultOf("cancelled", null, null, null, trace("cancelled", "allow", null, null));
  }
  if (outcome.status === "failed" || !outcome.observable) {
    // Jamais de faux succès : un « succès » sans preuve observable est traité comme un échec.
    if (effect) await exec.idempotency.fail(plan.idempotencyKey!);
    transitions.push("failed");
    const err: StructuredActionError = outcome.error ?? { code: "NO_OBSERVABLE_RESULT", message: "Succès non prouvé (aucune condition observable)." };
    return resultOf("failed", null, outcome.output, err, trace("failed", "allow", null, err));
  }

  if (effect) await exec.idempotency.commit(plan.idempotencyKey!, outcome.output ?? null);
  transitions.push("succeeded");
  return resultOf("succeeded", outcome.observable, outcome.output, null, trace("succeeded", "allow", outcome.observable, null));
}
