// src/lib/cloneos/files/attachment.ts
// B34 — File attachment decision logic. Pure, no async.

import type { CloneFileRecord, FileClassificationResult, FileAttachDecision, HrFileCategory } from "./types";

// Categories that should trigger a new mission when no context is given
const MISSION_TRIGGERING_CATEGORIES: HrFileCategory[] = [
  "cv",
  "contract",
  "amendment",
  "sick_leave",
  "absence_proof",
  "offboarding_document",
  "legal_sensitive",
  "interview_report",
];

// Categories that just need to be archived or linked to a template
const ARCHIVE_ONLY_CATEGORIES: HrFileCategory[] = [
  "policy",
  "procedure",
  "training_document",
  "other",
];

export function buildFileAttachDecision(params: {
  fileRecord: CloneFileRecord;
  classification: FileClassificationResult;
  missionId?: string | null;
  taskId?: string | null;
  employeeId?: string | null;
}): FileAttachDecision {
  const { fileRecord, classification, missionId, taskId, employeeId } = params;

  // Always block sensitive/blocked risk levels
  if (classification.risk_level === "sensitive" || classification.risk_level === "blocked") {
    return {
      action: "block_sensitive",
      related_mission_id: missionId ?? null,
      related_task_id: taskId ?? null,
      related_employee_id: employeeId ?? null,
      reason: `Document à risque "${classification.risk_level}" — validation humaine obligatoire avant rattachement.`,
      approval_required: true,
    };
  }

  // If task ID provided, attach to task
  if (taskId) {
    return {
      action: "attach_to_task",
      related_mission_id: missionId ?? fileRecord.related_mission_id,
      related_task_id: taskId,
      related_employee_id: employeeId ?? fileRecord.related_employee_id,
      reason: `Rattaché à la tâche fournie.`,
      approval_required: false,
    };
  }

  // If mission ID provided, attach to mission
  if (missionId) {
    return {
      action: "attach_to_mission",
      related_mission_id: missionId,
      related_task_id: null,
      related_employee_id: employeeId ?? fileRecord.related_employee_id,
      reason: `Rattaché à la mission fournie.`,
      approval_required: false,
    };
  }

  // If employee ID provided without mission, attach to employee
  if (employeeId) {
    return {
      action: "attach_to_employee",
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: employeeId,
      reason: `Rattaché au dossier salarié fourni.`,
      approval_required: false,
    };
  }

  // Archive-only categories with no context
  if (ARCHIVE_ONLY_CATEGORIES.includes(classification.category)) {
    return {
      action: "archive_only",
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      reason: `Catégorie "${classification.category}" archivée sans rattachement spécifique.`,
      approval_required: false,
    };
  }

  // Mission-triggering categories with no context → ask or create mission
  if (MISSION_TRIGGERING_CATEGORIES.includes(classification.category)) {
    // Low confidence → ask for more info
    if (classification.confidence < 0.5) {
      return {
        action: "ask_for_more_info",
        related_mission_id: null,
        related_task_id: null,
        related_employee_id: null,
        reason: `Catégorie "${classification.category}" détectée avec faible confiance (${Math.round(classification.confidence * 100)}%) — contexte supplémentaire requis.`,
        approval_required: false,
      };
    }

    return {
      action: "create_new_mission",
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      reason: `Catégorie "${classification.category}" actionnable sans contexte fourni — création de mission recommandée.`,
      approval_required: false,
    };
  }

  // Default: ask for more info if no context
  return {
    action: "ask_for_more_info",
    related_mission_id: null,
    related_task_id: null,
    related_employee_id: null,
    reason: `Aucun contexte fourni pour la catégorie "${classification.category}" — informations supplémentaires requises.`,
    approval_required: false,
  };
}
