// src/lib/pierre/files/attach-file-to-pierre.ts
// B34 — Pierre-specific file attachment. Pure, no async.

import type { CloneFileRecord, FileClassificationResult, FileAttachDecision, HrFileCategory } from "../../cloneos/files/types";
import type { PierreFileAttachContext } from "./types";

// Pierre always requires approval for these categories
const PIERRE_APPROVAL_REQUIRED_CATEGORIES: HrFileCategory[] = [
  "legal_sensitive",
  "sick_leave",
  "identity_document",
  "contract",
  "amendment",
  "payroll_export",
  "payroll_variable",
  "offboarding_document",
];

export function attachFileToPierre(
  fileRecord: CloneFileRecord,
  classification: FileClassificationResult,
  context: PierreFileAttachContext,
): FileAttachDecision {
  // Sensitive/blocked always go to block_sensitive
  if (classification.risk_level === "sensitive" || classification.risk_level === "blocked") {
    return {
      action: "block_sensitive",
      related_mission_id: context.mission_id ?? null,
      related_task_id: context.task_id ?? null,
      related_employee_id: context.employee_id ?? null,
      reason: `Document sensible ("${classification.category}", risque "${classification.risk_level}") — validation humaine obligatoire.`,
      approval_required: true,
    };
  }

  const approval_required = PIERRE_APPROVAL_REQUIRED_CATEGORIES.includes(classification.category);

  // Attach to task if task_id provided
  if (context.task_id) {
    return {
      action: "attach_to_task",
      related_mission_id: context.mission_id ?? null,
      related_task_id: context.task_id,
      related_employee_id: context.employee_id ?? null,
      reason: `Rattaché à la tâche Pierre "${context.task_id}".`,
      approval_required,
    };
  }

  // Attach to mission if mission_id provided
  if (context.mission_id) {
    return {
      action: "attach_to_mission",
      related_mission_id: context.mission_id,
      related_task_id: null,
      related_employee_id: context.employee_id ?? null,
      reason: `Rattaché à la mission Pierre "${context.mission_id}".`,
      approval_required,
    };
  }

  // Attach to employee if employee_id provided
  if (context.employee_id) {
    return {
      action: "attach_to_employee",
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: context.employee_id,
      reason: `Rattaché au dossier salarié "${context.employee_id}".`,
      approval_required,
    };
  }

  // No context — create mission for actionable categories
  const ACTIONABLE: HrFileCategory[] = ["cv", "contract", "amendment", "sick_leave", "absence_proof", "offboarding_document", "interview_report"];
  if (ACTIONABLE.includes(classification.category)) {
    return {
      action: "create_new_mission",
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      reason: `Catégorie "${classification.category}" détectée sans contexte — Pierre doit créer une mission.`,
      approval_required,
    };
  }

  // Default: ask for more info
  return {
    action: "ask_for_more_info",
    related_mission_id: null,
    related_task_id: null,
    related_employee_id: null,
    reason: `Catégorie "${classification.category}" sans contexte suffisant — informations complémentaires requises.`,
    approval_required: false,
  };
}
