// src/lib/clonestore/runtime-integration/pierre-channels-identity-final.ts
// PHASE 6.4 — Pierre Channels & Identity Final (pur)
//
// Finalise l'identité Pierre + surface canaux pour une première vente contrôlée, SANS
// rien activer. Aucun email réel. Aucun domaine connecté. Aucun DNS modifié. Aucune
// route d'envoi. Aucun appel provider/IA. Première vente contrôlée ≠ email production.

import type {
  PierreDisplayIdentity,
  PierreChannelMatrixItem,
  PierreChannelStatus,
  PierreEmailIdentityStrategy,
  PierreDomainReadinessItem,
  PierrePermissionsRow,
  PierreChannelCloneGuardDecision,
  PierreDraftTemplate,
  PierreChannelsIdentityFinalReport,
} from "./pierre-channels-identity-final-types";

// ── Display identity ──────────────────────────────────────────────────────────

export function buildPierreDisplayIdentity(): PierreDisplayIdentity {
  return {
    employee_name: "Pierre",
    employee_role: "Employé IA RH CloneStore",
    customer_facing_title: "Pierre — votre employé IA RH",
    short_description: "Pierre prépare, organise, analyse, rédige des brouillons, signale les risques et demande les validations.",
    long_description:
      "Pierre est l'employé IA RH de CloneStore. Il cadre les demandes RH, structure les missions, prépare des brouillons (fiches, messages, checklists), détecte les risques et signale ce qui nécessite une validation humaine. Il ne signe rien, ne sanctionne pas, ne modifie pas la paie et n'envoie rien sans permission.",
    allowed_claims: [
      "Prépare et structure des missions RH.",
      "Rédige des brouillons (fiches, messages, checklists).",
      "Analyse et signale les risques.",
      "Demande les validations humaines nécessaires.",
      "Garde une trace (CloneTrace) des actions préparées.",
    ],
    forbidden_claims: [
      "Ne signe pas de contrat (no contract signature).",
      "Ne sanctionne pas (no sanction).",
      "Ne modifie pas la paie (no payroll).",
      "N'envoie rien sans permission (no real send).",
      "Ne remplace pas l'avis légal (no legal replacement).",
      "Ne promet aucune autonomie complète non prouvée.",
    ],
    tone: "Professionnel, clair, prudent, honnête sur les limites.",
    trust_microcopy: "Pierre prépare et propose ; l'humain valide les actions sensibles.",
    first_sale_positioning: "Mode première vente : local-first controlled sale / demo-proof / human-in-the-loop.",
    public_launch_positioning: "Mode public launch futur : identité email/domaine vérifiée, RLS/prod/live proofs.",
  };
}

// ── Channel matrix ────────────────────────────────────────────────────────────

function channel(
  id: string,
  name: string,
  status: PierreChannelStatus,
  usage: string,
  constraints: string[]
): PierreChannelMatrixItem {
  return { id, channel: name, status, usage, constraints };
}

export function buildPierreChannelMatrix(): PierreChannelMatrixItem[] {
  return [
    channel("ch_dashboard", "Internal dashboard / cockpit", "active_for_first_sale", "Demandes RH, scénarios, brouillons, validations.", ["Local-first", "Aucun runtime autonome"]),
    channel("ch_demo", "Demo surface", "active_for_first_sale", "Montrer les 5 scénarios RH.", ["Controlled proof", "Pas de production live"]),
    channel("ch_email_outbound", "Email outbound", "draft_only", "Préparer des brouillons d'emails managers/RH/candidats.", ["Aucun envoi réel", "Validation humaine requise"]),
    channel("ch_email_inbound", "Email inbound", "future", "Recevoir demandes/absences/documents.", ["Domaine/provider requis", "RLS/audit requis"]),
    channel("ch_customer_domain", "Customer domain identity", "future_public_launch", "pierre@client.com / rh@client.com / no-reply, etc.", ["SPF/DKIM/DMARC", "DNS", "Provider", "Legal"]),
    channel("ch_voice", "Phone / voice / CloneVoice", "future", "Appels / voix.", ["CloneVoice non actif", "Call runtime futur"]),
    channel("ch_file_upload", "File / document upload", "controlled_local_or_future", "Importer des documents RH.", ["Privacy", "Validation", "Aucun document officiel généré"]),
    channel("ch_integrations", "Intégrations planning / paie", "future", "Planning, absences, pré-paie.", ["Aucune exécution paie", "Validation humaine"]),
  ];
}

