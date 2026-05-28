// B47 — Pierre Email Legal Policy
// Defines what Pierre can and cannot do for email-related actions.
// Pure: no Supabase, no Next, no async. No throw.

export type PierreEmailActionType =
  | "draft_email"
  | "prepare_reminder"
  | "prepare_hr_communication"
  | "suggest_tone"
  | "send_email_autonomous"
  | "send_dismissal_notification"
  | "send_sanction_notification"
  | "send_legal_notice"
  | "send_contract_offer"
  | "mass_email_campaign"
  | "auto_respond_to_employee"
  | "send_official_document_by_email";

export type PierreEmailActionPolicy = {
  action_type: PierreEmailActionType;
  pierre_can_do: boolean;
  requires_human_approval_before_send: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  safe_description: string;
  required_disclaimers: string[];
  safe_next_actions: string[];
  risk_note: string;
};

const EMAIL_ACTION_POLICIES: Record<PierreEmailActionType, PierreEmailActionPolicy> = {
  draft_email: {
    action_type: "draft_email",
    pierre_can_do: true,
    requires_human_approval_before_send: true,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre rédige un brouillon d'email — validation humaine avant envoi.",
    required_disclaimers: ["EMAIL_SEND_LIMIT"],
    safe_next_actions: ["review_draft", "approve_before_send"],
    risk_note: "Brouillon uniquement — jamais d'envoi automatique.",
  },
  prepare_reminder: {
    action_type: "prepare_reminder",
    pierre_can_do: true,
    requires_human_approval_before_send: true,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre prépare un email de relance — approbation humaine requise avant envoi.",
    required_disclaimers: ["EMAIL_SEND_LIMIT"],
    safe_next_actions: ["review_before_send", "adjust_tone_if_needed"],
    risk_note: "Relances automatiques interdites — risque de harcèlement perçu si répétition non contrôlée.",
  },
  prepare_hr_communication: {
    action_type: "prepare_hr_communication",
    pierre_can_do: true,
    requires_human_approval_before_send: true,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre prépare un email de communication RH — validation RH avant envoi.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["hr_manager_review", "legal_check_if_sensitive"],
    risk_note: "Communications RH sensibles (licenciement, sanction) requièrent revue juridique recommandée.",
  },
  suggest_tone: {
    action_type: "suggest_tone",
    pierre_can_do: true,
    requires_human_approval_before_send: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre suggère un ton ou une reformulation pour un email — aucune obligation de suivre.",
    required_disclaimers: ["AI_LIMIT"],
    safe_next_actions: ["accept_or_modify_suggestion"],
    risk_note: "Suggestion uniquement — humain reste auteur responsable du message final.",
  },
  send_email_autonomous: {
    action_type: "send_email_autonomous",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Pierre ne peut pas envoyer d'email de façon autonome — tout envoi requiert approbation humaine explicite.",
    safe_description: "Envoi autonome d'email — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT"],
    safe_next_actions: ["prepare_draft_for_human_review"],
    risk_note: "Envoi autonome interdit — risque légal, commercial et relationnel majeur.",
  },
  send_dismissal_notification: {
    action_type: "send_dismissal_notification",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Notification de licenciement — BLOQUÉ. Pierre ne peut jamais envoyer ce type de communication seul.",
    safe_description: "Email de notification de licenciement — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "HUMAN_RESPONSIBILITY", "LEGAL_LIMIT"],
    safe_next_actions: ["escalate_to_hr_manager", "escalate_to_legal"],
    risk_note: "Licenciement : risque prudhommal, abus de droit, forme. Jamais automatique.",
  },
  send_sanction_notification: {
    action_type: "send_sanction_notification",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Notification de sanction disciplinaire — BLOQUÉ. Processus disciplinaire exclusivement humain.",
    safe_description: "Email de notification de sanction — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "HUMAN_RESPONSIBILITY", "LEGAL_LIMIT"],
    safe_next_actions: ["escalate_to_hr_manager", "follow_disciplinary_procedure"],
    risk_note: "Sanction disciplinaire : procédure strictement encadrée — entretien préalable obligatoire.",
  },
  send_legal_notice: {
    action_type: "send_legal_notice",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Envoi de mise en demeure légale — BLOQUÉ. Acte réservé à un professionnel du droit.",
    safe_description: "Email de mise en demeure légale — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "LEGAL_LIMIT"],
    safe_next_actions: ["escalate_to_legal_counsel"],
    risk_note: "Mise en demeure : acte juridique — signature avocat ou représentant légal habilité.",
  },
  send_contract_offer: {
    action_type: "send_contract_offer",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Offre contractuelle — BLOQUÉ. Pierre ne peut pas engager juridiquement l'entreprise.",
    safe_description: "Email d'offre de contrat — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "LEGAL_LIMIT", "HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["prepare_draft_for_hr_review", "legal_validation_required"],
    risk_note: "Offre de contrat : engagement unilatéral avec valeur juridique — approbation direction requise.",
  },
  mass_email_campaign: {
    action_type: "mass_email_campaign",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Campagne email de masse — BLOQUÉ. Risque RGPD, spam, et réputation majeur.",
    safe_description: "Campagne email de masse — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT"],
    safe_next_actions: ["use_dedicated_emailing_tool", "consult_dpo_for_gdpr"],
    risk_note: "Campagnes mass-emailing : conformité RGPD obligatoire, outil dédié recommandé.",
  },
  auto_respond_to_employee: {
    action_type: "auto_respond_to_employee",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Réponse automatique à un salarié — BLOQUÉ. Tout contact officiel RH doit être humain ou approuvé.",
    safe_description: "Réponse auto à salarié — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["prepare_draft_for_hr_manager"],
    risk_note: "Auto-réponse RH : risque de créer des engagements implicites ou malentendus.",
  },
  send_official_document_by_email: {
    action_type: "send_official_document_by_email",
    pierre_can_do: false,
    requires_human_approval_before_send: true,
    is_blocked: true,
    blocked_reason: "Envoi d'un document officiel par email — BLOQUÉ. Document doit être validé humainement avant tout envoi.",
    safe_description: "Envoi de document officiel par email — BLOQUÉ.",
    required_disclaimers: ["EMAIL_SEND_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION", "HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["validate_document_first", "human_sends_after_validation"],
    risk_note: "Document officiel non validé envoyé = engagement prématuré ou document nul.",
  },
};

