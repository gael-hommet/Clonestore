// B47 — Pierre Legal Taxonomy
// Classifies HR categories by legal sensitivity and required guardrails.
// Pure: no Supabase, no Next, no async. No throw.

export type PierreSensitiveHrCategory =
  | "dismissal"
  | "sanction"
  | "harassment"
  | "discrimination"
  | "health"
  | "salary"
  | "payroll"
  | "contract"
  | "conflict"
  | "legal"
  | "employee_data"
  | "absence_sensitive"
  | "other";

export type PierreLegalActionPolicy = {
  category: PierreSensitiveHrCategory;
  autonomous_allowed: boolean;
  draft_allowed: boolean;
  prepare_allowed: boolean;
  send_allowed: boolean;
  export_allowed: boolean;
  human_validation_required: boolean;
  legal_review_recommended: boolean;
  required_disclaimers: string[];
  forbidden_actions: string[];
  safe_next_actions: string[];
};

import type { LegalRiskLevel } from "../../../lib/legal-commercial/types";

export type PierreSensitiveHrCategoryDefinition = {
  category: PierreSensitiveHrCategory;
  label: string;
  risk_level: LegalRiskLevel;
  human_validation_required: boolean;
  autonomous_decision_allowed: boolean;
  keywords: string[];
  policy: PierreLegalActionPolicy;
};

// ── Taxonomy definitions ──────────────────────────────────────────────────────

