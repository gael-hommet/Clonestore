// src/lib/pierre/files/types.ts
// B34 — Pierre-specific file types. Bridges CloneOS files to Pierre's HR model.

import type { CloneFileRecord, FileExtractionResult, FileClassificationResult, FileAttachDecision } from "../../cloneos/files/types";

export type PierreFileContext = {
  file: CloneFileRecord;
  extraction: FileExtractionResult | null;
  classification: FileClassificationResult | null;
  attach_decision: FileAttachDecision | null;
  summary: string;
  hr_tags: string[];
  requires_validation: boolean;
  risk_summary: string;
};

export type PierreFileAttachContext = {
  company_id: string;
  agent_slug: string;
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;
  site_id?: string | null;
  requested_by_user_id?: string | null;
};
