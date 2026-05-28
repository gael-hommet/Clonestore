// B45 — Document Style Kit template registry
// 10 Pierre-specific templates in B45 format.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentTemplate, DocumentTemplateSection } from "./types";

function section(
  id: string,
  title: string,
  order: number,
  content_template: string,
  required = true,
  rendering_hint: string | null = null,
): DocumentTemplateSection {
  const TOKEN_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  const variable_names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(content_template)) !== null) {
    if (!variable_names.includes(m[1])) variable_names.push(m[1]);
  }
  return { id, title, order, required, content_template, variable_names, rendering_hint };
}

// ── 1. employment_certificate_simple ─────────────────────────────────────────

const employmentCertificate: DocumentTemplate = {
  id: "pierre_employment_certificate_simple_v1",
  category: "certificate",
  document_type: "employment_certificate",
  label: "Attestation de travail",
  description:
    "Attestation officielle confirmant la relation de travail. Validation obligatoire avant export.",
  risk_level: "high",
  output_format: "pdf_ready_html",
  required_variables: [
    "company_name",
    "employee_name",
    "position_title",
    "start_date",
    "issue_date",
    "signatory_name",
    "signatory_title",
  ],
  optional_variables: ["contract_type", "department", "employee_id", "company_address"],
  default_validation_requirement: "required_before_export",
  style_profile: "official",
  official_document: true,
  active: true,
  sections: [
    section(
      "header",
      "En-tête",
      1,
      "{{company_name}}\n{{company_address}}",
      false,
      "company_header",
    ),
    section(
      "title",
      "Titre",
      2,
      "ATTESTATION DE TRAVAIL",
      true,
      "document_title",
    ),
    section(
      "date_place",
      "Date et lieu",
      3,
      "Fait le {{issue_date}}",
      true,
      null,
    ),
    section(
      "body",
      "Corps de l'attestation",
      4,
      "Je soussigné(e), {{signatory_name}}, {{signatory_title}} de {{company_name}}, atteste que :\n\nM./Mme {{employee_name}} est employé(e) en qualité de {{position_title}} au sein de notre organisation depuis le {{start_date}}.",
      true,
      "main_body",
    ),
    section(
      "contract_details",
      "Nature du contrat",
      5,
      "Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.",
      true,
      null,
    ),
    section(
      "signature",
      "Signature",
      6,
      "{{signatory_name}}\n{{signatory_title}}\n{{company_name}}",
      true,
      "signature_block",
    ),
    section(
      "disclaimer",
      "Mention légale",
      7,
      "Ce document a été préparé par Pierre à titre de brouillon opérationnel. Il doit être validé et signé par un responsable RH habilité avant tout usage officiel.",
      true,
      "legal_notice",
    ),
  ],
};

// ── 2. missing_documents_request ─────────────────────────────────────────────

const missingDocumentsRequest: DocumentTemplate = {
  id: "pierre_missing_documents_request_v1",
  category: "employee_file",
  document_type: "missing_documents_request",
  label: "Demande de documents manquants",
  description: "Courrier de relance pour documents manquants dans le dossier employé.",
  risk_level: "low",
  output_format: "html",
  required_variables: ["employee_name", "missing_documents", "due_date", "company_name"],
  optional_variables: ["hr_contact_name", "hr_contact_email", "department"],
  default_validation_requirement: "recommended",
  style_profile: "standard",
  official_document: false,
  active: true,
  sections: [
    section("opening", "Ouverture", 1, "Madame, Monsieur {{employee_name}},", true, null),
    section(
      "body",
      "Corps",
      2,
      "Nous avons bien reçu votre dossier. Cependant, les documents suivants sont manquants ou incomplets :\n\n{{missing_documents}}\n\nNous vous remercions de bien vouloir nous faire parvenir ces éléments au plus tard le {{due_date}}.",
      true,
      "main_body",
    ),
    section(
      "closing",
      "Clôture",
      3,
      "Dans l'attente de votre retour, nous restons à votre disposition pour tout renseignement complémentaire.\n\nCordialement,\n{{hr_contact_name}}\nService RH — {{company_name}}",
      true,
      "signature_block",
    ),
  ],
};

