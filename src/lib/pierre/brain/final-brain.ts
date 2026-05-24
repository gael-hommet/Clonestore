// src/lib/pierre/brain/final-brain.ts
// Pierre Brain Final Core — Cerveau IA final async.
// Utilise CloneOS AI Runtime. Ne throw jamais. Fallback déterministe obligatoire.
// N'envoie pas d'email. N'exécute pas de tâche. Ne crée pas de mission.

import { runCloneAIContract } from "../../cloneos/ai/runtime";
import { safeTrimForPrompt } from "../../cloneos/ai/utils";
import type { CloneAIRouterPolicy } from "../../cloneos/ai/types";
import type {
  PierreBrainFinalOutput,
  PierreBrainInterpretation,
  PierreBrainRiskReview,
  PierreBrainTaskPlan,
  PierreBrainQualityGate,
} from "./types";
import {
  normalizePierreBrainInterpretation,
  normalizePierreBrainRiskReview,
  normalizePierreBrainTaskPlan,
  normalizePierreBrainQualityGate,
  buildSafePierreBrainFallback,
  buildNormalizedPierreBrainOutputJson,
} from "./schema";

// ── Internal helpers ──────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeJsonString(value: unknown, maxChars = 3000): string {
  if (typeof value === "string") return safeTrimForPrompt(value, maxChars);
  if (value === null || value === undefined) return "Non disponible";
  try {
    return safeTrimForPrompt(JSON.stringify(value), maxChars);
  } catch {
    return "Non disponible";
  }
}

function buildMockPolicy(): Partial<CloneAIRouterPolicy> {
  return { preferred_provider: "mock", fallback_providers: ["mock"] };
}

// Détermine si l'IA est activée selon le mode et l'env
function isAIEnabled(aiMode: string | undefined): boolean {
  if (aiMode === "off") return false;
  if (aiMode === "assist" || aiMode === "primary") return true;
  return process.env.CLONESTORE_AI_ENABLED === "true";
}

// ── Step 1: Final interpretation ──────────────────────────────────────────────

async function runInterpretationStep(params: {
  input: string;
  companyContext?: Record<string, unknown> | null;
  employeeContext?: Record<string, unknown> | null;
  deterministicContext?: Record<string, unknown> | null;
  policyOverride?: Partial<CloneAIRouterPolicy>;
}): Promise<{ ok: boolean; interpretation: PierreBrainInterpretation; provider: string; warnings: string[]; error: string | null }> {
  try {
    const { input, companyContext, employeeContext, deterministicContext, policyOverride } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.brain.final_interpret",
      variables: {
        input: safeTrimForPrompt(input, 3000),
        company_context: safeJsonString(companyContext, 2000),
        employee_context: safeJsonString(employeeContext, 1000),
        deterministic_context: safeJsonString(deterministicContext, 1500),
      },
      policy: policyOverride,
    });

    if (!response.ok) {
      return {
        ok: false,
        interpretation: normalizePierreBrainInterpretation(null),
        provider: response.provider,
        warnings: response.warnings,
        error: response.error,
      };
    }

    return {
      ok: true,
      interpretation: normalizePierreBrainInterpretation(isObject(response.json) ? response.json : null),
      provider: response.provider,
      warnings: response.warnings,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      interpretation: normalizePierreBrainInterpretation(null),
      provider: "mock",
      warnings: [],
      error: String(err),
    };
  }
}

// ── Step 2: Risk review ───────────────────────────────────────────────────────

async function runRiskReviewStep(params: {
  interpretation: PierreBrainInterpretation;
  input: string;
  policyOverride?: Partial<CloneAIRouterPolicy>;
}): Promise<{ ok: boolean; riskReview: PierreBrainRiskReview; warnings: string[]; error: string | null }> {
  try {
    const { interpretation, input, policyOverride } = params;

    const inputForRisk = safeJsonString({
      intent: interpretation.intent,
      domain: interpretation.domain,
      summary: interpretation.summary,
      risk_level: interpretation.risk_level,
      sensitive_topics: interpretation.sensitive_topics,
    }, 2000);

    const response = await runCloneAIContract({
      useCase: "pierre.brain.risk_review",
      variables: {
        input: inputForRisk,
        context: safeTrimForPrompt(input, 1000),
      },
      policy: policyOverride,
    });

    if (!response.ok) {
      return {
        ok: false,
        riskReview: normalizePierreBrainRiskReview(null),
        warnings: response.warnings,
        error: response.error,
      };
    }

    return {
      ok: true,
      riskReview: normalizePierreBrainRiskReview(isObject(response.json) ? response.json : null),
      warnings: response.warnings,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      riskReview: normalizePierreBrainRiskReview(null),
      warnings: [],
      error: String(err),
    };
  }
}

