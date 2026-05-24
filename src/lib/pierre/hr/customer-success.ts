// src/lib/pierre/hr/customer-success.ts
// Bloc 24 — Pierre Customer Success, Conversion & Retention Engine
// Module pur : pas de Supabase, pas de Next, pas d'async, pas d'effets de bord.
// Robuste face aux objets null/undefined/malformés.

// ── Helpers internes ────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "true" || v === "1") return true;
  if (v === 0 || v === "false" || v === "0") return false;
  return null;
}

function safeRows(v: unknown): Record<string, unknown>[] {
  if (!isArray(v)) return [];
  return v.filter(isObject);
}

function safeField(row: Record<string, unknown>, field: string): unknown {
  try { return row[field]; } catch { return undefined; }
}

function rowStatus(row: Record<string, unknown>): string | null {
  return asStr(safeField(row, "status"));
}

function rowType(row: Record<string, unknown>): string | null {
  return asStr(safeField(row, "type"));
}

function rowFamily(row: Record<string, unknown>): string | null {
  return asStr(safeField(row, "family")) ?? asStr(safeField(row, "doc_family"));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Constantes ──────────────────────────────────────────────────────────────

const SEND_TASK_TYPES = new Set(["email.send", "send_email"]);

const PREMIUM_DOC_FAMILIES = new Set([
  "contract", "amendment", "offer", "convocation", "refusal", "followup",
  "onboarding", "absence", "pre_payroll", "performance", "training",
  "offboarding", "employee_summary", "internal_note", "generic_hr",
]);

const SENSITIVE_DOC_FAMILIES = new Set(["contract", "amendment", "convocation", "refusal"]);

const TERMINAL_STATUSES = new Set(["done", "completed", "archived"]);
const APPROVAL_STATUSES = new Set(["pending_approval", "awaiting_approval", "awaiting_validation"]);
const ERROR_STATUSES = new Set(["error", "failed", "cancelled"]);
const BLOCKED_STATUSES = new Set(["blocked"]);

// ── Types exportés ──────────────────────────────────────────────────────────

export type PierreCustomerSuccessStage =
  | "new_account"
  | "setup_in_progress"
  | "activated"
  | "value_visible"
  | "conversion_ready"
  | "retention_risk"
  | "churn_risk"
  | "successful";

export type PierreCustomerHealthStatus =
  | "excellent"
  | "healthy"
  | "fragile"
  | "at_risk"
  | "critical";

export type PierreCustomerSignalType =
  | "configuration"
  | "usage"
  | "value"
  | "quality"
  | "risk"
  | "conversion"
  | "retention"
  | "support";

export type PierreCustomerSignalPolarity =
  | "positive"
  | "neutral"
  | "negative";

export type PierreCustomerRiskType =
  | "not_configured"
  | "no_usage"
  | "low_usage"
  | "no_completed_value"
  | "no_document_output"
  | "no_employee_files"
  | "schema_or_safety_issue"
  | "blocked_workflow"
  | "too_many_errors"
  | "low_perceived_value"
  | "conversion_not_ready"
  | "sensitive_case_mishandled"
  | "missing_templates"
  | "insufficient_traceability";

export type PierreCustomerActionType =
  | "complete_setup"
  | "launch_high_value_mission"
  | "generate_premium_document"
  | "review_employee_files"
  | "resolve_blockers"
  | "run_trial_plan"
  | "show_value_report"
  | "prepare_conversion_call"
  | "extend_trial"
  | "escalate_support"
  | "no_action";

export type PierreCustomerSuccessSignal = {
  type: PierreCustomerSignalType;
  polarity: PierreCustomerSignalPolarity;
  label: string;
  reason: string;
  score_impact: number;
  source_type:
    | "company_memory"
    | "mission"
    | "task"
    | "document"
    | "log"
    | "employee_file"
    | "trial"
    | "release"
    | "readiness"
    | "system";
  source_id: string | null;
};

export type PierreCustomerRisk = {
  type: PierreCustomerRiskType;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  reason: string;
  business_impact: string;
  recommended_fix: string;
};

export type PierreCustomerSuccessAction = {
  type: PierreCustomerActionType;
  label: string;
  priority: "low" | "normal" | "high" | "urgent";
  reason: string;
  expected_impact: string;
};

export type PierreCustomerValueSummary = {
  estimated_hours_saved_low: number;
  estimated_hours_saved_high: number;
  estimated_monthly_value_eur_low: number;
  estimated_monthly_value_eur_high: number;
  visible_value_count: number;
  strongest_proofs: string[];
  confidence: "low" | "medium" | "high";
};

export type PierreCustomerSuccessScore = {
  score: number;
  status: PierreCustomerHealthStatus;
  label: string;
  explanation: string;
};

export type PierreCustomerConversionReadiness = {
  score: number;
  ready: boolean;
  label: string;
  reasons: string[];
  missing_before_conversion: string[];
};

export type PierreCustomerRetentionScore = {
  score: number;
  status: "strong" | "medium" | "weak" | "danger";
  label: string;
  reasons: string[];
};

export type PierreCustomerSuccessExecutiveSummary = {
  headline: string;
  summary: string;
  what_worked: string[];
  what_is_missing: string[];
  recommendation: string;
};

export type PierreCustomerSuccessReport = {
  generated_at: string;
  stage: PierreCustomerSuccessStage;
  health: PierreCustomerSuccessScore;
  conversion: PierreCustomerConversionReadiness;
  retention: PierreCustomerRetentionScore;
  value: PierreCustomerValueSummary;
  signals: PierreCustomerSuccessSignal[];
  risks: PierreCustomerRisk[];
  actions: PierreCustomerSuccessAction[];
  executive_summary: PierreCustomerSuccessExecutiveSummary;
  metrics: {
    missions_total: number;
    tasks_total: number;
    completed_tasks: number;
    blocked_tasks: number;
    error_tasks: number;
    documents_total: number;
    premium_documents: number;
    pdf_documents: number;
    logs_total: number;
    employees_total: number;
    employee_files_total: number;
    approvals_pending: number;
    trial_activation_score: number | null;
    trial_value_score: number | null;
    release_score: number | null;
    readiness_score: number | null;
  };
};

export type PierreCustomerSuccessParams = {
  companyMemory?: Record<string, unknown> | null;
  missions?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  employees?: Record<string, unknown>[];
  employeeFiles?: unknown[];
  trialReport?: unknown;
  releaseReport?: unknown;
  readinessReport?: unknown;
  now?: Date;
};

// ── Extraction scores externes ───────────────────────────────────────────────

function extractTrialActivationScore(trialReport: unknown): number | null {
  if (!isObject(trialReport)) return null;
  const direct = asNum(safeField(trialReport, "activation_score"));
  if (direct !== null) return direct;
  const nested = isObject(safeField(trialReport, "report"))
    ? (safeField(trialReport, "report") as Record<string, unknown>)
    : null;
  if (nested) return asNum(safeField(nested, "activation_score"));
  return null;
}

function extractTrialValueScore(trialReport: unknown): number | null {
  if (!isObject(trialReport)) return null;
  const vs = safeField(trialReport, "value_score");
  if (isObject(vs)) {
    const s = asNum(safeField(vs, "score"));
    if (s !== null) return s;
  }
  const nested = isObject(safeField(trialReport, "report"))
    ? (safeField(trialReport, "report") as Record<string, unknown>)
    : null;
  if (nested) {
    const nvs = safeField(nested, "value_score");
    if (isObject(nvs)) return asNum(safeField(nvs, "score"));
  }
  return null;
}

function extractReleaseScore(releaseReport: unknown): number | null {
  if (!isObject(releaseReport)) return null;
  const direct = asNum(safeField(releaseReport, "global_score"));
  if (direct !== null) return direct;
  const nested = isObject(safeField(releaseReport, "report"))
    ? (safeField(releaseReport, "report") as Record<string, unknown>)
    : null;
  if (nested) return asNum(safeField(nested, "global_score"));
  return null;
}

function extractReadinessScore(readinessReport: unknown): number | null {
  if (!isObject(readinessReport)) return null;
  const direct =
    asNum(safeField(readinessReport, "global_score")) ??
    asNum(safeField(readinessReport, "score"));
  if (direct !== null) return direct;
  const nested = isObject(safeField(readinessReport, "report"))
    ? (safeField(readinessReport, "report") as Record<string, unknown>)
    : null;
  if (nested) {
    return (
      asNum(safeField(nested, "global_score")) ??
      asNum(safeField(nested, "score")) ??
      null
    );
  }
  return null;
}

// ── Métriques ─────────────────────────────────────────────────────────────────

export function computePierreCustomerSuccessMetrics(
  params: PierreCustomerSuccessParams,
): PierreCustomerSuccessReport["metrics"] {
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const logs = safeRows(params.logs);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);

  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  const blockedTasks = tasks.filter((t) => BLOCKED_STATUSES.has(rowStatus(t) ?? ""));
  const errorTasks = tasks.filter((t) => ERROR_STATUSES.has(rowStatus(t) ?? ""));
  const approvalPending = tasks.filter((t) => APPROVAL_STATUSES.has(rowStatus(t) ?? ""));

  const premiumDocs = documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? ""));
  const pdfDocs = documents.filter((d) => {
    return (
      asBool(safeField(d, "has_pdf")) === true ||
      asStr(safeField(d, "pdf_url")) !== null ||
      asStr(safeField(d, "pdf_path")) !== null
    );
  });

  return {
    missions_total: missions.length,
    tasks_total: tasks.length,
    completed_tasks: completedTasks.length,
    blocked_tasks: blockedTasks.length,
    error_tasks: errorTasks.length,
    documents_total: documents.length,
    premium_documents: premiumDocs.length,
    pdf_documents: pdfDocs.length,
    logs_total: logs.length,
    employees_total: employees.length,
    employee_files_total: employeeFiles.length,
    approvals_pending: approvalPending.length,
    trial_activation_score: extractTrialActivationScore(params.trialReport),
    trial_value_score: extractTrialValueScore(params.trialReport),
    release_score: extractReleaseScore(params.releaseReport),
    readiness_score: extractReadinessScore(params.readinessReport),
  };
}