// ── Email identity strategy ───────────────────────────────────────────────────

export function buildPierreEmailIdentityStrategy(): PierreEmailIdentityStrategy {
  return {
    first_sale_mode: [
      "Pierre peut préparer des brouillons.",
      "Identité simulée/proposée affichée.",
      "Aucun email réel envoyé.",
      "Adresse présentée comme « à configurer ».",
      "Tout envoi réel reste bloqué (draft only).",
    ],
    future_customer_domain_mode: [
      "Le client fournit le domaine.",
      "DNS SPF/DKIM/DMARC.",
      "Provider email sélectionné.",
      "Vérification de l'identité expéditeur.",
      "Règles d'expéditeur.",
      "Audit (CloneTrace).",
      "Opt-out / unsubscribe si nécessaire.",
      "Protection anti-usurpation (anti-spoofing).",
    ],
    public_launch_requirements: [
      "Domaine testé.",
      "Envoi test validé.",
      "Bounce/reply handling défini.",
      "Audit trace.",
      "Legal review.",
      "DPA/privacy.",
      "Support process.",
    ],
    address_options: [
      "pierre@entreprise.fr",
      "rh@entreprise.fr",
      "pierre-rh@entreprise.fr",
      "pierre@clonestore.app (managed futur)",
      "no-reply@clonestore.app (managed futur)",
    ],
  };
}

// ── Domain readiness strategy ─────────────────────────────────────────────────

export function buildPierreDomainReadinessStrategy(): PierreDomainReadinessItem[] {
  const d = (id: string, label: string, status: PierreDomainReadinessItem["status"]): PierreDomainReadinessItem => ({ id, label, status, verified: false });
  return [
    d("domain_owner_confirmed", "Propriété du domaine confirmée", "required"),
    d("dns_access_confirmed", "Accès DNS confirmé", "required"),
    d("spf_record_ready", "Enregistrement SPF prêt", "required"),
    d("dkim_record_ready", "Enregistrement DKIM prêt", "required"),
    d("dmarc_record_ready", "Enregistrement DMARC prêt", "required"),
    d("provider_selected", "Provider email sélectionné", "required"),
    d("sender_identity_approved", "Identité expéditeur approuvée", "required"),
    d("reply_to_approved", "Reply-to approuvé", "required"),
    d("bounce_handling_defined", "Gestion bounce définie", "required"),
    d("audit_trace_ready", "Trace d'audit prête", "required"),
    d("legal_copy_reviewed", "Copie légale relue", "required"),
    d("test_send_evidence_required", "Evidence d'envoi test requise", "required"),
    d("production_send_not_enabled", "Envoi production non activé", "not_enabled"),
  ];
}

// ── Permissions matrix ────────────────────────────────────────────────────────

function perm(
  channel: string,
  can_prepare_draft: boolean,
  human_validation_required: boolean,
  cloneguard_decision: PierreChannelCloneGuardDecision,
  public_launch_required: boolean,
  reason: string
): PierrePermissionsRow {
  return {
    channel,
    can_prepare_draft,
    can_send_real_message: false,
    human_validation_required,
    cloneguard_decision,
    clonetrace_required: true,
    public_launch_required,
    reason,
  };
}

