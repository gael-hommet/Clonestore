// src/lib/clonechat/actions/guard.ts
//
// CLONEGUARD — vérifications DÉTERMINISTES avant toute exécution. Le modèle ne peut JAMAIS : ajouter
// une permission, diminuer le risque, désactiver une confirmation, changer le tenant, choisir le
// succès, inventer un adaptateur, contourner CloneGuard, ni transformer un refus en action.

import { isRealRoute } from "./registry";
import { hasAdapter, adapterAvailable, type AdapterDeps } from "./adapters";
import { verifyConfirmation, type ConfirmationRegistry } from "./confirmation";
import {
  CLONECHAT_GUARD_VERSION, type GuardResult, type GuardCheck, type StructuredActionError,
  type ActionDefinition, type ActionAuthorization, type ConfirmationToken, type CloneActionPlan,
} from "./types";

export interface GuardStaticInput {
  readonly definition: ActionDefinition | null;
  readonly validatedArgs: Readonly<Record<string, unknown>> | null;
  readonly argsError: StructuredActionError | null;
  readonly authorization: ActionAuthorization;
  readonly route: string | null; // route concernée (si l'action porte sur une route)
}

function permissionOk(def: ActionDefinition, a: ActionAuthorization): boolean {
  switch (def.permission) {
    case "public": return true;
    case "authenticated": return a.authenticated;
    case "company_member": return a.tenantResolved;
    case "company_owner": return a.tenantResolved && a.role === "owner";
    default: return false;
  }
}

/** Vérifications communes (indépendantes de la phase). Renvoie le premier blocage RÉEL rencontré. */
function staticChecks(input: GuardStaticInput): { checks: GuardCheck[]; block: StructuredActionError | null } {
  const checks: GuardCheck[] = [];
  const { definition: def, validatedArgs, argsError, authorization: a, route } = input;
  let block: StructuredActionError | null = null;
  const push = (id: string, ok: boolean, detail?: string) => { checks.push({ id, ok, detail }); return ok; };
  const stop = (code: string, message: string): void => { if (!block) block = { code, message }; };

  // 1) Sécurité en premier : un refus reste un refus.
  if (!push("no_security_refusal", !a.securityRefusal)) stop("SECURITY_REFUSAL", "Demande refusée (contournement de gouvernance ou injection).");
  // 2) Action connue.
  if (!block && !push("action_known", def !== null)) stop("ACTION_UNKNOWN", "Action inconnue du registre.");
  // 3) Action réellement disponible.
  if (!block && def && !push("action_available", def.available)) stop("ACTION_UNAVAILABLE", "Action déclarée non disponible.");
  // 4) Arguments valides.
  if (!block && !push("args_valid", validatedArgs !== null, argsError?.code)) stop(argsError?.code ?? "INVALID_ARGS", argsError?.message ?? "Arguments invalides.");
  // 5) Route réelle si l'action porte sur une route.
  if (!block && def && route !== null && !push("route_real", isRealRoute(route))) stop("ROUTE_NOT_FOUND", "Route inexistante dans le registre.");
  // 6) Authentification.
  if (!block && def?.authRequired && !push("auth", a.authenticated)) stop("AUTH_REQUIRED", "Authentification requise.");
  // 7) Tenant : invalide (sécurité) vs absent.
  if (!block && def?.tenantRequired) {
    if (a.tenantSecurityFailure) { push("tenant_valid", false); stop("TENANT_INVALID", "Accès entreprise invalide (suspendu / indisponible)."); }
    else if (!push("tenant_present", a.tenantResolved)) stop("TENANT_REQUIRED", "Entreprise active requise.");
  }
  // 8) Entitlement Pierre.
  if (!block && def?.entitlementRequired && !push("entitlement", a.pierreGranted)) stop("ENTITLEMENT_REQUIRED", "Droit Pierre requis.");
  // 9) Permission (rôle).
  if (!block && def && !push("permission", permissionOk(def, a))) stop("PERMISSION_DENIED", "Permission insuffisante pour cette action.");
  // 10) Adaptateur connu (statique).
  if (!block && def && !push("adapter_known", hasAdapter(def.adapterId))) stop("ADAPTER_UNKNOWN", "Adaptateur inconnu.");

  return { checks, block };
}

function result(decision: GuardResult["decision"], reason: string | null, blockCode: string | null, checks: GuardCheck[], confirmationRequired: boolean): GuardResult {
  return Object.freeze({ version: CLONECHAT_GUARD_VERSION, decision, reason, blockCode, checks: Object.freeze([...checks]), confirmationRequired });
}

/** Phase 1 (plan) : aucune confirmation encore. Renvoie block / needs_confirmation / allow. */
export function guardPlan(input: GuardStaticInput): GuardResult {
  const { checks, block } = staticChecks(input);
  const confirmationRequired = input.definition?.confirmationRequired === true;
  if (block) return result("block", block.message, block.code, checks, confirmationRequired);
  if (confirmationRequired) {
    checks.push({ id: "confirmation_required", ok: true, detail: "confirmation à fournir en phase d'exécution" });
    return result("needs_confirmation", "Confirmation explicite requise.", null, checks, true);
  }
  return result("allow", null, null, checks, false);
}

export interface GuardExecuteOptions {
  readonly confirmation?: ConfirmationToken;
  readonly confirmationRegistry: ConfirmationRegistry;
  readonly nowMs: number;
  readonly deps: AdapterDeps;
}

/** Phase 2 (exécution) : re-vérifie tout + disponibilité runtime de l'adaptateur + confirmation liée. */
export function guardExecute(plan: CloneActionPlan, opts: GuardExecuteOptions): GuardResult {
  const input: GuardStaticInput = {
    definition: plan.definition,
    validatedArgs: plan.validatedArgs,
    argsError: plan.error,
    authorization: plan.authorization,
    route: plan.route,
  };
  const { checks, block } = staticChecks(input);
  const confirmationRequired = plan.definition?.confirmationRequired === true;
  if (block) return result("block", block.message, block.code, checks, confirmationRequired);

  // Disponibilité RUNTIME de l'adaptateur (deps injectées).
  if (plan.definition && !adapterAvailable(plan.definition.adapterId, opts.deps)) {
    checks.push({ id: "adapter_available", ok: false });
    return result("block", "Adaptateur indisponible.", "ADAPTER_UNAVAILABLE", checks, confirmationRequired);
  }
  checks.push({ id: "adapter_available", ok: true });

  // Confirmation liée exactement (action/args/viewer/tenant), non expirée, non réutilisée.
  if (confirmationRequired) {
    const v = verifyConfirmation(opts.confirmation, plan, { nowMs: opts.nowMs, registry: opts.confirmationRegistry });
    if (!v.ok) {
      checks.push({ id: "confirmation", ok: false, detail: v.code });
      return result("block", v.reason, v.code, checks, true);
    }
    checks.push({ id: "confirmation", ok: true });
  }

  return result("allow", null, null, checks, confirmationRequired);
}
