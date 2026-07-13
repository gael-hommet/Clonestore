// src/lib/pierre/documents/premium-document-system.ts
// Module pur — Bloc 20 — Pierre Premium Document System
// Zéro Supabase, zéro Next, zéro async, zéro effets de bord.
// Robuste face aux objets null/undefined/malformés.

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierrePremiumDocumentChannel =
  | "document"
  | "pdf"
  | "email"
  | "html"
  | "internal_note";

export type PierrePremiumDocumentFamily =
  | "contract"
  | "amendment"
  | "offer"
  | "convocation"
  | "refusal"
  | "followup"
  | "onboarding"
  | "absence"
  | "pre_payroll"
  | "performance"
  | "training"
  | "offboarding"
  | "employee_summary"
  | "internal_note"
  | "generic_hr";

export type PierrePremiumDocumentRiskLevel = "green" | "orange" | "red" | "black";

export type PierrePremiumDocumentTone =
  | "neutral"
  | "warm"
  | "formal"
  | "firm"
  | "executive"
  | "legal_careful"
  | "human";

export type PierrePremiumDocumentQualityStatus =
  | "excellent"
  | "good"
  | "needs_review"
  | "blocked";

export type PierrePremiumDocumentBranding = {
  company_name: string | null;
  logo_url: string | null;
  legal_name: string | null;
  address: string | null;
  siret: string | null;
  default_signature: string | null;
  footer_note: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

export type PierrePremiumDocumentStyleGuide = {
  tone: PierrePremiumDocumentTone;
  formality_level: "low" | "medium" | "high";
  sentence_density: "short" | "balanced" | "detailed";
  use_company_we: boolean;
  avoid_ai_phrasing: boolean;
  include_human_review_note: boolean;
  preferred_greeting: string | null;
  preferred_closing: string | null;
};

export type PierrePremiumDocumentVariable = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  required: boolean;
  source:
    | "profile"
    | "employee_file"
    | "mission"
    | "task"
    | "company_memory"
    | "payload"
    | "manual"
    | "unknown";
};

export type PierrePremiumDocumentTemplateSection = {
  id: string;
  title: string;
  body: string;
  required: boolean;
  order: number;
};

export type PierrePremiumDocumentTemplate = {
  id: string;
  family: PierrePremiumDocumentFamily;
  name: string;
  description: string;
  channel: PierrePremiumDocumentChannel;
  version: string;
  risk_level: PierrePremiumDocumentRiskLevel;
  approval_required: boolean;
  required_variables: string[];
  optional_variables: string[];
  sections: PierrePremiumDocumentTemplateSection[];
  default_tone: PierrePremiumDocumentTone;
  tags: string[];
};

export type PierrePremiumDocumentConfig = {
  branding: PierrePremiumDocumentBranding;
  style_guide: PierrePremiumDocumentStyleGuide;
  templates: PierrePremiumDocumentTemplate[];
  custom_templates: PierrePremiumDocumentTemplate[];
  validation_rules: Array<{
    code: string;
    label: string;
    required: boolean;
    applies_to: PierrePremiumDocumentFamily[];
  }>;
};

export type PierrePremiumDocumentInput = {
  family: PierrePremiumDocumentFamily;
  channel: PierrePremiumDocumentChannel;
  title: string | null;
  raw_content: string | null;
  html_content?: string | null;
  variables: PierrePremiumDocumentVariable[];
  mission?: Record<string, unknown> | null;
  task?: Record<string, unknown> | null;
  employee_file?: Record<string, unknown> | null;
  company_memory?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  requested_tone?: PierrePremiumDocumentTone | null;
};

export type PierrePremiumDocumentIssue = {
  level: "info" | "warning" | "error" | "blocking";
  code: string;
  label: string;
  message: string;
  field?: string | null;
};

export type PierrePremiumDocumentQuality = {
  status: PierrePremiumDocumentQualityStatus;
  score: number;
  issues: PierrePremiumDocumentIssue[];
  missing_required_variables: string[];
  approval_required: boolean;
  risk_level: PierrePremiumDocumentRiskLevel;
};

export type PierrePremiumDocumentRendered = {
  title: string;
  plain_text: string;
  html: string;
  email_subject: string | null;
  email_body_html: string | null;
  pdf_filename: string;
  metadata: {
    family: PierrePremiumDocumentFamily;
    channel: PierrePremiumDocumentChannel;
    template_id: string | null;
    generated_at: string;
    company_name: string | null;
    employee_name: string | null;
    mission_id: string | null;
    task_id: string | null;
    approval_required: boolean;
    risk_level: PierrePremiumDocumentRiskLevel;
    quality_score: number;
  };
};

export type PierrePremiumDocumentDigest = {
  tone: "ready" | "review" | "blocked" | "sensitive";
  text: string;
};