export function buildPierrePermissionsMatrix(): PierrePermissionsRow[] {
  return [
    perm("dashboard", true, true, "allow_with_limits", false, "Préparation locale ; aucun effet de bord externe."),
    perm("demo", false, false, "allow_with_limits", false, "Affichage de preuve ; aucun effet de bord."),
    perm("outbound_email", true, true, "draft_only", true, "Brouillon uniquement ; aucun envoi réel."),
    perm("inbound_email", false, true, "future", true, "Réception future ; domaine/provider/RLS requis."),
    perm("customer_domain", false, true, "future", true, "Identité domaine future ; DNS/provider preuve requise."),
    perm("voice", false, true, "future", true, "CloneVoice non actif ; runtime voix futur."),
    perm("file_upload", true, true, "require_human_validation", false, "Import contrôlé ; aucun document officiel généré."),
    perm("integrations", false, true, "future", true, "Intégrations futures ; aucune exécution paie."),
  ];
}

// ── Draft template matrix ─────────────────────────────────────────────────────

function template(
  id: string,
  name: string,
  channel: string,
  subject: string,
  body_outline: string[],
  forbidden_auto_send_reason: string
): PierreDraftTemplate {
  return { id, name, channel, subject, body_outline, requires_human_validation: true, can_be_sent_now: false, forbidden_auto_send_reason };
}

export function buildPierreDraftTemplateMatrix(): PierreDraftTemplate[] {
  return [
    template("tpl_absence", "Manager absence update", "outbound_email", "Point organisation suite à des absences", ["Contexte des absences", "Priorités du jour", "Demande de relais"], "Envoi = validation humaine ; pas de sanction/paie."),
    template("tpl_recruitment", "Candidate recruitment intro", "outbound_email", "Prise de contact recrutement", ["Présentation du poste", "Prochaines étapes", "Aucun engagement officiel"], "Envoi = validation humaine ; pas de promesse d'embauche."),
    template("tpl_onboarding", "Onboarding checklist message", "outbound_email", "Checklist d'onboarding", ["Étapes d'arrivée", "Documents à préparer", "Contacts"], "Envoi = validation humaine."),
    template("tpl_payroll", "Payroll variables reminder", "outbound_email", "Rappel variables de pré-paie", ["Variables attendues", "Date limite", "Aucune DSN/bulletin"], "Envoi = validation humaine ; pré-paie uniquement."),
    template("tpl_sensitive", "Sensitive HR meeting preparation", "outbound_email", "Préparation d'un entretien (interne)", ["Trame factuelle", "Points neutres", "Risques juridiques"], "Envoi = validation humaine exclusive ; pas de sanction/licenciement."),
    template("tpl_multisite", "Multi-site staffing coordination", "outbound_email", "Coordination multi-site", ["Besoins par site", "Options de renfort", "Aucune affectation imposée"], "Envoi = validation humaine ; pas d'affectation imposée."),
  ];
}

// ── CloneGuard rules / CloneTrace events ──────────────────────────────────────

export function buildPierreCloneGuardIdentityRules(): string[] {
  return [
    "No spoofing (aucune usurpation d'identité).",
    "No unauthorized sender (aucun expéditeur non autorisé).",
    "No legal/disciplinary send without human validation.",
    "No payroll official message without human validation.",
    "No external email before identity verified.",
    "No customer-domain claim before DNS/provider proof.",
    "No CloneVoice live claim.",
    "No public launch claim.",
  ];
}