// ── Step 3: Task plan ─────────────────────────────────────────────────────────

async function runTaskPlanStep(params: {
  interpretation: PierreBrainInterpretation;
  companyContext?: Record<string, unknown> | null;
  employeeContext?: Record<string, unknown> | null;
  existingWorkflowContext?: Record<string, unknown> | null;
  policyOverride?: Partial<CloneAIRouterPolicy>;
}): Promise<{ ok: boolean; taskPlan: PierreBrainTaskPlan; warnings: string[]; error: string | null }> {
  try {
    const { interpretation, companyContext, employeeContext, existingWorkflowContext, policyOverride } = params;

    const response = await runCloneAIContract({
      useCase: "pierre.brain.task_plan",
      variables: {
        brain_interpretation: safeJsonString(interpretation, 2000),
        company_context: safeJsonString(companyContext, 1500),
        employee_context: safeJsonString(employeeContext, 1000),
        existing_workflow_context: safeJsonString(existingWorkflowContext, 1500),
      },
      policy: policyOverride,
    });

    if (!response.ok) {
      return {
        ok: false,
        taskPlan: normalizePierreBrainTaskPlan(null),
        warnings: response.warnings,
        error: response.error,
      };
    }

    return {
      ok: true,
      taskPlan: normalizePierreBrainTaskPlan(isObject(response.json) ? response.json : null),
      warnings: response.warnings,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      taskPlan: normalizePierreBrainTaskPlan(null),
      warnings: [],
      error: String(err),
    };
  }
}

// ── Step 4: Quality gate ──────────────────────────────────────────────────────

async function runQualityGateStep(params: {
  interpretation: PierreBrainInterpretation;
  riskReview: PierreBrainRiskReview;
  taskPlan: PierreBrainTaskPlan;
  input: string;
  policyOverride?: Partial<CloneAIRouterPolicy>;
}): Promise<{ ok: boolean; qualityGate: PierreBrainQualityGate; warnings: string[]; error: string | null }> {
  try {
    const { interpretation, riskReview, taskPlan, input, policyOverride } = params;

    const brainOutput = safeJsonString({
      interpretation: {
        intent: interpretation.intent,
        domain: interpretation.domain,
        risk_level: interpretation.risk_level,
        requires_human_validation: interpretation.requires_human_validation,
        sensitive_topics: interpretation.sensitive_topics,
        confidence: interpretation.confidence,
      },
      risk_review: {
        risk_level: riskReview.risk_level,
        approval_required: riskReview.approval_required,
        human_only: riskReview.human_only,
        blocked_reason: riskReview.blocked_reason,
      },
      task_plan: {
        task_count: taskPlan.tasks.length,
        validation_points: taskPlan.validation_points,
        has_email_tasks: taskPlan.tasks.some((t) => t.type.toLowerCase().includes("email.send")),
        all_email_approval: taskPlan.tasks
          .filter((t) => t.type.toLowerCase().includes("email"))
          .every((t) => t.approval_required),
      },
    }, 3000);

    const response = await runCloneAIContract({
      useCase: "pierre.brain.quality_gate",
      variables: {
        brain_output: brainOutput,
        original_input: safeTrimForPrompt(input, 500),
      },
      policy: policyOverride,
    });

    if (!response.ok) {
      return {
        ok: false,
        qualityGate: normalizePierreBrainQualityGate(null),
        warnings: response.warnings,
        error: response.error,
      };
    }

    return {
      ok: true,
      qualityGate: normalizePierreBrainQualityGate(isObject(response.json) ? response.json : null),
      warnings: response.warnings,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      qualityGate: normalizePierreBrainQualityGate(null),
      warnings: [],
      error: String(err),
    };
  }
}

// ── Main: runPierreFinalBrain ─────────────────────────────────────────────────