// ── Functions ─────────────────────────────────────────────────────────────────

export function getPierreEmailActionPolicy(actionType: PierreEmailActionType): PierreEmailActionPolicy {
  return EMAIL_ACTION_POLICIES[actionType];
}

export function isPierreEmailActionAllowed(actionType: PierreEmailActionType): boolean {
  return EMAIL_ACTION_POLICIES[actionType]?.pierre_can_do ?? false;
}

export function isPierreEmailActionBlocked(actionType: PierreEmailActionType): boolean {
  return EMAIL_ACTION_POLICIES[actionType]?.is_blocked ?? true;
}

export function getAllEmailActionPolicies(): PierreEmailActionPolicy[] {
  return Object.values(EMAIL_ACTION_POLICIES);
}

export function getBlockedEmailActions(): PierreEmailActionPolicy[] {
  return Object.values(EMAIL_ACTION_POLICIES).filter((p) => p.is_blocked);
}

export function getAllowedEmailActions(): PierreEmailActionPolicy[] {
  return Object.values(EMAIL_ACTION_POLICIES).filter((p) => !p.is_blocked && p.pierre_can_do);
}

export function buildEmailCapabilitySummary(): {
  can_do: string[];
  cannot_do: string[];
  key_limit: string;
} {
  const can_do = getAllowedEmailActions().map((p) => p.safe_description);
  const cannot_do = getBlockedEmailActions().map((p) => p.blocked_reason ?? "Action bloquée");
  return {
    can_do,
    cannot_do,
    key_limit:
      "Pierre prépare des brouillons d'emails RH mais ne peut jamais envoyer d'email de façon autonome. Tout envoi requiert approbation humaine explicite, en particulier pour les communications sensibles (licenciement, sanction, mise en demeure).",
  };
}