const TAXONOMY: PierreSensitiveHrCategoryDefinition[] = [
  {
    category: "dismissal",
    label: "Licenciement",
    risk_level: "critical",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["licenciement", "licencier", "rupture", "renvoi", "fin de contrat", "rupture conventionnelle", "demission"],
    policy: {
      category: "dismissal",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "LEGAL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
      forbidden_actions: ["auto_send_dismissal", "sign_dismissal", "decide_dismissal_alone"],
      safe_next_actions: ["prepare_draft", "list_missing_info", "escalate_to_hr_manager", "escalate_to_legal"],
    },
  },
  {
    category: "sanction",
    label: "Sanction disciplinaire",
    risk_level: "critical",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["sanction", "avertissement", "blâme", "mise en demeure", "convocation disciplinaire", "disciplinaire"],
    policy: {
      category: "sanction",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "LEGAL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
      forbidden_actions: ["auto_send_sanction", "sign_sanction", "decide_sanction_alone"],
      safe_next_actions: ["prepare_draft", "list_facts", "escalate_to_hr_manager", "propose_procedure"],
    },
  },
  {
    category: "harassment",
    label: "Harcèlement",
    risk_level: "critical",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["harcèlement", "harcelement", "harcel", "intimidation", "agression", "violence au travail"],
    policy: {
      category: "harassment",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "LEGAL_LIMIT"],
      forbidden_actions: ["auto_classify_harassment", "auto_send_sanction", "auto_decide_outcome"],
      safe_next_actions: ["prepare_summary_note", "list_facts_chronologically", "escalate_to_rh_referent", "escalate_to_legal"],
    },
  },
  {
    category: "discrimination",
    label: "Discrimination",
    risk_level: "critical",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["discrimination", "discriminatoire", "inégalité de traitement", "segregation"],
    policy: {
      category: "discrimination",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "LEGAL_LIMIT"],
      forbidden_actions: ["auto_classify_discrimination", "auto_decide_outcome"],
      safe_next_actions: ["prepare_factual_summary", "escalate_to_hr_manager", "escalate_to_legal"],
    },
  },
  {
    category: "health",
    label: "Santé et maladie",
    risk_level: "high",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["maladie", "arrêt maladie", "santé", "medical", "médecin", "inaptitude", "accident du travail", "at/mp", "invalidité"],
    policy: {
      category: "health",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "OFFICIAL_DOCUMENT_VALIDATION"],
      forbidden_actions: ["auto_decide_medical_fitness", "auto_classify_inaptitude"],
      safe_next_actions: ["track_absence_dates", "prepare_summary", "escalate_to_hr_manager"],
    },
  },
  {
    category: "salary",
    label: "Salaire et rémunération",
    risk_level: "high",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["salaire", "augmentation", "prime", "bonus", "rémunération", "indemnité", "variable"],
    policy: {
      category: "salary",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: false,
      required_disclaimers: ["HUMAN_RESPONSIBILITY"],
      forbidden_actions: ["auto_change_salary", "auto_approve_bonus"],
      safe_next_actions: ["prepare_summary", "list_current_conditions", "escalate_to_hr_manager"],
    },
  },
  {
    category: "payroll",
    label: "Pré-paie et éléments variables",
    risk_level: "high",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["paie", "pré-paie", "prepaye", "bulletin", "dsn", "cotisations", "fiches de paie", "éléments variables", "elements variables"],
    policy: {
      category: "payroll",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: false,
      required_disclaimers: ["PAYROLL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
      forbidden_actions: ["generate_official_payslip", "submit_dsn", "certify_payroll"],
      safe_next_actions: ["prepare_variable_elements", "list_anomalies", "escalate_to_payroll_expert"],
    },
  },
  {
    category: "contract",
    label: "Contrats et avenants",
    risk_level: "high",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["contrat", "avenant", "cdi", "cdd", "alternance", "stage", "clause"],
    policy: {
      category: "contract",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "LEGAL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
      forbidden_actions: ["auto_sign_contract", "auto_finalize_contract", "certify_contract"],
      safe_next_actions: ["prepare_draft", "list_clauses_to_review", "escalate_to_legal_or_hr"],
    },
  },
  {
    category: "conflict",
    label: "Conflit et litige",
    risk_level: "high",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["conflit", "litige", "prud'hommes", "prudhommes", "contentieux", "tribunal", "plainte"],
    policy: {
      category: "conflict",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "LEGAL_LIMIT"],
      forbidden_actions: ["auto_respond_litigation", "auto_file_complaint"],
      safe_next_actions: ["prepare_factual_summary", "list_key_dates", "escalate_to_legal"],
    },
  },
  {
    category: "legal",
    label: "Juridique",
    risk_level: "critical",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["juridique", "légal", "loi", "décret", "arrêté", "code du travail", "convention collective"],
    policy: {
      category: "legal",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["LEGAL_LIMIT", "HUMAN_RESPONSIBILITY"],
      forbidden_actions: ["auto_interpret_law", "certify_legal_compliance", "auto_decide_legal_case"],
      safe_next_actions: ["list_relevant_articles", "escalate_to_legal", "prepare_summary_for_counsel"],
    },
  },
  {
    category: "employee_data",
    label: "Données salarié sensibles",
    risk_level: "high",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["données personnelles", "données salarié", "rgpd", "dossier personnel", "numéro de sécu"],
    policy: {
      category: "employee_data",
      autonomous_allowed: false,
      draft_allowed: false,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: true,
      required_disclaimers: ["HUMAN_RESPONSIBILITY", "DATA_PROTECTION_REVIEW"],
      forbidden_actions: ["auto_export_personal_data", "auto_share_employee_data"],
      safe_next_actions: ["summarize_with_redaction", "escalate_to_dpo", "list_data_subjects"],
    },
  },
  {
    category: "absence_sensitive",
    label: "Absence sensible",
    risk_level: "medium",
    human_validation_required: true,
    autonomous_decision_allowed: false,
    keywords: ["absence injustifiée", "abandon de poste", "absence non autorisée"],
    policy: {
      category: "absence_sensitive",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: true,
      legal_review_recommended: false,
      required_disclaimers: ["HUMAN_RESPONSIBILITY"],
      forbidden_actions: ["auto_classify_abandon_de_poste", "auto_send_formal_notice"],
      safe_next_actions: ["track_dates", "prepare_reminder_draft", "escalate_to_hr_manager"],
    },
  },
  {
    category: "other",
    label: "Autre sensible",
    risk_level: "medium",
    human_validation_required: false,
    autonomous_decision_allowed: false,
    keywords: [],
    policy: {
      category: "other",
      autonomous_allowed: false,
      draft_allowed: true,
      prepare_allowed: true,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: false,
      legal_review_recommended: false,
      required_disclaimers: ["HUMAN_RESPONSIBILITY"],
      forbidden_actions: [],
      safe_next_actions: ["prepare_draft", "escalate_if_uncertain"],
    },
  },
];

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getAllTaxonomyDefinitions(): PierreSensitiveHrCategoryDefinition[] {
  return TAXONOMY;
}

export function getTaxonomyDefinition(category: PierreSensitiveHrCategory): PierreSensitiveHrCategoryDefinition | null {
  return TAXONOMY.find((t) => t.category === category) ?? null;
}

export function classifyHrTextCategory(text: string): PierreSensitiveHrCategory {
  const lower = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const def of TAXONOMY) {
    if (def.category === "other") continue;
    if (def.keywords.some((kw) => lower.includes(kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")))) {
      return def.category;
    }
  }
  return "other";
}

export function isCategoryAutonomousAllowed(category: PierreSensitiveHrCategory): boolean {
  const def = getTaxonomyDefinition(category);
  return def?.autonomous_decision_allowed ?? false;
}

export function isCategoryHumanValidationRequired(category: PierreSensitiveHrCategory): boolean {
  const def = getTaxonomyDefinition(category);
  return def?.human_validation_required ?? false;
}

export function getPolicyForCategory(category: PierreSensitiveHrCategory): PierreLegalActionPolicy | null {
  const def = getTaxonomyDefinition(category);
  return def?.policy ?? null;
}

export function getSensitiveCategoryRiskLevel(category: PierreSensitiveHrCategory): LegalRiskLevel {
  const def = getTaxonomyDefinition(category);
  return def?.risk_level ?? "medium";
}
