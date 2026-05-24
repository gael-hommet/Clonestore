// src/lib/pierre/files/route-file-to-pierre.ts
// B34 — Routes a received file through Pierre's decision pipeline. Pure, no async.

import type { CloneFileRecord, FileExtractionResult, FileAttachDecision } from "../../cloneos/files/types";
import type { PierreFileAttachContext } from "./types";
import { classifyPierreHrFile } from "./classify-hr-file";
import { attachFileToPierre } from "./attach-file-to-pierre";

export type PierreFileRoutingResult = {
  classification_category: string;
  classification_confidence: number;
  risk_level: string;
  attach_decision: FileAttachDecision;
  requires_validation: boolean;
  warnings: string[];
};

export function routeFileToPierre(
  fileRecord: CloneFileRecord,
  extractionResult: FileExtractionResult | null,
  context: PierreFileAttachContext,
): PierreFileRoutingResult {
  // 1. Pierre-specific classification
  const classification = classifyPierreHrFile(fileRecord, extractionResult);

  // 2. Pierre-specific attach decision
  const attachDecision = attachFileToPierre(fileRecord, classification, context);

  const requires_validation =
    attachDecision.approval_required ||
    classification.risk_level === "sensitive" ||
    classification.risk_level === "blocked" ||
    classification.risk_level === "high";

  return {
    classification_category: classification.category,
    classification_confidence: classification.confidence,
    risk_level: classification.risk_level,
    attach_decision: attachDecision,
    requires_validation,
    warnings: [...classification.warnings, ...classification.missing_info],
  };
}
