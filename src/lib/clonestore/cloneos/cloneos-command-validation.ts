// TECH-08 — CloneOS Command Center — Validation
// 25 règles de validation pour le pipeline CloneOS.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSClassifiedCommand,
  CloneOSEmployeeRoute,
  CloneOSMissionPlan,
  CloneOSCommandCenterResult,
  CloneOSCommandValidationIssue,
  CloneOSCommandValidationReport,
} from "./cloneos-command-types";

// ── Helper ────────────────────────────────────────────────────────────────────

function issue(
  code: string,
  field: string,
  message: string,
  severity: "error" | "warning" | "info",
): CloneOSCommandValidationIssue {
  return { code, field, message, severity };
}

// ── Validation input ──────────────────────────────────────────────────────────

export function validateCloneOSCommandInput(
  input: CloneOSCommandInput,
): CloneOSCommandValidationIssue[] {
  const issues: CloneOSCommandValidationIssue[] = [];

  // CV01 : company_id non vide
  if (!input.company_id?.trim()) {
    issues.push(issue("CV01", "company_id", "company_id est requis.", "error"));
  }

  // CV02 : raw_request non vide
  if (!input.raw_request?.trim()) {
    issues.push(issue("CV02", "raw_request", "La demande brute ne peut pas être vide.", "error"));
  }

  // CV03 : source valide
  const validSources = [
    "clonechat", "employee_page", "pierre_cockpit",
    "profile_command_center", "api", "system",
  ];
  if (!validSources.includes(input.source)) {
    issues.push(issue("CV03", "source", `Source "${input.source}" invalide.`, "error"));
  }

  // CV04 : raw_request ne doit pas contenir 'public launch ready'
  const lowerReq = (input.raw_request ?? "").toLowerCase();
  if (lowerReq.includes("public launch ready")) {
    issues.push(issue("CV04", "raw_request", "La demande ne doit pas contenir 'public launch ready'.", "error"));
  }

  return issues;
}

// ── Validation classified ─────────────────────────────────────────────────────

export function validateCloneOSClassifiedCommand(
  classified: CloneOSClassifiedCommand,
): CloneOSCommandValidationIssue[] {
  const issues: CloneOSCommandValidationIssue[] = [];

  // CV05 : command_id non vide
  if (!classified.command_id?.trim()) {
    issues.push(issue("CV05", "command_id", "command_id est requis après normalisation.", "error"));
  }

  // CV06 : domain valide
  const validDomains = [
    "hr", "support", "finance", "admin", "legal", "sales",
    "marketing", "ops", "engineering", "general", "unknown",
  ];
  if (!validDomains.includes(classified.domain)) {
    issues.push(issue("CV06", "domain", `Domaine "${classified.domain}" invalide.`, "error"));
  }

  // CV07 : intent valide
  const validIntents = [
    "ask_information", "create_document", "prepare_email", "send_email",
    "create_task", "update_memory", "analyze_file", "plan_followup",
    "hr_operation", "support_operation", "finance_operation", "admin_operation", "unknown",
  ];
  if (!validIntents.includes(classified.intent)) {
    issues.push(issue("CV07", "intent", `Intent "${classified.intent}" invalide.`, "error"));
  }

  // CV08 : confidence entre 0 et 1
  if (typeof classified.confidence !== "number" || classified.confidence < 0 || classified.confidence > 1) {
    issues.push(issue("CV08", "confidence", "confidence doit être entre 0.0 et 1.0.", "error"));
  }

  return issues;
}

// ── Validation route ──────────────────────────────────────────────────────────

export function validateCloneOSEmployeeRoute(
  route: CloneOSEmployeeRoute,
): CloneOSCommandValidationIssue[] {
  const issues: CloneOSCommandValidationIssue[] = [];

  // CV09 : si route disponible, employee_slug non vide
  if (route.is_available && !route.employee_slug?.trim()) {
    issues.push(issue("CV09", "employee_slug", "employee_slug requis si route disponible.", "error"));
  }

  // CV10 : ne pas router vers un employé inconnu
  const knownEmployees = ["pierre", ""];
  if (route.employee_slug && !knownEmployees.includes(route.employee_slug)) {
    // Vérification loose — le registry est la source de vérité
    // Si l'employé n'est pas dans la liste connue, warning
    issues.push(issue(
      "CV10", "employee_slug",
      `Employé "${route.employee_slug}" inconnu du registry. Vérifier la déclaration.`,
      "warning",
    ));
  }

  // CV11 : Pierre uniquement pour HR en V1
  if (route.employee_slug === "pierre" && route.domain !== "hr") {
    issues.push(issue(
      "CV11", "domain",
      "Pierre est l'employé RH — son domaine doit être 'hr'.",
      "warning",
    ));
  }

  return issues;
}