// ── 3. onboarding_plan ────────────────────────────────────────────────────────

const onboardingPlan: DocumentTemplate = {
  id: "pierre_onboarding_plan_v1",
  category: "onboarding",
  document_type: "onboarding_plan",
  label: "Plan d'intégration",
  description: "Plan d'intégration structuré pour un nouveau collaborateur.",
  risk_level: "low",
  output_format: "html",
  required_variables: ["employee_name", "start_date", "manager_name", "checklist_items"],
  optional_variables: ["position_title", "department", "buddy_name", "company_name"],
  default_validation_requirement: "recommended",
  style_profile: "standard",
  official_document: false,
  active: true,
  sections: [
    section(
      "welcome",
      "Bienvenue",
      1,
      "Plan d'intégration — {{employee_name}}\nDate d'arrivée : {{start_date}}\nManager : {{manager_name}}",
      true,
      "document_header",
    ),
    section(
      "checklist",
      "Étapes d'intégration",
      2,
      "{{checklist_items}}",
      true,
      "checklist",
    ),
    section(
      "contacts",
      "Contacts clés",
      3,
      "Manager référent : {{manager_name}}\nEquipe RH : Service RH — {{company_name}}",
      false,
      null,
    ),
  ],
};

// ── 4. absence_followup ───────────────────────────────────────────────────────

const absenceFollowup: DocumentTemplate = {
  id: "pierre_absence_followup_v1",
  category: "absence",
  document_type: "absence_followup",
  label: "Suivi d'absence",
  description:
    "Courrier de suivi d'absence et demande de justificatif. Peut être sensible selon contexte.",
  risk_level: "medium",
  output_format: "html",
  required_variables: [
    "employee_name",
    "absence_start_date",
    "requested_document",
    "due_date",
  ],
  optional_variables: ["absence_end_date", "company_name", "hr_contact_name", "manager_name"],
  default_validation_requirement: "recommended",
  style_profile: "standard",
  official_document: false,
  active: true,
  sections: [
    section("opening", "Ouverture", 1, "Madame, Monsieur {{employee_name}},", true, null),
    section(
      "body",
      "Corps",
      2,
      "Nous avons noté votre absence depuis le {{absence_start_date}}. Afin de régulariser votre dossier, nous vous prions de bien vouloir nous faire parvenir : {{requested_document}}\n\nCes éléments sont attendus au plus tard le {{due_date}}.",
      true,
      "main_body",
    ),
    section(
      "closing",
      "Clôture",
      3,
      "Cordialement,\n{{hr_contact_name}}\nService RH — {{company_name}}",
      true,
      "signature_block",
    ),
  ],
};

// ── 5. prepayroll_summary ─────────────────────────────────────────────────────

const prepayrollSummary: DocumentTemplate = {
  id: "pierre_prepayroll_summary_v1",
  category: "prepayroll",
  document_type: "prepayroll_summary",
  label: "Récapitulatif pré-paie",
  description:
    "Récapitulatif interne des éléments variables de paie. Inclut disclaimer DSN/paie. Ne se substitue pas aux obligations légales.",
  risk_level: "high",
  output_format: "html",
  required_variables: [
    "payroll_period",
    "variable_items",
    "anomalies",
    "missing_justificatifs",
  ],
  optional_variables: ["company_name", "total_employees", "hr_contact_name", "cutoff_date"],
  default_validation_requirement: "required_before_send",
  style_profile: "sensitive",
  official_document: false,
  active: true,
  sections: [
    section(
      "title",
      "Titre",
      1,
      "Récapitulatif Pré-Paie — Période : {{payroll_period}}",
      true,
      "document_title",
    ),
    section(
      "variable_elements",
      "Éléments variables",
      2,
      "{{variable_items}}",
      true,
      "table",
    ),
    section(
      "anomalies",
      "Anomalies détectées",
      3,
      "{{anomalies}}",
      true,
      "alert_list",
    ),
    section(
      "missing",
      "Justificatifs manquants",
      4,
      "{{missing_justificatifs}}",
      true,
      "checklist",
    ),
    section(
      "dsn_disclaimer",
      "Avertissement DSN / Paie",
      5,
      "AVERTISSEMENT IMPORTANT : Ce document ne se substitue pas à la DSN officielle. Les données de paie doivent être validées et soumises par le logiciel de paie agréé de l'entreprise. Ce récapitulatif pré-paie est un outil de préparation interne uniquement.",
      true,
      "legal_notice",
    ),
  ],
};