// ── Signaux customer success ──────────────────────────────────────────────────

export function detectPierreCustomerSuccessSignals(
  params: PierreCustomerSuccessParams,
): PierreCustomerSuccessSignal[] {
  const signals: PierreCustomerSuccessSignal[] = [];
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const logs = safeRows(params.logs);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const companyMemory = params.companyMemory;

  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  const blockedTasks = tasks.filter((t) => BLOCKED_STATUSES.has(rowStatus(t) ?? ""));
  const errorTasks = tasks.filter((t) => ERROR_STATUSES.has(rowStatus(t) ?? ""));
  const approvalTasks = tasks.filter((t) => asBool(safeField(t, "approval_required")) === true);
  const premiumDocs = documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? ""));
  const pdfDocs = documents.filter((d) => {
    return (
      asBool(safeField(d, "has_pdf")) === true ||
      asStr(safeField(d, "pdf_url")) !== null ||
      asStr(safeField(d, "pdf_path")) !== null
    );
  });

  // ── Signaux de configuration ───────────────────────────────
  if (isObject(companyMemory)) {
    const rrh = isObject(safeField(companyMemory, "reusable_rh_context_json"))
      ? (safeField(companyMemory, "reusable_rh_context_json") as Record<string, unknown>)
      : null;

    signals.push({
      type: "configuration",
      polarity: "positive",
      label: "Mémoire entreprise configurée",
      reason: "L'Empreinte Entreprise Pierre est initialisée — contexte RH disponible.",
      score_impact: 15,
      source_type: "company_memory",
      source_id: null,
    });

    if (rrh && isObject(safeField(rrh, "document_system"))) {
      signals.push({
        type: "configuration",
        polarity: "positive",
        label: "Système documentaire configuré",
        reason: "Templates documentaires disponibles pour la génération.",
        score_impact: 10,
        source_type: "company_memory",
        source_id: null,
      });
    } else {
      signals.push({
        type: "configuration",
        polarity: "negative",
        label: "Système documentaire absent",
        reason: "Aucune configuration documentaire — génération de documents non disponible.",
        score_impact: -10,
        source_type: "company_memory",
        source_id: null,
      });
    }
  } else {
    signals.push({
      type: "configuration",
      polarity: "negative",
      label: "Mémoire entreprise manquante",
      reason: "Pierre n'est pas configuré — impossible de travailler sans Empreinte Entreprise.",
      score_impact: -30,
      source_type: "company_memory",
      source_id: null,
    });
  }

  // ── Signaux d'usage — salariés ───────────────────────────
  if (employees.length > 0) {
    signals.push({
      type: "usage",
      polarity: "positive",
      label: `${employees.length} salarié(s) configuré(s)`,
      reason: "La base salariée est initialisée — Pierre peut travailler sur des dossiers réels.",
      score_impact: Math.min(15, employees.length * 5),
      source_type: "company_memory",
      source_id: null,
    });
  } else {
    signals.push({
      type: "usage",
      polarity: "negative",
      label: "Aucun salarié configuré",
      reason: "Sans salariés, Pierre ne peut pas produire de valeur RH réelle.",
      score_impact: -20,
      source_type: "company_memory",
      source_id: null,
    });
  }

  // ── Signaux d'usage — missions ───────────────────────────
  if (missions.length >= 3) {
    signals.push({
      type: "usage",
      polarity: "positive",
      label: `${missions.length} missions RH créées`,
      reason: "Pierre est actif — plusieurs missions RH en cours ou terminées.",
      score_impact: Math.min(20, missions.length * 4),
      source_type: "mission",
      source_id: null,
    });
  } else if (missions.length >= 1) {
    signals.push({
      type: "usage",
      polarity: "neutral",
      label: `${missions.length} mission(s) RH créée(s)`,
      reason: "Pierre a démarré — premières missions initiées.",
      score_impact: 8,
      source_type: "mission",
      source_id: null,
    });
  } else {
    signals.push({
      type: "usage",
      polarity: "negative",
      label: "Aucune mission lancée",
      reason: "Pierre n'a pas encore produit de travail RH — valeur non démontrée.",
      score_impact: -25,
      source_type: "mission",
      source_id: null,
    });
  }

  // ── Signaux valeur — tâches complétées ───────────────────
  if (completedTasks.length >= 5) {
    signals.push({
      type: "value",
      polarity: "positive",
      label: `${completedTasks.length} tâches RH exécutées`,
      reason: "Volume significatif de travail RH automatisé — ROI visible.",
      score_impact: Math.min(25, completedTasks.length * 3),
      source_type: "task",
      source_id: null,
    });
  } else if (completedTasks.length >= 1) {
    signals.push({
      type: "value",
      polarity: "positive",
      label: `${completedTasks.length} tâche(s) complétée(s)`,
      reason: "Premières tâches RH terminées — début de preuve de valeur.",
      score_impact: completedTasks.length * 5,
      source_type: "task",
      source_id: null,
    });
  }

  // ── Signaux qualité — documents premium ───────────────────
  if (premiumDocs.length >= 2) {
    signals.push({
      type: "quality",
      polarity: "positive",
      label: `${premiumDocs.length} documents RH premium générés`,
      reason: "Pierre produit des livrables tangibles — contrats, rapports, synthèses.",
      score_impact: Math.min(20, premiumDocs.length * 6),
      source_type: "document",
      source_id: null,
    });
  } else if (premiumDocs.length === 1) {
    signals.push({
      type: "quality",
      polarity: "positive",
      label: "1 document RH premium généré",
      reason: "Premier livrable documentaire créé — valeur tangible visible.",
      score_impact: 8,
      source_type: "document",
      source_id: null,
    });
  }

  // ── Signaux qualité — PDFs ────────────────────────────────
  if (pdfDocs.length >= 1) {
    signals.push({
      type: "quality",
      polarity: "positive",
      label: `${pdfDocs.length} PDF généré(s)`,
      reason: "Documents PDF exportables — Pierre produit des preuves finales.",
      score_impact: Math.min(15, pdfDocs.length * 5),
      source_type: "document",
      source_id: null,
    });
  }

  // ── Signaux valeur — dossiers salariés ────────────────────
  if (employeeFiles.length >= 2) {
    signals.push({
      type: "value",
      polarity: "positive",
      label: `${employeeFiles.length} dossiers salariés 360° actifs`,
      reason: "Gestion centralisée des dossiers salariés — capital RH structuré.",
      score_impact: Math.min(18, employeeFiles.length * 6),
      source_type: "employee_file",
      source_id: null,
    });
  } else if (employeeFiles.length === 1) {
    signals.push({
      type: "value",
      polarity: "positive",
      label: "1 dossier salarié 360° construit",
      reason: "Premier dossier salarié opérationnel.",
      score_impact: 7,
      source_type: "employee_file",
      source_id: null,
    });
  }

  // ── Signaux rétention — logs / traçabilité ─────────────────
  if (logs.length >= 5) {
    signals.push({
      type: "retention",
      polarity: "positive",
      label: `${logs.length} événements tracés`,
      reason: "Traçabilité RH active — toutes les actions sont auditables.",
      score_impact: Math.min(12, Math.round(logs.length * 0.5)),
      source_type: "log",
      source_id: null,
    });
  } else if (logs.length > 0) {
    signals.push({
      type: "retention",
      polarity: "neutral",
      label: `${logs.length} événement(s) tracé(s)`,
      reason: "Traçabilité partielle active.",
      score_impact: 3,
      source_type: "log",
      source_id: null,
    });
  } else if (missions.length > 0) {
    signals.push({
      type: "retention",
      polarity: "negative",
      label: "Aucun log de traçabilité",
      reason: "Des missions sont actives mais aucune trace — audit impossible.",
      score_impact: -12,
      source_type: "log",
      source_id: null,
    });
  }

  // ── Signaux conversion — validation humaine ────────────────
  if (approvalTasks.length > 0) {
    signals.push({
      type: "conversion",
      polarity: "positive",
      label: `Circuit de validation humaine actif (${approvalTasks.length} tâches)`,
      reason: "Pierre respecte la gouvernance RH — actions sensibles sous contrôle.",
      score_impact: Math.min(15, approvalTasks.length * 7),
      source_type: "task",
      source_id: null,
    });
  }

  // ── Signaux risque — tâches bloquées ──────────────────────
  if (blockedTasks.length >= 3) {
    signals.push({
      type: "risk",
      polarity: "negative",
      label: `${blockedTasks.length} tâches bloquées`,
      reason: "Plusieurs tâches sont bloquées — risque d'accumulation de travail non traité.",
      score_impact: -Math.min(20, blockedTasks.length * 5),
      source_type: "task",
      source_id: null,
    });
  } else if (blockedTasks.length >= 1) {
    signals.push({
      type: "risk",
      polarity: "negative",
      label: `${blockedTasks.length} tâche(s) bloquée(s)`,
      reason: "Des tâches sont en attente — nécessite intervention.",
      score_impact: -8,
      source_type: "task",
      source_id: null,
    });
  }

  // ── Signaux risque — erreurs ──────────────────────────────
  if (errorTasks.length >= 5) {
    signals.push({
      type: "risk",
      polarity: "negative",
      label: `${errorTasks.length} erreurs de tâches`,
      reason: "Volume élevé d'erreurs — fiabilité Pierre compromise.",
      score_impact: -Math.min(35, errorTasks.length * 5),
      source_type: "task",
      source_id: null,
    });
  } else if (errorTasks.length >= 2) {
    signals.push({
      type: "risk",
      polarity: "negative",
      label: `${errorTasks.length} erreurs de tâches`,
      reason: "Erreurs de tâches détectées — à corriger.",
      score_impact: -12,
      source_type: "task",
      source_id: null,
    });
  }

  // ── Signaux conversion — scores externes ──────────────────
  const trialScore = extractTrialActivationScore(params.trialReport);
  if (trialScore !== null && trialScore >= 60) {
    signals.push({
      type: "conversion",
      polarity: "positive",
      label: `Score d'activation essai : ${trialScore}/100`,
      reason: "Pierre a démontré sa valeur pendant la période d'essai.",
      score_impact: Math.round(trialScore * 0.15),
      source_type: "trial",
      source_id: null,
    });
  } else if (trialScore !== null && trialScore < 40) {
    signals.push({
      type: "conversion",
      polarity: "negative",
      label: `Score d'activation faible : ${trialScore}/100`,
      reason: "L'essai n'a pas encore suffisamment démontré la valeur.",
      score_impact: -15,
      source_type: "trial",
      source_id: null,
    });
  }

  const releaseScore = extractReleaseScore(params.releaseReport);
  if (releaseScore !== null && releaseScore >= 65) {
    signals.push({
      type: "quality",
      polarity: "positive",
      label: `Release proof validé — ${releaseScore}/100`,
      reason: "Pierre est certifié opérationnel par le diagnostic release.",
      score_impact: Math.round(releaseScore * 0.12),
      source_type: "release",
      source_id: null,
    });
  }

  const readinessScore = extractReadinessScore(params.readinessReport);
  if (readinessScore !== null && readinessScore >= 65) {
    signals.push({
      type: "quality",
      polarity: "positive",
      label: `Readiness certifié — ${readinessScore}/100`,
      reason: "Pierre est opérationnellement prêt selon la certification de maturité.",
      score_impact: Math.round(readinessScore * 0.10),
      source_type: "readiness",
      source_id: null,
    });
  }

  // ── Signal absence d'usage total ─────────────────────────
  if (missions.length === 0 && tasks.length === 0 && documents.length === 0) {
    signals.push({
      type: "support",
      polarity: "negative",
      label: "Aucune utilisation détectée",
      reason: "Pierre est installé mais jamais utilisé — risque de churn immédiat.",
      score_impact: -30,
      source_type: "system",
      source_id: null,
    });
  }

  return signals;
}

