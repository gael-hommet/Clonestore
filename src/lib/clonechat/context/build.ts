// src/lib/clonechat/context/build.ts
//
// Assembleur PUR du contexte CloneChat. Prend les entrées DÉJÀ RÉSOLUES côté serveur (viewer,
// tenant, entitlement, route) et les normalise. Il ne lit aucune base, n'autorise aucun tenant,
// ne devine aucun état : il REFLÈTE ce qui a été résolu pour CETTE requête. L'isolation tenant
// reste appliquée en amont (résolution) ; ici companyId n'apparaît que si le tenant est résolu.

import {
  classifyCloneChatRequest, resolveCloneChatPlan, prerequisiteCta,
  type CloneChatViewer,
} from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";
import { getRouteEntry } from "@/lib/nav/route-registry";
import {
  CLONECHAT_CONTEXT_VERSION, type CloneChatContext, type CloneChatActionId,
  type CloneChatNavigation, type ContextEnvironment,
} from "./types";

export interface BuildContextInput {
  readonly message: string;
  readonly viewer: CloneChatViewer;
  /** Résolu côté serveur ; null si le lecteur est anonyme (aucune requête tenant tentée). */
  readonly tenant: TenantResolution | null;
  /** Résolu côté serveur ; null si le lecteur est anonyme. */
  readonly entitlement: PierreAccessResult | null;
  /** Route applicative courante (ex. "/agents/pierre"). Inconnue/absente → navigation non résolue. */
  readonly routePath?: string | null;
  /** Environnement d'exécution fourni par l'appelant (jamais deviné) ; défaut = NODE_ENV réel. */
  readonly environment?: ContextEnvironment;
  /** Erreurs réellement présentes sur la page (ids/labels sûrs, jamais de contenu sensible). */
  readonly surfacedErrors?: readonly string[];
}

function readEnvironment(explicit?: ContextEnvironment): ContextEnvironment {
  if (explicit) return explicit;
  const e = (process.env.NODE_ENV ?? "").toLowerCase();
  if (e === "production") return "production";
  if (e === "development") return "development";
  if (e === "test") return "development";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return "unknown";
}

function buildNavigation(routePath?: string | null): CloneChatNavigation {
  if (!routePath) {
    return { routePath: null, routeLabel: null, audience: null, status: null, space: null, breadcrumb: [], known: false };
  }
  const entry = getRouteEntry(routePath);
  if (!entry) {
    // Route inconnue du registre : on ne suppose RIEN (ni audience, ni statut).
    return { routePath, routeLabel: null, audience: null, status: null, space: null, breadcrumb: [], known: false };
  }
  return {
    routePath: entry.path, routeLabel: entry.label, audience: entry.audience, status: entry.status,
    space: entry.space, breadcrumb: entry.breadcrumb ? [...entry.breadcrumb] : [], known: true,
  };
}

/** Assemble le contexte CloneChat depuis les sources réelles. Pur & déterministe. */
export function buildCloneChatContext(input: BuildContextInput): CloneChatContext {
  const requestClass = classifyCloneChatRequest(input.message ?? "");
  const plan = resolveCloneChatPlan({
    requestClass, viewer: input.viewer, entitlement: input.entitlement ?? null, tenant: input.tenant ?? null,
  });

  const authenticated = input.viewer.kind === "user";
  const userId = input.viewer.kind === "user" ? input.viewer.userId : null;

  // Tenant : companyId UNIQUEMENT si résolu (ok). Jamais un autre tenant, jamais un id fabriqué.
  const t = input.tenant;
  const tenantResolved = !!t && t.ok === true && !plan.tenantSecurityFailure;
  const tenantCtx = {
    resolved: tenantResolved,
    companyId: t && t.ok === true ? t.companyId : null,
    role: t && t.ok === true ? t.role : null,
    real: t && t.ok === true ? t.real : false,
    refusalCode: t && t.ok === false ? t.code : null,
    securityFailure: plan.tenantSecurityFailure,
  };

  // Pierre : droit réel ; LOOKUP_FAILED jamais confondu avec absence de droit.
  const e = input.entitlement;
  const pierreCtx = {
    granted: !!e && e.ok === true,
    status: e && e.ok === true ? e.status : null,
    lookupFailed: plan.entitlementLookupFailed,
  };

  // Actions disponibles : DÉRIVÉES du plan (jamais inventées). Converser + naviguer = toujours ;
  // lecture privée = entreprise vérifiée ; action gouvernée = entreprise + Pierre vérifiés.
  const availableActions: CloneChatActionId[] = ["ask_question", "open_page"];
  if (plan.privateContextAvailable) availableActions.push("read_private_context");
  if (plan.governedActionAvailable) availableActions.push("propose_governed_action");

  // Blocages : uniquement des états RÉELS.
  const blockers: string[] = [];
  if (plan.tenantSecurityFailure) blockers.push("tenant_security_failure");
  if (plan.entitlementLookupFailed) blockers.push("entitlement_lookup_unavailable");
  const nav = buildNavigation(input.routePath);
  if (nav.known && nav.status === "gated" && requestClass !== "CONVERSATIONAL_OR_PUBLIC" && plan.missingPrerequisites.length > 0) {
    blockers.push("route_gated_prerequisite");
  }

  return Object.freeze({
    version: CLONECHAT_CONTEXT_VERSION,
    navigation: nav,
    viewer: { authenticated, userId },
    tenant: tenantCtx,
    pierre: pierreCtx,
    lane: plan.lane,
    requestClass,
    availableActions: Object.freeze(availableActions),
    missingPrerequisites: plan.missingPrerequisites,
    prerequisiteCta: prerequisiteCta(plan.missingPrerequisites),
    blockers: Object.freeze(blockers),
    surfacedErrors: Object.freeze([...(input.surfacedErrors ?? [])]),
    environment: readEnvironment(input.environment),
    privateContextAvailable: plan.privateContextAvailable,
    governedActionAvailable: plan.governedActionAvailable,
  });
}