export function buildPierreCloneTraceIdentityEvents(): string[] {
  return [
    "identity_plan_created",
    "channel_matrix_generated",
    "email_identity_draft_prepared",
    "domain_requirements_listed",
    "permissions_matrix_created",
    "draft_templates_prepared",
    "no_real_send_confirmed",
    "no_domain_connection_confirmed",
    "ready_for_p6_5",
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildPierreChannelsIdentityFinalReport(
  options?: { now?: string }
): PierreChannelsIdentityFinalReport {
  const now = options?.now ?? new Date().toISOString();
  const email = buildPierreEmailIdentityStrategy();
  return {
    phase: "6.4",
    title: "Pierre — Identité & canaux (readiness, aucun email réel, aucun domaine connecté)",
    generated_at: now,
    identity_status: "channels_ready_for_first_sale",
    recommended_identity_mode: "clonestore_managed_identity",
    pierre_display_identity: buildPierreDisplayIdentity(),
    channel_matrix: buildPierreChannelMatrix(),
    email_identity_strategy: email,
    domain_readiness_strategy: buildPierreDomainReadinessStrategy(),
    contact_surface_map: [
      "Cockpit / dashboard Pierre (actif première vente).",
      "Demo Pierre (preuve contrôlée).",
      "Brouillons email (draft only).",
      "Domaine client (futur public launch).",
    ],
    permissions_matrix: buildPierrePermissionsMatrix(),
    draft_template_matrix: buildPierreDraftTemplateMatrix(),
    inbound_channel_strategy: [
      "Réception future via domaine/provider vérifiés.",
      "RLS + audit requis avant activation.",
      "Aucune réception réelle dans cette phase.",
    ],
    outbound_channel_strategy: [
      "Brouillons uniquement (draft only).",
      "Validation humaine avant tout envoi futur.",
      "Aucun email réel envoyé dans cette phase.",
    ],
    cloneguard_identity_rules: buildPierreCloneGuardIdentityRules(),
    clonetrace_identity_events: buildPierreCloneTraceIdentityEvents(),
    customer_setup_requirements: [
      "Choisir le mode identité (managed CloneStore ou domaine client futur).",
      "Valider les limites affichées de Pierre.",
      "Désigner les approbateurs pour les actions sensibles.",
    ],
    public_launch_requirements: [
      "Domaine + email vérifiés (SPF/DKIM/DMARC).",
      "Envoi test validé + bounce/reply handling.",
      "Legal review + DPA/privacy.",
      "Audit trace + support process.",
    ],
    first_sale_readiness: [
      "Identité Pierre claire et honnête.",
      "Canaux première vente actifs (cockpit + demo).",
      "Brouillons email prêts, aucun envoi réel.",
      "Actions sensibles bloquées / validation humaine.",
    ],
    remaining_gaps: [
      "Domaine/email prod à prouver (public launch).",
      "Activation client E2E à prouver (P6.5).",
      "scale 80k non prouvé.",
    ],
    recommended_next_phase: "PHASE 6.5 — Pierre Customer Activation E2E Final / First Paid Customer Proof Path.",
    final_verdict:
      "Identité Pierre finalisée et canaux prêts pour une première vente contrôlée. Aucun email réel, aucun domaine connecté. Pierre non déclaré fully sellable. Prochaine étape : P6.5.",
    ready_for_p6_5: true,
    email_live_enabled: false,
    domain_connected: false,
    dns_modified: false,
    spf_verified: false,
    dkim_verified: false,
    dmarc_verified: false,
    send_route_created: false,
    real_email_sent: false,
    runtime_execution_active: false,
    server_persistence_active: false,
    sql_applied: false,
    env_modified: false,
    pierre_fully_sellable_declared: false,
    public_launch_validated: false,
    scale_80k_proven: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePierreChannelsIdentityFinalReport(
  report: PierreChannelsIdentityFinalReport
): string {
  return [
    `[Pierre Identité & canaux — PHASE 6.4] statut ${report.identity_status} · mode ${report.recommended_identity_mode}`,
    `  Canaux : ${report.channel_matrix.length} · templates brouillons : ${report.draft_template_matrix.length} · permissions : ${report.permissions_matrix.length}`,
    `  ${report.final_verdict}`,
    `  Aucun email réel · aucun domaine connecté · aucun DNS modifié · brouillons uniquement.`,
    `  Première vente contrôlée ≠ email production · Pierre NON fully sellable · public launch NON validé.`,
    `  Prochaine étape : P6.5 — Pierre Customer Activation E2E Final.`,
  ].join("\n");
}