// ── Risques customer ──────────────────────────────────────────────────────────

export function detectPierreCustomerRisks(
  params: PierreCustomerSuccessParams,
  signals?: PierreCustomerSuccessSignal[],
): PierreCustomerRisk[] {
  const risks: PierreCustomerRisk[] = [];
  const missions = safeRows(params.missions);
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const logs = safeRows(params.logs);
  const employees = safeRows(params.employees);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const companyMemory = params.companyMemory;

  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  const blockedTasks = tasks.filter((t) => BLOCKED_STATUSES.has(rowStatus(t) ?? ""));
  const errorTasks = tasks.filter((t) => ERROR_STATUSES.has(rowStatus(t) ?? ""));
  const premiumDocs = documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? ""));

  // ── not_configured ──────────────────────────────────────────
  if (!isObject(companyMemory)) {
    risks.push({
      type: "not_configured",
      severity: "high",
      label: "Pierre non configuré",
      reason: "Aucune Empreinte Entreprise trouvée — Pierre ne peut pas fonctionner.",
      business_impact: "Aucune valeur ne peut être créée sans configuration. Client à risque de churn immédiat.",
      recommended_fix: "Compléter l'Empreinte Entreprise : nom société, secteur, salariés, templates.",
    });
  } else {
    const rrh = isObject(safeField(companyMemory, "reusable_rh_context_json"))
      ? (safeField(companyMemory, "reusable_rh_context_json") as Record<string, unknown>)
      : null;

    // ── missing_templates ────────────────────────────────────
    if (!rrh || !isObject(safeField(rrh, "document_system"))) {
      risks.push({
        type: "missing_templates",
        severity: "medium",
        label: "Système documentaire non configuré",
        reason: "Aucun template documentaire disponible dans la configuration Pierre.",
        business_impact: "Génération de contrats/documents impossible — valeur premium limitée.",
        recommended_fix: "Configurer les templates documentaires dans les paramètres Pierre.",
      });
    }
  }

  // ── no_usage ────────────────────────────────────────────────
  if (missions.length === 0 && tasks.length === 0) {
    risks.push({
      type: "no_usage",
      severity: "high",
      label: "Aucune utilisation de Pierre",
      reason: "Pas de missions, pas de tâches — Pierre n'a jamais été utilisé.",
      business_impact: "Sans utilisation, la valeur est nulle. Risque de non-conversion élevé.",
      recommended_fix: "Lancer immédiatement une première mission RH (audit initial recommandé).",
    });
  } else if (missions.length === 1 && completedTasks.length === 0) {
    // ── low_usage ─────────────────────────────────────────────
    risks.push({
      type: "low_usage",
      severity: "medium",
      label: "Usage très limité de Pierre",
      reason: "Une seule mission, aucune tâche complétée — pas encore de valeur démontrée.",
      business_impact: "Usage insuffisant pour justifier la conversion en abonnement.",
      recommended_fix: "Compléter la mission en cours et lancer au moins 2 autres missions.",
    });
  } else if (missions.length <= 2 && completedTasks.length <= 1) {
    risks.push({
      type: "low_usage",
      severity: "low",
      label: "Usage Pierre encore limité",
      reason: `${missions.length} mission(s), ${completedTasks.length} tâche(s) complétée(s) — usage démarré mais insuffisant.`,
      business_impact: "Potentiel non encore exploité — valeur perçue faible.",
      recommended_fix: "Augmenter l'utilisation : générer des documents, créer des dossiers salariés.",
    });
  }

  // ── no_completed_value ──────────────────────────────────────
  if (tasks.length > 0 && completedTasks.length === 0) {
    risks.push({
      type: "no_completed_value",
      severity: "medium",
      label: "Tâches démarrées mais aucune terminée",
      reason: `${tasks.length} tâche(s) créée(s), aucune terminée — travail en cours non finalisé.`,
      business_impact: "Livrables non livrés — la valeur n'est pas encore visible pour le client.",
      recommended_fix: "Débloquer et finaliser les tâches en attente.",
    });
  }

  // ── no_document_output ──────────────────────────────────────
  if (completedTasks.length >= 3 && documents.length === 0) {
    risks.push({
      type: "no_document_output",
      severity: "medium",
      label: "Aucun document généré malgré l'activité",
      reason: `${completedTasks.length} tâches terminées mais aucun document produit.`,
      business_impact: "La valeur tangible (contrats, rapports) n'est pas visible — difficulté à justifier l'abonnement.",
      recommended_fix: "Lancer une mission de génération documentaire (contrat, rapport pré-paie).",
    });
  }

  // ── no_employee_files ────────────────────────────────────────
  if (employees.length > 0 && employeeFiles.length === 0) {
    risks.push({
      type: "no_employee_files",
      severity: "low",
      label: "Salariés configurés mais aucun dossier 360° construit",
      reason: `${employees.length} salarié(s) présent(s) mais aucun dossier 360° créé.`,
      business_impact: "Valeur centralisée non réalisée — les dossiers salariés sont un atout majeur de Pierre.",
      recommended_fix: "Construire les dossiers 360° via une mission de revue salarié.",
    });
  } else if (employees.length === 0) {
    risks.push({
      type: "no_employee_files",
      severity: "medium",
      label: "Aucun salarié configuré",
      reason: "Sans salariés, Pierre ne peut pas gérer de dossiers RH.",
      business_impact: "Fonctionnalité principale de Pierre inutilisable.",
      recommended_fix: "Ajouter les salariés dans la configuration Pierre.",
    });
  }

  // ── schema_or_safety_issue ──────────────────────────────────
  const tasksWithScheduledFor = tasks.filter((t) => {
    const sf = safeField(t, "scheduled_for");
    return sf !== undefined && sf !== null;
  });
  const logsWithWrongSchema = logs.filter((l) => {
    return (
      (safeField(l, "level") !== undefined && safeField(l, "level") !== null) ||
      (safeField(l, "event") !== undefined && safeField(l, "event") !== null) ||
      (safeField(l, "payload") !== undefined && safeField(l, "payload") !== null)
    );
  });
  const autoSendTasks = tasks.filter((t) => {
    const type = rowType(t) ?? "";
    return (
      SEND_TASK_TYPES.has(type) &&
      TERMINAL_STATUSES.has(rowStatus(t) ?? "") &&
      asBool(safeField(t, "approval_required")) !== true
    );
  });

  if (tasksWithScheduledFor.length > 0) {
    risks.push({
      type: "schema_or_safety_issue",
      severity: "critical",
      label: "Violation schéma DB critique : scheduled_for utilisé",
      reason: `${tasksWithScheduledFor.length} tâche(s) utilisent 'scheduled_for' au lieu de 'execute_at'.`,
      business_impact: "Risque d'intégrité DB — les tâches planifiées peuvent être manquées ou dupliquées.",
      recommended_fix: "Corriger immédiatement : remplacer 'scheduled_for' par 'execute_at' dans pierre_tasks.",
    });
  }
  if (logsWithWrongSchema.length > 0) {
    risks.push({
      type: "schema_or_safety_issue",
      severity: "critical",
      label: "Violation schéma logs critique : level/event/payload utilisés",
      reason: `${logsWithWrongSchema.length} log(s) utilisent l'ancien schéma (level/event/payload).`,
      business_impact: "Traçabilité compromise — l'audit RH est incomplet ou incorrect.",
      recommended_fix: "Corriger : utiliser event_type, message, meta_json dans pierre_task_logs.",
    });
  }
  if (autoSendTasks.length > 0) {
    risks.push({
      type: "schema_or_safety_issue",
      severity: "critical",
      label: "Violation sécurité : email auto-envoyé sans validation",
      reason: `${autoSendTasks.length} email(s) exécutés sans approval_required.`,
      business_impact: "Risque juridique et réputationnel — emails non autorisés envoyés en nom du client.",
      recommended_fix: "Ne jamais exécuter email.send/send_email sans approval_required=true.",
    });
  }

  // ── blocked_workflow ────────────────────────────────────────
  if (blockedTasks.length >= 3) {
    risks.push({
      type: "blocked_workflow",
      severity: "high",
      label: `Flux de travail bloqué (${blockedTasks.length} tâches)`,
      reason: `${blockedTasks.length} tâches en état bloqué — accumulation de travail non traité.`,
      business_impact: "Missions incomplètes — le client perçoit Pierre comme peu fiable.",
      recommended_fix: "Investiguer et débloquer les tâches suspendues. Vérifier les dépendances manquantes.",
    });
  } else if (blockedTasks.length >= 1) {
    risks.push({
      type: "blocked_workflow",
      severity: "medium",
      label: `${blockedTasks.length} tâche(s) bloquée(s)`,
      reason: "Des tâches sont bloquées — intervention requise.",
      business_impact: "Valeur partielle non livrée.",
      recommended_fix: "Débloquer les tâches en attente.",
    });
  }

  // ── too_many_errors ─────────────────────────────────────────
  const errorRate = tasks.length > 0 ? errorTasks.length / tasks.length : 0;
  if (errorTasks.length >= 5 || errorRate >= 0.3) {
    risks.push({
      type: "too_many_errors",
      severity: errorRate >= 0.5 ? "critical" : "high",
      label: `Taux d'erreur élevé (${errorTasks.length} erreurs)`,
      reason: `${errorTasks.length} tâche(s) en erreur sur ${tasks.length} — taux d'échec ${Math.round(errorRate * 100)}%.`,
      business_impact: "Fiabilité Pierre compromise — le client peut perdre confiance.",
      recommended_fix: "Analyser les erreurs, corriger la configuration, relancer les tâches.",
    });
  } else if (errorTasks.length >= 2) {
    risks.push({
      type: "too_many_errors",
      severity: "medium",
      label: `${errorTasks.length} erreurs de tâches détectées`,
      reason: "Plusieurs erreurs de tâches à corriger.",
      business_impact: "Livrables partiels — à corriger avant la conversion.",
      recommended_fix: "Vérifier et relancer les tâches en erreur.",
    });
  }

  // ── low_perceived_value ─────────────────────────────────────
  const trialScore = extractTrialActivationScore(params.trialReport);
  const releaseScore = extractReleaseScore(params.releaseReport);
  const readinessScore = extractReadinessScore(params.readinessReport);

  const hasLowScores =
    (trialScore !== null && trialScore < 40) ||
    (releaseScore !== null && releaseScore < 50) ||
    (readinessScore !== null && readinessScore < 50);

  const hasNoTangibleOutput = premiumDocs.length === 0 && completedTasks.length < 2 && employeeFiles.length === 0;

  if (hasNoTangibleOutput || (hasLowScores && completedTasks.length < 2)) {
    risks.push({
      type: "low_perceived_value",
      severity: completedTasks.length === 0 ? "high" : "medium",
      label: "Valeur perçue insuffisante",
      reason: "Peu de livrables concrets produits — le client ne perçoit pas encore la valeur de Pierre.",
      business_impact: "Non-conversion très probable si la valeur n'est pas démontrée avant la fin d'essai.",
      recommended_fix: "Générer des documents premium, construire des dossiers salariés, compléter les missions.",
    });
  }

  // ── conversion_not_ready ────────────────────────────────────
  const criticalRisksNow = risks.filter((r) => r.severity === "critical");
  const missingForConversion: string[] = [];
  if (!isObject(companyMemory)) missingForConversion.push("Empreinte Entreprise");
  if (completedTasks.length < 2) missingForConversion.push("Tâches complétées (min 2)");
  if (documents.length === 0) missingForConversion.push("Documents générés");
  if (criticalRisksNow.length > 0) missingForConversion.push("Correction des blockers critiques");

  if (missingForConversion.length >= 2 && missions.length > 0) {
    risks.push({
      type: "conversion_not_ready",
      severity: "medium",
      label: "Essai insuffisant pour convertir",
      reason: `${missingForConversion.length} éléments manquants avant de pouvoir convertir.`,
      business_impact: "Conversion prématurée = insatisfaction client post-achat.",
      recommended_fix: `Compléter avant conversion : ${missingForConversion.slice(0, 3).join(", ")}.`,
    });
  }

  // ── sensitive_case_mishandled ────────────────────────────────
  const sensitiveDocs = documents.filter((d) => SENSITIVE_DOC_FAMILIES.has(rowFamily(d) ?? ""));
  const uncontrolled = sensitiveDocs.filter((d) => {
    return TERMINAL_STATUSES.has(rowStatus(d) ?? "") && asBool(safeField(d, "approval_required")) !== true;
  });
  if (uncontrolled.length > 0) {
    risks.push({
      type: "sensitive_case_mishandled",
      severity: "high",
      label: `${uncontrolled.length} document(s) sensible(s) sans validation humaine`,
      reason: "Documents contractuels/convocations complétés sans circuit de validation.",
      business_impact: "Risque juridique — documents légaux potentiellement erronés et non validés.",
      recommended_fix: "S'assurer que tous les documents contractuels passent par approval_required=true.",
    });
  }

  // ── insufficient_traceability ───────────────────────────────
  if (logs.length === 0 && missions.length > 0) {
    risks.push({
      type: "insufficient_traceability",
      severity: "medium",
      label: "Traçabilité absente",
      reason: "Des missions sont actives mais aucun log d'audit n'est enregistré.",
      business_impact: "Audit RH impossible — risque de non-conformité pour le client.",
      recommended_fix: "Vérifier la configuration de la traçabilité pierre_task_logs.",
    });
  } else if (logs.length < 3 && missions.length >= 3) {
    risks.push({
      type: "insufficient_traceability",
      severity: "low",
      label: "Traçabilité insuffisante",
      reason: `${missions.length} missions actives pour seulement ${logs.length} log(s).`,
      business_impact: "Traçabilité partielle — audit RH incomplet.",
      recommended_fix: "Vérifier que les logs sont bien générés lors de l'exécution des tâches.",
    });
  }

  void signals;
  return risks;
}

