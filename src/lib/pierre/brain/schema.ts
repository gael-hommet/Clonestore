// src/lib/pierre/brain/schema.ts
// Pierre Brain Final Core — Normalisation et schéma.
// Module pur : pas de Supabase, pas de Next, pas d'async, ne throw jamais.

import type {
  PierreBrainDomain,
  PierreBrainRiskLevel,
  PierreBrainConfidence,
  PierreBrainMissingInfo,
  PierreBrainInterpretation,
  PierreBrainRiskReview,
  PierreBrainTaskDraft,
  PierreBrainTaskPlan,
  PierreBrainQualityGate,
  PierreBrainFinalOutput,
  PierreBrainSource,
} from "./types";

// ── Internal helpers ──────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function safeStr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function safeBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "true") return true;
  if (v === 0 || v === "false") return false;
  return fallback;
}

function safeNum(v: unknown, fallback = 0, min?: number, max?: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  const clamped = isNaN(n) ? fallback : n;
  if (min !== undefined && clamped < min) return min;
  if (max !== undefined && clamped > max) return max;
  return clamped;
}

function safeStringArray(v: unknown): string[] {
  if (!isArray(v)) return [];
  return v.map((item) => safeStr(item)).filter((s) => s.length > 0);
}

const CRITICAL_SIGNALS = [
  "licenciement", "licencié", "licencie",
  "harcelement", "harcèlement", "harcèle",
  "discrimination", "discrimin",
  "prud'hommes", "prudhommes", "prud hommes",
  "contentieux", "faute grave", "faute lourde",
  "sanction disciplinaire", "procedure disciplinaire", "procédure disciplinaire",
  "rupture conventionnelle", "rupture forcée", "rupture forcee",
  "violence", "agression",
];

function hasCriticalSignal(text: string): boolean {
  const normalized = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return CRITICAL_SIGNALS.some((s) =>
    normalized.includes(s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()),
  );
}

// ── Domain normalization ──────────────────────────────────────────────────────

const VALID_DOMAINS = new Set<PierreBrainDomain>([
  "recruitment", "onboarding", "employee_admin", "contract", "absence",
  "prepay", "performance", "training", "employee_relations", "offboarding",
  "document", "communication", "reporting", "unknown",
]);

const DOMAIN_ALIASES: Record<string, PierreBrainDomain> = {
  "recrutement": "recruitment", "embauche": "recruitment", "hiring": "recruitment",
  "candidature": "recruitment", "candidat": "recruitment",
  "onboardage": "onboarding", "integration": "onboarding",
  "admin": "employee_admin", "administratif": "employee_admin", "dossier": "employee_admin",
  "contrat": "contract", "cdi": "contract", "cdd": "contract", "avenant": "contract",
  "absence": "absence", "conge": "absence", "congé": "absence", "maladie": "absence", "rtt": "absence",
  "paie": "prepay", "salaire": "prepay", "pre_paie": "prepay", "prepay": "prepay",
  "performance": "performance", "evaluation": "performance", "entretien": "performance",
  "formation": "training", "apprentissage": "training", "competences": "training",
  "relations": "employee_relations", "conflit": "employee_relations", "discipline": "employee_relations",
  "offboarding": "offboarding", "depart": "offboarding", "sortie": "offboarding",
  "document": "document", "doc": "document",
  "communication": "communication", "email": "communication", "message": "communication",
  "rapport": "reporting", "reporting": "reporting", "bilan": "reporting",
};

export function normalizePierreBrainDomain(value: unknown): PierreBrainDomain {
  const s = safeStr(value).toLowerCase().replace(/[-_ ]/g, "");
  if (VALID_DOMAINS.has(s as PierreBrainDomain)) return s as PierreBrainDomain;
  for (const [alias, domain] of Object.entries(DOMAIN_ALIASES)) {
    if (s.includes(alias.toLowerCase().replace(/[-_ ]/g, ""))) return domain;
  }
  return "unknown";
}

// ── Risk level normalization ──────────────────────────────────────────────────

