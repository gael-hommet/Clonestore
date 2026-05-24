// src/lib/pierre/ai/runtime.ts
// Pierre AI Bridge — connects Pierre's HR use cases to the CloneOS AI Runtime.
// Fallback-safe: if AI fails, Pierre continues with its deterministic engine.

import { runCloneAIContract } from "../../cloneos/ai/runtime";
import { safeTrimForPrompt } from "../../cloneos/ai/utils";

// ── Helper ────────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeJsonString(value: unknown, maxChars = 4000): string {
  if (typeof value === "string") return safeTrimForPrompt(value, maxChars);
  try {
    return safeTrimForPrompt(JSON.stringify(value), maxChars);
  } catch {
    return "";
  }
}

// ── Mission interpretation ────────────────────────────────────────────────────

export async function interpretPierreMissionWithAI(params: {
  input: string;
  companyContext?: Record<string, unknown> | null;
  employeeContext?: Record<string, unknown> | null;
  autonomyLevel?: string | null;
}): Promise<{
  ok: boolean;
  interpretation: Record<string, unknown> | null;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { input, companyContext, employeeContext, autonomyLevel } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.mission.interpret",
      variables: {
        input: safeTrimForPrompt(input, 3000),
        company_context: companyContext ? safeJsonString(companyContext, 2000) : "Non disponible",
        employee_context: employeeContext ? safeJsonString(employeeContext, 1000) : "Non disponible",
        autonomy_level: autonomyLevel ?? "standard",
      },
    });

    if (!response.ok) {
      return { ok: false, interpretation: null, provider: response.provider, warnings: response.warnings, error: response.error };
    }

    const interpretation = isPlainObject(response.json) ? response.json : null;
    return {
      ok: interpretation !== null,
      interpretation,
      provider: response.provider,
      warnings: response.warnings,
      error: interpretation === null ? "AI returned non-object interpretation." : null,
    };
  } catch (err) {
    return { ok: false, interpretation: null, provider: "mock", warnings: [], error: String(err) };
  }
}

// ── Task planning ─────────────────────────────────────────────────────────────

export async function planPierreTasksWithAI(params: {
  missionSummary: string;
  interpretation?: Record<string, unknown> | null;
  companyContext?: Record<string, unknown> | null;
}): Promise<{
  ok: boolean;
  plan: Record<string, unknown> | null;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { missionSummary, interpretation, companyContext } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.tasks.plan",
      variables: {
        mission_summary: safeTrimForPrompt(missionSummary, 2000),
        interpretation: interpretation ? safeJsonString(interpretation, 2000) : "Non disponible",
        company_context: companyContext ? safeJsonString(companyContext, 2000) : "Non disponible",
      },
    });

    if (!response.ok) {
      return { ok: false, plan: null, provider: response.provider, warnings: response.warnings, error: response.error };
    }

    const plan = isPlainObject(response.json) ? response.json : null;
    return {
      ok: plan !== null,
      plan,
      provider: response.provider,
      warnings: response.warnings,
      error: plan === null ? "AI returned non-object plan." : null,
    };
  } catch (err) {
    return { ok: false, plan: null, provider: "mock", warnings: [], error: String(err) };
  }
}

// ── Document review ───────────────────────────────────────────────────────────

export async function reviewPierreDocumentWithAI(params: {
  title: string;
  content: string;
  documentType?: string | null;
  companyContext?: Record<string, unknown> | null;
}): Promise<{
  ok: boolean;
  review: Record<string, unknown> | null;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { title, content, documentType, companyContext } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.document.review",
      variables: {
        title: safeTrimForPrompt(title, 500),
        content: safeTrimForPrompt(content, 6000),
        document_type: documentType ?? "Non spécifié",
        company_context: companyContext ? safeJsonString(companyContext, 1500) : "Non disponible",
      },
    });

    if (!response.ok) {
      return { ok: false, review: null, provider: response.provider, warnings: response.warnings, error: response.error };
    }

    const review = isPlainObject(response.json) ? response.json : null;
    return {
      ok: review !== null,
      review,
      provider: response.provider,
      warnings: response.warnings,
      error: review === null ? "AI returned non-object review." : null,
    };
  } catch (err) {
    return { ok: false, review: null, provider: "mock", warnings: [], error: String(err) };
  }
}

// ── B32: Document generation (Opus 4.7) ─────────────────────────────────────