// ── Résumé de valeur ──────────────────────────────────────────────────────────

export function buildPierreCustomerValueSummary(
  params: PierreCustomerSuccessParams,
  signals: PierreCustomerSuccessSignal[],
): PierreCustomerValueSummary {
  const tasks = safeRows(params.tasks);
  const documents = safeRows(params.documents);
  const employeeFiles = (params.employeeFiles ?? []).filter(isObject);
  const logs = safeRows(params.logs);

  const completedTasks = tasks.filter((t) => TERMINAL_STATUSES.has(rowStatus(t) ?? ""));
  const premiumDocs = documents.filter((d) => PREMIUM_DOC_FAMILIES.has(rowFamily(d) ?? ""));
  const pdfDocs = documents.filter((d) => {
    return (
      asBool(safeField(d, "has_pdf")) === true ||
      asStr(safeField(d, "pdf_url")) !== null ||
      asStr(safeField(d, "pdf_path")) !== null
    );
  });

  const hoursLow =
    completedTasks.length * 1.5 +
    premiumDocs.length * 1.25 +
    pdfDocs.length * 0.75 +
    employeeFiles.length * 0.5 +
    (logs.length > 0 ? 0.5 : 0);

  const hoursHigh = Math.max(hoursLow, hoursLow * 1.6 + 1.5);

  const eurLow = Math.max(0, Math.round(hoursLow * 50));
  const eurHigh = Math.max(50, Math.round(hoursHigh * 50));

  const proofs: string[] = [];
  if (completedTasks.length > 0) proofs.push(`${completedTasks.length} tâche(s) RH complétée(s)`);
  if (premiumDocs.length > 0) proofs.push(`${premiumDocs.length} document(s) premium généré(s)`);
  if (pdfDocs.length > 0) proofs.push(`${pdfDocs.length} PDF exporté(s)`);
  if (employeeFiles.length > 0) proofs.push(`${employeeFiles.length} dossier(s) salarié 360° construit(s)`);
  if (logs.length > 0) proofs.push(`Traçabilité active — ${logs.length} événement(s) audité(s)`);

  const trialScore = extractTrialActivationScore(params.trialReport);
  const releaseScore = extractReleaseScore(params.releaseReport);
  const readinessScore = extractReadinessScore(params.readinessReport);

  if (trialScore !== null && trialScore >= 60) {
    proofs.push(`Score activation essai : ${trialScore}/100`);
  }

  const positiveSignals = signals.filter((s) => s.polarity === "positive" && s.type === "value");
  const visible_value_count = proofs.length + positiveSignals.length;

  const hasHighScores =
    (releaseScore !== null && releaseScore >= 75) ||
    (readinessScore !== null && readinessScore >= 75);

  const confidence: "low" | "medium" | "high" =
    hoursLow >= 6 && hasHighScores ? "high"
    : hoursLow >= 2 || visible_value_count >= 3 ? "medium"
    : "low";

  return {
    estimated_hours_saved_low: Math.round(hoursLow),
    estimated_hours_saved_high: Math.round(hoursHigh),
    estimated_monthly_value_eur_low: eurLow,
    estimated_monthly_value_eur_high: eurHigh,
    visible_value_count,
    strongest_proofs: proofs.slice(0, 5),
    confidence,
  };
}

