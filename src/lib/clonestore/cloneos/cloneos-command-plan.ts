// TECH-08 — CloneOS Command Center — Command Plan Builder
// Construit un plan de mission et de tâches sans exécuter quoi que ce soit.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSClassifiedCommand,
  CloneOSEmployeeRoute,
  CloneOSCommandContext,
  CloneOSMissionPlan,
  CloneOSTaskPlan,
  CloneOSCommandIntent,
  CloneOSCommandRiskLevel,
  CloneOSMissionId,
  CloneOSTaskId,
} from "./cloneos-command-types";

// ── ID generators ─────────────────────────────────────────────────────────────

function generateMissionId(): CloneOSMissionId {
  return `mission_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateTaskId(order: number): CloneOSTaskId {
  return `task_${Date.now()}_${order}_${Math.random().toString(36).slice(2, 5)}`;
}

// ── Mappings intent → action_type ─────────────────────────────────────────────

/**
 * Mappe une intention CloneOS vers un action_type compatible CloneGuard.
 */
export function mapIntentToActionType(intent: CloneOSCommandIntent): string {
  const mapping: Record<CloneOSCommandIntent, string> = {
    ask_information: "read_context",
    create_document: "draft_document",
    prepare_email: "draft_email",
    send_email: "send_email",
    create_task: "create_task",
    update_memory: "update_memory",
    analyze_file: "read_context",
    plan_followup: "create_task",
    hr_operation: "draft_document",
    support_operation: "create_task",
    finance_operation: "read_context",
    admin_operation: "create_task",
    unknown: "read_context",
  };
  return mapping[intent] ?? "read_context";
}

/**
 * Mappe une intention vers un type d'artefact attendu.
 */
export function mapIntentToExpectedArtifact(intent: CloneOSCommandIntent): string | undefined {
  const mapping: Partial<Record<CloneOSCommandIntent, string>> = {
    create_document: "document_pdf",
    prepare_email: "email_draft",
    send_email: "email_sent_confirmation",
    hr_operation: "hr_document",
    plan_followup: "task_list",
  };
  return mapping[intent];
}

// ── Tâches par intention ──────────────────────────────────────────────────────

function buildTasksForIntent(
  intent: CloneOSCommandIntent,
  riskLevel: CloneOSCommandRiskLevel,
  context: CloneOSCommandContext,
): CloneOSTaskPlan[] {
  const actionType = mapIntentToActionType(intent);
  const baseRequiresValidation = riskLevel === "critical" || riskLevel === "high";

  // Actions absolues → toujours bloquées/refused par Guard
  const absoluteBlocked = context.guard_context.absolute_blocked_actions;
  const alwaysValidation = context.guard_context.always_validation_required;

  const isAbsoluteBlocked = absoluteBlocked.includes(actionType);
  const requiresValidation = baseRequiresValidation ||
    alwaysValidation.includes(actionType) ||
    isAbsoluteBlocked;

  switch (intent) {
    case "create_document":
    case "hr_operation": {
      const task1: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Analyse du contexte et de la demande",
        description: "Récupérer les informations nécessaires depuis CloneADN et le dossier employé.",
        action_type: "read_context",
        risk_level: "low",
        requires_validation: false,
        can_auto_execute: true,
        order: 1,
        depends_on_task_ids: [],
        expected_artifact_type: "context_summary",
      };
      const task2: CloneOSTaskPlan = {
        task_id: generateTaskId(2),
        title: "Préparation du document",
        description: "Préparer le document RH selon les règles de l'entreprise.",
        action_type: "draft_document",
        risk_level: riskLevel,
        requires_validation: requiresValidation,
        can_auto_execute: !requiresValidation,
        order: 2,
        depends_on_task_ids: [task1.task_id],
        expected_artifact_type: "document_pdf",
      };
      return [task1, task2];
    }

    case "prepare_email": {
      const task: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Rédaction du brouillon d'email",
        description: "Préparer un brouillon d'email pour validation humaine avant envoi.",
        action_type: "draft_email",
        risk_level: riskLevel,
        requires_validation: requiresValidation,
        can_auto_execute: false, // Email toujours prepare_only
        order: 1,
        depends_on_task_ids: [],
        expected_artifact_type: "email_draft",
      };
      return [task];
    }

    case "send_email": {
      // send_email → Guard soumettra à validation si risque high/critical
      const task: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Envoi d'email (soumis à validation)",
        description: "Envoi d'email soumis à validation humaine selon les règles Guard.",
        action_type: "send_email",
        risk_level: riskLevel,
        requires_validation: true, // Toujours validation pour send_email
        can_auto_execute: false,
        order: 1,
        depends_on_task_ids: [],
        expected_artifact_type: "email_sent_confirmation",
      };
      return [task];
    }

    case "update_memory": {
      const task: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Mise à jour de la mémoire entreprise",
        description: "Proposer une mise à jour de la mémoire — validation humaine requise en V1.",
        action_type: "update_memory",
        risk_level: riskLevel,
        requires_validation: true, // V1 : toujours validation pour update_memory
        can_auto_execute: false,
        order: 1,
        depends_on_task_ids: [],
      };
      return [task];
    }

    case "ask_information":
    case "analyze_file": {
      const task: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Lecture du contexte et réponse",
        description: "Accès en lecture au contexte et aux données disponibles.",
        action_type: "read_context",
        risk_level: "low",
        requires_validation: false,
        can_auto_execute: true,
        order: 1,
        depends_on_task_ids: [],
      };
      return [task];
    }

    case "plan_followup":
    case "create_task":
    case "support_operation":
    case "admin_operation": {
      const task: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Création de tâche de suivi",
        description: "Planifier un suivi ou une tâche dans le système.",
        action_type: "create_task",
        risk_level: riskLevel,
        requires_validation: riskLevel === "critical",
        can_auto_execute: riskLevel !== "critical",
        order: 1,
        depends_on_task_ids: [],
        expected_artifact_type: "task_plan",
      };
      return [task];
    }

    default: {
      const task: CloneOSTaskPlan = {
        task_id: generateTaskId(1),
        title: "Traitement de la demande",
        description: "Traitement générique de la demande.",
        action_type: "read_context",
        risk_level: riskLevel,
        requires_validation: requiresValidation,
        can_auto_execute: !requiresValidation,
        order: 1,
        depends_on_task_ids: [],
      };
      return [task];
    }
  }
}

// ── Plan bloqué ───────────────────────────────────────────────────────────────

/**
 * Construit un plan bloqué (quand Guard refuse l'action).
 */
export function buildBlockedPlan(
  reason: string,
  employeeSlug?: string,
): CloneOSMissionPlan {
  return {
    mission_id: generateMissionId(),
    title: "Action bloquée",
    description: reason,
    employee_slug: employeeSlug ?? "system",
    domain: "unknown",
    intent: "unknown",
    priority: "normal",
    risk_level: "critical",
    tasks: [],
    missing_information: [],
    validation_required: false,
    expected_outputs: [],
    plan_notes: [reason],
  };
}

// ── Calcul validation ─────────────────────────────────────────────────────────

/**
 * Détermine si le plan global requiert une validation humaine.
 */
export function calculatePlanValidationRequirement(tasks: CloneOSTaskPlan[]): boolean {
  return tasks.some((t) => t.requires_validation);
}

// ── Builders ──────────────────────────────────────────────────────────────────

/**
 * Construit les tâches pour une commande.
 */
export function buildTaskPlansForCommand(
  classified: CloneOSClassifiedCommand,
  route: CloneOSEmployeeRoute,
  context: CloneOSCommandContext,
): CloneOSTaskPlan[] {
  if (!route.is_available) return [];
  return buildTasksForIntent(classified.intent, classified.risk_level, context);
}

/**
 * Construit le plan de mission.
 */
export function buildMissionPlanForCommand(
  classified: CloneOSClassifiedCommand,
  route: CloneOSEmployeeRoute,
  context: CloneOSCommandContext,
): CloneOSMissionPlan {
  if (!route.is_available) {
    return buildBlockedPlan(
      route.route_reason || "Aucun employé disponible pour cette commande.",
      route.employee_slug || "system",
    );
  }

  const tasks = buildTaskPlansForCommand(classified, route, context);
  const validationRequired = calculatePlanValidationRequirement(tasks);
  const expectedArtifact = mapIntentToExpectedArtifact(classified.intent);

  const missingInfo: string[] = [];
  if (!context.enterprise_memory_context.has_enterprise_memory) {
    missingInfo.push("Mémoire entreprise non configurée — contexte générique utilisé.");
  }

  return {
    mission_id: generateMissionId(),
    title: `Mission : ${classified.summary}`,
    description: classified.summary,
    employee_slug: route.employee_slug,
    domain: classified.domain,
    intent: classified.intent,
    priority: classified.priority,
    risk_level: classified.risk_level,
    tasks,
    missing_information: missingInfo,
    validation_required: validationRequired,
    expected_outputs: expectedArtifact ? [expectedArtifact] : [],
    plan_notes: [
      ...classified.classification_notes,
      ...route.route_warnings,
    ],
  };
}

/**
 * Construit le plan complet de la commande.
 */
export function buildCloneOSCommandPlan(
  input: CloneOSCommandInput,
  classified: CloneOSClassifiedCommand,
  route: CloneOSEmployeeRoute,
  context: CloneOSCommandContext,
): CloneOSMissionPlan {
  void input; // pas d'utilisation directe — contexte déjà enrichi
  return buildMissionPlanForCommand(classified, route, context);
}
