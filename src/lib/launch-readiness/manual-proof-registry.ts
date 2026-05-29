// P-FINAL 01 — Phase 9 — Manual proof registry.
// Registry of all manually verifiable proofs required before public launch.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: All proofs must default to false. Never set to true without real evidence.

export type ProofCategory =
  | "legal"
  | "security"
  | "billing"
  | "product"
  | "operations";

export type ProofStatus = "verified" | "pending" | "failed" | "not_applicable";

export interface ManualProof {
  id: string;
  category: ProofCategory;
  label: string;
  description: string;
  verification_criteria: string;
  blocks_public_launch: boolean;
  default_status: "pending";
}

// All proofs required before public launch.
// These are MANUAL — they require human verification and cannot be automated.
export const MANUAL_PROOF_REGISTRY: ManualProof[] = [
  // ── Legal ─────────────────────────────────────────────────────────────────
  {
    id: "proof_legal_cgu_validated",
    category: "legal",
    label: "CGU validées par un conseil juridique",
    description: "Un avocat ou juriste compétent a relu et approuvé les CGU avant usage contractuel",
    verification_criteria: "Email ou document de validation d'un conseil juridique en date",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_legal_cgv_validated",
    category: "legal",
    label: "CGV validées par un conseil juridique",
    description: "Un avocat ou juriste compétent a relu et approuvé les CGV",
    verification_criteria: "Email ou document de validation d'un conseil juridique en date",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_legal_dpa_validated",
    category: "legal",
    label: "DPA validé par un conseil juridique",
    description: "Le DPA RGPD a été revu par un DPO ou juriste spécialisé en protection des données",
    verification_criteria: "Validation documentée d'un spécialiste RGPD",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_legal_confidentialite_validated",
    category: "legal",
    label: "Politique de confidentialité validée",
    description: "La politique de confidentialité est conforme au RGPD et validée par un juriste",
    verification_criteria: "Validation juridique documentée",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_legal_mentions_completed",
    category: "legal",
    label: "Mentions légales complétées avec les vraies informations",
    description: "Les placeholders dans les mentions légales (éditeur, hébergeur, contact) sont remplis avec les vraies données",
    verification_criteria: "Vérification manuelle que tous les placeholders sont remplacés",
    blocks_public_launch: true,
    default_status: "pending",
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    id: "proof_rls_applied_production",
    category: "security",
    label: "RLS Supabase appliqué en production",
    description: "PFINAL01_RLS_PRODUCTION_PACK.sql a été appliqué sur la base Supabase production après test sur staging",
    verification_criteria: "Screenshot de pg_policies ou confirmation de l'application du SQL sur production",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_rls_isolation_tested",
    category: "security",
    label: "Isolation RLS testée avec 2 comptes de test",
    description: "Deux comptes appartenant à des companies distinctes ne peuvent pas accéder aux données l'un de l'autre",
    verification_criteria: "Test manuel documenté avec résultat attendu (0 rows cross-company)",
    blocks_public_launch: true,
    default_status: "pending",
  },

  // ── Billing ───────────────────────────────────────────────────────────────
  {
    id: "proof_stripe_live_keys_configured",
    category: "billing",
    label: "Clés Stripe live configurées en production",
    description: "STRIPE_SECRET_KEY=sk_live_..., NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_..., STRIPE_WEBHOOK_SECRET configurés",
    verification_criteria: "Vérification des variables d'environnement production (sans exposer les clés)",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_stripe_payment_flow_tested",
    category: "billing",
    label: "Flux paiement Pierre 449€ testé de bout en bout",
    description: "Checkout → paiement → activation compte → accès Pierre fonctionne sans erreur",
    verification_criteria: "Test avec une vraie carte (ou Stripe test clock) documenté",
    blocks_public_launch: true,
    default_status: "pending",
  },
  {
    id: "proof_stripe_webhook_live",
    category: "billing",
    label: "Webhook Stripe live configuré et testé",
    description: "L'endpoint webhook est actif dans le Dashboard Stripe avec les bons événements",
    verification_criteria: "Screenshot du webhook dans le Dashboard Stripe avec statut actif",
    blocks_public_launch: true,
    default_status: "pending",
  },

  // ── Product ───────────────────────────────────────────────────────────────
  {
    id: "proof_pierre_e2e_tested",
    category: "product",
    label: "Mission Pierre testée de bout en bout en production",
    description: "Pierre peut exécuter une mission complète en production (tâche, document brouillon, email brouillon)",
    verification_criteria: "Test manuel d'une mission complète en production avec un compte de test payant",
    blocks_public_launch: false,
    default_status: "pending",
  },
  {
    id: "proof_copy_scan_passed",
    category: "product",
    label: "Scan du contenu public passé sans violations bloquantes",
    description: "Toutes les pages publiques du site ont été scannées et ne contiennent pas de formules interdites",
    verification_criteria: "Résultat du copy scanner sur les pages homepage, pricing, demo",
    blocks_public_launch: false,
    default_status: "pending",
  },
];

export function getBlockingProofs(): ManualProof[] {
  return MANUAL_PROOF_REGISTRY.filter((p) => p.blocks_public_launch);
}

export function getProofsByCategory(category: ProofCategory): ManualProof[] {
  return MANUAL_PROOF_REGISTRY.filter((p) => p.category === category);
}

export function getProofById(id: string): ManualProof | undefined {
  return MANUAL_PROOF_REGISTRY.find((p) => p.id === id);
}

export function areAllBlockingProofsVerified(verifiedIds: string[]): boolean {
  const verifiedSet = new Set(verifiedIds);
  return getBlockingProofs().every((p) => verifiedSet.has(p.id));
}