// ── Score de santé ────────────────────────────────────────────────────────────

export function scorePierreCustomerHealth(params: {
  metrics: PierreCustomerSuccessReport["metrics"];
  signals: PierreCustomerSuccessSignal[];
  risks: PierreCustomerRisk[];
  value: PierreCustomerValueSummary;
}): PierreCustomerSuccessScore {
  const { metrics, signals, risks, value } = params;
  let score = 40;

  // Signaux positifs
  for (const s of signals) {
    if (s.polarity === "positive") score += clamp(s.score_impact, 0, 25);
    else if (s.polarity === "negative") score += clamp(s.score_impact, -35, 0);
  }

  // Bonus valeur
  if (value.confidence === "high") score += 8;
  else if (value.confidence === "medium") score += 4;

  // Bonus documents premium
  if (metrics.premium_documents >= 3) score += 8;
  else if (metrics.premium_documents >= 1) score += 4;

  // Bonus employee files
  if (metrics.employee_files_total >= 3) score += 6;
  else if (metrics.employee_files_total >= 1) score += 3;

  // Bonus scores externes
  if (metrics.release_score !== null && metrics.release_score >= 75) score += 8;
  else if (metrics.release_score !== null && metrics.release_score >= 50) score += 4;

  if (metrics.readiness_score !== null && metrics.readiness_score >= 75) score += 8;
  else if (metrics.readiness_score !== null && metrics.readiness_score >= 50) score += 4;

  // Malus risques
  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const highRisks = risks.filter((r) => r.severity === "high");
  const mediumRisks = risks.filter((r) => r.severity === "medium");

  score -= criticalRisks.length * 20;
  score -= highRisks.length * 10;
  score -= mediumRisks.length * 5;

  // Cap si critical
  if (criticalRisks.length > 0) {
    score = Math.min(score, 49);
  }

  score = clamp(Math.round(score), 0, 100);

  const hasCritical = criticalRisks.length > 0;
  const status: PierreCustomerHealthStatus =
    hasCritical || score < 30 ? "critical"
    : score < 50 ? "at_risk"
    : score < 70 ? "fragile"
    : score < 85 ? "healthy"
    : "excellent";

  let label: string;
  if (status === "excellent") label = "Pierre est en excellente santé — conversion recommandée";
  else if (status === "healthy") label = "Pierre est opérationnel — prêt à justifier la conversion";
  else if (status === "fragile") label = "Pierre fonctionne mais nécessite des améliorations";
  else if (status === "at_risk") label = "Pierre est en difficulté — plusieurs actions requises";
  else label = "Pierre est en état critique — blockers urgents à corriger";

  const explanation =
    `Score ${score}/100. ${metrics.completed_tasks} tâches complétées, ` +
    `${metrics.premium_documents} docs premium, ${metrics.employee_files_total} dossiers salariés. ` +
    `Risques : ${criticalRisks.length} critique(s), ${highRisks.length} important(s).`;

  return { score, status, label, explanation };
}

