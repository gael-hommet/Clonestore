// B45 — Pierre document style types
// Pure types: no Next.js, no Supabase, no async, no side effects.

import type { DocumentRenderResult, DocumentQualityResult } from "../../clonestore/document-style-kit/types";

export type PierreDocumentStatus =
  | "draft"
  | "ready"
  | "pending_validation"
  | "validated"
  | "sent"
  | "blocked";

export interface PierreDocumentMissionContext {
  mission_id: string | null;
  task_id: string | null;
  employee_name: string | null;
  employee_id: string | null;
  mission_title: string | null;
  extra_variables: Record<string, unknown>;
}

export interface PierreDocumentBuildInput {
  template_id: string;
  variables: Record<string, unknown>;
  mission_context?: PierreDocumentMissionContext | null;
  user_id: string;
  enterprise_id?: string | null;
}

export interface PierreDocumentBuildResult {
  ok: boolean;
  render_result: DocumentRenderResult | null;
  quality: DocumentQualityResult | null;
  status: PierreDocumentStatus;
  verdict_message: string;
  ready_for_export: boolean;
  errors: string[];
}

export interface PierreDocumentVerdictArea {
  name: string;
  passed: boolean;
  score: number;
  message: string;
}

export interface PierreDocumentVerdict {
  overall_score: number;
  passed: boolean;
  level: "poor" | "acceptable" | "good" | "premium";
  areas: PierreDocumentVerdictArea[];
  blocking_issues: string[];
  recommendations: string[];
  anti_chatgpt_passed: boolean;
  enterprise_identity_passed: boolean;
  structure_passed: boolean;
  safety_passed: boolean;
}
