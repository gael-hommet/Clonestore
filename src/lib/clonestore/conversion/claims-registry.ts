// BLOC 3 — Claims registry + evidence matrix.
//
// Chaque claim LeadForge est auditée côté CloneStore :
//   - VERIFIED_PRODUCT_FACT : preuve produit observable (fichier, comportement).
//   - PENDING_CLONESTORE_PRODUCT_VERIFICATION : preuve attendue, surface ne peut
//     pas l'exposer comme vérité — formulation prudente exigée.
//   - PROHIBITED_ON_SURFACE : ne peut apparaître sur aucune surface activable.
//
// Un linter pur (`claims-linter.ts`) vérifie ensuite que les surfaces ne contiennent
// pas de claim pending présentée comme vérité.

import type { ClaimId } from "./contract";

export type ClaimStatus =
  | "VERIFIED_PRODUCT_FACT"
  | "PENDING_CLONESTORE_PRODUCT_VERIFICATION"
  | "PROHIBITED_ON_SURFACE";

export type Surface =
  | "landing"
  | "demo"
  | "diagnostic"
  | "result"
  | "pricing"
  | "faq"
  | "checkout_copy"
  | "success";

export interface ClaimRecord {
  readonly id: ClaimId;
  readonly status: ClaimStatus;
  /** Texte autorisé sur les surfaces — toujours prudent quand pending. */
  readonly authorizedText: string;
  /** Preuves produit (chemins fichier / scripts de check / comportements). */
  readonly evidence: readonly string[];
  /** Surfaces où la claim peut apparaître (texte autorisé). */
  readonly allowedSurfaces: readonly Surface[];
  /** Limites explicites — toujours visibles à proximité de la claim. */
  readonly limitations: readonly string[];
  /** Version du contrat LeadForge — figée. */
  readonly contractVersion: string;
}

const CONTRACT_VERSION_REF = "1.0.0";

export const CLAIMS_REGISTRY: Readonly<Record<ClaimId, ClaimRecord>> = Object.freeze({
  pierre_is_role: {
    id: "pierre_is_role",
    status: "VERIFIED_PRODUCT_FACT",
    authorizedText:
      "Pierre est un poste RH opérationnel : il reçoit une mission, la structure en tâches, prépare les livrables et conserve l'état.",
    evidence: [
      "src/lib/pierre/cockpit/api-client.ts",
      "src/lib/pierre/v1/",
      "src/lib/clonestore/runtime-integration/",
    ],
    allowedSurfaces: ["landing", "demo", "result", "faq"],
    limitations: [
      "Les décisions managériales, juridiques et disciplinaires finales restent humaines.",
    ],
    contractVersion: CONTRACT_VERSION_REF,
  },
  human_validation: {
    id: "human_validation",
    status: "VERIFIED_PRODUCT_FACT",
    authorizedText:
      "Toute action sensible est bloquée par CloneGuard et reste en attente jusqu'à validation humaine explicite.",
    evidence: [
      "src/lib/clonestore/guard/",
      "src/lib/pierre/__tests__/hr-cloneguard.test.ts",
      "src/lib/pierre/__tests__/hr-cloneguard-runtime.test.ts",
    ],
    allowedSurfaces: ["landing", "demo", "result", "faq", "checkout_copy", "pricing"],
    limitations: [
      "Le périmètre des actions sensibles dépend des règles CloneADN de l'entreprise.",
    ],
    contractVersion: CONTRACT_VERSION_REF,
  },
  traceability: {
    id: "traceability",
    status: "VERIFIED_PRODUCT_FACT",
    authorizedText:
      "Chaque étape est enregistrée dans CloneTrace : actor, timestamp, statut, événements, artefacts, prochaine action.",
    evidence: [
      "src/lib/clonestore/trace/",
      "src/lib/pierre/__tests__/hr-audit-trail.test.ts",
      "src/lib/pierre/__tests__/hr-audit-trail-runtime.test.ts",
    ],
    allowedSurfaces: ["landing", "demo", "result", "faq"],
    limitations: [
      "La conservation pour audit dépend du contrat de service de l'entreprise.",
    ],
    contractVersion: CONTRACT_VERSION_REF,
  },
  company_adaptation: {
    id: "company_adaptation",
    status: "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
    authorizedText:
      "Pierre s'appuie sur l'Empreinte Entreprise et CloneADN pour adapter ton, approbateurs et modèles.",
    evidence: [
      "src/lib/clonestore/enterprise-footprint/",
      "src/lib/clonestore/adn/",
      "src/lib/pierre/__tests__/cloneadn-integration.test.ts",
    ],
    allowedSurfaces: ["landing", "demo", "result", "faq"],
    limitations: [
      "L'adaptation reste partielle tant que l'Empreinte n'a pas été remplie. Aucune omniscience.",
    ],
    contractVersion: CONTRACT_VERSION_REF,
  },
  recurring_work: {
    id: "recurring_work",
    status: "VERIFIED_PRODUCT_FACT",
    authorizedText:
      "Brief → analyse → mission → tâches → document/email → validation → trace : Pierre couvre ce cycle pour les tâches RH récurrentes.",
    evidence: [
      "src/lib/pierre/__tests__/golden-scenarios.test.ts",
      "src/lib/pierre/__tests__/release-candidate.test.ts",
    ],
    allowedSurfaces: ["landing", "demo", "result"],
    limitations: [
      "Hors périmètre : décisions managériales, conseil juridique, paie certifiée.",
    ],
    contractVersion: CONTRACT_VERSION_REF,
  },
  pierre_price_449: {
    id: "pierre_price_449",
    status: "VERIFIED_PRODUCT_FACT",
    authorizedText: "449 € HT / mois — accès complet à Pierre.",
    evidence: [
      "src/lib/billing/stripe-activation.ts:EXPECTED_PIERRE_PRICE_AMOUNT=44900",
      "src/lib/clonestore/conversion/contract.ts:PIERRE_PRICE_AMOUNT_CENTS",
    ],
    allowedSurfaces: ["landing", "demo", "pricing", "faq", "checkout_copy", "result"],
    limitations: [],
    contractVersion: CONTRACT_VERSION_REF,
  },
});

export function getClaim(id: ClaimId): ClaimRecord {
  const claim = CLAIMS_REGISTRY[id];
  if (!claim) throw new Error(`Claim inconnue: ${id}`);
  return claim;
}

export function listClaimsByStatus(status: ClaimStatus): readonly ClaimRecord[] {
  return Object.values(CLAIMS_REGISTRY).filter((c) => c.status === status);
}

export interface EvidenceMatrixEntry {
  claimId: ClaimId;
  status: ClaimStatus;
  surfaces: readonly Surface[];
  evidence: readonly string[];
  limitations: readonly string[];
}

export function buildEvidenceMatrix(): readonly EvidenceMatrixEntry[] {
  return Object.values(CLAIMS_REGISTRY).map((c) => ({
    claimId: c.id,
    status: c.status,
    surfaces: c.allowedSurfaces,
    evidence: c.evidence,
    limitations: c.limitations,
  }));
}