// ── Score de conversion ──────────────────────────────────────────────────────

export function scorePierreCustomerConversion(params: {
  metrics: PierreCustomerSuccessReport["metrics"];
  signals: PierreCustomerSuccessSignal[];
  risks: PierreCustomerRisk[];
  value: PierreCustomerValueSummary;
  health: PierreCustomerSuccessScore;
}): PierreCustomerConversionReadiness {
  const { metrics, risks, value, health } = params;
  let score = 25;
  const reasons: string[] = [];
  const missing: string[] = [];

  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const highRisks = risks.filter((r) => r.severity === "high");

  // Santé
  if (health.score >= 70) {
    score += 20;
    reasons.push(`Santé Pierre élevée (${health.score}/100)`);
  } else if (health.score >= 50) {
    score += 10;
  } else {
    score -= 10;
    missing.push("Améliorer la santé Pierre (score actuel trop bas)");
  }

  // Valeur visible
  if (value.visible_value_count >= 4) {
    score += 20;
    reasons.push("Valeur clairement démontrée — livrables multiples");
  } else if (value.visible_value_count >= 2) {
    score += 12;
    reasons.push("Preuves de valeur présentes");
  } else {
    score -= 15;
    missing.push("Générer au moins 2 preuves de valeur tangibles");
  }

  // Documents
  if (metrics.premium_documents >= 2) {
    score += 12;
    reasons.push(`${metrics.premium_documents} documents premium — livrables concrets`);
  } else if (metrics.premium_documents >= 1) {
    score += 6;
  } else {
    missing.push("Générer au moins 1 document RH premium");
  }

  // Tâches
  if (metrics.completed_tasks >= 5) {
    score += 12;
    reasons.push(`${metrics.completed_tasks} tâches complétées`);
  } else if (metrics.completed_tasks >= 2) {
    score += 7;
  } else if (metrics.completed_tasks === 0) {
    score -= 10;
    missing.push("Compléter au moins 2 tâches RH");
  }

  // Scores externes
  if (metrics.trial_activation_score !== null && metrics.trial_activation_score >= 60) {
    score += 10;
    reasons.push(`Score activation essai : ${metrics.trial_activation_score}/100`);
  }
  if (metrics.release_score !== null && metrics.release_score >= 65) {
    score += 8;
    reasons.push(`Release proof validé (${metrics.release_score}/100)`);
  }
  if (metrics.readiness_score !== null && metrics.readiness_score >= 65) {
    score += 8;
    reasons.push(`Readiness certifié (${metrics.readiness_score}/100)`);
  }

  // Risques
  if (criticalRisks.length > 0) {
    score -= criticalRisks.length * 25;
    missing.push(`Corriger ${criticalRisks.length} blocker(s) critique(s)`);
    reasons.push(`${criticalRisks.length} blocker(s) critique(s) à corriger en priorité`);
  }
  if (highRisks.length >= 2) {
    score -= highRisks.length * 8;
    missing.push("Résoudre les blockers importants");
  }

  // Pas de missions
  if (metrics.missions_total === 0) {
    score -= 20;
    missing.push("Lancer au moins une mission RH");
  }

  score = clamp(Math.round(score), 0, 100);

  const ready =
    criticalRisks.length === 0 &&
    health.score >= 60 &&
    value.visible_value_count >= 2 &&
    (metrics.premium_documents >= 1 || metrics.completed_tasks >= 2) &&
    missing.filter((m) => m.includes("Corriger") || m.includes("Lancer")).length === 0;

  let label: string;
  if (score >= 80) label = "Prêt à convertir — recommander l'abonnement maintenant";
  else if (score >= 65) label = "Presque prêt — finaliser 1–2 actions avant conversion";
  else if (score >= 45) label = "Conversion possible — renforcer la valeur démontrée";
  else label = "Pas encore prêt — résoudre les blockers prioritaires";

  return { score, ready, label, reasons, missing_before_conversion: missing };
}

// ── Score de rétention ────────────────────────────────────────────────────────

export function scorePierreCustomerRetention(params: {
  metrics: PierreCustomerSuccessReport["metrics"];
  signals: PierreCustomerSuccessSignal[];
  risks: PierreCustomerRisk[];
  value: PierreCustomerValueSummary;
  health: PierreCustomerSuccessScore;
}): PierreCustomerRetentionScore {
  const { metrics, risks, value, health } = params;
  let score = 30;
  const reasons: string[] = [];

  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const highRisks = risks.filter((r) => r.severity === "high");

  // Usage régulier
  if (metrics.missions_total >= 5) {
    score += 20;
    reasons.push(`Usage régulier : ${metrics.missions_total} missions`);
  } else if (metrics.missions_total >= 2) {
    score += 12;
    reasons.push(`Usage actif : ${metrics.missions_total} missions`);
  } else if (metrics.missions_total === 0) {
    score -= 15;
    reasons.push("Aucun usage — risque de désengagement");
  }

  // Valeur visible
  if (value.visible_value_count >= 5) {
    score += 20;
    reasons.push("Valeur forte et multiple démontrée");
  } else if (value.visible_value_count >= 2) {
    score += 12;
    reasons.push("Valeur visible");
  } else {
    score -= 10;
  }

  // Documents générés
  if (metrics.premium_documents >= 3) {
    score += 15;
    reasons.push(`${metrics.premium_documents} documents premium — ROI tangible`);
  } else if (metrics.premium_documents >= 1) {
    score += 8;
  }

  // Dossiers salariés
  if (metrics.employee_files_total >= 3) {
    score += 12;
    reasons.push(`${metrics.employee_files_total} dossiers salariés — capital RH structuré`);
  } else if (metrics.employee_files_total >= 1) {
    score += 6;
  }

  // Santé globale
  if (health.score >= 70) score += 10;
  else if (health.score < 40) score -= 10;

  // Risques
  if (criticalRisks.length > 0) {
    score -= criticalRisks.length * 20;
    reasons.push(`${criticalRisks.length} blocker(s) critique(s) — engagement compromis`);
  }
  if (highRisks.length >= 2) {
    score -= highRisks.length * 7;
  }

  // Logs / traçabilité
  if (metrics.logs_total >= 10) score += 8;
  else if (metrics.logs_total >= 3) score += 4;

  score = clamp(Math.round(score), 0, 100);

  const status: "strong" | "medium" | "weak" | "danger" =
    score >= 80 ? "strong"
    : score >= 60 ? "medium"
    : score >= 40 ? "weak"
    : "danger";

  let label: string;
  if (status === "strong") label = "Rétention forte — client engagé et satisfait";
  else if (status === "medium") label = "Rétention correcte — continuer à démontrer la valeur";
  else if (status === "weak") label = "Rétention fragile — actions de renforcement nécessaires";
  else label = "Rétention en danger — risque de churn immédiat";

  return { score, status, label, reasons };
}

// ── Classification du stage customer ─────────────────────────────────────────

