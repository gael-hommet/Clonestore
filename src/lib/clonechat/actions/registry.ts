// src/lib/clonechat/actions/registry.ts
//
// Registre CANONIQUE, typé, versionné et déterministe des actions. Une action n'existe QUE si une
// capacité réelle du repo ou un adaptateur réellement implémenté la prouve (provenance). Le
// périmètre initial est volontairement SÛR : navigation/recommandation de route réelle, préparation
// de ticket, soumission de ticket via provider abstrait (après confirmation), reprise contrôlée, et
// préparation d'une demande gouvernée POUR VALIDATION HUMAINE FUTURE (jamais d'effet métier). Les
// mutations métier (mission Pierre, RH, signature, paiement…) NE SONT PAS dans le registre : elles
// sont soit absentes (→ inconnues), soit déclarées non disponibles (available=false).

import { getRouteEntry } from "@/lib/nav/route-registry";
import type { ActionDefinition, ArgsValidation } from "./types";

const OK = (args: Readonly<Record<string, unknown>>): ArgsValidation => ({ ok: true, args });
const ERR = (code: string, message: string): ArgsValidation => ({ ok: false, code, message });

function requireString(args: Readonly<Record<string, unknown>>, key: string, code: string, label: string): ArgsValidation {
  const v = (args as Record<string, unknown>)[key];
  if (typeof v !== "string" || v.trim().length === 0) return ERR(code, `${label} requis.`);
  return OK({ ...args, [key]: v.trim() });
}

