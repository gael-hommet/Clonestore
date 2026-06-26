// src/lib/clonestore/runtime-integration/external-go-live-proofs-gate-types.ts
// PHASE 7.1 — External Go-Live Proofs (Stripe Live / Supabase Prod RLS / Domain Email /
// First Live Customer Evidence) — Types
//
// GATE DE PREUVES EXTERNES. Prépare et/ou vérifie les preuves externes réelles requises
// AVANT tout lancement public. Distingue strictement : (A) readiness documentée,
// (B) preuve manuelle requise, (C) preuve réellement validée, (D) bloquant public launch.
//
// RÈGLE ABSOLUE : ne jamais déclarer public launch ready sans preuve réelle ; ne jamais
// inventer un paiement live, une preuve Supabase prod/RLS, une preuve DNS/email ; ne jamais
// activer runtime autonome ; ne jamais envoyer email réel ; ne jamais modifier .env.local ni
// go-live-proofs.local.json automatiquement. Par défaut : rien n'est vérifié, public launch
// reste BLOCKED.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type ExternalGoLivePhase = "7.1";

export type ExternalGoLiveProofStatus =
  | "readiness_documented"
  | "manual_proof_required"
  | "partially_verified"
  | "verified"
  | "blocked";

// A / B / C / D
export type ExternalProofClassification =
  | "readiness_documented" // A
  | "manual_proof_required" // B
  | "proof_verified" // C
  | "blocking_public_launch"; // D

export type ExternalProofItemStatus =
  | "documented"
  | "manual_required"
  | "verified"
  | "blocked";

export type ExternalProofMatrixRow = {
  id: string;
  label: string;
  classification: ExternalProofClassification;
  expected_proof: string;
  evidence_location: string;
  status: ExternalProofItemStatus;
  blocking_before_public_launch: boolean;
  verified: false;
};

export type ExternalManualStep = {
  id: string;
  order: number;
  step: string;
  description: string;
  requires_human_action: true;
  auto_applied: false;
};

export type ExternalRollbackStep = {
  id: string;
  step: string;
  description: string;
};

export type FirstLiveCustomerReadiness = "ready" | "conditional" | "not_ready";

export type ExternalPublicLaunchVerdict = "BLOCKED" | "CONDITIONAL" | "GO";

export type ExternalGoLiveProofsReport = {
  phase: ExternalGoLivePhase;
  title: string;
  generated_at: string;
  proof_status: ExternalGoLiveProofStatus;
  stripe_live_matrix: ExternalProofMatrixRow[];
  supabase_prod_rls_matrix: ExternalProofMatrixRow[];
  domain_email_matrix: ExternalProofMatrixRow[];
  first_live_customer_matrix: ExternalProofMatrixRow[];
  evidence_required: string[];
  evidence_collected: string[];
  blockers: string[];
  manual_steps: ExternalManualStep[];
  rollback_plan: ExternalRollbackStep[];
  public_launch_verdict: ExternalPublicLaunchVerdict;
  first_live_customer_ready: FirstLiveCustomerReadiness;
  go_live_proofs_reference: string;
  next_phase_recommendation: string;
  final_note: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_first_live_customer_controlled_run: true;
  external_go_live_proofs_ready: false;
  public_launch_ready: false;
  stripe_live_verified: false;
  supabase_prod_rls_verified: false;
  domain_email_verified: false;
  first_live_customer_verified: false;
  scale_80k_proven: false;
  real_payment_performed: false;
  real_email_sent: false;
  runtime_execution_active: false;
  env_modified: false;
  go_live_proofs_modified: false;
  ai_call_performed: false;
};