// ── 6. candidate_reply ────────────────────────────────────────────────────────

const candidateReply: DocumentTemplate = {
  id: "pierre_candidate_reply_v1",
  category: "recruitment",
  document_type: "candidate_reply",
  label: "Réponse candidat",
  description: "Courrier de réponse à un candidat (suite favorable ou refus bienveillant).",
  risk_level: "low",
  output_format: "html",
  required_variables: ["candidate_name", "position_title", "company_name", "next_step"],
  optional_variables: ["recruiter_name", "interview_date", "hr_contact_email"],
  default_validation_requirement: "recommended",
  style_profile: "candidate_friendly",
  official_document: false,
  active: true,
  sections: [
    section("opening", "Ouverture", 1, "Madame, Monsieur {{candidate_name}},", true, null),
    section(
      "body",
      "Corps",
      2,
      "Suite à votre candidature pour le poste de {{position_title}} au sein de {{company_name}}, nous avons le plaisir de vous informer de la suite de votre dossier :\n\n{{next_step}}",
      true,
      "main_body",
    ),
    section(
      "closing",
      "Clôture",
      3,
      "Nous restons à votre disposition pour toute question.\n\nCordialement,\n{{recruiter_name}}\nService Recrutement — {{company_name}}",
      true,
      "signature_block",
    ),
  ],
};

// ── 7. manager_followup ───────────────────────────────────────────────────────

const managerFollowup: DocumentTemplate = {
  id: "pierre_manager_followup_v1",
  category: "recruitment",
  document_type: "manager_followup",
  label: "Note de suivi manager recrutement",
  description:
    "Note interne à destination du manager pour suivi d'un candidat en cours.",
  risk_level: "low",
  output_format: "html",
  required_variables: [
    "manager_name",
    "candidate_name",
    "position_title",
    "requested_action",
  ],
  optional_variables: ["interview_date", "hr_contact_name", "deadline"],
  default_validation_requirement: "none",
  style_profile: "internal",
  official_document: false,
  active: true,
  sections: [
    section(
      "opening",
      "Destinataire",
      1,
      "À l'attention de : {{manager_name}}",
      true,
      null,
    ),
    section(
      "body",
      "Corps",
      2,
      "Objet : Candidature {{candidate_name}} — Poste {{position_title}}\n\nAction demandée : {{requested_action}}",
      true,
      "main_body",
    ),
    section(
      "closing",
      "Clôture",
      3,
      "Merci de revenir vers le service RH ({{hr_contact_name}}) pour toute question.",
      false,
      null,
    ),
  ],
};

// ── 8. employee_file_summary ──────────────────────────────────────────────────

const employeeFileSummary: DocumentTemplate = {
  id: "pierre_employee_file_summary_v1",
  category: "employee_file",
  document_type: "employee_file_summary",
  label: "Synthèse dossier employé",
  description: "Synthèse du dossier administratif d'un employé.",
  risk_level: "medium",
  output_format: "html",
  required_variables: [
    "employee_name",
    "missing_documents",
    "completed_documents",
    "alerts",
  ],
  optional_variables: ["employee_id", "department", "position_title", "hr_contact_name"],
  default_validation_requirement: "recommended",
  style_profile: "standard",
  official_document: false,
  active: true,
  sections: [
    section(
      "title",
      "Titre",
      1,
      "Synthèse Dossier — {{employee_name}}",
      true,
      "document_title",
    ),
    section(
      "completed",
      "Documents validés",
      2,
      "{{completed_documents}}",
      true,
      "checklist",
    ),
    section(
      "missing",
      "Documents manquants",
      3,
      "{{missing_documents}}",
      true,
      "alert_list",
    ),
    section(
      "alerts",
      "Alertes",
      4,
      "{{alerts}}",
      true,
      "alert_list",
    ),
    section(
      "footer",
      "Signature RH",
      5,
      "Synthèse générée par Pierre — Service RH\n{{hr_contact_name}}",
      false,
      "signature_block",
    ),
  ],
};