const RISK_LEVEL_MAP: Record<string, PierreBrainRiskLevel> = {
  "low": "low", "normal": "low", "green": "low", "faible": "low",
  "medium": "medium", "moderate": "medium", "sensitive": "medium", "orange": "medium", "moyen": "medium",
  "high": "high", "red": "high", "elevé": "high", "eleve": "high", "grave": "high",
  "critical": "critical", "critique": "critical", "black": "critical", "bloquet": "critical",
};

export function normalizePierreBrainRiskLevel(value: unknown): PierreBrainRiskLevel {
  const s = safeStr(value).toLowerCase().replace(/[-_ ]/g, "");
  if (RISK_LEVEL_MAP[s]) return RISK_LEVEL_MAP[s];
  if (s.startsWith("crit")) return "critical";
  if (s === "h" || s.startsWith("hi")) return "high";
  if (s === "m" || s.startsWith("med")) return "medium";
  return "low";
}

// ── Confidence normalization ──────────────────────────────────────────────────

export function normalizePierreBrainConfidence(value: unknown): PierreBrainConfidence {
  const s = safeStr(value).toLowerCase();
  if (s === "high" || s === "élevé" || s === "eleve" || s === "strong") return "high";
  if (s === "low" || s === "faible" || s === "weak" || s === "bad") return "low";
  return "medium";
}

// ── Missing info normalization ────────────────────────────────────────────────

export function normalizePierreBrainMissingInfo(value: unknown): PierreBrainMissingInfo[] {
  if (!isArray(value)) return [];
  return value.flatMap((item): PierreBrainMissingInfo[] => {
    if (typeof item === "string" && item.trim().length > 0) {
      return [{
        field: item.trim().toLowerCase().replace(/\s+/g, "_"),
        label: item.trim(),
        required: true,
        reason: "Information nécessaire au traitement de la mission.",
        question: `Pouvez-vous préciser : ${item.trim()} ?`,
      }];
    }
    if (!isObject(item)) return [];
    return [{
      field: safeStr(item.field) || "unknown_field",
      label: safeStr(item.label) || safeStr(item.field) || "Information manquante",
      required: safeBool(item.required, true),
      reason: safeStr(item.reason) || "Information nécessaire.",
      question: safeStr(item.question) || `Pouvez-vous préciser ce champ ?`,
    }];
  });
}

// ── Interpretation normalization ──────────────────────────────────────────────

export function normalizePierreBrainInterpretation(value: unknown): PierreBrainInterpretation {
  if (!isObject(value)) {
    return {
      intent: "unknown",
      domain: "unknown",
      summary: "",
      employee_refs: [],
      dates: [],
      document_needs: [],
      risk_level: "low",
      sensitive_topics: [],
      missing_info: [],
      requires_human_validation: false,
      confidence: "low",
      reasoning_summary: "",
    };
  }

  const riskLevel = normalizePierreBrainRiskLevel(value.risk_level);
  const sensitiveTopics = safeStringArray(value.sensitive_topics);
  const missingInfo = normalizePierreBrainMissingInfo(value.missing_info);

  // Force critical if sensitive signals detected in summary or intent
  const textCorpus = [safeStr(value.intent), safeStr(value.summary), ...sensitiveTopics].join(" ");
  const hasCritical = hasCriticalSignal(textCorpus);
  const finalRisk: PierreBrainRiskLevel = hasCritical ? "critical" : riskLevel;

  // Force requires_human_validation if risk high/critical or sensitive_topics non-empty
  const requiresHuman = safeBool(value.requires_human_validation) ||
    finalRisk === "critical" ||
    finalRisk === "high" ||
    sensitiveTopics.length > 0;

  return {
    intent: safeStr(value.intent) || "Mission RH",
    domain: normalizePierreBrainDomain(value.domain),
    summary: safeStr(value.summary) || "",
    employee_refs: safeStringArray(value.employee_refs),
    dates: safeStringArray(value.dates),
    document_needs: safeStringArray(value.document_needs),
    risk_level: finalRisk,
    sensitive_topics: sensitiveTopics,
    missing_info: missingInfo,
    requires_human_validation: requiresHuman,
    confidence: normalizePierreBrainConfidence(value.confidence),
    reasoning_summary: safeStr(value.reasoning_summary) || "",
  };
}

