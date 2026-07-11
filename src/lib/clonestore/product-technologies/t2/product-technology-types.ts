// src/lib/clonestore/product-technologies/t2/product-technology-types.ts
// T2 — CLONESTORE PRODUCT TECHNOLOGIES : types de base.
// DOCTRINE : T1 = capacités bas-niveau réutilisables ; T2 = SYSTÈMES produit CloneStore
// (CloneOS, CloneADN, CloneGuard, …). T2 consomme T1 par contrat ; Pierre consommera T2
// via P16A/P16C ; CloneRoom consomme T2. Rien n'est hardcodé dans Pierre V1.
// Aucun provider live, aucun paiement, production OFF. Module PUR.

import type { TechnologyContext } from "@/lib/clonestore/technologies/t1";

/** Les 14 technologies produit CloneStore (canon T2). */
export type ProductTechnologyId =
  | "cloneos"
  | "cloneadn"
  | "cloneguard"
  | "clonetrace"
  | "clonevoice"
  | "clonepolicy"
  | "clonecontinuum"
  | "clonetrust"
  | "clonereview"
  | "clonesignals"
  | "clonelearn"
  | "clonebrief"
  | "clonecall"
  | "cloneroom";

export const ALL_PRODUCT_TECHNOLOGY_IDS: readonly ProductTechnologyId[] = [
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonepolicy",
  "clonecontinuum", "clonetrust", "clonereview", "clonesignals", "clonelearn",
  "clonebrief", "clonecall", "cloneroom",
];

export function isProductTechnologyId(value: string): value is ProductTechnologyId {
  return (ALL_PRODUCT_TECHNOLOGY_IDS as readonly string[]).includes(value);
}

/** Statut réel — jamais surdéclaré (une techno n'est « finale » qu'avec impl locale + tests + fallback + live bloqué + audit). */
export type ProductTechnologyStatus =
  | "verified"
  | "partial"
  | "architecture_ready"
  | "local_safe_ready"
  | "integration_ready"
  | "external_blocked"
  | "live_blocked"
  | "missing";

export type ProductTechnologyMode =
  | "local_safe"
  | "architecture_only"
  | "integration_ready"
  | "live_disabled"
  | "blocked";

/**
 * Contexte d'usage produit. Étend le contexte T1 (employeeId générique — « pierre » n'est
 * qu'un id parmi d'autres ; companyId obligatoire, fail-closed) avec le rôle du demandeur
 * (CloneTrust) — AUCUNE logique spécifique à un employé dans la couche.
 */
export interface ProductTechnologyContext extends TechnologyContext {
  readonly requesterRole?: string;
}

// ── Vocabulaire partagé de la couche (aide à l'intention — PUR, déterministe) ──

export type IntentKind =
  | "prepare_document" | "draft_email" | "schedule_event" | "analyze"
  | "follow_up" | "hr_case_preparation" | "generic_mission";

export type RiskLevel = "normal" | "sensitive" | "critical";

export type AutonomyLevel =
  | "prepare_only" | "suggest" | "execute_with_validation" | "autonomous_safe" | "human_only";