export async function generatePierreDocumentWithAI(params: {
  documentType: string;
  title: string;
  companyContext?: Record<string, unknown> | null;
  employeeContext?: Record<string, unknown> | null;
  instructions?: string | null;
  additionalData?: unknown;
}): Promise<{
  ok: boolean;
  content: string;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { documentType, title, companyContext, employeeContext, instructions, additionalData } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.document.generate",
      variables: {
        document_type: safeTrimForPrompt(documentType, 200),
        title: safeTrimForPrompt(title, 300),
        company_context: companyContext ? safeJsonString(companyContext, 2000) : "Non disponible",
        employee_context: employeeContext ? safeJsonString(employeeContext, 2000) : "Non disponible",
        instructions: instructions ? safeTrimForPrompt(instructions, 1000) : "Aucune instruction spécifique.",
        additional_data: additionalData ? safeJsonString(additionalData, 2000) : "",
      },
    });

    return {
      ok: response.ok,
      content: response.content,
      provider: response.provider,
      warnings: response.warnings,
      error: response.ok ? null : (response.error ?? "Document generation failed."),
    };
  } catch (err) {
    return { ok: false, content: "", provider: "mock", warnings: [], error: String(err) };
  }
}

// ── B32: PDF content generation (Opus 4.7) ───────────────────────────────────

export async function generatePierrePdfContentWithAI(params: {
  pdfType: string;
  title: string;
  period?: string | null;
  data?: unknown;
  context?: string | null;
  formatHints?: string | null;
}): Promise<{
  ok: boolean;
  content: string;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { pdfType, title, period, data, context, formatHints } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.pdf.generate",
      variables: {
        pdf_type: safeTrimForPrompt(pdfType, 200),
        title: safeTrimForPrompt(title, 300),
        period: period ? safeTrimForPrompt(period, 200) : "Non spécifiée",
        data_json: data ? safeJsonString(data, 4000) : "",
        context: context ? safeTrimForPrompt(context, 2000) : "",
        format_hints: formatHints ? safeTrimForPrompt(formatHints, 500) : "",
      },
    });

    return {
      ok: response.ok,
      content: response.content,
      provider: response.provider,
      warnings: response.warnings,
      error: response.ok ? null : (response.error ?? "PDF content generation failed."),
    };
  } catch (err) {
    return { ok: false, content: "", provider: "mock", warnings: [], error: String(err) };
  }
}

// ── B32: Client fiche generation (Opus 4.7) ──────────────────────────────────

export async function generatePierreClientFicheWithAI(params: {
  ficheType: string;
  entityData: unknown;
  missionHistory?: unknown;
  taskHistory?: unknown;
  documentsSummary?: string | null;
  instructions?: string | null;
}): Promise<{
  ok: boolean;
  fiche: Record<string, unknown> | null;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { ficheType, entityData, missionHistory, taskHistory, documentsSummary, instructions } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.client_fiche.generate",
      variables: {
        fiche_type: safeTrimForPrompt(ficheType, 200),
        entity_data: safeJsonString(entityData, 4000),
        mission_history: missionHistory ? safeJsonString(missionHistory, 2000) : "Non disponible",
        task_history: taskHistory ? safeJsonString(taskHistory, 2000) : "Non disponible",
        documents_summary: documentsSummary ? safeTrimForPrompt(documentsSummary, 1000) : "",
        instructions: instructions ? safeTrimForPrompt(instructions, 500) : "",
      },
    });

    if (!response.ok) {
      return { ok: false, fiche: null, provider: response.provider, warnings: response.warnings, error: response.error };
    }

    const fiche = isPlainObject(response.json) ? response.json : null;
    return {
      ok: fiche !== null,
      fiche,
      provider: response.provider,
      warnings: response.warnings,
      error: fiche === null ? "AI returned non-object fiche." : null,
    };
  } catch (err) {
    return { ok: false, fiche: null, provider: "mock", warnings: [], error: String(err) };
  }
}

// ── B32: Final report generation (Opus 4.7) ──────────────────────────────────

export async function generatePierreFinalReportWithAI(params: {
  period: string;
  kpiData?: unknown;
  missionsSummary?: string | null;
  alertsSummary?: string | null;
  companyContext?: Record<string, unknown> | null;
  instructions?: string | null;
}): Promise<{
  ok: boolean;
  content: string;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { period, kpiData, missionsSummary, alertsSummary, companyContext, instructions } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.final_report.generate",
      variables: {
        period: safeTrimForPrompt(period, 200),
        kpi_data: kpiData ? safeJsonString(kpiData, 4000) : "Non disponible",
        missions_summary: missionsSummary ? safeTrimForPrompt(missionsSummary, 3000) : "Non disponible",
        alerts_summary: alertsSummary ? safeTrimForPrompt(alertsSummary, 2000) : "Aucune alerte",
        company_context: companyContext ? safeJsonString(companyContext, 2000) : "Non disponible",
        instructions: instructions ? safeTrimForPrompt(instructions, 500) : "",
      },
    });

    return {
      ok: response.ok,
      content: response.content,
      provider: response.provider,
      warnings: response.warnings,
      error: response.ok ? null : (response.error ?? "Final report generation failed."),
    };
  } catch (err) {
    return { ok: false, content: "", provider: "mock", warnings: [], error: String(err) };
  }
}