// ── 9. executive_hr_report ────────────────────────────────────────────────────

const executiveHrReport: DocumentTemplate = {
  id: "pierre_executive_hr_report_v1",
  category: "executive_report",
  document_type: "executive_hr_report",
  label: "Rapport RH Direction",
  description: "Rapport RH synthétique destiné à la direction.",
  risk_level: "medium",
  output_format: "pdf_ready_html",
  required_variables: ["period", "highlights", "risks", "actions_required"],
  optional_variables: ["company_name", "total_employees", "open_positions", "prepared_by"],
  default_validation_requirement: "required_before_export",
  style_profile: "executive",
  official_document: false,
  active: true,
  sections: [
    section(
      "title",
      "Titre",
      1,
      "Rapport RH — {{period}}",
      true,
      "document_title",
    ),
    section(
      "highlights",
      "Points saillants",
      2,
      "{{highlights}}",
      true,
      "main_body",
    ),
    section(
      "risks",
      "Risques identifiés",
      3,
      "{{risks}}",
      true,
      "alert_list",
    ),
    section(
      "actions",
      "Actions requises",
      4,
      "{{actions_required}}",
      true,
      "checklist",
    ),
    section(
      "signature",
      "Préparé par",
      5,
      "Préparé par Pierre — {{prepared_by}}\nService RH — {{company_name}}",
      false,
      "signature_block",
    ),
    section(
      "disclaimer",
      "Avertissement",
      6,
      "Ce rapport a été préparé par Pierre à titre de synthèse opérationnelle. Il ne constitue pas un rapport officiel au sens légal et doit être validé par la Direction avant diffusion.",
      true,
      "legal_notice",
    ),
  ],
};

// ── 10. internal_hr_note ──────────────────────────────────────────────────────

const internalHrNote: DocumentTemplate = {
  id: "pierre_internal_hr_note_v1",
  category: "internal_note",
  document_type: "internal_hr_note",
  label: "Note interne RH",
  description: "Note interne RH pour suivi d'une situation ou recommandation.",
  risk_level: "medium",
  output_format: "html",
  required_variables: ["subject", "context", "analysis", "next_actions"],
  optional_variables: ["employee_name", "prepared_by", "date", "company_name", "confidentiality_level"],
  default_validation_requirement: "recommended",
  style_profile: "internal",
  official_document: false,
  active: true,
  sections: [
    section(
      "header",
      "En-tête",
      1,
      "NOTE INTERNE RH — CONFIDENTIEL\nObjet : {{subject}}\nDate : {{date}}",
      true,
      "document_header",
    ),
    section(
      "context",
      "Contexte",
      2,
      "{{context}}",
      true,
      "main_body",
    ),
    section(
      "analysis",
      "Analyse",
      3,
      "{{analysis}}",
      true,
      "main_body",
    ),
    section(
      "actions",
      "Actions recommandées",
      4,
      "{{next_actions}}",
      true,
      "checklist",
    ),
    section(
      "signature",
      "Préparé par",
      5,
      "Préparé par : {{prepared_by}}\nService RH — {{company_name}}",
      false,
      "signature_block",
    ),
    section(
      "confidentiality",
      "Confidentialité",
      6,
      "Document confidentiel — usage interne exclusivement. Ne pas diffuser sans autorisation du Service RH.",
      true,
      "legal_notice",
    ),
  ],
};

// ── Registry ──────────────────────────────────────────────────────────────────

const ALL_TEMPLATES: DocumentTemplate[] = [
  employmentCertificate,
  missingDocumentsRequest,
  onboardingPlan,
  absenceFollowup,
  prepayrollSummary,
  candidateReply,
  managerFollowup,
  employeeFileSummary,
  executiveHrReport,
  internalHrNote,
];

export function getB45TemplateRegistry(): DocumentTemplate[] {
  return ALL_TEMPLATES;
}

export function getB45TemplateById(id: string): DocumentTemplate | null {
  return ALL_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function getB45TemplatesByCategory(
  category: DocumentTemplate["category"],
): DocumentTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

export function listB45OfficialTemplates(): DocumentTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.official_document);
}
