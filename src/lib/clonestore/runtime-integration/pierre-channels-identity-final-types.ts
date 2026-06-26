// src/lib/clonestore/runtime-integration/pierre-channels-identity-final-types.ts
// PHASE 6.4 — Pierre Channels & Identity Final — Types
//
// READINESS / IDENTITY GOVERNANCE. Finalise l'identité Pierre et la surface canaux pour
// une première vente contrôlée, SANS rien activer. Aucun email réel. Aucun domaine
// connecté. Aucun DNS modifié. Aucune vérification SPF/DKIM/DMARC réelle. Aucune route
// d'envoi. Aucun appel provider/IA. Première vente contrôlée ≠ email production.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PierreIdentityPhase = "6.4";

export type PierreIdentityStatus =
  | "identity_ready"
  | "channels_ready_for_first_sale"
  | "blocked";

export type PierreIdentityMode =
  | "clonestore_managed_identity"
  | "customer_domain_future"
  | "customer_domain_required_for_public_launch";

export type PierreDisplayIdentity = {
  employee_name: string;
  employee_role: string;
  customer_facing_title: string;
  short_description: string;
  long_description: string;
  allowed_claims: string[];
  forbidden_claims: string[];
  tone: string;
  trust_microcopy: string;
  first_sale_positioning: string;
  public_launch_positioning: string;
};

export type PierreChannelStatus =
  | "active_for_first_sale"
  | "draft_only"
  | "future"
  | "future_public_launch"
  | "controlled_local_or_future";

export type PierreChannelMatrixItem = {
  id: string;
  channel: string;
  status: PierreChannelStatus;
  usage: string;
  constraints: string[];
};

export type PierreEmailIdentityStrategy = {
  first_sale_mode: string[];
  future_customer_domain_mode: string[];
  public_launch_requirements: string[];
  address_options: string[];
};

export type PierreDomainReadinessItem = {
  id: string;
  label: string;
  status: "required" | "future" | "not_enabled";
  verified: false;
};

export type PierreChannelCloneGuardDecision =
  | "allow_with_limits"
  | "draft_only"
  | "require_human_validation"
  | "future"
  | "block";

export type PierrePermissionsRow = {
  channel: string;
  can_prepare_draft: boolean;
  can_send_real_message: false;
  human_validation_required: boolean;
  cloneguard_decision: PierreChannelCloneGuardDecision;
  clonetrace_required: boolean;
  public_launch_required: boolean;
  reason: string;
};

export type PierreDraftTemplate = {
  id: string;
  name: string;
  channel: string;
  subject: string;
  body_outline: string[];
  requires_human_validation: true;
  can_be_sent_now: false;
  forbidden_auto_send_reason: string;
};

export type PierreChannelsIdentityFinalReport = {
  phase: PierreIdentityPhase;
  title: string;
  generated_at: string;
  identity_status: PierreIdentityStatus;
  recommended_identity_mode: PierreIdentityMode;
  pierre_display_identity: PierreDisplayIdentity;
  channel_matrix: PierreChannelMatrixItem[];
  email_identity_strategy: PierreEmailIdentityStrategy;
  domain_readiness_strategy: PierreDomainReadinessItem[];
  contact_surface_map: string[];
  permissions_matrix: PierrePermissionsRow[];
  draft_template_matrix: PierreDraftTemplate[];
  inbound_channel_strategy: string[];
  outbound_channel_strategy: string[];
  cloneguard_identity_rules: string[];
  clonetrace_identity_events: string[];
  customer_setup_requirements: string[];
  public_launch_requirements: string[];
  first_sale_readiness: string[];
  remaining_gaps: string[];
  recommended_next_phase: string;
  final_verdict: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_p6_5: true;
  email_live_enabled: false;
  domain_connected: false;
  dns_modified: false;
  spf_verified: false;
  dkim_verified: false;
  dmarc_verified: false;
  send_route_created: false;
  real_email_sent: false;
  runtime_execution_active: false;
  server_persistence_active: false;
  sql_applied: false;
  env_modified: false;
  pierre_fully_sellable_declared: false;
  public_launch_validated: false;
  scale_80k_proven: false;
};