// ── Risk review normalization ─────────────────────────────────────────────────

export function normalizePierreBrainRiskReview(value: unknown): PierreBrainRiskReview {
  if (!isObject(value)) {
    return {
      risk_level: "medium",
      sensitive_topics: [],
      approval_required: true,
      human_only: false,
      blocked_reason: null,
      safe_next_step: "Demander validation humaine avant de continuer.",
    };
  }

  const riskLevel = normalizePierreBrainRiskLevel(value.risk_level);
  const sensitiveTopics = safeStringArray(value.sensitive_topics);

  // Force human_only if critical
  const humanOnly = safeBool(value.human_only) || riskLevel === "critical";
  // Force approval_required if high/critical or sensitive topics
  const approvalRequired = safeBool(value.approval_required) ||
    riskLevel === "critical" ||
    riskLevel === "high" ||
    sensitiveTopics.length > 0 ||
    humanOnly;

  const blockedReason = value.blocked_reason != null ? safeStr(value.blocked_reason) || null : null;

  return {
    risk_level: riskLevel,
    sensitive_topics: sensitiveTopics,
    approval_required: approvalRequired,
    human_only: humanOnly,
    blocked_reason: blockedReason || null,
    safe_next_step: safeStr(value.safe_next_step) || "Consulter un responsable RH.",
  };
}

// ── Task draft normalization ──────────────────────────────────────────────────

const BLOCKED_TASK_TYPES = new Set(["email.send", "send_email", "email_send"]);

export function normalizePierreBrainTaskDraft(value: unknown): PierreBrainTaskDraft {
  if (!isObject(value)) {
    return {
      type: "general.action",
      title: "Tâche RH",
      description: "",
      priority: 50,
      approval_required: true,
      risk_level: "medium",
      expected_artifact: null,
      payload: {},
    };
  }

  const type = safeStr(value.type) || "general.action";
  const riskLevel = normalizePierreBrainRiskLevel(value.risk_level);

  // Force approval_required if email/send type or risk high/critical
  const approvalRequired = safeBool(value.approval_required) ||
    BLOCKED_TASK_TYPES.has(type.toLowerCase()) ||
    riskLevel === "high" ||
    riskLevel === "critical";

  const priority = safeNum(value.priority, 50, 1, 100);

  const payload = isObject(value.payload) ? value.payload : {};

  return {
    type,
    title: safeStr(value.title) || "Tâche RH",
    description: safeStr(value.description) || "",
    priority,
    approval_required: approvalRequired,
    risk_level: riskLevel,
    expected_artifact: value.expected_artifact != null ? safeStr(value.expected_artifact) || null : null,
    payload,
  };
}

// ── Task plan normalization ───────────────────────────────────────────────────

export function normalizePierreBrainTaskPlan(value: unknown): PierreBrainTaskPlan {
  if (!isObject(value)) {
    return {
      tasks: [],
      dependencies: [],
      validation_points: [],
      artifact_expectations: [],
      execution_notes: [],
    };
  }

  const tasks = isArray(value.tasks)
    ? value.tasks.map((t) => normalizePierreBrainTaskDraft(t))
    : [];

  const dependencies = isArray(value.dependencies)
    ? value.dependencies.flatMap((d) => {
        if (!isObject(d)) return [];
        return [{
          task_title: safeStr(d.task_title) || "",
          depends_on: safeStringArray(d.depends_on),
          reason: safeStr(d.reason) || "",
        }];
      })
    : [];

  return {
    tasks,
    dependencies,
    validation_points: safeStringArray(value.validation_points),
    artifact_expectations: safeStringArray(value.artifact_expectations),
    execution_notes: safeStringArray(value.execution_notes),
  };
}

// ── Quality gate normalization ────────────────────────────────────────────────

