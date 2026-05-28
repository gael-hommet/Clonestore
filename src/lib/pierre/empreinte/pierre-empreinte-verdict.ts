// B44 — PierreEmpreinte verdict
// Combined enterprise + pierre readiness assessment.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  PierreEmpreinte,
  PierreEmpreinteVerdict,
  PierreEmpreinteVerdictArea,
  PierreEmpreinteVerdictLevel,
} from "./types";
import type { EnterpriseEmpreinte } from "../../clonestore/empreinte/types";

function assessIdentity(pierre: PierreEmpreinte): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];
  let score = 0;

  if (pierre.identity.display_name) score += 30;
  if (pierre.identity.greeting_message) score += 30;
  else notes.push("Message d'accueil non défini.");
  if (pierre.identity.persona_description) score += 20;
  if (pierre.completion.identity_ready) score = Math.max(score, 60);

  return { area: "identity", ready: score >= 60, score, blocking_issues: blocking, notes };
}

function assessHrScope(pierre: PierreEmpreinte): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];
  let score = 0;

  if (pierre.hr_scope.enabled_domains.length > 0) score += 50;
  else blocking.push("Aucun domaine RH activé.");
  if (pierre.hr_scope.contract_types_in_scope.length > 0) score += 50;

  return { area: "hr_scope", ready: blocking.length === 0, score, blocking_issues: blocking, notes };
}

function assessDocuments(pierre: PierreEmpreinte): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];
  let score = 0;

  if (pierre.document_rules.default_tone) score += 30;
  if (pierre.document_rules.always_require_human_for_types.length > 0) score += 40;
  else blocking.push("Aucun type de document avec validation humaine défini.");
  if (pierre.document_rules.document_language) score += 30;

  return { area: "documents", ready: blocking.length === 0, score, blocking_issues: blocking, notes };
}

function assessSensitivity(pierre: PierreEmpreinte): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];
  let score = 50; // default — has safe defaults

  if (!pierre.sensitive_cases.always_require_human) {
    blocking.push("Les cas sensibles doivent toujours requérir une validation humaine.");
    score -= 30;
  } else {
    score += 30;
  }
  if (!pierre.sensitive_cases.hr_manager_must_validate) {
    notes.push("La validation par le manager RH n'est pas requise.");
  } else {
    score += 20;
  }

  return { area: "sensitivity", ready: blocking.length === 0, score: Math.max(0, score), blocking_issues: blocking, notes };
}

function assessAutonomy(pierre: PierreEmpreinte): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];
  let score = 0;

  if (pierre.autonomy.ai_mode === "off") {
    score += 70; // fully manual is safe
    notes.push("Mode IA désactivé — Pierre fonctionne en mode assisté déterministe.");
  } else {
    score += 40;
  }

  if (pierre.autonomy.blocked_task_types.includes("email.send")) score += 30;
  else blocking.push("email.send doit être dans les tâches bloquées.");

  if (pierre.email_rules.send_mode === "live_auto") {
    blocking.push("Mode live_auto désactive toute validation humaine pour les emails.");
  }

  return { area: "autonomy", ready: blocking.length === 0, score: Math.min(100, score), blocking_issues: blocking, notes };
}

function assessEmail(pierre: PierreEmpreinte): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];
  let score = 0;

  if (pierre.email_rules.send_mode !== "live_auto") score += 50;
  else blocking.push("Mode live_auto est interdit — risque d'envoi non contrôlé.");

  if (pierre.email_rules.never_auto_send_domains.length > 0) score += 30;
  if (pierre.email_rules.send_mode === "mock" || pierre.email_rules.send_mode === "draft_only") score += 20;
  else notes.push("Mode live actif — assurer que les domaines sensibles sont exclus.");

  return { area: "email", ready: blocking.length === 0, score: Math.min(100, score), blocking_issues: blocking, notes };
}

function assessEnterprise(enterprise: EnterpriseEmpreinte | null): PierreEmpreinteVerdictArea {
  const blocking: string[] = [];
  const notes: string[] = [];

  if (!enterprise) {
    return { area: "enterprise", ready: false, score: 0, blocking_issues: ["Empreinte Entreprise non configurée."], notes };
  }

  const score = enterprise.completion.score;
  if (score < 30) {
    blocking.push("Empreinte Entreprise trop incomplète (<30%).");
  }
  if (!enterprise.company_identity.legal_name && !enterprise.company_identity.trade_name) {
    notes.push("Nom de l'entreprise non renseigné.");
  }

  return { area: "enterprise", ready: blocking.length === 0, score, blocking_issues: blocking, notes };
}

export function buildPierreEmpreinteVerdict(params: {
  pierre: PierreEmpreinte;
  enterprise: EnterpriseEmpreinte | null;
}): PierreEmpreinteVerdict {
  const { pierre, enterprise } = params;
  const now = new Date().toISOString();

  const areas: PierreEmpreinteVerdictArea[] = [
    assessIdentity(pierre),
    assessHrScope(pierre),
    assessDocuments(pierre),
    assessSensitivity(pierre),
    assessAutonomy(pierre),
    assessEmail(pierre),
    assessEnterprise(enterprise),
  ];

  const allBlocking = areas.flatMap((a) => a.blocking_issues);
  const enterpriseScore = enterprise?.completion.score ?? 0;
  const pierreScore = pierre.completion.score;
  const overallScore = Math.round((enterpriseScore * 0.4) + (pierreScore * 0.6));

  const recommendations: string[] = [];
  for (const area of areas) {
    if (!area.ready) {
      recommendations.push(...area.blocking_issues);
    }
    recommendations.push(...area.notes);
  }

  const level = derivePierreVerdictLevel(overallScore, allBlocking);
  const safeToActivate = allBlocking.length === 0 && overallScore >= 50;

  return {
    level,
    overall_score: overallScore,
    safe_to_activate: safeToActivate,
    areas,
    blocking_issues: allBlocking,
    recommendations: [...new Set(recommendations)].slice(0, 10),
    enterprise_completion: enterpriseScore,
    pierre_completion: pierreScore,
    generated_at: now,
  };
}

function derivePierreVerdictLevel(
  score: number,
  blocking: string[],
): PierreEmpreinteVerdictLevel {
  if (blocking.length > 0) return "not_ready";
  if (score < 40) return "not_ready";
  if (score < 60) return "minimal_viable";
  if (score < 80) return "production_ready";
  return "fully_configured";
}
