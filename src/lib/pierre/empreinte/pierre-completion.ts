// B44 — PierreEmpreinte completion scoring
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  PierreEmpreinte,
  PierreEmpreinteCompletion,
  PierreEmpreinteStatus,
} from "./types";

const SECTION_WEIGHTS: Record<string, number> = {
  identity: 20,
  hr_scope: 15,
  workflow_rules: 10,
  document_rules: 15,
  email_rules: 10,
  sensitive_cases: 10,
  autonomy: 10,
  recruitment: 3,
  onboarding: 3,
  absences: 2,
  prepayroll: 1,
  employee_file: 1,
};

function scoreIdentity(e: PierreEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 3;

  if (e.identity.display_name && e.identity.display_name !== "Pierre") filled++;
  if (e.identity.greeting_message) filled++;
  else missing.push("identity.greeting_message");
  if (e.identity.persona_description) filled++;
  else missing.push("identity.persona_description");

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreHrScope(e: PierreEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 2;

  if (e.hr_scope.enabled_domains.length > 0) filled++;
  if (e.hr_scope.contract_types_in_scope.length > 0) filled++;
  else missing.push("hr_scope.contract_types_in_scope");

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreWorkflowRules(e: PierreEmpreinte): { score: number; missing: string[] } {
  let filled = 0;
  const total = 2;

  if (e.workflow_rules.default_mission_language) filled++;
  if (e.workflow_rules.max_tasks_per_mission > 0) filled++;

  return { score: Math.round((filled / total) * 100), missing: [] };
}

function scoreDocumentRules(e: PierreEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 3;

  if (e.document_rules.default_tone) filled++;
  if (e.document_rules.always_require_human_for_types.length > 0) filled++;
  else missing.push("document_rules.always_require_human_for_types");
  if (e.document_rules.document_language) filled++;

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreEmailRules(e: PierreEmpreinte): { score: number; missing: string[] } {
  let filled = 0;
  const total = 2;

  if (e.email_rules.send_mode) filled++;
  if (e.email_rules.never_auto_send_domains.length > 0) filled++;

  return { score: Math.round((filled / total) * 100), missing: [] };
}

function scoreSensitiveCases(e: PierreEmpreinte): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  const total = 3;

  if (e.sensitive_cases.always_require_human) filled++;
  if (e.sensitive_cases.legal_review_required_for.length > 0) filled++;
  else missing.push("sensitive_cases.legal_review_required_for");
  if (e.sensitive_cases.confidentiality_level) filled++;

  return { score: Math.round((filled / total) * 100), missing };
}

function scoreAutonomy(e: PierreEmpreinte): { score: number; missing: string[] } {
  let filled = 0;
  const total = 3;

  if (e.autonomy.ai_mode) filled++;
  if (e.autonomy.trust_level) filled++;
  if (e.autonomy.blocked_task_types.length > 0) filled++;

  return { score: Math.round((filled / total) * 100), missing: [] };
}

function scoreSimpleSection(enabled: boolean): { score: number; missing: string[] } {
  return { score: enabled ? 80 : 50, missing: [] };
}

export function computePierreEmpreinteCompletion(
  empreinte: PierreEmpreinte,
): PierreEmpreinteCompletion {
  const sections: Record<string, { score: number; missing: string[] }> = {
    identity: scoreIdentity(empreinte),
    hr_scope: scoreHrScope(empreinte),
    workflow_rules: scoreWorkflowRules(empreinte),
    document_rules: scoreDocumentRules(empreinte),
    email_rules: scoreEmailRules(empreinte),
    sensitive_cases: scoreSensitiveCases(empreinte),
    autonomy: scoreAutonomy(empreinte),
    recruitment: scoreSimpleSection(empreinte.recruitment.enabled),
    onboarding: scoreSimpleSection(empreinte.onboarding.enabled),
    absences: scoreSimpleSection(empreinte.absences.enabled),
    prepayroll: scoreSimpleSection(empreinte.prepayroll.enabled),
    employee_file: scoreSimpleSection(empreinte.employee_file.enabled),
  };

  let weightedScore = 0;
  const allMissing: string[] = [];
  const filledSections: string[] = [];
  const emptySections: string[] = [];

  for (const [key, result] of Object.entries(sections)) {
    const weight = SECTION_WEIGHTS[key] ?? 0;
    weightedScore += (result.score / 100) * weight;
    allMissing.push(...result.missing);
    if (result.score >= 70) filledSections.push(key);
    else emptySections.push(key);
  }

  const score = Math.round(weightedScore);
  const status = derivePierreStatus(score);
  const canActivate = score >= 50;

  const recommendations: string[] = [];
  if (allMissing.includes("identity.greeting_message")) {
    recommendations.push("Personnalisez le message d'accueil de Pierre.");
  }
  if (allMissing.includes("document_rules.always_require_human_for_types")) {
    recommendations.push("Définissez les types de documents nécessitant une validation humaine.");
  }
  if (allMissing.includes("sensitive_cases.legal_review_required_for")) {
    recommendations.push("Précisez les cas sensibles nécessitant une revue juridique.");
  }

  const identityReady = sections.identity.score >= 60;
  const hrScopeReady = sections.hr_scope.score >= 70;
  const workflowReady = sections.workflow_rules.score >= 80;
  const documentReady = sections.document_rules.score >= 70;

  return {
    score,
    status,
    missing_fields: allMissing,
    recommendations,
    filled_sections: filledSections,
    empty_sections: emptySections,
    can_activate: canActivate,
    identity_ready: identityReady,
    hr_scope_ready: hrScopeReady,
    workflow_ready: workflowReady,
    document_ready: documentReady,
  };
}

function derivePierreStatus(score: number): PierreEmpreinteStatus {
  if (score === 0) return "not_configured";
  if (score < 25) return "minimal";
  if (score < 50) return "partial";
  if (score < 80) return "configured";
  return "complete";
}