export function normalizePierreBrainQualityGate(value: unknown): PierreBrainQualityGate {
  if (!isObject(value)) {
    return {
      valid: false,
      score: 0,
      errors: ["Quality gate response is not a valid object."],
      warnings: [],
      safe_to_use: false,
      normalization_hints: [],
    };
  }

  const score = safeNum(value.score, 0, 0, 100);
  const errors = safeStringArray(value.errors);
  const warnings = safeStringArray(value.warnings);
  const valid = safeBool(value.valid, errors.length === 0);
  const safeToUse = safeBool(value.safe_to_use, valid && errors.length === 0 && score >= 50);

  return {
    valid,
    score,
    errors,
    warnings,
    safe_to_use: safeToUse,
    normalization_hints: safeStringArray(value.normalization_hints),
  };
}

// ── Safe fallback builder ─────────────────────────────────────────────────────

export function buildSafePierreBrainFallback(params: {
  input: string;
  deterministicInterpretation?: Record<string, unknown> | null;
  deterministicTasks?: Record<string, unknown>[] | null;
}): PierreBrainFinalOutput {
  try {
    const { input, deterministicInterpretation, deterministicTasks } = params;
    const safeInput = typeof input === "string" ? input : "";

    const hasCritical = hasCriticalSignal(safeInput);

    const interpretation: PierreBrainInterpretation = {
      intent: safeStr(deterministicInterpretation?.intent) || safeInput.slice(0, 80) || "Mission RH",
      domain: normalizePierreBrainDomain(deterministicInterpretation?.domain ?? deterministicInterpretation?.workflow_domain),
      summary: safeStr(deterministicInterpretation?.summary ?? deterministicInterpretation?.mission_summary) || safeInput.slice(0, 200),
      employee_refs: [],
      dates: [],
      document_needs: [],
      risk_level: hasCritical ? "critical" : normalizePierreBrainRiskLevel(deterministicInterpretation?.risk_level ?? deterministicInterpretation?.workflow_risk_level ?? "low"),
      sensitive_topics: hasCritical ? ["cas_sensible_detecté"] : [],
      missing_info: normalizePierreBrainMissingInfo(deterministicInterpretation?.missing_info),
      requires_human_validation: hasCritical ||
        Boolean(deterministicInterpretation?.approval_required) ||
        Boolean(deterministicInterpretation?.requires_human_validation),
      confidence: "low",
      reasoning_summary: "Interprétation déterministe — IA non disponible.",
    };

    const riskReview: PierreBrainRiskReview = {
      risk_level: interpretation.risk_level,
      sensitive_topics: interpretation.sensitive_topics,
      approval_required: interpretation.requires_human_validation,
      human_only: interpretation.risk_level === "critical",
      blocked_reason: null,
      safe_next_step: interpretation.requires_human_validation
        ? "Soumettre à un responsable RH pour validation."
        : "Pierre peut préparer les actions — validation recommandée.",
    };

    const taskDrafts: PierreBrainTaskDraft[] = isArray(deterministicTasks)
      ? deterministicTasks.flatMap((t) => {
          if (!isObject(t)) return [];
          const type = safeStr(t.type) || "general.action";
          const riskLvl = normalizePierreBrainRiskLevel(t.risk_level);
          return [{
            type,
            title: safeStr(t.title) || "Tâche RH",
            description: safeStr(t.description) || "",
            priority: safeNum(t.priority, 50, 1, 100),
            approval_required: safeBool(t.approval_required) ||
              BLOCKED_TASK_TYPES.has(type.toLowerCase()) ||
              riskLvl === "high" || riskLvl === "critical",
            risk_level: riskLvl,
            expected_artifact: null,
            payload: isObject(t.payload_json) ? t.payload_json : isObject(t.payload) ? t.payload : {},
          }];
        })
      : [];

    const taskPlan: PierreBrainTaskPlan = {
      tasks: taskDrafts,
      dependencies: [],
      validation_points: interpretation.requires_human_validation
        ? ["Validation humaine requise avant exécution."]
        : [],
      artifact_expectations: [],
      execution_notes: ["Mode déterministe — IA non disponible."],
    };

    const qualityGate: PierreBrainQualityGate = {
      valid: true,
      score: 30,
      errors: [],
      warnings: ["Fallback déterministe — qualité IA non évaluée."],
      safe_to_use: true,
      normalization_hints: [],
    };

    const output: PierreBrainFinalOutput = {
      source: "deterministic",
      ai_enabled: false,
      ai_ok: false,
      provider: null,
      interpretation,
      risk_review: riskReview,
      task_plan: taskPlan,
      quality_gate: qualityGate,
      normalized_brain_output_json: {},
      warnings: ["IA non disponible — mode déterministe actif."],
      errors: [],
    };

    output.normalized_brain_output_json = buildNormalizedPierreBrainOutputJson(output);
    return output;
  } catch {
    return {
      source: "deterministic",
      ai_enabled: false,
      ai_ok: false,
      provider: null,
      interpretation: {
        intent: "unknown",
        domain: "unknown",
        summary: "",
        employee_refs: [],
        dates: [],
        document_needs: [],
        risk_level: "medium",
        sensitive_topics: [],
        missing_info: [],
        requires_human_validation: true,
        confidence: "low",
        reasoning_summary: "Erreur interne — fallback appliqué.",
      },
      risk_review: {
        risk_level: "medium",
        sensitive_topics: [],
        approval_required: true,
        human_only: false,
        blocked_reason: null,
        safe_next_step: "Contacter un responsable RH.",
      },
      task_plan: {
        tasks: [],
        dependencies: [],
        validation_points: ["Validation humaine requise."],
        artifact_expectations: [],
        execution_notes: ["Fallback d'urgence."],
      },
      quality_gate: {
        valid: false,
        score: 0,
        errors: ["Erreur interne lors du fallback."],
        warnings: [],
        safe_to_use: false,
        normalization_hints: [],
      },
      normalized_brain_output_json: {},
      warnings: ["Erreur lors de la construction du fallback."],
      errors: ["Fallback d'urgence activé."],
    };
  }
}

