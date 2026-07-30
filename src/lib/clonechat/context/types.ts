// src/lib/clonechat/context/types.ts
//
// CloneChat BLOC 3 — CLONECONTEXT. Contexte applicatif RÉEL et typé fourni à CloneChat : page/route
// courante, viewer (authentifié/anonyme), entreprise/tenant, accès Pierre, entitlements, actions
// réellement disponibles, prérequis manquants, erreurs/blocages présents, environnement et
// navigation. Assemblé UNIQUEMENT à partir des sources déjà résolues côté serveur (viewer + tenant
// + entitlement + route) — jamais deviné, jamais inter-tenant, jamais un droit inventé. Module PUR.

import type { CloneChatRequestClass, CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import type { RouteAudience, RouteStatus } from "@/lib/nav/route-registry";

export const CLONECHAT_CONTEXT_VERSION = "context-1" as const;

export type ContextEnvironment = "production" | "preview" | "development" | "unknown";

/** Contexte de navigation : reflète la route RÉELLE (registre) ou rien — jamais inventé. */
export interface CloneChatNavigation {
  readonly routePath: string | null;
  readonly routeLabel: string | null;
  readonly audience: RouteAudience | null;
  readonly status: RouteStatus | null;
  readonly space: string | null;
  readonly breadcrumb: readonly string[];
  /** La route existe-t-elle dans le registre canonique ? (false = inconnue → rien n'est supposé) */
  readonly known: boolean;
}

/** Qui parle. Aucun identifiant n'est jamais fabriqué pour un anonyme. */
export interface CloneChatViewerContext {
  readonly authenticated: boolean;
  readonly userId: string | null;
}

/** Entreprise/tenant RÉSOLU pour CETTE requête uniquement. companyId n'apparaît que si résolu. */
export interface CloneChatTenantContext {
  readonly resolved: boolean;
  readonly companyId: string | null;
  readonly role: string | null;
  readonly real: boolean;
  /** Code de refus tenant quand non résolu (MEMBERSHIP_REQUIRED, COMPANY_SELECTION_REQUIRED, …). */
  readonly refusalCode: string | null;
  /** Défaillance de sécurité tenant (suspendu / indisponible) — seul cas fail-closed. */
  readonly securityFailure: boolean;
}

/** Accès Pierre RÉEL. Une panne de lecture n'est jamais confondue avec une absence de droit. */
export interface CloneChatPierreContext {
  readonly granted: boolean;
  readonly status: string | null;
  readonly lookupFailed: boolean;
}

/** Actions réellement disponibles, DÉRIVÉES du plan (jamais une permission inventée). */
export type CloneChatActionId =
  | "ask_question" // toujours : converser est un droit
  | "open_page" // toujours : navigation vers une route réelle
  | "read_private_context" // seulement si l'entreprise est vérifiée
  | "propose_governed_action"; // seulement si entreprise + Pierre vérifiés

export interface CloneChatContext {
  readonly version: typeof CLONECHAT_CONTEXT_VERSION;
  readonly navigation: CloneChatNavigation;
  readonly viewer: CloneChatViewerContext;
  readonly tenant: CloneChatTenantContext;
  readonly pierre: CloneChatPierreContext;
  readonly lane: "PUBLIC" | "COMPANY";
  readonly requestClass: CloneChatRequestClass;
  readonly availableActions: readonly CloneChatActionId[];
  readonly missingPrerequisites: readonly CloneChatPrerequisite[];
  readonly prerequisiteCta: { readonly route: string; readonly label: string } | null;
  /** Blocages présents (dérivés d'états RÉELS : sécurité tenant, panne d'entitlement, route gated…). */
  readonly blockers: readonly string[];
  /** Erreurs réellement présentes sur la page (fournies par l'appelant ; jamais inventées). */
  readonly surfacedErrors: readonly string[];
  readonly environment: ContextEnvironment;
  readonly privateContextAvailable: boolean;
  readonly governedActionAvailable: boolean;
}
