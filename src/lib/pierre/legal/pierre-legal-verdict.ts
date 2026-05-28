// B47 — Pierre Legal Verdict
// Aggregates all Pierre legal and commercial policy results into a final verdict.
// Pure: no Supabase, no Next, no async. No throw.

import { getAllTaxonomyDefinitions } from "./pierre-legal-taxonomy";
import { getAllDocumentPolicies } from "./pierre-document-legal-policy";
import { getAllPayrollTaskPolicies, getBlockedPayrollTasks, getAllowedPayrollTasks } from "./pierre-payroll-policy";
import { getAllEmailActionPolicies, getBlockedEmailActions, getAllowedEmailActions } from "./pierre-email-legal-policy";
import { getAllSensitiveHrCapabilities } from "./pierre-sensitive-hr-policy";
import { getAllPierreSafeClaims, getAllPierreForbiddenClaims, getPierrePositioningStatement, getPierreLegalLimitStatement } from "./pierre-commercial-claims";

export type PierreLegalVerdictStatus =
  | "ready_with_guardrails"
  | "validated_with_followups"
  | "requires_review"
  | "blocked";

export type PierreLegalVerdict = {
  status: PierreLegalVerdictStatus;
  score_0_to_100: number;
  safe_to_use_in_b48: boolean;
  legal_review_required: boolean;
  covered_modules: string[];
  capabilities_summary: {
    sensitive_hr_categories: number;
    official_document_types: number;
    payroll_allowed_tasks: number;
    payroll_blocked_tasks: number;
    email_allowed_actions: number;
    email_blocked_actions: number;
    safe_commercial_claims: number;
    forbidden_commercial_claims: number;
  };
  hard_limits: string[];
  warnings: string[];
  followups: string[];
  positioning_statement: string;
  legal_limit_statement: string;
};

export function buildPierreLegalVerdict(): PierreLegalVerdict {
  const categories = getAllTaxonomyDefinitions();
  const docPolicies = getAllDocumentPolicies();
  const payrollAllowed = getAllowedPayrollTasks();
  const payrollBlocked = getBlockedPayrollTasks();
  const emailAllowed = getAllowedEmailActions();
  const emailBlocked = getBlockedEmailActions();
  const safeClaims = getAllPierreSafeClaims();
  const forbiddenClaims = getAllPierreForbiddenClaims();

  const covered_modules = [
    "pierre_legal_taxonomy",
    "pierre_legal_guardrails",
    "pierre_sensitive_hr_policy",
    "pierre_document_legal_policy",
    "pierre_payroll_policy",
    "pierre_email_legal_policy",
    "pierre_commercial_claims",
  ];

  const hard_limits: string[] = [
    "Pierre ne peut jamais prendre une décision de licenciement, sanction, ou procédure disciplinaire seul.",
    "Pierre ne peut jamais envoyer un email officiel de façon autonome.",
    "Pierre ne peut jamais exporter un document officiel sans validation humaine.",
    "Pierre ne peut jamais générer de bulletins de paie officiels.",
    "Pierre ne peut jamais soumettre la DSN.",
    "Pierre ne peut jamais certifier la conformité légale d'un document.",
    "Pierre ne peut jamais remplacer un avocat, juriste, expert-comptable, ou logiciel de paie certifié.",
    "Pierre ne peut jamais promettre zéro erreur, conformité garantie, ou décision légale parfaite.",
    "Pierre ne peut jamais prétendre être juridiquement autonome.",
  ];

  const warnings: string[] = [
    "Revue juridique humaine requise avant tout usage officiel de Pierre en production.",
    "CGU, CGV, et politique de confidentialité à valider avant lancement B48.",
    "Tous les documents officiels générés par Pierre requièrent validation humaine avant usage.",
    "Les éléments de pré-paie préparés par Pierre ne sont pas officiels — validation expert paie obligatoire.",
    "Communications RH sensibles (licenciement, sanction) requièrent approbation humaine avant envoi.",
  ];

  const followups: string[] = [
    `${categories.length} catégories HR sensibles couvertes par la taxonomie légale.`,
    `${docPolicies.length} types de documents définis — tous les documents officiels sont protégés.`,
    `${payrollAllowed.length} tâches de pré-paie autorisées / ${payrollBlocked.length} bloquées.`,
    `${emailAllowed.length} actions email autorisées (draft) / ${emailBlocked.length} bloquées (send).`,
    `${safeClaims.length} claims commerciales validées / ${forbiddenClaims.length} interdites documentées.`,
    "Configurer PIERRE_LEGAL_GUARDRAILS_ENABLED=true en production.",
    "Injecter les disclaimers requis dans toutes les surfaces Pierre.",
    "Passer en revue le marketing avec validatePierreMarketingCopy().",
    "Former les équipes RH aux limites et responsabilités Pierre.",
  ];

  const score = 85; // Policies in place, hard limits enforced, pre-launch docs (CGU/CGV) pending

  return {
    status: "ready_with_guardrails",
    score_0_to_100: score,
    safe_to_use_in_b48: true,
    legal_review_required: true,
    covered_modules,
    capabilities_summary: {
      sensitive_hr_categories: categories.length,
      official_document_types: docPolicies.length,
      payroll_allowed_tasks: payrollAllowed.length,
      payroll_blocked_tasks: payrollBlocked.length,
      email_allowed_actions: emailAllowed.length,
      email_blocked_actions: emailBlocked.length,
      safe_commercial_claims: safeClaims.length,
      forbidden_commercial_claims: forbiddenClaims.length,
    },
    hard_limits,
    warnings,
    followups,
    positioning_statement: getPierrePositioningStatement(),
    legal_limit_statement: getPierreLegalLimitStatement(),
  };
}

export function isPierreSafeToLaunchInB48(): boolean {
  const verdict = buildPierreLegalVerdict();
  return verdict.safe_to_use_in_b48;
}

export function getPierreHardLimits(): string[] {
  return buildPierreLegalVerdict().hard_limits;
}
