// src/lib/clonestore/technologies/t1/technology-types.ts
// T1 — CLONESTORE TECHNOLOGIES LAYER : types de base.
// DOCTRINE : les technologies appartiennent à CloneStore. Pierre les CONSOMME par contrat
// (adaptateurs P16C) ; les futurs employés IA consomment les MÊMES contrats. Aucune techno
// n'est hardcodée pour Pierre. Aucun provider live. Aucun secret. Production OFF.
// Module PUR : aucune I/O, aucun réseau, aucun accès base.

/** Les 15 technologies CloneStore (périmètre P16.0 — catégorie B). */
export type TechnologyId =
  | "document"
  | "mail"
  | "calendar"
  | "signature"
  | "voice"
  | "notification"
  | "connector"
  | "memory"
  | "evidence"
  | "workflow"
  | "analytics"
  | "file"
  | "export"
  | "permission"
  | "integration_bus";

export const ALL_TECHNOLOGY_IDS: readonly TechnologyId[] = [
  "document", "mail", "calendar", "signature", "voice",
  "notification", "connector", "memory", "evidence", "workflow",
  "analytics", "file", "export", "permission", "integration_bus",
];

export function isTechnologyId(value: string): value is TechnologyId {
  return (ALL_TECHNOLOGY_IDS as readonly string[]).includes(value);
}

/** Statut réel d'une technologie (jamais surdéclaré — doctrine fail-closed). */
export type TechnologyStatus =
  | "verified"
  | "partial"
  | "architecture_ready"
  | "missing"
  | "external_blocked"
  | "disabled";

export const ALL_TECHNOLOGY_STATUSES: readonly TechnologyStatus[] = [
  "verified", "partial", "architecture_ready", "missing", "external_blocked", "disabled",
];

/** De quoi dépend le chemin LIVE de la technologie (le chemin local sûr n'en dépend jamais). */
export type LiveDependency = "none" | "provider" | "external" | "owner_attestation";

/** Mode d'exécution. En T1, « live_ready » n'est JAMAIS atteint (production OFF + 0 provider vérifié). */
export type TechnologyMode = "local_safe" | "test" | "live_disabled" | "live_ready" | "blocked";

/**
 * Contexte d'utilisation d'une technologie.
 * `employeeId` est un identifiant d'employé IA quelconque (« pierre » aujourd'hui, n'importe quel
 * futur employé demain) — la couche ne contient AUCUNE logique spécifique à un employé.
 * `companyId` est le périmètre société : obligatoire, fail-closed s'il manque.
 */
export interface TechnologyContext {
  readonly employeeId: string;
  readonly companyId: string;
  readonly actorUserId?: string;
  readonly mode?: TechnologyMode;
  readonly purpose?: string;
}