export const CLONE_ACTIONS: readonly ActionDefinition[] = [
  {
    id: "navigate",
    version: "1", description: "Préparer une navigation vers une route réelle du produit.",
    category: "navigation", risk: "low", nature: "navigation", available: true,
    authRequired: false, tenantRequired: false, entitlementRequired: false, permission: "public",
    confirmationRequired: false, cancellable: true, idempotency: "none", adapterId: "navigate",
    successCondition: "La route cible existe dans le registre canonique.",
    possibleErrors: ["INVALID_ARGS", "ROUTE_NOT_FOUND"],
    provenance: "nav/route-registry (getRouteEntry) — navigation vers des routes réelles.",
    validate: (a) => requireString(a, "route", "INVALID_ARGS", "route"),
    routeOf: (a) => (typeof a.route === "string" ? (a.route as string) : null),
  },
  {
    id: "recommend_route",
    version: "1", description: "Recommander une route réelle (sans naviguer).",
    category: "navigation", risk: "low", nature: "read", available: true,
    authRequired: false, tenantRequired: false, entitlementRequired: false, permission: "public",
    confirmationRequired: false, cancellable: true, idempotency: "none", adapterId: "recommend_route",
    successCondition: "La route recommandée existe dans le registre canonique.",
    possibleErrors: ["INVALID_ARGS", "ROUTE_NOT_FOUND"],
    provenance: "nav/route-registry (getRouteEntry).",
    validate: (a) => requireString(a, "route", "INVALID_ARGS", "route"),
    routeOf: (a) => (typeof a.route === "string" ? (a.route as string) : null),
  },
  {
    id: "prepare_ticket",
    version: "1", description: "Préparer un brouillon de ticket support sûr (sans l'envoyer).",
    category: "support", risk: "low", nature: "prepare", available: true,
    authRequired: false, tenantRequired: false, entitlementRequired: false, permission: "public",
    confirmationRequired: false, cancellable: true, idempotency: "none", adapterId: "prepare_ticket",
    successCondition: "Un brouillon de ticket avec clé d'idempotence est produit.",
    possibleErrors: ["NO_TICKET_CONTEXT"],
    provenance: "CloneCare BLOC 7 (buildTicketDraft) — brouillon sûr, jamais envoyé.",
    validate: (a) => OK(a),
    routeOf: () => null,
  },
  {
    id: "submit_ticket",
    version: "1", description: "Soumettre un ticket support via un provider abstrait, après confirmation explicite.",
    category: "support", risk: "medium", nature: "write", available: true,
    authRequired: true, tenantRequired: false, entitlementRequired: false, permission: "authenticated",
    confirmationRequired: true, cancellable: true, idempotency: "effect", adapterId: "submit_ticket",
    successCondition: "Le provider support a retourné un identifiant de ticket.",
    possibleErrors: ["INVALID_ARGS", "ADAPTER_UNAVAILABLE", "PROVIDER_UNAVAILABLE", "DUPLICATE", "NO_OBSERVABLE_RESULT"],
    provenance: "CloneCare BLOC 7 (submitTicket + SupportTicketProvider abstrait + mock).",
    validate: (a) => {
      const t = (a as Record<string, unknown>).ticket as { idempotencyKey?: unknown } | undefined;
      if (!t || typeof t !== "object" || typeof t.idempotencyKey !== "string") return ERR("INVALID_ARGS", "Un brouillon de ticket valide est requis.");
      return OK(a);
    },
    routeOf: () => null,
  },
  {
    id: "prepare_retry",
    version: "1", description: "Préparer une reprise / un réessai contrôlé (non destructif).",
    category: "recovery", risk: "low", nature: "prepare", available: true,
    authRequired: false, tenantRequired: false, entitlementRequired: false, permission: "public",
    confirmationRequired: false, cancellable: true, idempotency: "none", adapterId: "prepare_retry",
    successCondition: "Un plan de reprise (étape à réessayer) est produit.",
    possibleErrors: [],
    provenance: "Diagnostic/Guide BLOC 4-5 (états provider_outage / recover).",
    validate: (a) => OK(a),
    routeOf: () => null,
  },
  {
    id: "prepare_governed_request",
    version: "1", description: "Préparer une demande gouvernée POUR VALIDATION HUMAINE FUTURE (aucun effet métier).",
    category: "governed_prepare", risk: "medium", nature: "prepare", available: true,
    authRequired: true, tenantRequired: true, entitlementRequired: true, permission: "company_owner",
    confirmationRequired: true, cancellable: true, idempotency: "none", adapterId: "prepare_only",
    successCondition: "Un descripteur de demande est préparé (aucune mutation, à valider par un humain).",
    possibleErrors: ["INVALID_ARGS", "AUTH_REQUIRED", "TENANT_REQUIRED", "TENANT_INVALID", "ENTITLEMENT_REQUIRED", "PERMISSION_DENIED"],
    provenance: "Gouvernance CloneStore : Pierre prépare, un humain valide (aucune exécution ici).",
    validate: (a) => requireString(a, "summary", "INVALID_ARGS", "résumé de la demande"),
    routeOf: () => null,
  },
  {
    // Déclarée mais NON DISPONIBLE : prouve que le système CONNAÎT ces demandes et les refuse
    // explicitement, sans jamais les exécuter (aucun adaptateur métier réel/sûr n'existe).
    id: "prepare_pierre_mission",
    version: "1", description: "Créer/lancer une mission Pierre — DÉCLARÉE NON DISPONIBLE (mutation métier).",
    category: "governed_prepare", risk: "irreversible", nature: "write", available: false,
    authRequired: true, tenantRequired: true, entitlementRequired: true, permission: "company_owner",
    confirmationRequired: true, cancellable: false, idempotency: "effect", adapterId: "unavailable",
    successCondition: "N/A — action non disponible.",
    possibleErrors: ["ACTION_UNAVAILABLE"],
    provenance: "Mutation métier Pierre — hors périmètre CloneActions (aucun adaptateur sûr) ; déclarée non disponible.",
    validate: (a) => OK(a),
    routeOf: () => null,
  },
] as const;

export function resolveActionDefinition(actionId: string): ActionDefinition | null {
  return CLONE_ACTIONS.find((d) => d.id === actionId) ?? null;
}

/** Une route candidate est-elle réelle (registre) ? */
export function isRealRoute(route: string | null): boolean {
  return !!route && !!getRouteEntry(route);
}