// ── Normalized output JSON builder ────────────────────────────────────────────

export function buildNormalizedPierreBrainOutputJson(
  output: PierreBrainFinalOutput,
): Record<string, unknown> {
  try {
    return {
      brain_source: output.source,
      brain_ai_enabled: output.ai_enabled,
      brain_ai_ok: output.ai_ok,
      brain_provider: output.provider,
      brain_intent: output.interpretation.intent,
      brain_domain: output.interpretation.domain,
      brain_summary: output.interpretation.summary,
      brain_risk_level: output.interpretation.risk_level,
      brain_requires_human_validation: output.interpretation.requires_human_validation,
      brain_confidence: output.interpretation.confidence,
      brain_employee_refs: output.interpretation.employee_refs,
      brain_dates: output.interpretation.dates,
      brain_document_needs: output.interpretation.document_needs,
      brain_sensitive_topics: output.interpretation.sensitive_topics,
      brain_missing_info_count: output.interpretation.missing_info.length,
      brain_missing_info: output.interpretation.missing_info,
      brain_risk_review_level: output.risk_review.risk_level,
      brain_approval_required: output.risk_review.approval_required,
      brain_human_only: output.risk_review.human_only,
      brain_blocked_reason: output.risk_review.blocked_reason,
      brain_safe_next_step: output.risk_review.safe_next_step,
      brain_task_count: output.task_plan.tasks.length,
      brain_validation_points: output.task_plan.validation_points,
      brain_quality_score: output.quality_gate.score,
      brain_quality_valid: output.quality_gate.valid,
      brain_quality_safe: output.quality_gate.safe_to_use,
      brain_quality_errors: output.quality_gate.errors,
      brain_quality_warnings: output.quality_gate.warnings,
      brain_warnings: output.warnings,
      brain_errors: output.errors,
    };
  } catch {
    return { brain_source: "deterministic", brain_error: "failed_to_build_json" };
  }
}