export type PierrePremiumDocumentResult = {
  config: PierrePremiumDocumentConfig;
  selected_template: PierrePremiumDocumentTemplate | null;
  variables: PierrePremiumDocumentVariable[];
  quality: PierrePremiumDocumentQuality;
  rendered: PierrePremiumDocumentRendered;
  digest: PierrePremiumDocumentDigest;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugifyFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

const VALID_FAMILIES: PierrePremiumDocumentFamily[] = [
  "contract", "amendment", "offer", "convocation", "refusal", "followup",
  "onboarding", "absence", "pre_payroll", "performance", "training",
  "offboarding", "employee_summary", "internal_note", "generic_hr",
];

const VALID_CHANNELS: PierrePremiumDocumentChannel[] = [
  "document", "pdf", "email", "html", "internal_note",
];

const VALID_TONES: PierrePremiumDocumentTone[] = [
  "neutral", "warm", "formal", "firm", "executive", "legal_careful", "human",
];

const FAMILY_LABELS: Record<PierrePremiumDocumentFamily, string> = {
  contract: "Contrat de travail",
  amendment: "Avenant au contrat",
  offer: "Offre d'emploi",
  convocation: "Convocation",
  refusal: "Refus de candidature",
  followup: "Suivi RH",
  onboarding: "Document d'onboarding",
  absence: "Justificatif d'absence",
  pre_payroll: "Éléments de pré-paie",
  performance: "Entretien d'évaluation",
  training: "Document de formation",
  offboarding: "Procédure de départ",
  employee_summary: "Synthèse salarié",
  internal_note: "Note interne RH",
  generic_hr: "Document RH",
};

// Source priority ranking (higher = more authoritative)
const SOURCE_RANK: Record<PierrePremiumDocumentVariable["source"], number> = {
  manual: 7,
  payload: 6,
  employee_file: 5,
  profile: 4,
  task: 3,
  mission: 2,
  company_memory: 1,
  unknown: 0,
};

// ── Default templates ─────────────────────────────────────────────────────────

function buildDefaultTemplates(): PierrePremiumDocumentTemplate[] {
  return [
    // ── contract ──────────────────────────────────────────────
    {
      id: "tpl_contract_v1",
      family: "contract",
      name: "Contrat de travail (CDI/CDD)",
      description: "Modèle de contrat de travail standard avec clauses obligatoires.",
      channel: "pdf",
      version: "1.0",
      risk_level: "orange",
      approval_required: true,
      required_variables: ["company_name", "employee_name", "position", "contract_type", "start_date", "salary"],
      optional_variables: ["trial_period", "manager_name", "address", "location", "end_date", "collective_agreement"],
      default_tone: "formal",
      tags: ["contrat", "rh", "juridique"],
      sections: [
        { id: "parties", title: "Entre les parties", body: "Entre la société {{company_name}}, ci-après dénommée « l'Employeur »,\n\net {{employee_name}}, demeurant {{address}}, ci-après dénommé(e) « le Salarié »,\n\nil est convenu ce qui suit.", required: true, order: 1 },
        { id: "poste", title: "Article 1 — Engagement et poste", body: "{{company_name}} engage {{employee_name}} en qualité de {{position}}, à compter du {{start_date}}, dans le cadre d'un contrat à durée {{contract_type}}.\n\nLe Salarié exercera ses fonctions sous la responsabilité de {{manager_name}}.", required: true, order: 2 },
        { id: "remuneration", title: "Article 2 — Rémunération", body: "Le Salarié percevra une rémunération mensuelle brute de {{salary}}.\n\nCette rémunération sera versée mensuellement selon les modalités légales en vigueur.", required: true, order: 3 },
        { id: "essai", title: "Article 3 — Période d'essai", body: "Le présent contrat est conclu sous réserve d'une période d'essai de {{trial_period}}.\n\nCette période est susceptible d'être renouvelée dans les conditions prévues par la convention collective applicable.", required: false, order: 4 },
        { id: "general", title: "Article 4 — Dispositions générales", body: "Le présent contrat est soumis aux dispositions légales et conventionnelles en vigueur, notamment celles issues de la convention collective {{collective_agreement}}.\n\nTout litige relatif à l'exécution du présent contrat sera soumis aux juridictions compétentes.", required: true, order: 5 },
        { id: "signature", title: "Signatures", body: "Fait à {{location}}, le {{date}}.\n\nPour {{company_name}} :\n{{signature}}\n\nLu et approuvé — {{employee_name}} :", required: true, order: 6 },
      ],
    },

    // ── amendment ─────────────────────────────────────────────
    {
      id: "tpl_amendment_v1",
      family: "amendment",
      name: "Avenant au contrat de travail",
      description: "Modification d'un ou plusieurs éléments du contrat de travail.",
      channel: "pdf",
      version: "1.0",
      risk_level: "orange",
      approval_required: true,
      required_variables: ["company_name", "employee_name", "amendment_subject", "effective_date"],
      optional_variables: ["position", "salary", "schedule", "location", "manager_name"],
      default_tone: "formal",
      tags: ["avenant", "contrat", "modification"],
      sections: [
        { id: "parties", title: "Entre les parties", body: "Entre {{company_name}} et {{employee_name}},\n\nIl est convenu de modifier le contrat de travail initial par le présent avenant.", required: true, order: 1 },
        { id: "objet", title: "Objet de l'avenant", body: "Le présent avenant a pour objet de modifier les dispositions suivantes du contrat de travail :\n\n{{amendment_subject}}", required: true, order: 2 },
        { id: "nouvelles_conditions", title: "Nouvelles conditions", body: "À compter du {{effective_date}}, les conditions suivantes s'appliquent :\n\nPoste : {{position}}\nRémunération : {{salary}}\nLieu de travail : {{location}}", required: true, order: 3 },
        { id: "maintien", title: "Maintien des autres clauses", body: "Toutes les autres clauses du contrat de travail initial demeurent inchangées et continuent de produire leurs effets.", required: true, order: 4 },
        { id: "signature", title: "Signatures", body: "Fait à {{location}}, le {{date}}.\n\nPour {{company_name}} :\n{{signature}}\n\nLu et approuvé — {{employee_name}} :", required: true, order: 5 },
      ],
    },

    // ── offer ──────────────────────────────────────────────────
    {
      id: "tpl_offer_v1",
      family: "offer",
      name: "Offre d'emploi",
      description: "Offre d'emploi ou proposition de poste.",
      channel: "document",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["company_name", "position"],
      optional_variables: ["salary", "location", "start_date", "contract_type", "manager_name", "deadline"],
      default_tone: "warm",
      tags: ["offre", "recrutement", "emploi"],
      sections: [
        { id: "presentation", title: "Notre entreprise", body: "{{company_name}} recrute activement pour accompagner sa croissance.", required: true, order: 1 },
        { id: "poste", title: "Poste proposé", body: "Poste : {{position}}\nType de contrat : {{contract_type}}\nDémarrage souhaité : {{start_date}}\nLieu de travail : {{location}}\nRémunération proposée : {{salary}}", required: true, order: 2 },
        { id: "reponse", title: "Comment postuler", body: "Merci de transmettre votre candidature (CV + lettre de motivation) avant le {{deadline}}.\n\nContact : {{manager_name}}", required: false, order: 3 },
      ],
    },

    // ── convocation ────────────────────────────────────────────
    {
      id: "tpl_convocation_v1",
      family: "convocation",
      name: "Convocation à entretien",
      description: "Convocation à un entretien préalable, d'évaluation ou disciplinaire.",
      channel: "document",
      version: "1.0",
      risk_level: "orange",
      approval_required: false,
      required_variables: ["employee_name", "company_name", "date", "time", "location", "convocation_type"],
      optional_variables: ["manager_name", "reason", "bring_items"],
      default_tone: "formal",
      tags: ["convocation", "entretien", "rh"],
      sections: [
        { id: "destinataire", title: "Destinataire", body: "À l'attention de : {{employee_name}}", required: true, order: 1 },
        { id: "objet", title: "Objet", body: "Convocation à un entretien : {{convocation_type}}", required: true, order: 2 },
        { id: "details", title: "Détails de la convocation", body: "Nous vous informons par la présente que vous êtes convoqué(e) à un entretien le {{date}} à {{time}}, dans les locaux de {{company_name}}, {{location}}.\n\n{{reason}}", required: true, order: 3 },
        { id: "documents", title: "Documents à apporter", body: "Merci de vous munir des documents suivants :\n{{bring_items}}\n\nVous avez la possibilité de vous faire accompagner par une personne de votre choix appartenant à l'entreprise.", required: false, order: 4 },
        { id: "signature", title: "Signature", body: "{{manager_name}}\nPour {{company_name}}", required: true, order: 5 },
      ],
    },

    // ── refusal ────────────────────────────────────────────────
    {
      id: "tpl_refusal_v1",
      family: "refusal",
      name: "Refus de candidature",
      description: "Lettre de refus adressée à un candidat.",
      channel: "email",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["candidate_name", "position", "company_name"],
      optional_variables: ["manager_name", "date"],
      default_tone: "warm",
      tags: ["refus", "candidat", "recrutement"],
      sections: [
        { id: "salutation", title: "Salutation", body: "Madame, Monsieur {{candidate_name}},", required: true, order: 1 },
        { id: "corps", title: "Corps du message", body: "Nous avons bien reçu votre candidature pour le poste de {{position}} au sein de {{company_name}} et nous vous remercions de l'intérêt que vous portez à notre entreprise.\n\nAprès examen attentif de votre dossier, nous avons le regret de vous informer que votre candidature n'a pas été retenue.", required: true, order: 2 },
        { id: "cloture", title: "Clôture", body: "Nous vous souhaitons plein succès dans vos recherches et vous adressons nos cordiales salutations.\n\n{{manager_name}}\nPour {{company_name}}", required: true, order: 3 },
      ],
    },

    // ── followup ───────────────────────────────────────────────
    {
      id: "tpl_followup_v1",
      family: "followup",
      name: "Suivi RH",
      description: "Relance ou suivi de dossier RH.",
      channel: "email",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["employee_name", "followup_subject"],
      optional_variables: ["manager_name", "deadline", "company_name"],
      default_tone: "neutral",
      tags: ["relance", "suivi", "rh"],
      sections: [
        { id: "salutation", title: "Salutation", body: "Madame, Monsieur {{employee_name}},", required: true, order: 1 },
        { id: "objet", title: "Objet du suivi", body: "Nous revenons vers vous concernant : {{followup_subject}}.\n\nNous n'avons pas encore reçu de retour de votre part et souhaitions vous relancer sur ce point.", required: true, order: 2 },
        { id: "action", title: "Action attendue", body: "Merci de bien vouloir nous transmettre les éléments demandés avant le {{deadline}}.\n\nSans retour de votre part, nous serons contraints d'escalader ce dossier.", required: false, order: 3 },
        { id: "signature", title: "Signature", body: "Cordialement,\n{{manager_name}}\nService RH — {{company_name}}", required: true, order: 4 },
      ],
    },

    // ── onboarding ─────────────────────────────────────────────
    {
      id: "tpl_onboarding_v1",
      family: "onboarding",
      name: "Document d'onboarding",
      description: "Guide d'accueil et d'intégration pour un nouveau salarié.",
      channel: "document",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["employee_name", "company_name", "position", "start_date"],
      optional_variables: ["manager_name", "location", "department", "buddy_name", "it_contact"],
      default_tone: "warm",
      tags: ["onboarding", "accueil", "intégration"],
      sections: [
        { id: "bienvenue", title: "Bienvenue", body: "Bonjour {{employee_name}},\n\nNous sommes ravis de vous accueillir chez {{company_name}} en qualité de {{position}} à compter du {{start_date}}.\n\nCe document est votre guide pour vos premiers jours.", required: true, order: 1 },
        { id: "equipe", title: "Votre équipe", body: "Vous intégrerez l'équipe {{department}}, sous la responsabilité de {{manager_name}}.\n\nVotre référent d'intégration (buddy) sera : {{buddy_name}}.", required: false, order: 2 },
        { id: "pratique", title: "Informations pratiques", body: "Lieu de travail : {{location}}\nContact IT pour votre accès informatique : {{it_contact}}\n\nMerci de vous présenter à l'accueil le {{start_date}} à partir de 9h00 avec une pièce d'identité.", required: true, order: 3 },
        { id: "documents", title: "Documents à remettre", body: "Merci de nous transmettre dès que possible les documents suivants :\n- Pièce d'identité en cours de validité\n- RIB pour le versement de votre salaire\n- Attestation de sécurité sociale\n- Diplômes si requis pour le poste", required: true, order: 4 },
        { id: "signature", title: "Contact RH", body: "Pour toute question, n'hésitez pas à contacter le service RH.\n\n{{manager_name}}\nService RH — {{company_name}}", required: true, order: 5 },
      ],
    },

    // ── absence ────────────────────────────────────────────────
    {
      id: "tpl_absence_v1",
      family: "absence",
      name: "Justificatif / demande d'absence",
      description: "Traitement d'une demande ou d'un justificatif d'absence.",
      channel: "document",
      version: "1.0",
      risk_level: "orange",
      approval_required: false,
      required_variables: ["employee_name", "absence_type", "start_date"],
      optional_variables: ["end_date", "justification", "manager_name", "company_name"],
      default_tone: "neutral",
      tags: ["absence", "congé", "rh"],
      sections: [
        { id: "salarié", title: "Salarié concerné", body: "Nom : {{employee_name}}\nType d'absence : {{absence_type}}\nDébut : {{start_date}}\nFin prévue : {{end_date}}", required: true, order: 1 },
        { id: "justification", title: "Justification", body: "{{justification}}", required: false, order: 2 },
        { id: "traitement", title: "Traitement RH", body: "Cette absence a été enregistrée par le service RH de {{company_name}}.\n\nUn justificatif (arrêt maladie, attestation, etc.) devra être fourni dans un délai de 48 heures si applicable.", required: true, order: 3 },
        { id: "signature", title: "Visa RH", body: "{{manager_name}}\nService RH — {{company_name}}", required: false, order: 4 },
      ],
    },

    // ── pre_payroll ────────────────────────────────────────────
    {
      id: "tpl_pre_payroll_v1",
      family: "pre_payroll",
      name: "Éléments de pré-paie",
      description: "Synthèse des éléments variables de paie à transmettre.",
      channel: "document",
      version: "1.0",
      risk_level: "red",
      approval_required: true,
      required_variables: ["employee_name", "period", "company_name"],
      optional_variables: ["base_salary", "variable_elements", "absences", "bonuses", "manager_name"],
      default_tone: "neutral",
      tags: ["paie", "pré-paie", "rh", "confidentiel"],
      sections: [
        { id: "identification", title: "Identification", body: "Salarié : {{employee_name}}\nPériode : {{period}}\nSociété : {{company_name}}\n\nDocument CONFIDENTIEL — Usage interne uniquement.", required: true, order: 1 },
        { id: "elements", title: "Éléments fixes", body: "Salaire de base mensuel brut : {{base_salary}}", required: true, order: 2 },
        { id: "variables", title: "Éléments variables", body: "{{variable_elements}}\n\nAbsences : {{absences}}\nPrimes : {{bonuses}}", required: false, order: 3 },
        { id: "validation", title: "Validation", body: "Ces éléments sont soumis à validation par le responsable hiérarchique avant transmission au service paie.\n\nValidé par : {{manager_name}}", required: true, order: 4 },
      ],
    },

    // ── performance ────────────────────────────────────────────
    {
      id: "tpl_performance_v1",
      family: "performance",
      name: "Entretien d'évaluation",
      description: "Support d'entretien annuel ou semestriel.",
      channel: "document",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["employee_name", "period", "manager_name"],
      optional_variables: ["position", "department", "company_name", "objectives", "results", "rating"],
      default_tone: "neutral",
      tags: ["évaluation", "performance", "rh"],
      sections: [
        { id: "identification", title: "Identification", body: "Salarié : {{employee_name}}\nPoste : {{position}}\nDépartement : {{department}}\nPériode évaluée : {{period}}\nManager : {{manager_name}}", required: true, order: 1 },
        { id: "objectifs", title: "Objectifs de la période", body: "{{objectives}}", required: false, order: 2 },
        { id: "resultats", title: "Résultats atteints", body: "{{results}}\n\nÉvaluation globale : {{rating}}/5", required: false, order: 3 },
        { id: "plan", title: "Plan de développement", body: "Points forts identifiés :\n[À compléter lors de l'entretien]\n\nAxes de progrès :\n[À compléter lors de l'entretien]\n\nFormations recommandées :\n[À compléter lors de l'entretien]", required: false, order: 4 },
        { id: "signature", title: "Signatures", body: "Manager : {{manager_name}}\nSalarié : {{employee_name}}\n\nDate : {{date}}", required: true, order: 5 },
      ],
    },

    // ── training ───────────────────────────────────────────────
    {
      id: "tpl_training_v1",
      family: "training",
      name: "Document de formation",
      description: "Convocation, convention ou attestation de formation.",
      channel: "document",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["employee_name", "training_name", "start_date"],
      optional_variables: ["end_date", "location", "trainer", "company_name", "manager_name", "cost"],
      default_tone: "neutral",
      tags: ["formation", "développement", "rh"],
      sections: [
        { id: "formation", title: "Formation", body: "Intitulé : {{training_name}}\nDébut : {{start_date}}\nFin : {{end_date}}\nLieu : {{location}}\nOrganisme / formateur : {{trainer}}\nCoût : {{cost}}", required: true, order: 1 },
        { id: "participant", title: "Participant", body: "Salarié : {{employee_name}}\nSociété : {{company_name}}\n\nCette formation s'inscrit dans le plan de développement des compétences.", required: true, order: 2 },
        { id: "validation", title: "Validation", body: "Accordé par : {{manager_name}}\n\nLe salarié est invité à restituer les acquis à son équipe dans le mois suivant la formation.", required: false, order: 3 },
      ],
    },

    // ── offboarding ────────────────────────────────────────────
    {
      id: "tpl_offboarding_v1",
      family: "offboarding",
      name: "Procédure de départ",
      description: "Checklist et procédure de départ d'un salarié.",
      channel: "document",
      version: "1.0",
      risk_level: "red",
      approval_required: true,
      required_variables: ["employee_name", "departure_date", "departure_reason"],
      optional_variables: ["position", "department", "manager_name", "company_name", "hr_contact"],
      default_tone: "formal",
      tags: ["départ", "offboarding", "rh", "clôture"],
      sections: [
        { id: "salarié", title: "Salarié", body: "Nom : {{employee_name}}\nPoste : {{position}}\nDépartement : {{department}}\nDate de départ : {{departure_date}}\nMotif : {{departure_reason}}", required: true, order: 1 },
        { id: "restitution", title: "Restitution du matériel", body: "Le salarié devra restituer avant son départ :\n- Badge d'accès\n- Matériel informatique\n- Véhicule de fonction si applicable\n- Clés et accès\n\nResponsable de collecte : {{manager_name}}", required: true, order: 2 },
        { id: "documents", title: "Documents de fin de contrat", body: "Les documents suivants seront remis à la date de départ :\n- Certificat de travail\n- Attestation Pôle Emploi\n- Solde de tout compte\n- Portabilité mutuelle et prévoyance\n\nContact RH : {{hr_contact}}", required: true, order: 3 },
        { id: "note", title: "Note importante", body: "Ce document est soumis à validation RH et direction. Tout départ sensible nécessite une vérification juridique préalable.\n\nVisa RH : {{manager_name}}", required: true, order: 4 },
      ],
    },

    // ── employee_summary ───────────────────────────────────────
    {
      id: "tpl_employee_summary_v1",
      family: "employee_summary",
      name: "Synthèse salarié",
      description: "Fiche récapitulative du dossier d'un salarié.",
      channel: "document",
      version: "1.0",
      risk_level: "orange",
      approval_required: false,
      required_variables: ["employee_name", "company_name"],
      optional_variables: ["position", "department", "hire_date", "salary", "status", "manager_name"],
      default_tone: "neutral",
      tags: ["synthèse", "dossier", "salarié", "rh"],
      sections: [
        { id: "identite", title: "Identité", body: "Nom : {{employee_name}}\nPoste : {{position}}\nDépartement : {{department}}\nDate d'entrée : {{hire_date}}\nStatut : {{status}}", required: true, order: 1 },
        { id: "contrat", title: "Contrat", body: "Rémunération : {{salary}}\nResponsable hiérarchique : {{manager_name}}\n\nCe document est strictement confidentiel.", required: false, order: 2 },
        { id: "note", title: "Note RH", body: "Document établi par le service RH de {{company_name}}.\n\nDernière mise à jour : {{date}}", required: true, order: 3 },
      ],
    },

    // ── internal_note ──────────────────────────────────────────
    {
      id: "tpl_internal_note_v1",
      family: "internal_note",
      name: "Note interne RH",
      description: "Note interne pour traçabilité ou information équipe RH.",
      channel: "internal_note",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: ["note_subject"],
      optional_variables: ["employee_name", "author", "company_name", "action_required"],
      default_tone: "neutral",
      tags: ["note", "interne", "rh", "traçabilité"],
      sections: [
        { id: "objet", title: "Objet", body: "{{note_subject}}", required: true, order: 1 },
        { id: "contexte", title: "Contexte", body: "Salarié concerné : {{employee_name}}\nAuteur : {{author}}\n\n[Détails à compléter]", required: false, order: 2 },
        { id: "action", title: "Action requise", body: "{{action_required}}", required: false, order: 3 },
      ],
    },

    // ── generic_hr ─────────────────────────────────────────────
    {
      id: "tpl_generic_hr_v1",
      family: "generic_hr",
      name: "Document RH générique",
      description: "Document RH générique pour tout usage opérationnel.",
      channel: "document",
      version: "1.0",
      risk_level: "green",
      approval_required: false,
      required_variables: [],
      optional_variables: ["company_name", "employee_name", "manager_name", "date", "subject"],
      default_tone: "neutral",
      tags: ["rh", "document", "générique"],
      sections: [
        { id: "objet", title: "Objet", body: "{{subject}}", required: false, order: 1 },
        { id: "contenu", title: "Contenu", body: "[Contenu du document à compléter]\n\nSalarié concerné : {{employee_name}}\nSociété : {{company_name}}", required: false, order: 2 },
        { id: "suites", title: "Suites à donner", body: "Pour toute question, contacter : {{manager_name}}", required: false, order: 3 },
      ],
    },
  ];
}

// ── Default branding ──────────────────────────────────────────────────────────

function buildDefaultBranding(mem: Record<string, unknown> | null): PierrePremiumDocumentBranding {
  const branding = isObj(mem?.branding) ? mem.branding : null;
  const docSystem = isObj(mem?.document_system) ? mem.document_system : null;
  const dsBranding = isObj(docSystem?.branding) ? docSystem.branding : null;
  const active = dsBranding ?? branding;

  return {
    company_name:
      asStr(active?.company_name) ||
      asStr(mem?.company_name) ||
      asStr(mem?.companyName) ||
      asStr(mem?.legal_name) ||
      null,
    logo_url: asStr(active?.logo_url) || null,
    legal_name: asStr(active?.legal_name) || asStr(mem?.legal_name) || null,
    address: asStr(active?.address) || null,
    siret: asStr(active?.siret) || null,
    default_signature:
      asStr(active?.default_signature) ||
      asStr(mem?.default_signature) ||
      asStr(mem?.company_name) ||
      asStr(mem?.companyName) ||
      null,
    footer_note: asStr(active?.footer_note) || null,
    primary_color: asStr(active?.primary_color) || null,
    accent_color: asStr(active?.accent_color) || null,
  };
}

// ── Default style guide ───────────────────────────────────────────────────────

function buildDefaultStyleGuide(mem: Record<string, unknown> | null): PierrePremiumDocumentStyleGuide {
  const docSystem = isObj(mem?.document_system) ? mem.document_system : null;
  const sg = isObj(docSystem?.style_guide) ? docSystem.style_guide :
    isObj(mem?.style_guide) ? mem.style_guide :
    isObj(mem?.document_style) ? mem.document_style : null;

  const rawTone = asStr(sg?.tone) ?? asStr(mem?.preferred_tone) ?? "formal";
  const tone = VALID_TONES.includes(rawTone as PierrePremiumDocumentTone)
    ? (rawTone as PierrePremiumDocumentTone)
    : "formal";

  const rawFormality = asStr(sg?.formality_level) ?? "high";
  const formality_level = (["low", "medium", "high"].includes(rawFormality)
    ? rawFormality
    : "high") as PierrePremiumDocumentStyleGuide["formality_level"];

  const rawDensity = asStr(sg?.sentence_density) ?? "balanced";
  const sentence_density = (["short", "balanced", "detailed"].includes(rawDensity)
    ? rawDensity
    : "balanced") as PierrePremiumDocumentStyleGuide["sentence_density"];

  return {
    tone,
    formality_level,
    sentence_density,
    use_company_we: sg?.use_company_we === true || sg?.use_company_we === false ? Boolean(sg.use_company_we) : true,
    avoid_ai_phrasing: sg?.avoid_ai_phrasing !== false,
    include_human_review_note: sg?.include_human_review_note !== false,
    preferred_greeting: asStr(sg?.preferred_greeting) || null,
    preferred_closing: asStr(sg?.preferred_closing) || null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildDefaultPremiumDocumentConfig(
  rawCompanyMemory?: Record<string, unknown> | null,
): PierrePremiumDocumentConfig {
  const mem = isObj(rawCompanyMemory) ? rawCompanyMemory : null;

  // Read reusable_rh_context_json if available
  const rrhContext = isObj(mem?.reusable_rh_context_json) ? mem.reusable_rh_context_json : mem;
  const docSystem = isObj(rrhContext?.document_system) ? rrhContext.document_system : isObj(rrhContext?.rh_document_templates) ? rrhContext.rh_document_templates : null;

  const branding = buildDefaultBranding(rrhContext ?? mem);
  const style_guide = buildDefaultStyleGuide(rrhContext ?? mem);

  // Load custom templates from document_system
  const rawCustom = Array.isArray(docSystem?.custom_templates) ? docSystem.custom_templates : [];
  const custom_templates: PierrePremiumDocumentTemplate[] = rawCustom
    .filter((t) => isObj(t))
    .map((t) => {
      try {
        const obj = t as Record<string, unknown>;
        return {
          id: asStr(obj.id) || "custom_" + String(Date.now()),
          family: VALID_FAMILIES.includes(obj.family as PierrePremiumDocumentFamily)
            ? (obj.family as PierrePremiumDocumentFamily)
            : "generic_hr",
          name: asStr(obj.name) || "Template personnalisé",
          description: asStr(obj.description) || "",
          channel: VALID_CHANNELS.includes(obj.channel as PierrePremiumDocumentChannel)
            ? (obj.channel as PierrePremiumDocumentChannel)
            : "document",
          version: asStr(obj.version) || "1.0",
          risk_level: (["green", "orange", "red", "black"].includes(obj.risk_level as string)
            ? obj.risk_level as PierrePremiumDocumentRiskLevel
            : "green"),
          approval_required: obj.approval_required === true,
          required_variables: Array.isArray(obj.required_variables)
            ? (obj.required_variables as unknown[]).map((v) => asStr(v)).filter((v): v is string => v !== null)
            : [],
          optional_variables: Array.isArray(obj.optional_variables)
            ? (obj.optional_variables as unknown[]).map((v) => asStr(v)).filter((v): v is string => v !== null)
            : [],
          sections: Array.isArray(obj.sections)
            ? (obj.sections as unknown[])
                .filter(isObj)
                .map((s, i) => ({
                  id: asStr(s.id) || `section_${i}`,
                  title: asStr(s.title) || "",
                  body: asStr(s.body) || "",
                  required: s.required !== false,
                  order: typeof s.order === "number" ? s.order : i,
                }))
                .sort((a, b) => a.order - b.order)
            : [],
          default_tone: VALID_TONES.includes(obj.default_tone as PierrePremiumDocumentTone)
            ? (obj.default_tone as PierrePremiumDocumentTone)
            : "neutral",
          tags: Array.isArray(obj.tags)
            ? (obj.tags as unknown[]).map((t) => asStr(t)).filter((t): t is string => t !== null)
            : [],
        } satisfies PierrePremiumDocumentTemplate;
      } catch (_e) { /* skip malformed custom template */ return null; }
    })
    .filter((t): t is PierrePremiumDocumentTemplate => t !== null);

  // Load custom validation rules
  const rawRules = Array.isArray(docSystem?.validation_rules) ? docSystem.validation_rules : [];
  const validation_rules = rawRules
    .filter(isObj)
    .map((r) => {
      const applies_to = Array.isArray(r.applies_to)
        ? (r.applies_to as unknown[])
            .map((f) => asStr(f))
            .filter((f): f is string => f !== null && VALID_FAMILIES.includes(f as PierrePremiumDocumentFamily))
            .map((f) => f as PierrePremiumDocumentFamily)
        : [];
      return {
        code: asStr(r.code) || "rule",
        label: asStr(r.label) || "",
        required: r.required !== false,
        applies_to,
      };
    });

  return {
    branding,
    style_guide,
    templates: buildDefaultTemplates(),
    custom_templates,
    validation_rules,
  };
}

export function normalizePremiumDocumentVariable(
  variable: unknown,
): PierrePremiumDocumentVariable | null {
  if (!isObj(variable)) return null;
  const key = asStr(variable.key);
  if (!key) return null;

  const rawValue = variable.value;
  let value: string | number | boolean | null = null;
  if (typeof rawValue === "string") value = rawValue.trim();
  else if (typeof rawValue === "number" && Number.isFinite(rawValue)) value = rawValue;
  else if (typeof rawValue === "boolean") value = rawValue;

  const rawSource = asStr(variable.source) ?? "unknown";
  const source: PierrePremiumDocumentVariable["source"] = (
    ["profile", "employee_file", "mission", "task", "company_memory", "payload", "manual", "unknown"].includes(rawSource)
      ? rawSource
      : "unknown"
  ) as PierrePremiumDocumentVariable["source"];

  return {
    key: key.toLowerCase().replace(/\s+/g, "_"),
    label: asStr(variable.label) || key,
    value,
    required: variable.required === true,
    source,
  };
}

export function normalizePremiumDocumentVariables(
  variables: unknown,
): PierrePremiumDocumentVariable[] {
  if (!Array.isArray(variables)) return [];
  return variables
    .map(normalizePremiumDocumentVariable)
    .filter((v): v is PierrePremiumDocumentVariable => v !== null);
}

/** Marques combinantes Unicode (accents) produites par la decomposition NFD. */
const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g");

/**
 * Forme canonique pour la reconnaissance de famille : minuscules, diacritiques retirés
 * (NFD puis suppression des marques combinantes), et toute ponctuation réduite à une
 * espace simple. "Arrêt maladie" → "arret maladie" ; "entretien d'évaluation" →
 * "entretien d evaluation" ; "synthèse salarié" → "synthese salarie".
 */
function normalizeForFamilyMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mots de liaison français tolérés ENTRE deux mots-clés ("solde DE tout compte"). */
const FAMILY_LINK = "(?:\\s+(?:de|du|des|d|la|le|les|l|au|aux|a|en|et|pour|sur)){0,2}\\s+";

/**
 * Expression de plusieurs mots-clés séparés par des liaisons optionnelles. Chaque mot
 * tolère une flexion (pluriel/féminin) mais jamais une troncature : "salarie" reconnaît
 * "salaries", pas "salai". Appliqué au texte DÉJÀ normalisé.
 */
function seq(...words: readonly string[]): RegExp {
  return new RegExp("\\b" + words.map((w) => `${w}[a-z]*`).join(FAMILY_LINK));
}

export function inferPremiumDocumentFamily(
  input: Record<string, unknown> | string | null | undefined,
): PierrePremiumDocumentFamily {
  if (input === null || input === undefined) return "generic_hr";

  const text = typeof input === "string"
    ? input
    : [
        asStr(input.family),
        asStr(input.doc_type),
        asStr(input.type),
        asStr(input.document_type),
        asStr(input.classification),
        asStr(input.title),
        asStr(input.instructions),
      ]
        .filter(Boolean)
        .join(" ");

  if (!text) return "generic_hr";

  // Check direct family name first (from object)
  if (typeof input === "object" && input !== null) {
    const fam = asStr(input.family);
    if (fam && VALID_FAMILIES.includes(fam as PierrePremiumDocumentFamily)) {
      return fam as PierrePremiumDocumentFamily;
    }
  }

  // E1.1 — la RH française s'écrit avec des accents ("arrêt maladie", "synthèse salarié")
  // et avec des mots de liaison ("solde DE tout compte"). Le texte est donc réduit à une
  // forme canonique — sans diacritiques, ponctuation ramenée à une espace — AVANT toute
  // reconnaissance. Sans cela, `\bcongé\b` ne peut jamais correspondre (`é` n'est pas un
  // caractère de mot ASCII : la limite `\b` finale échoue) et `arret.maladie` rate "arrêt".
  const norm = normalizeForFamilyMatch(text);
  if (!norm) return "generic_hr";

  if (/\bcontract[a-z]*\b|\bcdi\b|\bcdd\b/.test(norm) || seq("contrat", "travail").test(norm) || seq("contrat", "cdi").test(norm) || seq("contrat", "cdd").test(norm)) return "contract";
  if (/\bamendment|\bavenant/.test(norm)) return "amendment";
  if (/\boffer\b/.test(norm) || seq("offre", "emploi").test(norm) || seq("job", "offer").test(norm)) return "offer";
  if (/\bconvocation|\bconvoqu/.test(norm)) return "convocation";
  if (/\brefusal\b/.test(norm) || seq("refus", "candidat").test(norm) || seq("candidature", "refus").test(norm)) return "refusal";
  if (/\bonboarding\b/.test(norm) || seq("accueil", "nouvel").test(norm) || seq("parcours", "integration").test(norm) || seq("document", "accueil").test(norm) || seq("guide", "accueil").test(norm)) return "onboarding";
  if (/\babsence[a-z]*\b|\bconge[a-z]*\b/.test(norm) || seq("arret", "travail").test(norm) || seq("arret", "maladie").test(norm) || seq("justificatif", "absence").test(norm)) return "absence";
  if (/\bprepayroll\b|\bbulletin/.test(norm) || seq("pre", "paie").test(norm) || seq("elements", "paie").test(norm) || seq("elements", "variables", "paie").test(norm)) return "pre_payroll";
  if (/\bperformance\b/.test(norm) || seq("entretien", "evaluation").test(norm) || seq("entretien", "performance").test(norm) || seq("evaluation", "annuelle").test(norm)) return "performance";
  if (/\bformation[a-z]*\b|\btraining\b/.test(norm) || seq("plan", "formation").test(norm) || seq("developpement", "competences").test(norm)) return "training";
  if (/\boffboarding\b|\blicenciement[a-z]*\b|\bdemission[a-z]*\b/.test(norm) || seq("fin", "contrat").test(norm) || seq("depart", "salarie").test(norm) || seq("solde", "tout", "compte").test(norm) || seq("rupture", "conventionnelle").test(norm)) return "offboarding";
  if (seq("synthese", "salarie").test(norm) || seq("fiche", "salarie").test(norm) || seq("dossier", "salarie").test(norm) || seq("employee", "summary").test(norm) || seq("employee", "file").test(norm)) return "employee_summary";
  if (seq("note", "interne").test(norm) || seq("note", "rh").test(norm) || seq("internal", "note").test(norm) || seq("memo", "rh").test(norm)) return "internal_note";
  if (/\brelance[a-z]*\b|\bfollowup\b/.test(norm) || seq("suivi", "rh").test(norm) || seq("follow", "up").test(norm) || seq("rappel", "rh").test(norm)) return "followup";

  return "generic_hr";
}

export function inferPremiumDocumentRiskLevel(
  family: PierrePremiumDocumentFamily,
  content: string,
  variables?: PierrePremiumDocumentVariable[],
): PierrePremiumDocumentRiskLevel {
  const text = (content ?? "").toLowerCase();
  const varText = (variables ?? [])
    .map((v) => `${v.key} ${String(v.value ?? "")}`)
    .join(" ")
    .toLowerCase();
  const combined = text + " " + varText;

  // Black: extremely serious disciplinary/legal topics
  if (/harcel|discrimin|faute.?grave|licencie.*disciplin|licenciem.*disciplin|prud.?homm|violence.au.travail|accident.grave|agression|harcèlement/i.test(combined)) {
    return "black";
  }

  // Red: termination, offboarding, critical payroll, departure
  if (/licenciem|rupture.conventionnelle|mise.en.demeure|solde.de.tout.compte|depart.definitif|fin.de.contrat.anticip|paie.critiqu|retenue.salaire/i.test(combined)) {
    return "red";
  }

  // Family-based risk
  if (family === "offboarding" || family === "pre_payroll") return "red";
  if (family === "contract" || family === "amendment") return "orange";
  if (family === "convocation" || family === "absence" || family === "employee_summary") return "orange";

  return "green";
}

export function selectPremiumDocumentTemplate(
  config: PierrePremiumDocumentConfig,
  family: PierrePremiumDocumentFamily,
  channel: PierrePremiumDocumentChannel,
): PierrePremiumDocumentTemplate | null {
  if (!config) return null;

  // Custom templates take priority
  const customMatch = (config.custom_templates ?? []).find(
    (t) => t.family === family && (t.channel === channel || channel === "document"),
  );
  if (customMatch) return customMatch;

  // Exact match on family + channel
  const exact = (config.templates ?? []).find(
    (t) => t.family === family && t.channel === channel,
  );
  if (exact) return exact;

  // Match on family only
  const familyMatch = (config.templates ?? []).find((t) => t.family === family);
  if (familyMatch) return familyMatch;

  // Fallback to generic_hr
  return (config.templates ?? []).find((t) => t.family === "generic_hr") ?? null;
}

export function resolvePremiumDocumentVariables(
  input: PierrePremiumDocumentInput,
  config: PierrePremiumDocumentConfig,
): PierrePremiumDocumentVariable[] {
  // Collect variables from all sources
  const all: PierrePremiumDocumentVariable[] = [];

  // 1. Explicit input variables (manual/payload)
  const explicit = normalizePremiumDocumentVariables(input.variables ?? []);
  for (const v of explicit) all.push(v);

  // 2. From payload
  if (isObj(input.payload)) {
    const payload = input.payload;
    const payloadVars: Array<[string, string, unknown]> = [
      ["employee_name", "Salarié", payload.employee_name],
      ["candidate_name", "Candidat", payload.candidate_name],
      ["company_name", "Entreprise", payload.company_name],
      ["position", "Poste", payload.position],
      ["date", "Date", payload.date],
      ["location", "Lieu", payload.location],
      ["manager_name", "Responsable", payload.manager_name],
      ["salary", "Salaire", payload.salary],
      ["start_date", "Date de début", payload.start_date],
      ["end_date", "Date de fin", payload.end_date],
    ];
    for (const [key, label, val] of payloadVars) {
      const s = asStr(val);
      if (s) {
        all.push({ key, label, value: s, required: false, source: "payload" });
      }
    }
  }

  // 3. From employee_file
  if (isObj(input.employee_file)) {
    const ef = input.employee_file;
    const name = asStr(ef.name) || asStr(ef.full_name) || asStr(ef.employee_name);
    if (name) all.push({ key: "employee_name", label: "Salarié", value: name, required: false, source: "employee_file" });
    const role = asStr(ef.role) || asStr(ef.position) || asStr(ef.job_title);
    if (role) all.push({ key: "position", label: "Poste", value: role, required: false, source: "employee_file" });
    const dept = asStr(ef.department);
    if (dept) all.push({ key: "department", label: "Département", value: dept, required: false, source: "employee_file" });
    const email = asStr(ef.email);
    if (email) all.push({ key: "employee_email", label: "Email salarié", value: email, required: false, source: "employee_file" });
  }

  // 4. From task
  if (isObj(input.task)) {
    const t = input.task;
    const tp = isObj(t.payload_json) ? t.payload_json : null;
    if (tp) {
      const empName = asStr(tp.employee_name) || asStr(tp.recipient_name);
      if (empName) all.push({ key: "employee_name", label: "Salarié", value: empName, required: false, source: "task" });
    }
    const tid = asStr(t.id) || asStr(t.task_id);
    if (tid) all.push({ key: "task_id", label: "ID Tâche", value: tid, required: false, source: "task" });
  }

  // 5. From mission
  if (isObj(input.mission)) {
    const m = input.mission;
    const mId = asStr(m.id) || asStr(m.mission_id);
    if (mId) all.push({ key: "mission_id", label: "ID Mission", value: mId, required: false, source: "mission" });
  }

  // 6. From company_memory (branding)
  const companyName = config.branding.company_name;
  if (companyName) {
    all.push({ key: "company_name", label: "Entreprise", value: companyName, required: false, source: "company_memory" });
    all.push({ key: "signature", label: "Signature", value: config.branding.default_signature ?? companyName, required: false, source: "company_memory" });
  }

  // Deduplicate — keep highest priority source for each key
  const deduped = new Map<string, PierrePremiumDocumentVariable>();
  for (const v of all) {
    const existing = deduped.get(v.key);
    if (!existing || SOURCE_RANK[v.source] > SOURCE_RANK[existing.source]) {
      deduped.set(v.key, v);
    }
  }

  return Array.from(deduped.values());
}

export function interpolatePremiumTemplate(
  text: string,
  variables: PierrePremiumDocumentVariable[],
): string {
  if (!text) return "";

  const varMap = new Map<string, PierrePremiumDocumentVariable>();
  for (const v of variables) {
    if (v.key) varMap.set(v.key.toLowerCase(), v);
  }

  return text.replace(/\{\{(\w+)\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const variable = varMap.get(key);

    if (!variable) {
      // Unknown variable — use placeholder
      return `[À compléter : ${rawKey}]`;
    }

    if (variable.value === null || variable.value === undefined) {
      if (variable.required) return `[À compléter : ${variable.label || rawKey}]`;
      return "";
    }

    if (typeof variable.value === "boolean") return variable.value ? "Oui" : "Non";
    if (typeof variable.value === "number") return String(variable.value);
    return String(variable.value);
  });
}

export function buildPremiumDocumentPlainText(
  input: PierrePremiumDocumentInput,
  template: PierrePremiumDocumentTemplate | null,
  variables: PierrePremiumDocumentVariable[],
  config: PierrePremiumDocumentConfig,
): string {
  const companyName = config.branding.company_name;
  const employeeName = variables.find((v) => v.key === "employee_name")?.value;
  const styleGuide = config.style_guide;

  // If raw_content is sufficiently complete, use it as base
  if (input.raw_content && input.raw_content.trim().length > 80) {
    const base = interpolatePremiumTemplate(input.raw_content.trim(), variables);

    const parts: string[] = [];
    if (input.title) parts.push(input.title.toUpperCase());
    if (companyName) parts.push(`${companyName}`);
    parts.push("");
    parts.push(base);

    // Add signature if not already present
    if (!/signature|cordialement|sincèrement/i.test(base) && config.branding.default_signature) {
      parts.push("\n" + config.branding.default_signature);
    }

    // Human review note
    if (styleGuide.include_human_review_note) {
      parts.push("\n---");
      parts.push("Ce document est soumis à validation avant toute utilisation officielle.");
    }

    return parts.filter(Boolean).join("\n").trim();
  }

  // Build from template sections
  if (template && template.sections.length > 0) {
    const ordered = [...template.sections].sort((a, b) => a.order - b.order);
    const parts: string[] = [];

    if (input.title || template.name) {
      parts.push((input.title || template.name).toUpperCase());
    }
    if (companyName) parts.push(companyName);
    if (employeeName) parts.push(`Concernant : ${employeeName}`);
    parts.push("");

    for (const section of ordered) {
      const body = interpolatePremiumTemplate(section.body, variables);
      if (!body.trim() && !section.required) continue;
      parts.push(`— ${section.title} —`);
      parts.push(body.trim());
      parts.push("");
    }

    if (styleGuide.include_human_review_note) {
      parts.push("---");
      parts.push("Ce document est soumis à validation avant toute utilisation officielle.");
    }

    return parts.join("\n").trim();
  }

  // Minimal fallback
  const title = input.title || FAMILY_LABELS[input.family] || "Document RH";
  const lines = [
    title.toUpperCase(),
    companyName ? companyName : "",
    "",
    `Type : ${FAMILY_LABELS[input.family]}`,
    "",
    "[Contenu à compléter]",
  ];
  if (styleGuide.include_human_review_note) {
    lines.push("", "Ce document est soumis à validation avant toute utilisation officielle.");
  }
  return lines.filter((l, i) => i === 0 || l !== "").join("\n").trim();
}

export function buildPremiumDocumentHtml(
  plainText: string,
  input: PierrePremiumDocumentInput,
  template: PierrePremiumDocumentTemplate | null,
  variables: PierrePremiumDocumentVariable[],
  config: PierrePremiumDocumentConfig,
): string {
  const companyName = escapeHtml(config.branding.company_name ?? "");
  const primaryColor = config.branding.primary_color ?? "#1a1a2e";
  const title = escapeHtml(input.title || (template ? template.name : FAMILY_LABELS[input.family]));
  const footerNote = escapeHtml(config.branding.footer_note ?? "Document confidentiel — usage interne");

  // Build body paragraphs from plain_text, splitting on double newlines
  const blocks = plainText
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const bodyHtml = blocks
    .map((block) => {
      if (block.startsWith("—") && block.endsWith("—")) {
        return `<h3 class="pierre-section-title">${escapeHtml(block.replace(/^—\s*/, "").replace(/\s*—$/, ""))}</h3>`;
      }
      if (/^[A-ZÉÈÀÂÊ\s]{4,}$/.test(block) && block.length < 80) {
        return `<h2 class="pierre-doc-title">${escapeHtml(block)}</h2>`;
      }
      if (block.startsWith("---")) {
        return `<hr class="pierre-separator" />`;
      }
      const escaped = escapeHtml(block).replace(/\n/g, "<br />");
      return `<p class="pierre-paragraph">${escaped}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; margin: 0; padding: 0; }
  .pierre-wrapper { max-width: 800px; margin: 0 auto; padding: 40px 48px; }
  .pierre-header { border-bottom: 2px solid ${escapeHtml(primaryColor)}; padding-bottom: 16px; margin-bottom: 32px; }
  .pierre-company { font-size: 18px; font-weight: 700; color: ${escapeHtml(primaryColor)}; letter-spacing: 0.5px; }
  .pierre-doc-family { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .pierre-doc-title { font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 24px 0 16px; }
  h3.pierre-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: ${escapeHtml(primaryColor)}; margin: 24px 0 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
  .pierre-paragraph { line-height: 1.7; margin: 0 0 12px; color: #2a2a2a; }
  .pierre-separator { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
  .pierre-footer { border-top: 1px solid #e5e5e5; margin-top: 48px; padding-top: 12px; font-size: 11px; color: #888; }
</style>
</head>
<body>
<div class="pierre-wrapper">
  <div class="pierre-header">
    ${companyName ? `<div class="pierre-company">${companyName}</div>` : ""}
    <div class="pierre-doc-family">${escapeHtml(FAMILY_LABELS[input.family])}</div>
  </div>
  <div class="pierre-content">
${bodyHtml}
  </div>
  <div class="pierre-footer">${footerNote}</div>
</div>
</body>
</html>`.trim();
}

export function validatePremiumDocument(
  input: PierrePremiumDocumentInput,
  template: PierrePremiumDocumentTemplate | null,
  variables: PierrePremiumDocumentVariable[],
  plainText: string,
  html: string,
  config: PierrePremiumDocumentConfig,
): PierrePremiumDocumentQuality {
  const issues: PierrePremiumDocumentIssue[] = [];
  let score = 100;

  const varMap = new Map(variables.map((v) => [v.key, v]));
  const companyName = config.branding.company_name;

  // ── Blocking checks ────────────────────────────────────────────
  if (!plainText || plainText.trim().length < 20) {
    issues.push({
      level: "blocking",
      code: "EMPTY_CONTENT",
      label: "Contenu vide",
      message: "Le document ne contient pas de contenu suffisant.",
    });
    score -= 50;
  }

  // Check required variables from template
  const requiredVarKeys = template ? template.required_variables : [];
  const missingRequired: string[] = [];
  for (const key of requiredVarKeys) {
    const v = varMap.get(key);
    if (!v || v.value === null) {
      missingRequired.push(key);
      issues.push({
        level: "error",
        code: "MISSING_REQUIRED_VAR",
        label: "Variable obligatoire manquante",
        message: `La variable obligatoire "${key}" est manquante ou vide.`,
        field: key,
      });
      score -= 10;
    }
  }

  // Black risk without approval
  const riskLevel = inferPremiumDocumentRiskLevel(input.family, plainText, variables);
  const templateRisk = template?.risk_level ?? "green";
  const effectiveRisk = (["black", "red", "orange", "green"] as PierrePremiumDocumentRiskLevel[])
    .find((r) => r === riskLevel || r === templateRisk) ?? "green";
  const finalRisk: PierrePremiumDocumentRiskLevel =
    riskLevel === "black" || templateRisk === "black" ? "black" :
    riskLevel === "red" || templateRisk === "red" ? "red" :
    riskLevel === "orange" || templateRisk === "orange" ? "orange" : "green";

  let approval_required = template?.approval_required ?? false;
  if (finalRisk === "black" || finalRisk === "red") {
    approval_required = true;
    if (finalRisk === "black") {
      issues.push({
        level: "blocking",
        code: "BLACK_RISK_APPROVAL_REQUIRED",
        label: "Risque critique — validation obligatoire",
        message: "Ce document contient des éléments de risque critique. Une validation humaine est obligatoire avant toute utilisation.",
      });
      score -= 30;
    } else {
      issues.push({
        level: "error",
        code: "RED_RISK_APPROVAL_REQUIRED",
        label: "Risque élevé — validation recommandée",
        message: "Ce document présente un risque élevé. Une validation humaine est fortement recommandée.",
      });
      score -= 15;
    }
  }

  void effectiveRisk; // used above

  // ── Warning checks ─────────────────────────────────────────────
  if (plainText.trim().length < 100) {
    issues.push({
      level: "warning",
      code: "CONTENT_TOO_SHORT",
      label: "Contenu insuffisant",
      message: "Le contenu du document est très court. Pensez à le compléter.",
    });
    score -= 10;
  }

  // Remaining placeholders
  const remainingPlaceholders = (plainText.match(/\[À compléter/g) ?? []).length;
  if (remainingPlaceholders > 3) {
    issues.push({
      level: "warning",
      code: "MANY_INCOMPLETE_FIELDS",
      label: "Nombreux champs incomplets",
      message: `${remainingPlaceholders} champs restent à compléter dans ce document.`,
    });
    score -= Math.min(20, remainingPlaceholders * 3);
  } else if (remainingPlaceholders > 0) {
    issues.push({
      level: "info",
      code: "INCOMPLETE_FIELDS",
      label: "Champs à compléter",
      message: `${remainingPlaceholders} champ(s) à compléter avant finalisation.`,
    });
    score -= remainingPlaceholders * 2;
  }

  // No company name
  if (!companyName) {
    issues.push({
      level: "warning",
      code: "NO_COMPANY_NAME",
      label: "Nom d'entreprise manquant",
      message: "Le nom de l'entreprise n'est pas renseigné dans la configuration.",
    });
    score -= 5;
  }

  // Employee name missing for employee documents
  const needsEmployee: PierrePremiumDocumentFamily[] = [
    "contract", "amendment", "convocation", "onboarding", "absence",
    "pre_payroll", "performance", "training", "offboarding", "employee_summary",
  ];
  if (needsEmployee.includes(input.family)) {
    const empVar = varMap.get("employee_name");
    if (!empVar || !empVar.value) {
      issues.push({
        level: "warning",
        code: "NO_EMPLOYEE_NAME",
        label: "Nom de salarié manquant",
        message: "Le nom du salarié concerné n'est pas renseigné.",
        field: "employee_name",
      });
      score -= 8;
    }
  }

  // No signature
  if (!/signature|cordialement|sincèrement|bien.cordialement/i.test(plainText) && !config.branding.default_signature) {
    issues.push({
      level: "warning",
      code: "NO_SIGNATURE",
      label: "Signature manquante",
      message: "Aucune signature n'est présente dans le document.",
    });
    score -= 5;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine status
  const hasBlocking = issues.some((i) => i.level === "blocking");
  let status: PierrePremiumDocumentQualityStatus;
  if (hasBlocking || score < 40) status = "blocked";
  else if (score < 60) status = "needs_review";
  else if (score < 80) status = "good";
  else status = "excellent";

  return {
    status,
    score,
    issues,
    missing_required_variables: missingRequired,
    approval_required,
    risk_level: finalRisk,
  };
}

export function buildPremiumDocumentDigest(
  quality: PierrePremiumDocumentQuality,
  family: PierrePremiumDocumentFamily,
): PierrePremiumDocumentDigest {
  const label = FAMILY_LABELS[family] ?? "Document RH";

  if (quality.risk_level === "black" || quality.risk_level === "red") {
    return {
      tone: "sensitive",
      text: `${label} — Risque ${quality.risk_level === "black" ? "critique" : "élevé"}. Validation humaine obligatoire avant utilisation.`,
    };
  }

  if (quality.status === "blocked") {
    const reason = quality.issues.find((i) => i.level === "blocking")?.label ?? "Document incomplet";
    return {
      tone: "blocked",
      text: `${label} — Bloqué : ${reason}. Des corrections sont nécessaires avant utilisation.`,
    };
  }

  if (quality.status === "needs_review") {
    return {
      tone: "review",
      text: `${label} — À réviser. Score qualité : ${quality.score}/100. ${quality.missing_required_variables.length > 0 ? `Variables manquantes : ${quality.missing_required_variables.join(", ")}.` : ""}`,
    };
  }

  return {
    tone: "ready",
    text: `${label} — Prêt. Score qualité : ${quality.score}/100.`,
  };
}

export function renderPremiumDocument(
  input: PierrePremiumDocumentInput,
  config?: PierrePremiumDocumentConfig,
  now?: Date,
): PierrePremiumDocumentResult {
  const safeNow = now instanceof Date ? now : new Date();
  const generatedAt = safeNow.toISOString();

  // Safe config
  const safeConfig = config ?? buildDefaultPremiumDocumentConfig(
    isObj(input.company_memory) ? input.company_memory : null,
  );

  // Safe family/channel
  const family: PierrePremiumDocumentFamily = VALID_FAMILIES.includes(input.family)
    ? input.family
    : "generic_hr";
  const channel: PierrePremiumDocumentChannel = VALID_CHANNELS.includes(input.channel)
    ? input.channel
    : "document";

  // Select template
  const selectedTemplate = selectPremiumDocumentTemplate(safeConfig, family, channel);

  // Resolve variables
  const variables = resolvePremiumDocumentVariables({ ...input, family, channel }, safeConfig);

  // Apply requested tone to config if provided
  const effectiveConfig: PierrePremiumDocumentConfig = input.requested_tone
    ? {
        ...safeConfig,
        style_guide: { ...safeConfig.style_guide, tone: input.requested_tone },
      }
    : safeConfig;

  // Build plain text
  const plainText = buildPremiumDocumentPlainText(
    { ...input, family, channel },
    selectedTemplate,
    variables,
    effectiveConfig,
  );

  // Build HTML
  const html = buildPremiumDocumentHtml(
    plainText,
    { ...input, family, channel },
    selectedTemplate,
    variables,
    effectiveConfig,
  );

  // Validate quality
  const quality = validatePremiumDocument(
    { ...input, family, channel },
    selectedTemplate,
    variables,
    plainText,
    html,
    effectiveConfig,
  );

  // Build digest
  const digest = buildPremiumDocumentDigest(quality, family);

  // Title
  const title = asStr(input.title) || (selectedTemplate ? selectedTemplate.name : FAMILY_LABELS[family]);

  // Filename
  const companySlug = effectiveConfig.branding.company_name
    ? slugifyFilename(effectiveConfig.branding.company_name) + "_"
    : "";
  const familySlug = slugifyFilename(FAMILY_LABELS[family]);
  const dateSlug = generatedAt.slice(0, 10).replace(/-/g, "");
  const pdfFilename = `${companySlug}${familySlug}_${dateSlug}.pdf`;

  // Email parts
  const isEmail = channel === "email";
  const emailSubject = isEmail
    ? `${title} — ${effectiveConfig.branding.company_name ?? "Document RH"}`
    : null;
  const emailBodyHtml = isEmail ? html : null;

  // Extract metadata values
  const missionId = asStr(input.mission?.id) || asStr(input.mission?.mission_id) || null;
  const taskId = asStr(input.task?.id) || asStr(input.task?.task_id) || null;
  const employeeName = variables.find((v) => v.key === "employee_name")?.value;

  const rendered: PierrePremiumDocumentRendered = {
    title,
    plain_text: plainText,
    html,
    email_subject: emailSubject,
    email_body_html: emailBodyHtml,
    pdf_filename: pdfFilename,
    metadata: {
      family,
      channel,
      template_id: selectedTemplate?.id ?? null,
      generated_at: generatedAt,
      company_name: effectiveConfig.branding.company_name,
      employee_name: typeof employeeName === "string" ? employeeName : null,
      mission_id: missionId,
      task_id: taskId,
      approval_required: quality.approval_required,
      risk_level: quality.risk_level,
      quality_score: quality.score,
    },
  };

  return {
    config: effectiveConfig,
    selected_template: selectedTemplate,
    variables,
    quality,
    rendered,
    digest,
  };
}

export function buildPremiumDocumentArtifactPayload(
  result: PierrePremiumDocumentResult,
): Record<string, unknown> {
  return {
    title: result.rendered.title,
    plain_text: result.rendered.plain_text,
    html: result.rendered.html,
    metadata: result.rendered.metadata,
    quality: {
      status: result.quality.status,
      score: result.quality.score,
      approval_required: result.quality.approval_required,
      risk_level: result.quality.risk_level,
      missing_required_variables: result.quality.missing_required_variables,
      issues: result.quality.issues,
    },
    digest: result.digest,
    family: result.rendered.metadata.family,
    channel: result.rendered.metadata.channel,
    template_id: result.rendered.metadata.template_id,
    variables: result.variables.map((v) => ({
      key: v.key,
      label: v.label,
      value: v.value,
      source: v.source,
    })),
    pdf_filename: result.rendered.pdf_filename,
  };
}

export function buildPremiumDocumentEmailPayload(
  result: PierrePremiumDocumentResult,
  recipient?: string | null,
): Record<string, unknown> {
  return {
    subject: result.rendered.email_subject ?? result.rendered.title,
    body_html: result.rendered.email_body_html ?? result.rendered.html,
    body_text: result.rendered.plain_text,
    to: recipient ? [recipient] : [],
    cc: [],
    bcc: [],
    metadata: result.rendered.metadata,
    quality: {
      status: result.quality.status,
      score: result.quality.score,
      approval_required: result.quality.approval_required,
      risk_level: result.quality.risk_level,
    },
    // Never auto-send — must be explicitly triggered by human
    auto_send: false,
  };
}

// ── Bloc 27 — Pierre adapter for CloneStore document engine ──────────────────

import type { CloneDocumentRenderResult } from "../../clonestore/documents/types";
import {
  renderCloneDocument,
  validateCloneDocumentTemplate,
} from "../../clonestore/documents/renderer";
import {
  buildCloneDocumentTemplateRegistry,
  getCloneDocumentTemplateById,
} from "../../clonestore/documents/template-registry";

export type PierrePremiumDocumentKind =
  | "hr_contract_draft"
  | "hr_amendment_draft"
  | "candidate_rejection"
  | "interview_invitation"
  | "onboarding_plan"
  | "absence_followup"
  | "prepay_summary"
  | "employee_file_summary"
  | "sensitive_case_note"
  | "offboarding_checklist"
  | "hr_weekly_briefing"
  | "manager_notification";

const KIND_TO_TEMPLATE_ID: Record<PierrePremiumDocumentKind, string> = {
  hr_contract_draft: "pierre_hr_contract_draft_v1",
  hr_amendment_draft: "pierre_hr_amendment_draft_v1",
  candidate_rejection: "pierre_candidate_rejection_v1",
  interview_invitation: "pierre_interview_invitation_v1",
  onboarding_plan: "pierre_onboarding_plan_v1",
  absence_followup: "pierre_absence_followup_v1",
  prepay_summary: "pierre_prepay_summary_v1",
  employee_file_summary: "pierre_employee_file_summary_v1",
  sensitive_case_note: "pierre_sensitive_case_note_v1",
  offboarding_checklist: "pierre_offboarding_checklist_v1",
  hr_weekly_briefing: "pierre_hr_weekly_briefing_v1",
  manager_notification: "pierre_manager_notification_v1",
};

const FAMILY_TO_KIND: Record<string, PierrePremiumDocumentKind> = {
  contract: "hr_contract_draft",
  amendment: "hr_amendment_draft",
  refusal: "candidate_rejection",
  convocation: "interview_invitation",
  onboarding: "onboarding_plan",
  absence: "absence_followup",
  pre_payroll: "prepay_summary",
  employee_summary: "employee_file_summary",
  internal_note: "sensitive_case_note",
  offboarding: "offboarding_checklist",
  generic_hr: "hr_weekly_briefing",
  offer: "manager_notification",
};

export function normalizePierrePremiumDocumentKind(
  value: unknown,
): PierrePremiumDocumentKind {
  if (typeof value !== "string") return "hr_weekly_briefing";
  const lower = value.trim().toLowerCase();
  if (lower in KIND_TO_TEMPLATE_ID) return lower as PierrePremiumDocumentKind;
  if (lower in FAMILY_TO_KIND) return FAMILY_TO_KIND[lower];
  return "hr_weekly_briefing";
}

export function buildPierreDocumentVariables(params: {
  employee?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  mission?: Record<string, unknown> | null;
  extra?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const { employee, company, mission, extra } = params;
  const vars: Record<string, unknown> = {};

  if (employee && typeof employee === "object") {
    const e = employee as Record<string, unknown>;
    if (e["first_name"]) vars["employee_first_name"] = e["first_name"];
    if (e["last_name"]) vars["employee_last_name"] = e["last_name"];
    if (e["full_name"]) vars["employee_name"] = e["full_name"];
    else if (e["first_name"] && e["last_name"])
      vars["employee_name"] = `${e["first_name"]} ${e["last_name"]}`;
    if (e["role"]) vars["employee_role"] = e["role"];
    if (e["email"]) vars["employee_email"] = e["email"];
    if (e["department"]) vars["department"] = e["department"];
    if (e["start_date"]) vars["start_date"] = e["start_date"];
    if (e["contract_type"]) vars["contract_type"] = e["contract_type"];
    if (e["salary"]) vars["salary"] = e["salary"];
  }

  if (company && typeof company === "object") {
    const c = company as Record<string, unknown>;
    if (c["name"]) vars["company_name"] = c["name"];
    if (c["address"]) vars["company_address"] = c["address"];
    if (c["siren"]) vars["company_siren"] = c["siren"];
    if (c["legal_representative"])
      vars["legal_representative"] = c["legal_representative"];
    if (c["hr_contact"]) vars["hr_contact"] = c["hr_contact"];
  }

  if (mission && typeof mission === "object") {
    const m = mission as Record<string, unknown>;
    if (m["title"]) vars["mission_title"] = m["title"];
    if (m["id"]) vars["mission_id"] = m["id"];
    if (m["context"]) vars["mission_context"] = m["context"];
  }

  if (extra && typeof extra === "object") {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) vars[k] = v;
    }
  }

  return vars;
}

export function selectPierreDocumentTemplate(
  kind: PierrePremiumDocumentKind,
  companyTemplates?: Record<string, unknown>[] | null,
) {
  const templateId = KIND_TO_TEMPLATE_ID[kind] ?? KIND_TO_TEMPLATE_ID["hr_weekly_briefing"];

  // Try company-overridden template first
  if (Array.isArray(companyTemplates)) {
    const override = companyTemplates.find(
      (t) =>
        t &&
        typeof t === "object" &&
        (t as Record<string, unknown>)["id"] === templateId,
    );
    if (override) {
      const validation = validateCloneDocumentTemplate(override);
      if (validation.ok && validation.template) return validation.template;
    }
  }

  // Fall back to platform default
  return getCloneDocumentTemplateById(templateId);
}

export function renderPierrePremiumDocument(params: {
  kind: PierrePremiumDocumentKind;
  variables: Record<string, unknown>;
  company_profile?: Record<string, unknown> | null;
  employee_profile?: Record<string, unknown> | null;
  mission_context?: Record<string, unknown> | null;
  ai_content?: Record<string, unknown> | string | null;
  companyTemplates?: Record<string, unknown>[] | null;
  cloneADNVariables?: Record<string, unknown> | null;
}): CloneDocumentRenderResult {
  try {
    const {
      kind,
      variables,
      company_profile,
      employee_profile,
      mission_context,
      ai_content,
      companyTemplates,
      cloneADNVariables,
    } = params;

    // Merge CloneADN-derived variables (lower priority than explicit variables)
    const mergedVariables =
      cloneADNVariables && typeof cloneADNVariables === "object"
        ? { ...cloneADNVariables, ...(variables ?? {}) }
        : variables ?? {};

    const template = selectPierreDocumentTemplate(kind, companyTemplates);

    if (!template) {
      const fallback = buildCloneDocumentTemplateRegistry()[0];
      return renderCloneDocument({
        template: fallback,
        variables: mergedVariables,
        company_profile,
        employee_profile,
        mission_context,
        ai_content,
      });
    }

    return renderCloneDocument({
      template,
      variables: mergedVariables,
      company_profile,
      employee_profile,
      mission_context,
      ai_content,
    });
  } catch {
    const registry = buildCloneDocumentTemplateRegistry();
    const fallback = registry[0] ?? ({
      id: "fallback",
      version: "1.0.0",
      scope: "platform_default" as const,
      agent_slug: "pierre",
      document_type: "generic_hr_document",
      title: "Document RH",
      description: "",
      audience: "internal" as const,
      default_format: "text" as const,
      tone: "neutral" as const,
      risk_level: "low" as const,
      validation_mode: "none" as const,
      variables: [],
      blocks: [],
      theme: {
        name: "Default",
        primary_color: "#1a1a2e",
        accent_color: "#4f6ef2",
        text_color: "#1f2937",
        background_color: "#ffffff",
        font_family: "Inter, system-ui, sans-serif",
        border_radius: "6px",
        density: "comfortable" as const,
      },
      signature: null,
      tags: [],
      created_at: null,
      updated_at: null,
    });

    return {
      ok: false,
      template_id: fallback.id,
      document_type: fallback.document_type,
      format: "text",
      title: fallback.title,
      content_text: "",
      content_markdown: "",
      content_html: "",
      content_pdf_ready_html: "",
      missing_variables: [],
      validation_issues: [
        {
          level: "error",
          code: "render_error",
          label: "Render error",
          message: "An unexpected error occurred during rendering.",
        },
      ],
      risk_level: "low",
      validation_mode: "none",
      requires_human_validation: false,
      quality_score: 0,
      warnings: ["Rendering failed — fallback applied."],
    };
  }
}

export function buildPierrePremiumDocumentQualitySummary(
  result: CloneDocumentRenderResult,
): Record<string, unknown> {
  const criticalIssues = result.validation_issues.filter(
    (i) => i.level === "critical",
  ).length;
  const errorIssues = result.validation_issues.filter(
    (i) => i.level === "error",
  ).length;
  const warningIssues = result.validation_issues.filter(
    (i) => i.level === "warning",
  ).length;

  const status =
    !result.ok || criticalIssues > 0
      ? "critical"
      : errorIssues > 0
      ? "needs_review"
      : result.quality_score >= 80
      ? "ready"
      : result.quality_score >= 50
      ? "acceptable"
      : "needs_review";

  return {
    ok: result.ok,
    status,
    quality_score: result.quality_score,
    risk_level: result.risk_level,
    validation_mode: result.validation_mode,
    requires_human_validation: result.requires_human_validation,
    missing_required: result.missing_variables.filter((v) => v.required).length,
    missing_optional: result.missing_variables.filter((v) => !v.required).length,
    issues: {
      critical: criticalIssues,
      error: errorIssues,
      warning: warningIssues,
    },
    warnings: result.warnings,
  };
}
