// B44 — EnterpriseEmpreinte completion scoring
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  EnterpriseEmpreinte,
  EmpreinteCompletion,
  EmpreinteStatus,
} from "./types";

// Weights per section (total = 100)
const SECTION_WEIGHTS: Record<string, number> = {
  company_identity: 30,
  communication: 15,
  autonomy: 15,
  data_governance: 10,
  document_preferences: 10,
  memory_seed: 5,
  locations: 5,
  roles: 5,
  validation_circuits: 5,
};

function scoreCompanyIdentity(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 8;

  if (e.company_identity.legal_name || e.company_identity.trade_name) filled++;
  else missing.push("company_identity.legal_name");

  if (e.company_identity.sector) filled++;
  else missing.push("company_identity.sector");

  if (e.company_identity.size_range) filled++;
  else missing.push("company_identity.size_range");

  if (e.company_identity.country_code) filled++;
  else missing.push("company_identity.country_code");

  if (e.company_identity.hr_contact_email) filled++;
  else missing.push("company_identity.hr_contact_email");

  if (e.company_identity.main_language) filled++;

  if (e.company_identity.values.length > 0) filled++;
  else missing.push("company_identity.values");

  if (e.company_identity.mission_statement) filled++;

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreCommunication(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 4;

  if (e.communication.default_tone) filled++;
  if (e.communication.preferred_length) filled++;
  if (e.communication.language_code) filled++;
  if (e.communication.formal_closing) filled++;
  else missing.push("communication.formal_closing");

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreAutonomy(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 3;

  if (e.autonomy.default_level) filled++;
  if (e.autonomy.require_approval_above_risk) filled++;
  if (e.autonomy.never_auto_execute.length > 0) filled++;
  else missing.push("autonomy.never_auto_execute");

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreDataGovernance(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 3;

  if (e.data_governance.data_retention_days > 0) filled++;
  if (e.data_governance.gdpr_dpo_email) filled++;
  else missing.push("data_governance.gdpr_dpo_email");
  if (e.data_governance.data_processing_region) filled++;

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreDocumentPreferences(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  let filled = 0;
  const total = 3;

  if (e.document_preferences.preferred_format) filled++;
  if (e.document_preferences.document_language) filled++;
  if (e.document_preferences.require_validation_for_risk_levels.length > 0) filled++;

  return { score: Math.round((filled / total) * 100), missing: [] };
}

function scoreMemorySeed(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 2;

  if (e.memory_seed.key_facts.length > 0) filled++;
  else missing.push("memory_seed.key_facts");
  if (e.memory_seed.preferred_workflows.length > 0) filled++;

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreLocations(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  if (e.locations.length > 0) return { score: 100, missing: [] };
  return { score: 0, missing: ["locations"] };
}

function scoreRoles(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  if (e.roles.length > 0) return { score: 100, missing: [] };
  return { score: 0, missing: ["roles"] };
}

function scoreValidationCircuits(e: EnterpriseEmpreinte): { score: number; missing: string[] } {
  if (e.validation_circuits.length > 0) return { score: 100, missing: [] };
  return { score: 0, missing: [] }; // optional — no penalty
}

export function computeEnterpriseEmpreinteCompletion(
  empreinte: EnterpriseEmpreinte,
): EmpreinteCompletion {
  const sections: Record<string, { score: number; missing: string[] }> = {
    company_identity: scoreCompanyIdentity(empreinte),
    communication: scoreCommunication(empreinte),
    autonomy: scoreAutonomy(empreinte),
    data_governance: scoreDataGovernance(empreinte),
    document_preferences: scoreDocumentPreferences(empreinte),
    memory_seed: scoreMemorySeed(empreinte),
    locations: scoreLocations(empreinte),
    roles: scoreRoles(empreinte),
    validation_circuits: scoreValidationCircuits(empreinte),
  };

  let weightedScore = 0;
  const allMissing: string[] = [];
  const filledSections: string[] = [];
  const emptySections: string[] = [];

  for (const [key, result] of Object.entries(sections)) {
    const weight = SECTION_WEIGHTS[key] ?? 0;
    weightedScore += (result.score / 100) * weight;
    allMissing.push(...result.missing);
    if (result.score >= 80) filledSections.push(key);
    else emptySections.push(key);
  }

  const score = Math.round(weightedScore);
  const status = deriveStatus(score);
  const canActivate = score >= 60;

  const recommendations: string[] = [];
  if (allMissing.includes("company_identity.legal_name")) {
    recommendations.push("Renseignez le nom légal de l'entreprise.");
  }
  if (allMissing.includes("company_identity.hr_contact_email")) {
    recommendations.push("Ajoutez l'email du contact RH.");
  }
  if (allMissing.includes("data_governance.gdpr_dpo_email")) {
    recommendations.push("Désignez un DPO RGPD pour la gouvernance des données.");
  }
  if (allMissing.includes("autonomy.never_auto_execute")) {
    recommendations.push("Définissez les actions jamais auto-exécutées.");
  }

  return {
    score,
    status,
    missing_fields: allMissing,
    recommendations,
    filled_sections: filledSections,
    empty_sections: emptySections,
    can_activate: canActivate,
  };
}

function deriveStatus(score: number): EmpreinteStatus {
  if (score === 0) return "not_configured";
  if (score < 30) return "minimal";
  if (score < 60) return "partial";
  if (score < 85) return "configured";
  return "complete";
}