export async function runPierreFinalBrain(params: {
  input: string;
  companyContext?: Record<string, unknown> | null;
  employeeContext?: Record<string, unknown> | null;
  deterministicInterpretation?: Record<string, unknown> | null;
  deterministicTasks?: Record<string, unknown>[] | null;
  autonomyLevel?: string | null;
  aiMode?: "off" | "assist" | "primary";
}): Promise<PierreBrainFinalOutput> {
  try {
    const {
      input,
      companyContext,
      employeeContext,
      deterministicInterpretation,
      deterministicTasks,
      aiMode,
    } = params;

    const safeInput = typeof input === "string" ? input : "";
    const aiEnabled = isAIEnabled(aiMode);

    // Mode off ou IA désactivée → fallback déterministe immédiat
    if (!aiEnabled) {
      return buildSafePierreBrainFallback({
        input: safeInput,
        deterministicInterpretation,
        deterministicTasks,
      });
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    // Forcer mock si pas de vraie clé configurée et mode test
    const hasRealProvider =
      (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) ||
      (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);

    const policyOverride: Partial<CloneAIRouterPolicy> | undefined = hasRealProvider
      ? undefined
      : buildMockPolicy();

    const deterministicCtx = deterministicInterpretation
      ? {
          domain: deterministicInterpretation.domain ?? deterministicInterpretation.workflow_domain,
          risk_level: deterministicInterpretation.risk_level ?? deterministicInterpretation.workflow_risk_level,
          summary: deterministicInterpretation.summary ?? deterministicInterpretation.mission_summary,
          approval_required: deterministicInterpretation.approval_required,
          missing_info: deterministicInterpretation.missing_info,
          task_count: Array.isArray(deterministicTasks) ? deterministicTasks.length : 0,
        }
      : null;

    // ── Step 1: Interpretation ──────────────────────────────────────────────
    const interpResult = await runInterpretationStep({
      input: safeInput,
      companyContext,
      employeeContext,
      deterministicContext: deterministicCtx,
      policyOverride,
    });

    warnings.push(...interpResult.warnings);
    if (!interpResult.ok) {
      errors.push(`Interpretation failed: ${interpResult.error ?? "unknown"}`);
      warnings.push("Interpretation IA échouée — fallback déterministe pour interprétation.");
    }

    // En mode assist: si l'interprétation IA a un score de confiance faible,
    // utiliser les valeurs déterministes comme base
    let interpretation = interpResult.interpretation;
    if (aiMode === "assist" && deterministicInterpretation && !interpResult.ok) {
      const fallback = buildSafePierreBrainFallback({
        input: safeInput,
        deterministicInterpretation,
        deterministicTasks,
      });
      interpretation = fallback.interpretation;
    }

    // ── Step 2: Risk review ─────────────────────────────────────────────────
    const riskResult = await runRiskReviewStep({
      interpretation,
      input: safeInput,
      policyOverride,
    });

    warnings.push(...riskResult.warnings);
    if (!riskResult.ok) {
      errors.push(`Risk review failed: ${riskResult.error ?? "unknown"}`);
      warnings.push("Risk review IA échoué — fallback vers interprétation risk.");
    }

    // Fallback risk_review depuis interprétation si IA échoue
    const riskReview: PierreBrainRiskReview = riskResult.ok
      ? riskResult.riskReview
      : {
          risk_level: interpretation.risk_level,
          sensitive_topics: interpretation.sensitive_topics,
          approval_required: interpretation.requires_human_validation,
          human_only: interpretation.risk_level === "critical",
          blocked_reason: null,
          safe_next_step: interpretation.requires_human_validation
            ? "Validation humaine requise."
            : "Pierre peut préparer les actions.",
        };

    // ── Step 3: Task plan ───────────────────────────────────────────────────
    const taskResult = await runTaskPlanStep({
      interpretation,
      companyContext,
      employeeContext,
      existingWorkflowContext: deterministicCtx,
      policyOverride,
    });

    warnings.push(...taskResult.warnings);
    if (!taskResult.ok) {
      errors.push(`Task plan failed: ${taskResult.error ?? "unknown"}`);
      warnings.push("Task plan IA échoué — fallback déterministe pour les tâches.");
    }

    // Fallback task plan depuis deterministic si IA échoue
    let taskPlan = taskResult.taskPlan;
    if (!taskResult.ok && deterministicTasks) {
      const fallback = buildSafePierreBrainFallback({
        input: safeInput,
        deterministicInterpretation,
        deterministicTasks,
      });
      taskPlan = fallback.task_plan;
    }

    // ── Step 4: Quality gate ────────────────────────────────────────────────
    const qualityResult = await runQualityGateStep({
      interpretation,
      riskReview,
      taskPlan,
      input: safeInput,
      policyOverride,
    });

    warnings.push(...qualityResult.warnings);
    if (!qualityResult.ok) {
      errors.push(`Quality gate failed: ${qualityResult.error ?? "unknown"}`);
      warnings.push("Quality gate IA échoué — validation minimale appliquée.");
    }

    const qualityGate = qualityResult.ok
      ? qualityResult.qualityGate
      : {
          valid: errors.length === 0,
          score: errors.length === 0 ? 50 : 20,
          errors: errors.slice(0, 3),
          warnings: warnings.slice(0, 5),
          safe_to_use: errors.length === 0,
          normalization_hints: [],
        };

    // ── Determine source ────────────────────────────────────────────────────
    const allAIOk = interpResult.ok && riskResult.ok && taskResult.ok && qualityResult.ok;
    const someAIOk = interpResult.ok || riskResult.ok || taskResult.ok;

    let source: PierreBrainFinalOutput["source"];
    if (allAIOk && qualityGate.safe_to_use) {
      source = "ai";
    } else if (someAIOk) {
      source = "hybrid";
    } else {
      source = "deterministic";
    }

    // Si quality gate unsafe → downgrade à hybrid ou deterministic
    if (!qualityGate.safe_to_use && source === "ai") {
      source = "hybrid";
      warnings.push("Quality gate unsafe — source downgradée à hybrid.");
    }

    const provider = interpResult.provider ?? null;

    const finalOutput: PierreBrainFinalOutput = {
      source,
      ai_enabled: true,
      ai_ok: someAIOk,
      provider,
      interpretation,
      risk_review: riskReview,
      task_plan: taskPlan,
      quality_gate: qualityGate,
      normalized_brain_output_json: {},
      warnings,
      errors,
    };

    finalOutput.normalized_brain_output_json = buildNormalizedPierreBrainOutputJson(finalOutput);
    return finalOutput;
  } catch (err) {
    // Dernier recours — fallback total
    const fallback = buildSafePierreBrainFallback({
      input: typeof params.input === "string" ? params.input : "",
      deterministicInterpretation: params.deterministicInterpretation,
      deterministicTasks: params.deterministicTasks,
    });
    return {
      ...fallback,
      errors: [...fallback.errors, `Unexpected brain error: ${String(err)}`],
    };
  }
}

// ── Interpretation only ───────────────────────────────────────────────────────

export async function runPierreBrainInterpretationOnly(params: {
  input: string;
  companyContext?: Record<string, unknown> | null;
  employeeContext?: Record<string, unknown> | null;
  deterministicContext?: Record<string, unknown> | null;
  aiMode?: "off" | "assist" | "primary";
}): Promise<{
  ok: boolean;
  interpretation: PierreBrainInterpretation;
  provider: string | null;
  warnings: string[];
  errors: string[];
}> {
  try {
    const { input, companyContext, employeeContext, deterministicContext, aiMode } = params;
    const safeInput = typeof input === "string" ? input : "";
    const aiEnabled = isAIEnabled(aiMode);

    if (!aiEnabled) {
      return {
        ok: false,
        interpretation: normalizePierreBrainInterpretation(deterministicContext),
        provider: null,
        warnings: ["IA désactivée — interprétation déterministe."],
        errors: [],
      };
    }

    const hasRealProvider =
      (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) ||
      (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);

    const policyOverride = hasRealProvider ? undefined : buildMockPolicy();

    const result = await runInterpretationStep({
      input: safeInput,
      companyContext,
      employeeContext,
      deterministicContext,
      policyOverride,
    });

    return {
      ok: result.ok,
      interpretation: result.interpretation,
      provider: result.provider,
      warnings: result.warnings,
      errors: result.error ? [result.error] : [],
    };
  } catch (err) {
    return {
      ok: false,
      interpretation: normalizePierreBrainInterpretation(null),
      provider: null,
      warnings: [],
      errors: [String(err)],
    };
  }
}

// ── Quality gate only ─────────────────────────────────────────────────────────

export async function runPierreBrainQualityGate(params: {
  brainOutput: PierreBrainFinalOutput;
  input: string;
  companyContext?: Record<string, unknown> | null;
}): Promise<PierreBrainQualityGate> {
  try {
    const { brainOutput, input } = params;
    const hasRealProvider =
      (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) ||
      (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);

    const policyOverride = hasRealProvider ? undefined : buildMockPolicy();

    const result = await runQualityGateStep({
      interpretation: brainOutput.interpretation,
      riskReview: brainOutput.risk_review,
      taskPlan: brainOutput.task_plan,
      input,
      policyOverride,
    });

    return result.qualityGate;
  } catch {
    return {
      valid: false,
      score: 0,
      errors: ["Quality gate failed unexpectedly."],
      warnings: [],
      safe_to_use: false,
      normalization_hints: [],
    };
  }
}
