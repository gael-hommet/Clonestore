// B44 — EnterpriseEmpreinte schema definitions
// Field metadata for UI rendering, validation labels, and completion tracking.
// Pure: no async, no Supabase, no Next.js, no side effects.

export interface EmpreinteFieldSchema {
  key: string;
  label: string;
  section: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "array" | "object" | "select";
  options?: string[];
  placeholder?: string;
  help?: string;
}

export const ENTERPRISE_EMPREINTE_SCHEMA: EmpreinteFieldSchema[] = [
  // company_identity
  { key: "company_identity.legal_name", label: "Raison sociale", section: "company_identity", required: true, type: "string", placeholder: "Ex: Pierre RH SAS" },
  { key: "company_identity.trade_name", label: "Nom commercial", section: "company_identity", required: false, type: "string" },
  { key: "company_identity.sector", label: "Secteur d'activité", section: "company_identity", required: true, type: "string", placeholder: "Ex: Technologie, Santé, Finance" },
  { key: "company_identity.size_range", label: "Taille de l'entreprise", section: "company_identity", required: true, type: "select", options: ["1-10","11-50","51-200","201-500","501-1000","1000+"] },
  { key: "company_identity.country_code", label: "Pays (code ISO)", section: "company_identity", required: true, type: "string", placeholder: "FR" },
  { key: "company_identity.main_language", label: "Langue principale", section: "company_identity", required: true, type: "select", options: ["fr","en","de","es","it","nl","pt"] },
  { key: "company_identity.hr_contact_email", label: "Email contact RH", section: "company_identity", required: true, type: "string", placeholder: "rh@entreprise.com" },
  { key: "company_identity.hr_contact_name", label: "Nom du contact RH", section: "company_identity", required: false, type: "string" },
  { key: "company_identity.website_url", label: "Site web", section: "company_identity", required: false, type: "string" },
  { key: "company_identity.values", label: "Valeurs de l'entreprise", section: "company_identity", required: false, type: "array" },
  { key: "company_identity.mission_statement", label: "Mission de l'entreprise", section: "company_identity", required: false, type: "string" },
  // communication
  { key: "communication.default_tone", label: "Ton par défaut", section: "communication", required: true, type: "select", options: ["formal","warm","direct","executive","neutral","legal_careful","candidate_friendly","internal_concise"] },
  { key: "communication.preferred_length", label: "Longueur préférée", section: "communication", required: true, type: "select", options: ["concise","standard","detailed","comprehensive"] },
  { key: "communication.formal_closing", label: "Formule de clôture formelle", section: "communication", required: false, type: "string", placeholder: "Ex: Veuillez agréer..." },
  { key: "communication.greeting_style", label: "Style de salutation", section: "communication", required: false, type: "string" },
  // autonomy
  { key: "autonomy.default_level", label: "Niveau d'autonomie", section: "autonomy", required: true, type: "select", options: ["manual","assist","supervised","trusted","restricted"] },
  { key: "autonomy.require_approval_above_risk", label: "Approbation requise au-dessus de", section: "autonomy", required: true, type: "select", options: ["low","medium","high","critical"] },
  // data_governance
  { key: "data_governance.gdpr_dpo_email", label: "Email DPO RGPD", section: "data_governance", required: false, type: "string" },
  { key: "data_governance.data_processing_region", label: "Région de traitement", section: "data_governance", required: false, type: "select", options: ["eu","fr","us","other"] },
  { key: "data_governance.data_retention_days", label: "Rétention des données (jours)", section: "data_governance", required: true, type: "number" },
];

export const ENTERPRISE_EMPREINTE_SECTIONS: { id: string; label: string; description: string; required: boolean }[] = [
  { id: "company_identity", label: "Identité de l'entreprise", description: "Nom, secteur, taille, langue, contact RH.", required: true },
  { id: "communication", label: "Profil de communication", description: "Ton, longueur, formules.", required: true },
  { id: "autonomy", label: "Politique d'autonomie", description: "Niveau d'autonomie de Pierre, règles d'approbation.", required: true },
  { id: "data_governance", label: "Gouvernance des données", description: "Rétention, DPO, région RGPD.", required: false },
  { id: "document_preferences", label: "Préférences documentaires", description: "Format, validation, templates.", required: false },
  { id: "memory_seed", label: "Mémoire initiale", description: "Faits clés, vocabulaire personnalisé.", required: false },
  { id: "locations", label: "Sites", description: "Bureaux et locaux de l'entreprise.", required: false },
  { id: "roles", label: "Rôles organisationnels", description: "Hiérarchie et rôles RH.", required: false },
  { id: "validation_circuits", label: "Circuits de validation", description: "Workflows d'approbation.", required: false },
  { id: "channels", label: "Canaux d'identité", description: "Email, Slack, Teams — identité visuelle.", required: false },
];
