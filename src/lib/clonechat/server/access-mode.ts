// src/lib/clonechat/server/access-mode.ts
// C1.4 — MATRICE D'ACCÈS CloneChat, explicite et PURE (donc testable sans réseau/DB).
//
// Trois autorités DISTINCTES, jamais confondues :
//   · l'INTENTION choisit une voie (publique ou opérationnelle) — elle n'accorde JAMAIS d'autorisation ;
//   · le DROIT PIERRE (orders) débloque l'opérationnel — il ne fabrique JAMAIS une entreprise ;
//   · l'ENTREPRISE (membership) identifie le tenant — elle ne fabrique JAMAIS un droit Pierre.
//
// Doctrine préservée :
//   · C1.3 — la découverte publique authentifiée reste accessible SANS droit et SANS entreprise ;
//   · une entreprise active seule NE contourne PAS le droit Pierre ;
//   · un échec de vérification du droit n'est jamais lu comme « pas de droit » (fail-closed opérationnel) ;
//   · suspension de membership / indisponibilité entreprise restent FAIL-CLOSED (même en question publique).

import type { PierreAccessResult } from "@/lib/pierre/access";
import type { TenantResolution } from "./company";
import type { NoCompanyIntent } from "./no-company-gate";

export type CloneChatAccessMode =
  /** Entreprise + droit valides → comportement entreprise existant (inchangé). */
  | { readonly mode: "COMPANY_MODE"; readonly companyId: string }
  /** Découverte publique authentifiée : sources PUBLIQUES uniquement, budget companyId=null. */
  | { readonly mode: "AUTHENTICATED_DISCOVERY"; readonly entitlementKnown: boolean }
  /** Requête opérationnelle sans droit Pierre → activation requise (aucun modèle, aucune donnée). */
  | { readonly mode: "ENTITLEMENT_REQUIRED" }
  /** Droit OK mais aucune entreprise active → sélectionner/créer une entreprise. */
  | { readonly mode: "COMPANY_REQUIRED" }
  /** Demande ambiguë → une clarification, jamais un blocage automatique. */
  | { readonly mode: "CLARIFICATION_REQUIRED" }
  /** Vérification du droit indisponible + requête opérationnelle → fail-closed (503). */
  | { readonly mode: "ACCESS_CHECK_UNAVAILABLE" }
  /** Échec tenant sensible (suspendu / indisponible / inconnu) → fail-closed. */
  | { readonly mode: "TENANT_FAIL_CLOSED" };

/** États tenant ORDINAIRES « pas d'entreprise » (C1.3) — les seuls qui ouvrent la découverte. */
export function isOrdinaryNoCompany(tenant: TenantResolution): boolean {
  return (
    tenant.ok === false &&
    (tenant.code === "MEMBERSHIP_REQUIRED" || tenant.code === "COMPANY_SELECTION_REQUIRED")
  );
}

export interface AccessModeInput {
  readonly intent: NoCompanyIntent; // public | company | ambiguous
  readonly entitlement: PierreAccessResult;
  readonly tenant: TenantResolution;
}

/**
 * Calcule le mode d'accès SERVEUR. Ordre volontaire :
 *   1) sécurité tenant (suspendu/indisponible) → fail-closed pour TOUS, même en question publique ;
 *   2) vérification du droit indisponible → opérationnel fail-closed, public toléré (n'accorde rien) ;
 *   3) pas de droit → public autorisé (découverte), opérationnel refusé (même AVEC une entreprise) ;
 *   4) droit OK → entreprise valide = mode entreprise ; sinon porte C1.3 « pas d'entreprise ».
 */
export function resolveCloneChatAccessMode(input: AccessModeInput): CloneChatAccessMode {
  const { intent, entitlement, tenant } = input;
  const isPublic = intent === "public";
  const isAmbiguous = intent === "ambiguous";

  // 1) Échec tenant SENSIBLE → fail-closed pour tous (doctrine C1.3, non régressée).
  if (!tenant.ok && !isOrdinaryNoCompany(tenant)) {
    return { mode: "TENANT_FAIL_CLOSED" };
  }

  // 2) Droit INCONNU (panne de vérification) : jamais lu comme « droit accordé » ni « pas de droit ».
  if (entitlement.ok === false && entitlement.reason === "LOOKUP_FAILED") {
    // La découverte publique n'accorde AUCUN accès entreprise → elle peut continuer.
    if (isPublic) return { mode: "AUTHENTICATED_DISCOVERY", entitlementKnown: false };
    return { mode: "ACCESS_CHECK_UNAVAILABLE" }; // opérationnel → fail-closed
  }

  // 3) AUCUN droit Pierre : la découverte publique reste ouverte (C1.3), l'opérationnel est refusé —
  //    même si une entreprise active existe (une entreprise seule ne contourne pas le droit).
  if (entitlement.ok === false) {
    if (isPublic) return { mode: "AUTHENTICATED_DISCOVERY", entitlementKnown: true };
    if (isAmbiguous) return { mode: "CLARIFICATION_REQUIRED" };
    return { mode: "ENTITLEMENT_REQUIRED" };
  }

  // 4) Droit Pierre VALIDE.
  if (tenant.ok) return { mode: "COMPANY_MODE", companyId: tenant.companyId };

  // Droit OK mais pas d'entreprise active (état ordinaire) → porte C1.3.
  if (isPublic) return { mode: "AUTHENTICATED_DISCOVERY", entitlementKnown: true };
  if (isAmbiguous) return { mode: "CLARIFICATION_REQUIRED" };
  return { mode: "COMPANY_REQUIRED" };
}

/** Message honnête : Pierre doit être activé pour toute opération sur l'entreprise. */
export const PIERRE_ENTITLEMENT_REQUIRED_MESSAGE =
  "Pierre doit être activé pour agir sur votre entreprise, accéder à vos données RH ou créer des missions. " +
  "En attendant, je réponds à toutes vos questions sur CloneStore, Pierre, les prix et le fonctionnement.";

/** Message honnête quand la vérification du droit est indisponible (aucun détail technique). */
export const ACCESS_CHECK_UNAVAILABLE_MESSAGE =
  "Je ne peux pas vérifier votre accès à Pierre pour le moment. Réessayez dans un instant — " +
  "aucune action n'a été effectuée sur votre entreprise.";
