// src/lib/pierre/files/classify-hr-file.ts
// B34 — Pierre HR classification bridge. Pure, no async.

import type { CloneFileRecord, FileExtractionResult, FileClassificationResult, HrFileCategory, FileRiskLevel } from "../../cloneos/files/types";
import { classifyHrFile } from "../../cloneos/files/classification";

// Pierre escalates risk for specific categories that require human oversight
const PIERRE_HIGH_RISK_CATEGORIES: HrFileCategory[] = [
  "legal_sensitive",
  "sick_leave",
  "identity_document",
  "payroll_export",
  "payroll_variable",
];

const PIERRE_SENSITIVE_CATEGORIES: HrFileCategory[] = [
  "legal_sensitive",
  "sick_leave",
  "identity_document",
];

export function classifyPierreHrFile(
  fileRecord: CloneFileRecord,
  extractionResult: FileExtractionResult | null,
): FileClassificationResult {
  // Re-classify with extracted text if available
  const baseClassification = classifyHrFile({
    filename: fileRecord.original_filename,
    text: extractionResult?.preview ?? null,
    hasEmployee: !!fileRecord.related_employee_id,
    hasMission: !!fileRecord.related_mission_id,
  });

  // Pierre escalates risk for sensitive HR categories
  let risk_level: FileRiskLevel = baseClassification.risk_level;
  if (PIERRE_SENSITIVE_CATEGORIES.includes(baseClassification.category)) {
    risk_level = "sensitive";
  } else if (PIERRE_HIGH_RISK_CATEGORIES.includes(baseClassification.category) && risk_level === "medium") {
    risk_level = "high";
  }

  const warnings = [...baseClassification.warnings];
  if (risk_level !== baseClassification.risk_level) {
    warnings.push(`Pierre a escaladé le niveau de risque de "${baseClassification.risk_level}" à "${risk_level}" pour la catégorie "${baseClassification.category}".`);
  }

  return {
    ...baseClassification,
    risk_level,
    warnings,
  };
}
