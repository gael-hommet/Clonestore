// B44 — PierreEmpreinte schema definitions
// Field metadata for UI rendering, setup wizard, and completion tracking.
// Pure: no async, no Supabase, no Next.js, no side effects.

export interface PierreEmpreinteFieldSchema {
  key: string;
  label: string;
  section: string;
  step: number;        // wizard step (1-10)
  required: boolean;
  type: "string" | "number" | "boolean" | "array" | "select";
  options?: string[];
  placeholder?: string;
  help?: string;
}

export const PIERRE_EMPREINTE_SCHEMA: PierreEmpreinteFieldSchema[] = [
  // Step 1 — identity
  { key: "identity.display_name", label: "Nom d'affichage", section: "identity", step: 1, required: true, type: "string", placeholder: "Pierre", help: "Comment Pierre s'appelle pour vos collaborateurs." },
  { key: "identity.greeting_message", label: "Message d'accueil", section: "identity", step: 1, required: false, type: "string", placeholder: "Bonjour ! Je suis Pierre, votre assistant RH." },
  { key: "identity.persona_description", label: "Description du persona", section: "identity", step: 1, required: false, type: "string" },
  { key: "identity.show_powered_by_clonestore", label: "Afficher 'Propulsé par CloneStore'", section: "identity", step: 1, required: false, type: "boolean" },
  // Step 2 — hr_scope
  { key: "hr_scope.enabled_domains", label: "Domaines RH activés", section: "hr_scope", step: 2, required: true, type: "array" },
  { key: "hr_scope.contract_types_in_scope", label: "Types de contrats", section: "hr_scope", step: 2, required: true, type: "array" },
  { key: "hr_scope.max_employees_managed", label: "Nombre max d'employés", section: "hr_scope", step: 2, required: false, type: "number" },
  // Step 3 — workflow_rules
  { key: "workflow_rules.default_mission_language", label: "Langue des missions", section: "workflow_rules", step: 3, required: true, type: "select", options: ["fr","en","de","es"] },
  { key: "workflow_rules.max_tasks_per_mission", label: "Tâches max par mission", section: "workflow_rules", step: 3, required: true, type: "number" },
  // Step 4 — document_rules
  { key: "document_rules.default_tone", label: "Ton des documents", section: "document_rules", step: 4, required: true, type: "select", options: ["formal","warm","direct","executive","neutral","legal_careful"] },
  { key: "document_rules.always_require_human_for_types", label: "Types nécessitant validation humaine", section: "document_rules", step: 4, required: true, type: "array" },
  { key: "document_rules.include_legal_disclaimer", label: "Inclure mention légale", section: "document_rules", step: 4, required: false, type: "boolean" },
  // Step 5 — email_rules
  { key: "email_rules.send_mode", label: "Mode d'envoi email", section: "email_rules", step: 5, required: true, type: "select", options: ["mock","draft_only","live_with_approval","live_auto"] },
  { key: "email_rules.never_auto_send_domains", label: "Jamais auto-envoyer pour", section: "email_rules", step: 5, required: false, type: "array" },
  { key: "email_rules.max_recipients_per_email", label: "Destinataires max", section: "email_rules", step: 5, required: false, type: "number" },
  // Step 6 — sensitive_cases
  { key: "sensitive_cases.always_require_human", label: "Toujours validation humaine", section: "sensitive_cases", step: 6, required: true, type: "boolean" },
  { key: "sensitive_cases.confidentiality_level", label: "Niveau de confidentialité", section: "sensitive_cases", step: 6, required: true, type: "select", options: ["internal","restricted","confidential","secret"] },
  { key: "sensitive_cases.escalation_email", label: "Email d'escalade", section: "sensitive_cases", step: 6, required: false, type: "string" },
  // Step 7 — autonomy
  { key: "autonomy.ai_mode", label: "Mode IA", section: "autonomy", step: 7, required: true, type: "select", options: ["off","assist","primary"] },
  { key: "autonomy.trust_level", label: "Niveau de confiance", section: "autonomy", step: 7, required: true, type: "select", options: ["minimal","supervised","trusted","autonomous"] },
  { key: "autonomy.require_human_review_before_send", label: "Revue humaine avant envoi", section: "autonomy", step: 7, required: true, type: "boolean" },
  // Step 8 — recruitment + onboarding
  { key: "recruitment.enabled", label: "Recrutement activé", section: "recruitment", step: 8, required: false, type: "boolean" },
  { key: "onboarding.enabled", label: "Onboarding activé", section: "onboarding", step: 8, required: false, type: "boolean" },
  { key: "absences.enabled", label: "Absences activées", section: "absences", step: 8, required: false, type: "boolean" },
  // Step 9 — prepayroll
  { key: "prepayroll.enabled", label: "Pré-paie activée", section: "prepayroll", step: 9, required: false, type: "boolean" },
  { key: "prepayroll.payroll_software", label: "Logiciel de paie", section: "prepayroll", step: 9, required: false, type: "string", placeholder: "silae, payfit, adp..." },
  // Step 10 — document_style
  { key: "document_style.primary_color_hex", label: "Couleur principale", section: "document_style", step: 10, required: false, type: "string", placeholder: "#1A5276" },
  { key: "document_style.font_family", label: "Police", section: "document_style", step: 10, required: false, type: "string" },
  { key: "document_style.page_margin_mm", label: "Marge (mm)", section: "document_style", step: 10, required: false, type: "number" },
];

export const PIERRE_EMPREINTE_WIZARD_STEPS: { step: number; id: string; title: string; description: string }[] = [
  { step: 1, id: "identity", title: "Identité de Pierre", description: "Personnalisez le nom et le profil de Pierre pour votre entreprise." },
  { step: 2, id: "hr_scope", title: "Périmètre RH", description: "Définissez les domaines RH que Pierre doit gérer." },
  { step: 3, id: "workflow_rules", title: "Règles de workflow", description: "Configurez les règles de gestion des missions et tâches." },
  { step: 4, id: "document_rules", title: "Règles documentaires", description: "Ton, validation humaine et types de documents." },
  { step: 5, id: "email_rules", title: "Règles email", description: "Mode d'envoi, approbations et sécurité des emails." },
  { step: 6, id: "sensitive_cases", title: "Cas sensibles", description: "Protocole pour les situations RH sensibles." },
  { step: 7, id: "autonomy", title: "Autonomie & IA", description: "Mode IA, niveau de confiance et limites d'automatisation." },
  { step: 8, id: "hr_modules", title: "Modules RH", description: "Activez recrutement, onboarding et gestion des absences." },
  { step: 9, id: "prepayroll", title: "Pré-paie", description: "Intégration paie et paramètres de cycle." },
  { step: 10, id: "document_style", title: "Style documentaire", description: "Couleurs, polices et identité visuelle des documents." },
];
