// BLOC 3 — Claims registry conforme LeadForge db9b166.
//
// Réimplémentation littérale de `services/conversion/claims.py:_SEED_CLAIMS` :
// 8 claims, 9-status enum, distinction REAL_ACTIVATABLE vs SHADOW_ALLOWED.
// Le linter (`claims-linter.ts`) accepte les mêmes modes que LeadForge :
//   mode='shadow'           → autorise pending product/timing
//   mode='real_activation'  → REFUSE pending (fail closed)

import type { ClaimId, ClaimStatus, Surface } from "./contract";
import {
  REAL_ACTIVATABLE_CLAIM_STATUSES,
  SHADOW_ALLOWED_CLAIM_STATUSES,
  SURFACE_ALLOWED_CLAIMS,
} from "./contract";

export interface ClaimRecord {
  readonly id: ClaimId;
  readonly text: string;
  readonly status: ClaimStatus;
  readonly scope: string;
  readonly evidence: string;
  readonly productSource: string;
  readonly validatedAt: string;
  readonly owner: string;
  readonly limitations: string;
}

export const CLAIMS_REGISTRY: Readonly<Record<ClaimId, ClaimRecord>> = Object.freeze({
  price_monthly: {
    id: "price_monthly",
    text: "449 €/mois",
    status: "VERIFIED_PRICE",
    scope: "pricing",
    evidence: "internal_pricing",
    productSource: "product_pricing",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "",
  },
  pierre_is_role: {
    id: "pierre_is_role",
    text: "Pierre est un poste RH opérationnel automatisé (assistant IA transparent), pas un chatbot",
    status: "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
    scope: "landing",
    evidence: "requires_clonestore_product_verification",
    productSource: "CloneOS",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "à vérifier sur le produit CloneStore réel avant activation",
  },
  human_validation: {
    id: "human_validation",
    text: "Les actions sensibles passent par une validation humaine (CloneGuard)",
    status: "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
    scope: "landing",
    evidence: "requires_clonestore_product_verification",
    productSource: "CloneGuard",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "périmètre des actions sensibles à vérifier sur le produit réel avant activation",
  },
  traceability: {
    id: "traceability",
    text: "Chaque action est tracée et inspectable (CloneTrace)",
    status: "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
    scope: "landing",
    evidence: "requires_clonestore_product_verification",
    productSource: "CloneTrace",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "à vérifier sur le produit CloneStore réel avant activation",
  },
  company_adaptation: {
    id: "company_adaptation",
    text: "Pierre s'adapte au fonctionnement de l'entreprise (CloneADN)",
    status: "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
    scope: "demo",
    evidence: "requires_clonestore_product_verification",
    productSource: "CloneADN",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "à vérifier sur le produit CloneStore réel avant activation",
  },
  volume_estimate: {
    id: "volume_estimate",
    text:
      "Estimation d'un volume d'opérations RH traitable, en fourchette, à partir de vos hypothèses visibles et modifiables",
    status: "ASSUMPTION_REQUIRES_DISCLOSURE",
    scope: "diagnostic",
    evidence: "diagnostic_formula",
    productSource: "diagnostic_model",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "aucune économie financière sans coût fourni par l'utilisateur; aucun résultat garanti",
  },
  recurring_work: {
    id: "recurring_work",
    text:
      "Pierre prend en charge du travail RH opérationnel récurrent (brief → missions → documents/emails → validation → trace)",
    status: "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
    scope: "email",
    evidence: "requires_clonestore_product_verification",
    productSource: "CloneOS",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "à vérifier sur le produit CloneStore réel avant activation",
  },
  demo_timing: {
    id: "demo_timing",
    text: "durée de la démonstration",
    status: "PENDING_DEMO_TIMING_MEASUREMENT",
    scope: "demo",
    evidence: "requires_measured_demo_timing",
    productSource: "diagnostic_model",
    validatedAt: "2026-06-22",
    owner: "founder",
    limitations: "aucune durée promise tant qu'elle n'est pas mesurée sur la vraie démo",
  },
});

export function getClaim(id: ClaimId): ClaimRecord {
  const c = CLAIMS_REGISTRY[id];
  if (!c) throw new Error(`Claim inconnue: ${id}`);
  return c;
}

export function isActivatable(id: ClaimId): boolean {
  const c = CLAIMS_REGISTRY[id];
  if (!c) return false;
  return REAL_ACTIVATABLE_CLAIM_STATUSES.has(c.status);
}

export function isShadowAllowed(id: ClaimId): boolean {
  const c = CLAIMS_REGISTRY[id];
  if (!c) return false;
  return SHADOW_ALLOWED_CLAIM_STATUSES.has(c.status);
}

export function claimAllowedOnSurface(id: ClaimId, surface: Surface): boolean {
  const allowed = SURFACE_ALLOWED_CLAIMS[surface] ?? [];
  return allowed.includes(id);
}

export interface EvidenceMatrixEntry {
  claimId: ClaimId;
  status: ClaimStatus;
  scope: string;
  surfaces: readonly Surface[];
  evidence: string;
  productSource: string;
  limitations: string;
  realActivatable: boolean;
  shadowAllowed: boolean;
}

export function buildEvidenceMatrix(): readonly EvidenceMatrixEntry[] {
  return (Object.values(CLAIMS_REGISTRY) as ClaimRecord[]).map((c) => ({
    claimId: c.id,
    status: c.status,
    scope: c.scope,
    surfaces: (Object.entries(SURFACE_ALLOWED_CLAIMS) as [Surface, readonly string[]][])
      .filter(([, claims]) => claims.includes(c.id))
      .map(([s]) => s),
    evidence: c.evidence,
    productSource: c.productSource,
    limitations: c.limitations,
    realActivatable: REAL_ACTIVATABLE_CLAIM_STATUSES.has(c.status),
    shadowAllowed: SHADOW_ALLOWED_CLAIM_STATUSES.has(c.status),
  }));
}

export function auditClaims(): {
  total: number;
  byStatus: Record<string, number>;
  realActivatableIds: readonly ClaimId[];
  shadowAllowedIds: readonly ClaimId[];
  pendingProductIds: readonly ClaimId[];
  pendingTimingIds: readonly ClaimId[];
} {
  const records = Object.values(CLAIMS_REGISTRY) as ClaimRecord[];
  const byStatus: Record<string, number> = {};
  for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    total: records.length,
    byStatus,
    realActivatableIds: records.filter((r) => isActivatable(r.id)).map((r) => r.id).sort(),
    shadowAllowedIds: records.filter((r) => isShadowAllowed(r.id)).map((r) => r.id).sort(),
    pendingProductIds: records
      .filter((r) => r.status === "PENDING_CLONESTORE_PRODUCT_VERIFICATION")
      .map((r) => r.id)
      .sort(),
    pendingTimingIds: records
      .filter((r) => r.status === "PENDING_DEMO_TIMING_MEASUREMENT")
      .map((r) => r.id)
      .sort(),
  };
}
