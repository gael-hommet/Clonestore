// src/lib/go-live/final-launch-gate/final-launch-proof-map.ts
// GO-LIVE 10 — Proof ID map distinguishing staging/test/live/human/repo proofs.
// Pure data — no side effects, no auto-validation.
// All proofs are PENDING until manually verified and added to go-live-proofs.local.json.

import type { FinalLaunchProofEntry } from "./final-launch-gate-types";

export const FINAL_LAUNCH_PROOF_MAP: FinalLaunchProofEntry[] = [
  // ── Staging / Test proofs (already verified) ───────────────────────────────

  {
    proof_id: "SUPABASE_RLS_STAGING_VERIFIED",
    blocker_id: "supabase_preprod_security",
    description: "RLS Supabase valide en staging/pre-prod (7/7 PASS). GO-LIVE 01D/01E.",
    proof_type: "staging_test",
    auto_verifiable: true,
  },
  {
    proof_id: "PUBLIC_COPY_SCAN_CLEAN",
    blocker_id: "legal_public_copy",
    description: "Scan automatique copy public propre. Aucune violation bloquante detectee.",
    proof_type: "staging_test",
    auto_verifiable: true,
  },
  {
    proof_id: "STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED",
    blocker_id: "stripe_test",
    description: "Paiement test mode confirme via Stripe test card 4242 4242 4242 4242.",
    proof_type: "staging_test",
    auto_verifiable: false,
  },
  {
    proof_id: "STRIPE_TEST_WEBHOOK_RECEIVED",
    blocker_id: "stripe_test",
    description: "Webhook checkout.session.completed recu et traite en mode test.",
    proof_type: "staging_test",
    auto_verifiable: false,
  },

  // ── Human / Legal proofs (require manual validation) ──────────────────────

  {
    proof_id: "LEGAL_ENTITY_INFO_COMPLETED",
    blocker_id: "legal_entity",
    description: "Informations societe (SIREN, adresse, gerant) saisies dans les pages legales.",
    proof_type: "human_legal",
    auto_verifiable: false,
  },
  {
    proof_id: "LEGAL_HUMAN_REVIEW_COMPLETED",
    blocker_id: "legal_review",
    description: "CGU/CGV/DPA/confidentialite relus et valides par un avocat ou juriste.",
    proof_type: "human_legal",
    auto_verifiable: false,
  },

  // ── Production / Live proofs (require real production environment) ─────────

  {
    proof_id: "STRIPE_LIVE_SECRET_SET",
    blocker_id: "stripe_live",
    description: "STRIPE_SECRET_KEY=sk_live_... defini en production.",
    proof_type: "production_live",
    auto_verifiable: false,
  },
  {
    proof_id: "STRIPE_LIVE_PRICE_PIERRE_449_CREATED",
    blocker_id: "stripe_live",
    description: "Produit Pierre 449 EUR/mois cree sur Stripe live avec price ID configure.",
    proof_type: "production_live",
    auto_verifiable: false,
  },
  {
    proof_id: "STRIPE_LIVE_WEBHOOK_CONFIGURED",
    blocker_id: "stripe_live",
    description: "Webhook Stripe live configure, STRIPE_WEBHOOK_SECRET=whsec_live_... defini.",
    proof_type: "production_live",
    auto_verifiable: false,
  },
  {
    proof_id: "STRIPE_LIVE_PAYMENT_SUCCESS_TESTED",
    blocker_id: "live_paid_customer_e2e",
    description: "Flux paiement complet teste en production avec vraie carte bancaire.",
    proof_type: "production_live",
    auto_verifiable: false,
  },
  {
    proof_id: "SUPABASE_RLS_PRODUCTION_VERIFIED",
    blocker_id: "production_rls",
    description: "RLS Supabase applique et verifie en production (isolation cross-company confirme).",
    proof_type: "production_live",
    auto_verifiable: false,
  },
  {
    proof_id: "PAID_CUSTOMER_PRODUCTION_E2E_COMPLETED",
    blocker_id: "live_paid_customer_e2e",
    description: "Flux paid customer complet valide en production: checkout, webhook, acces Pierre, setup, cockpit.",
    proof_type: "production_live",
    auto_verifiable: false,
  },

  // ── Repo / Tooling proofs (verified by tests/build) ───────────────────────

  {
    proof_id: "BUILD_AND_TESTS_CLEAN",
    blocker_id: "product_core",
    description: "npm run build propre. 8000+ tests valides. tsc --noEmit clean.",
    proof_type: "repo_tooling",
    auto_verifiable: true,
  },
  {
    proof_id: "PIERRE_ACCESS_GATE_DEPLOYED",
    blocker_id: "first_customer_onboarding",
    description: "Cockpit /agents/pierre/use protege par access gate (GO-LIVE 09).",
    proof_type: "repo_tooling",
    auto_verifiable: true,
  },
];

export function getProofsByType(
  type: FinalLaunchProofEntry["proof_type"]
): FinalLaunchProofEntry[] {
  return FINAL_LAUNCH_PROOF_MAP.filter((p) => p.proof_type === type);
}

export function getProofsByBlocker(blockerId: string): FinalLaunchProofEntry[] {
  return FINAL_LAUNCH_PROOF_MAP.filter((p) => p.blocker_id === blockerId);
}

export function getNonAutoVerifiableProofs(): FinalLaunchProofEntry[] {
  return FINAL_LAUNCH_PROOF_MAP.filter((p) => !p.auto_verifiable);
}