// ── B32: HR letter generation (Opus 4.7, risk_mode: sensitive) ───────────────

export async function generatePierreHrLetterWithAI(params: {
  letterType: string;
  recipient: string;
  subject: string;
  contextData?: unknown;
  employeeData?: Record<string, unknown> | null;
  instructions?: string | null;
}): Promise<{
  ok: boolean;
  content: string;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { letterType, recipient, subject, contextData, employeeData, instructions } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.hr_letter.generate",
      variables: {
        letter_type: safeTrimForPrompt(letterType, 200),
        recipient: safeTrimForPrompt(recipient, 300),
        subject: safeTrimForPrompt(subject, 500),
        context_data: contextData ? safeJsonString(contextData, 2000) : "",
        employee_data: employeeData ? safeJsonString(employeeData, 2000) : "Non disponible",
        instructions: instructions ? safeTrimForPrompt(instructions, 500) : "",
      },
    });

    return {
      ok: response.ok,
      content: response.content,
      provider: response.provider,
      warnings: response.warnings,
      error: response.ok ? null : (response.error ?? "HR letter generation failed."),
    };
  } catch (err) {
    return { ok: false, content: "", provider: "mock", warnings: [], error: String(err) };
  }
}

// ── B32: Sensitive risk analysis (Opus 4.7, risk_mode: sensitive) ─────────────

export async function analyzePierreRiskSensitiveWithAI(params: {
  caseType: string;
  situation: string;
  employeeData?: Record<string, unknown> | null;
  history?: string | null;
  companyContext?: Record<string, unknown> | null;
}): Promise<{
  ok: boolean;
  analysis: Record<string, unknown> | null;
  humanValidationRequired: boolean;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { caseType, situation, employeeData, history, companyContext } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.risk.sensitive",
      variables: {
        case_type: safeTrimForPrompt(caseType, 200),
        situation: safeTrimForPrompt(situation, 4000),
        employee_data: employeeData ? safeJsonString(employeeData, 2000) : "Non disponible",
        history: history ? safeTrimForPrompt(history, 2000) : "Non disponible",
        company_context: companyContext ? safeJsonString(companyContext, 2000) : "Non disponible",
      },
    });

    if (!response.ok) {
      return { ok: false, analysis: null, humanValidationRequired: true, provider: response.provider, warnings: response.warnings, error: response.error };
    }

    const analysis = isPlainObject(response.json) ? response.json : null;
    // Default to true if parsing fails — never assume safe on sensitive analysis
    const humanValidationRequired = analysis === null || analysis.human_validation_required !== false;

    return {
      ok: analysis !== null,
      analysis,
      humanValidationRequired,
      provider: response.provider,
      warnings: response.warnings,
      error: analysis === null ? "AI returned non-object risk analysis." : null,
    };
  } catch (err) {
    return { ok: false, analysis: null, humanValidationRequired: true, provider: "mock", warnings: [], error: String(err) };
  }
}

// ── Employee file summarization ───────────────────────────────────────────────

export async function summarizePierreEmployeeFileWithAI(params: {
  employeeFile: unknown;
  companyContext?: Record<string, unknown> | null;
}): Promise<{
  ok: boolean;
  summary: Record<string, unknown> | null;
  provider: string;
  warnings: string[];
  error: string | null;
}> {
  try {
    const { employeeFile, companyContext } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.employee_file.summarize",
      variables: {
        employee_file: safeJsonString(employeeFile, 5000),
        company_context: companyContext ? safeJsonString(companyContext, 2000) : "Non disponible",
      },
    });

    if (!response.ok) {
      return { ok: false, summary: null, provider: response.provider, warnings: response.warnings, error: response.error };
    }

    const summary = isPlainObject(response.json) ? response.json : null;
    return {
      ok: summary !== null,
      summary,
      provider: response.provider,
      warnings: response.warnings,
      error: summary === null ? "AI returned non-object summary." : null,
    };
  } catch (err) {
    return { ok: false, summary: null, provider: "mock", warnings: [], error: String(err) };
  }
}