export function classifyPierreCustomerSuccessStage(params: {
  metrics: PierreCustomerSuccessReport["metrics"];
  health: PierreCustomerSuccessScore;
  conversion: PierreCustomerConversionReadiness;
  retention: PierreCustomerRetentionScore;
  risks: PierreCustomerRisk[];
}): PierreCustomerSuccessStage {
  const { metrics, health, conversion, retention, risks } = params;

  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const highRisks = risks.filter((r) => r.severity === "high");

  // successful : top tier
  if (
    health.status === "excellent" &&
    conversion.ready &&
    retention.status === "strong"
  ) {
    return "successful";
  }

  // new_account : aucune config, aucun usage
  if (
    metrics.missions_total === 0 &&
    metrics.tasks_total === 0 &&
    metrics.employees_total === 0 &&
    metrics.documents_total === 0
  ) {
    return "new_account";
  }

  // setup_in_progress : config présente (employees/docs) mais aucune mission lancée
  if (metrics.missions_total === 0 && metrics.tasks_total === 0) {
    return "setup_in_progress";
  }

  // churn_risk : missions présentes mais usage quasi nul + risques importants
  if (
    metrics.completed_tasks === 0 &&
    (criticalRisks.length > 0 || highRisks.length >= 2)
  ) {
    return "churn_risk";
  }

  // conversion_ready
  if (conversion.ready && criticalRisks.length === 0) {
    return "conversion_ready";
  }

  // value_visible
  if (
    health.score >= 55 &&
    (metrics.premium_documents >= 2 || metrics.completed_tasks >= 3 || metrics.employee_files_total >= 2)
  ) {
    return "value_visible";
  }

  // retention_risk : valeur partielle + risques non résolus
  if (
    metrics.missions_total >= 1 &&
    (highRisks.length >= 2 || retention.status === "weak" || retention.status === "danger")
  ) {
    return "retention_risk";
  }

  // activated : usage démarré
  return "activated";
}

// ── Actions customer success ──────────────────────────────────────────────────

export function buildPierreCustomerSuccessActions(params: {
  stage: PierreCustomerSuccessStage;
  metrics: PierreCustomerSuccessReport["metrics"];
  risks: PierreCustomerRisk[];
  conversion: PierreCustomerConversionReadiness;
  retention: PierreCustomerRetentionScore;
}): PierreCustomerSuccessAction[] {
  const { stage, metrics, risks, conversion, retention } = params;
  const actions: PierreCustomerSuccessAction[] = [];

  const criticalRisks = risks.filter((r) => r.severity === "critical");

  // Résoudre blockers critiques en premier
  if (criticalRisks.length > 0) {
    actions.push({
      type: "resolve_blockers",
      label: `Corriger ${criticalRisks.length} blocker(s) critique(s) immédiatement`,
      priority: "urgent",
      reason: criticalRisks[0].label,
      expected_impact: "Débloquer Pierre et restaurer la confiance client.",
    });
  }

  // Escalade support si churn_risk
  if (stage === "churn_risk") {
    actions.push({
      type: "escalate_support",
      label: "Contacter le client — risque de churn immédiat",
      priority: "urgent",
      reason: "Usage quasi nul détecté — intervention commerciale requise.",
      expected_impact: "Réengager le client avant la fin d'essai.",
    });
  }

  // Setup manquant
  if (
    risks.some((r) => r.type === "not_configured") ||
    stage === "new_account" ||
    stage === "setup_in_progress"
  ) {
    actions.push({
      type: "complete_setup",
      label: "Compléter la configuration Pierre (Empreinte Entreprise + salariés)",
      priority: "urgent",
      reason: "Sans configuration, Pierre ne peut pas travailler.",
      expected_impact: "Pierre devient opérationnel — premières missions possibles.",
    });
  }

  // Pas de missions
  if (metrics.missions_total === 0) {
    actions.push({
      type: "launch_high_value_mission",
      label: "Lancer la première mission à fort ROI (Audit RH initial recommandé)",
      priority: "high",
      reason: "Aucune mission lancée — valeur non démontrée.",
      expected_impact: "Premiers livrables visibles en moins de 30 minutes.",
    });
  }

  // Pas de documents premium
  if (metrics.premium_documents === 0 && metrics.missions_total >= 1) {
    actions.push({
      type: "generate_premium_document",
      label: "Générer le premier document RH premium (contrat ou rapport)",
      priority: "high",
      reason: "Aucun document premium — valeur tangible non visible.",
      expected_impact: "Pierre démontre sa capacité documentaire — ROI visible.",
    });
  }

  // Dossiers salariés
  if (metrics.employee_files_total === 0 && metrics.employees_total > 0) {
    actions.push({
      type: "review_employee_files",
      label: "Construire les dossiers salariés 360°",
      priority: "normal",
      reason: "Salariés présents mais aucun dossier 360° construit.",
      expected_impact: "Capital RH structuré — valeur centralisée visible.",
    });
  }

  // Plan d'essai si pas encore suivi
  if (stage === "activated" && conversion.score < 50) {
    actions.push({
      type: "run_trial_plan",
      label: "Suivre le plan d'essai 7 jours pour maximiser la valeur démontrée",
      priority: "normal",
      reason: "Score de conversion insuffisant — le plan d'essai guidé peut améliorer la situation.",
      expected_impact: "Augmentation du score de conversion de 20–30 points.",
    });
  }

  // Rapport de valeur
  if (stage === "value_visible" || (stage === "activated" && metrics.completed_tasks >= 2)) {
    actions.push({
      type: "show_value_report",
      label: "Présenter le rapport de valeur Pierre au dirigeant",
      priority: "normal",
      reason: "Valeur présente mais pas encore mise en avant devant le décideur.",
      expected_impact: "Accélère la décision de conversion.",
    });
  }

  // Préparer conversion
  if (conversion.ready || stage === "conversion_ready" || stage === "successful") {
    actions.push({
      type: "prepare_conversion_call",
      label: "Planifier l'appel de conversion — Pierre est prêt",
      priority: "high",
      reason: "Tous les indicateurs sont au vert pour convertir.",
      expected_impact: "Conversion en abonnement payant.",
    });
  }

  // Extension essai si rétention faible mais pas de churn_risk
  if (
    retention.status === "weak" &&
    stage !== "churn_risk" &&
    metrics.missions_total >= 1 &&
    conversion.score < 50
  ) {
    actions.push({
      type: "extend_trial",
      label: "Proposer une extension d'essai si valeur insuffisamment démontrée",
      priority: "low",
      reason: "Rétention fragile — plus de temps peut permettre de démontrer la valeur.",
      expected_impact: "Client mieux convaincu, conversion plus probable.",
    });
  }

  // No action si tout est parfait
  if (actions.length === 0) {
    actions.push({
      type: "no_action",
      label: "Pierre est en excellente santé — continuer l'utilisation",
      priority: "low",
      reason: "Aucun blocker détecté — le client est engagé et satisfait.",
      expected_impact: "Maintien de la satisfaction client.",
    });
  }

  return actions.slice(0, 8);
}

// ── Résumé dirigeant ──────────────────────────────────────────────────────────