// ── Validation plan ───────────────────────────────────────────────────────────

export function validateCloneOSMissionPlan(
  plan: CloneOSMissionPlan,
): CloneOSCommandValidationIssue[] {
  const issues: CloneOSCommandValidationIssue[] = [];

  // CV12 : tâches non vides si route disponible
  if (plan.employee_slug && plan.employee_slug !== "system" && plan.tasks.length === 0) {
    issues.push(issue("CV12", "tasks", "Le plan de mission doit contenir au moins une tâche.", "warning"));
  }

  // CV13 : chaque tâche a un action_type
  for (const task of plan.tasks) {
    if (!task.action_type?.trim()) {
      issues.push(issue("CV13", "task.action_type", `La tâche "${task.task_id}" n'a pas d'action_type.`, "error"));
    }
  }

  // CV14 : chaque tâche a un risk_level
  const validRisks = ["low", "medium", "high", "critical"];
  for (const task of plan.tasks) {
    if (!validRisks.includes(task.risk_level)) {
      issues.push(issue("CV14", "task.risk_level", `La tâche "${task.task_id}" a un risk_level invalide.`, "error"));
    }
  }

  // CV15 : tâches critiques requirent validation
  for (const task of plan.tasks) {
    if (task.risk_level === "critical" && !task.requires_validation) {
      issues.push(issue(
        "CV15", "task.requires_validation",
        `La tâche critique "${task.task_id}" doit avoir requires_validation=true.`,
        "error",
      ));
    }
  }

  // CV16 : actions légales/paie/licenciement/signature ne peuvent pas s'auto-exécuter
  const absoluteActions = [
    "legal_decision", "payroll_execution", "termination_decision", "contract_signature",
  ];
  for (const task of plan.tasks) {
    if (absoluteActions.includes(task.action_type) && task.can_auto_execute) {
      issues.push(issue(
        "CV16", "task.can_auto_execute",
        `L'action "${task.action_type}" ne peut jamais s'auto-exécuter.`,
        "error",
      ));
    }
  }

  return issues;
}

// ── Validation result complet ─────────────────────────────────────────────────

export function validateCloneOSCommandCenterResult(
  result: CloneOSCommandCenterResult,
): CloneOSCommandValidationIssue[] {
  const issues: CloneOSCommandValidationIssue[] = [];

  // CV17 : guard_result présent si plan présent
  if (result.mission_plan && !result.guard_result) {
    issues.push(issue("CV17", "guard_result", "guard_result requis si mission_plan présent.", "error"));
  }

  // CV18 : trace_result présent
  if (!result.trace_result) {
    issues.push(issue("CV18", "trace_result", "trace_result doit être présent.", "warning"));
  }

  // CV19 : pas de "public launch ready"
  const textToCheck = JSON.stringify(result).toLowerCase();
  if (textToCheck.includes("public launch ready")) {
    issues.push(issue("CV19", "result", "Le résultat ne doit pas contenir 'public launch ready'.", "error"));
  }

  // CV20 : pas de "conformité garantie"
  if (textToCheck.match(/conformit.* garantie|garantit.* conformit/)) {
    issues.push(issue("CV20", "result", "Ne pas affirmer une conformité garantie.", "error"));
  }

  // CV21 : pas de "zéro erreur" / "zero erreur"
  if (textToCheck.match(/z.ro erreur|zéro erreur|0 erreur/)) {
    issues.push(issue("CV21", "result", "Ne pas promettre 'zéro erreur'.", "error"));
  }

  // CV22 : no OpenAI call pattern
  if (textToCheck.includes("openai.api") || textToCheck.includes("gpt-4")) {
    issues.push(issue("CV22", "result", "Aucun appel OpenAI dans le pipeline CloneOS Command Center.", "error"));
  }

  // CV23 : no Anthropic call pattern
  if (textToCheck.includes("anthropic.api")) {
    issues.push(issue("CV23", "result", "Aucun appel Anthropic dans le pipeline CloneOS Command Center.", "error"));
  }

  // CV24 : no Stripe live
  if (textToCheck.includes("sk_live_")) {
    issues.push(issue("CV24", "result", "Aucun secret Stripe live dans le résultat.", "error"));
  }

  // CV25 : no Supabase write pattern
  if (textToCheck.includes(".insert(") || textToCheck.includes(".upsert(")) {
    issues.push(issue("CV25", "result", "Aucune écriture Supabase dans le résultat.", "error"));
  }

  return issues;
}

// ── Rapport de validation ─────────────────────────────────────────────────────

export function getCloneOSCommandValidationReport(
  result: CloneOSCommandCenterResult,
): CloneOSCommandValidationReport {
  const allIssues = validateCloneOSCommandCenterResult(result);
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}
