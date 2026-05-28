// B45 — Pierre document context builder
// Integrates B44 empreinte data with B45 style kit and template.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { PierreEmpreinte } from "../empreinte/types";
import type { EnterpriseEmpreinte } from "../../clonestore/empreinte/types";
import type { DocumentRenderContext } from "../../clonestore/document-style-kit/types";
import { buildPierreDocumentRenderConfig, buildDocumentVariablesFromEmpreinte } from "../empreinte/pierre-document-prep";
import { createDefaultDocumentStyleKit } from "../../clonestore/document-style-kit/defaults";
import { getB45TemplateById } from "../../clonestore/document-style-kit/template-registry";
import type { PierreDocumentMissionContext } from "./pierre-document-types";
import { mergeVariables } from "../../clonestore/document-style-kit/tokens";

// ── Build Pierre document context ─────────────────────────────────────────────

export function buildPierreDocumentContext(params: {
  enterprise: EnterpriseEmpreinte | null;
  pierre: PierreEmpreinte | null;
  templateId: string;
  variables: Record<string, unknown>;
  userId: string;
  missionContext?: PierreDocumentMissionContext | null;
}): DocumentRenderContext | null {
  const { enterprise, pierre, templateId, variables, userId, missionContext } = params;

  const template = getB45TemplateById(templateId);
  if (!template) return null;

  // Build style kit from B44 empreinte
  const styleKit = createDefaultDocumentStyleKit({
    user_id: userId,
    enterprise: enterprise ?? undefined,
    pierre: pierre ?? undefined,
  });

  // Build B44 empreinte variables
  const empreinteVars = buildDocumentVariablesFromEmpreinte({ pierre, enterprise });
  const renderConfig = buildPierreDocumentRenderConfig({ pierre, enterprise });

  // Merge variables: empreinte → mission context → caller variables (highest priority)
  const missionVars: Record<string, unknown> = {};
  if (missionContext) {
    if (missionContext.employee_name) missionVars.employee_name = missionContext.employee_name;
    if (missionContext.employee_id) missionVars.employee_id = missionContext.employee_id;
    if (missionContext.mission_id) missionVars.mission_id = missionContext.mission_id;
    if (missionContext.mission_title) missionVars.mission_title = missionContext.mission_title;
    Object.assign(missionVars, missionContext.extra_variables ?? {});
  }

  const mergedVariables = mergeVariables(
    empreinteVars as Record<string, unknown>,
    missionVars,
    variables,
  );

  // Apply render config overrides to style kit
  if (renderConfig.primary_color_hex) {
    styleKit.color_system.primary_color_hex = renderConfig.primary_color_hex;
    styleKit.tables.header_background_hex = renderConfig.primary_color_hex;
  }
  if (renderConfig.font_family) {
    styleKit.typography.primary_font_family = renderConfig.font_family;
  }
  if (renderConfig.signature_template) {
    styleKit.signature.enabled = true;
    styleKit.signature.signature_template = renderConfig.signature_template;
  }
  if (renderConfig.legal_footer_text) {
    styleKit.legal.legal_footer_text = renderConfig.legal_footer_text;
  }
  if (renderConfig.always_include_signature) {
    styleKit.signature.enabled = true;
  }
  if (renderConfig.use_company_brand_mark && renderConfig.company_name) {
    styleKit.visual_identity.brand_mark_text = renderConfig.company_name;
    styleKit.visual_identity.show_brand_mark = true;
  }

  const companyName = renderConfig.company_name ??
    enterprise?.company_identity.trade_name ??
    enterprise?.company_identity.legal_name ??
    null;

  return {
    style_kit: styleKit,
    template,
    variables: mergedVariables,
    company_name: companyName,
    document_title: template.label,
    mission_id: missionContext?.mission_id ?? null,
    task_id: missionContext?.task_id ?? null,
    generated_at: new Date().toISOString(),
  };
}

// ── Available template IDs from B45 registry ─────────────────────────────────

export const PIERRE_TEMPLATE_IDS = {
  EMPLOYMENT_CERTIFICATE: "pierre_employment_certificate_simple_v1",
  MISSING_DOCUMENTS: "pierre_missing_documents_request_v1",
  ONBOARDING_PLAN: "pierre_onboarding_plan_v1",
  ABSENCE_FOLLOWUP: "pierre_absence_followup_v1",
  PREPAYROLL_SUMMARY: "pierre_prepayroll_summary_v1",
  CANDIDATE_REPLY: "pierre_candidate_reply_v1",
  MANAGER_FOLLOWUP: "pierre_manager_followup_v1",
  EMPLOYEE_FILE_SUMMARY: "pierre_employee_file_summary_v1",
  EXECUTIVE_HR_REPORT: "pierre_executive_hr_report_v1",
  INTERNAL_HR_NOTE: "pierre_internal_hr_note_v1",
} as const;