export function buildPierreCustomerExecutiveSummary(params: {
  stage: PierreCustomerSuccessStage;
  health: PierreCustomerSuccessScore;
  conversion: PierreCustomerConversionReadiness;
  retention: PierreCustomerRetentionScore;
  value: PierreCustomerValueSummary;
  risks: PierreCustomerRisk[];
  actions: PierreCustomerSuccessAction[];
}): PierreCustomerSuccessExecutiveSummary {
  const { stage, health, conversion, retention, value, risks, actions } = params;

  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const hasValue = value.visible_value_count >= 2 || value.estimated_hours_saved_low >= 2;

  // Headline
  let headline: string;
  if (stage === "successful") {
    headline = `Pierre est prêt — valeur démontrée, conversion recommandée (santé ${health.score}/100)`;
  } else if (stage === "conversion_ready") {
    headline = `Pierre peut convertir — ${value.estimated_monthly_value_eur_low}–${value.estimated_monthly_value_eur_high}€/mois d'économie estimée`;
  } else if (stage === "churn_risk") {
    headline = "Alerte : Pierre est peu utilisé — risque de non-conversion élevé";
  } else if (criticalRisks.length > 0) {
    headline = `${criticalRisks.length} blocker(s) critique(s) à corriger avant de continuer`;
  } else if (stage === "value_visible") {
    headline = `La valeur Pierre est visible — ${value.strongest_proofs.length} preuve(s) concrète(s)`;
  } else if (stage === "activated") {
    headline = "Pierre est démarré — continuer pour démontrer la valeur complète";
  } else {
    headline = "Pierre est installé mais pas encore configuré — 15 minutes suffisent pour démarrer";
  }

  // Summary
  let summary: string;
  if (hasValue) {
    summary =
      `Pierre a produit une valeur estimée à ${value.estimated_monthly_value_eur_low}–${value.estimated_monthly_value_eur_high}€/mois ` +
      `(${value.estimated_hours_saved_low}–${value.estimated_hours_saved_high}h économisées). ` +
      `${value.strongest_proofs.length > 0 ? `Preuves : ${value.strongest_proofs[0]}. ` : ""}` +
      `Score de santé : ${health.score}/100. Score de conversion : ${conversion.score}/100.`;
  } else {
    summary =
      `Pierre est installé mais la valeur n'est pas encore suffisamment démontrée. ` +
      `Score de santé : ${health.score}/100. ` +
      `${criticalRisks.length > 0 ? `${criticalRisks.length} problème(s) critique(s) à corriger. ` : ""}` +
      `${actions.length > 0 && actions[0].type !== "no_action" ? `Prochaine action : ${actions[0].label}.` : ""}`;
  }

  // What worked
  const whatWorked: string[] = [];
  if (value.strongest_proofs.length > 0) {
    whatWorked.push(...value.strongest_proofs.slice(0, 3));
  }
  if (health.score >= 60) {
    whatWorked.push(`Santé Pierre correcte (${health.score}/100)`);
  }
  if (retention.status === "strong" || retention.status === "medium") {
    whatWorked.push("Engagement client positif");
  }
  if (whatWorked.length === 0) {
    whatWorked.push("Configuration initiale en cours");
  }

  // What is missing
  const whatIsMissing: string[] = conversion.missing_before_conversion.slice(0, 4);
  if (criticalRisks.length > 0) {
    whatIsMissing.unshift(`Correction urgente : ${criticalRisks[0].label}`);
  }
  if (whatIsMissing.length === 0) {
    whatIsMissing.push("Rien de bloquant — continuer l'utilisation");
  }

  // Recommendation
  let recommendation: string;
  if (stage === "successful" || stage === "conversion_ready") {
    recommendation =
      `Planifier l'appel de conversion cette semaine. ` +
      `Pierre est prêt à passer en abonnement — ROI estimé : ${value.estimated_monthly_value_eur_low}–${value.estimated_monthly_value_eur_high}€/mois.`;
  } else if (stage === "churn_risk") {
    recommendation =
      "Intervention urgente requise. Contacter le client pour identifier les freins à l'utilisation. " +
      "Proposer une session d'accompagnement personnalisée pour relancer l'usage.";
  } else if (criticalRisks.length > 0) {
    recommendation =
      `Corriger en priorité : ${criticalRisks[0].label}. ` +
      "Ces blockers empêchent Pierre de fonctionner correctement et nuisent à la confiance client.";
  } else if (stage === "value_visible" || stage === "activated") {
    recommendation =
      `Continuer à utiliser Pierre — ${actions.length > 0 && actions[0].type !== "no_action" ? actions[0].label : "lancer d'autres missions"}. ` +
      `Objectif : atteindre ${conversion.missing_before_conversion.length === 0 ? "la conversion" : "les critères de conversion"} d'ici la fin de l'essai.`;
  } else {
    recommendation =
      "Compléter la configuration Pierre maintenant — 15–20 minutes pour l'Empreinte Entreprise + " +
      "1 première mission pour voir la valeur immédiatement.";
  }

  return { headline, summary, what_worked: whatWorked, what_is_missing: whatIsMissing, recommendation };
}

// ── Rapport principal ────────────────────────────────────────────────────────

export function buildPierreCustomerSuccessReport(
  params: PierreCustomerSuccessParams,
): PierreCustomerSuccessReport {
  const safeParams: PierreCustomerSuccessParams = {
    companyMemory: isObject(params.companyMemory) ? params.companyMemory : null,
    missions: safeRows(params.missions),
    tasks: safeRows(params.tasks),
    documents: safeRows(params.documents),
    logs: safeRows(params.logs),
    employees: safeRows(params.employees),
    employeeFiles: (params.employeeFiles ?? []).filter(isObject),
    trialReport: params.trialReport,
    releaseReport: params.releaseReport,
    readinessReport: params.readinessReport,
    now: params.now ?? new Date(),
  };

  const metrics = computePierreCustomerSuccessMetrics(safeParams);
  const signals = detectPierreCustomerSuccessSignals(safeParams);
  const risks = detectPierreCustomerRisks(safeParams, signals);
  const value = buildPierreCustomerValueSummary(safeParams, signals);
  const health = scorePierreCustomerHealth({ metrics, signals, risks, value });
  const conversion = scorePierreCustomerConversion({ metrics, signals, risks, value, health });
  const retention = scorePierreCustomerRetention({ metrics, signals, risks, value, health });

  const stage = classifyPierreCustomerSuccessStage({
    metrics, health, conversion, retention, risks,
  });

  const actions = buildPierreCustomerSuccessActions({
    stage, metrics, risks, conversion, retention,
  });

  const executive_summary = buildPierreCustomerExecutiveSummary({
    stage, health, conversion, retention, value, risks, actions,
  });

  return {
    generated_at: (safeParams.now ?? new Date()).toISOString(),
    stage,
    health,
    conversion,
    retention,
    value,
    signals,
    risks,
    actions,
    executive_summary,
    metrics,
  };
}

// ── Hint mission légère ──────────────────────────────────────────────────────

export function buildPierreCustomerSuccessMissionHint(params: {
  mission: Record<string, unknown>;
  tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  logs: Record<string, unknown>[];
  trialHint?: unknown;
  releaseHint?: unknown;
  readinessHint?: unknown;
  cloneADNHint?: {
    configured?: boolean;
    status?: string;
    completeness_score?: number;
  } | null;
}): {
  customer_stage: PierreCustomerSuccessStage;
  health_score: number;
  conversion_score: number;
  retention_score: number;
  main_risk: string | null;
  recommended_action: string | null;
} {
  const missionParams: PierreCustomerSuccessParams = {
    missions: [params.mission],
    tasks: safeRows(params.tasks),
    documents: safeRows(params.documents),
    logs: safeRows(params.logs),
  };

  const metrics = computePierreCustomerSuccessMetrics(missionParams);
  const signals = detectPierreCustomerSuccessSignals(missionParams);
  const risks = detectPierreCustomerRisks(missionParams, signals);
  const value = buildPierreCustomerValueSummary(missionParams, signals);
  const health = scorePierreCustomerHealth({ metrics, signals, risks, value });
  const conversion = scorePierreCustomerConversion({ metrics, signals, risks, value, health });
  const retention = scorePierreCustomerRetention({ metrics, signals, risks, value, health });

  const stage = classifyPierreCustomerSuccessStage({
    metrics, health, conversion, retention, risks,
  });

  const actions = buildPierreCustomerSuccessActions({
    stage, metrics, risks, conversion, retention,
  });

  const criticalRisk = risks.find((r) => r.severity === "critical");
  const highRisk = risks.find((r) => r.severity === "high");
  const mainRisk = criticalRisk ? criticalRisk.label : highRisk ? highRisk.label : null;
  const recommendedAction = actions.length > 0 && actions[0].type !== "no_action"
    ? actions[0].label
    : null;

  // CloneADN signal: if company profile is strong/locked, add a small health bonus
  const adnBonus =
    params.cloneADNHint &&
    params.cloneADNHint.configured &&
    (params.cloneADNHint.status === "strong" || params.cloneADNHint.status === "locked")
      ? 5
      : 0;

  return {
    customer_stage: stage,
    health_score: Math.min(100, health.score + adnBonus),
    conversion_score: Math.min(100, conversion.score + adnBonus),
    retention_score: Math.min(100, retention.score + adnBonus),
    main_risk: mainRisk,
    recommended_action: recommendedAction,
  };
}
