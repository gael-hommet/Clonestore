// src/lib/pierre/cockpit/normalizers.ts
// Pierre Cockpit B31 — Null-safe normalizers for API responses.
// No Supabase, no Next, no window, no async. Never throws.

import type {
  PierreCockpitMissionSummary,
  PierreCockpitTaskSummary,
  PierreCockpitDocumentSummary,
  PierreCockpitEmployeeSummary,
  PierreCockpitValidationSummary,
  PierreCockpitROI,
  PierreCockpitCard,
  PierreCockpitCloneADNSummary,
  PierreCockpitRCStatus,
  PierreCockpitScenarioSummary,
  PierreCockpitAIStatus,
} from "./types";

// ══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = parseFloat(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return false;
}

function safeArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is Record<string, unknown> => isObject(item));
}

const EMAIL_TASK_TYPES = new Set(["email.send", "email.draft", "send_email", "email_send", "email_draft"]);
const SENSITIVE_TASK_TYPES = new Set([
  "email.send", "send_email", "doc.generate", "pdf.generate",
  "approval_required", "sensitive_case_note", "offboarding_checklist",
  "hr_contract_draft", "hr_amendment_draft", "prepay_summary",
]);

// ══════════════════════════════════════════════════════════════
// 1. MISSION RESPONSE
// ══════════════════════════════════════════════════════════════

export function normalizeMissionResponse(raw: unknown): PierreCockpitMissionSummary | null {
  try {
    if (!isObject(raw)) return null;

    const mission = isObject(raw.mission) ? raw.mission : raw;
    const id = asStr(mission.id);
    if (!id) return null;

    const tasks = safeArray(raw.tasks ?? mission.tasks);
    let done = 0;
    let blocked = 0;
    let awaiting = 0;
    for (const t of tasks) {
      const s = asStr(t.status).toLowerCase();
      if (s === "completed" || s === "done") done++;
      else if (s === "blocked" || s === "failed") blocked++;
      else if (s === "awaiting_approval" || s === "awaiting_info") awaiting++;
    }

    return {
      id,
      title: asStr(mission.title, "Mission sans titre"),
      summary: asStr(mission.summary) || null,
      status: asStr(mission.status, "unknown"),
      riskLevel: asStr(mission.risk_level, "normal"),
      requiresValidation: asBool(mission.approval_required),
      tasksTotal: tasks.length,
      tasksDone: done,
      tasksBlocked: blocked,
      tasksAwaiting: awaiting,
      createdAt: asStr(mission.created_at) || null,
      updatedAt: asStr(mission.updated_at) || null,
    };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 2. TASK LIST
// ══════════════════════════════════════════════════════════════

export function normalizeTaskList(raw: unknown): PierreCockpitTaskSummary[] {
  try {
    const tasks = Array.isArray(raw) ? raw : (isObject(raw) ? safeArray(raw.tasks ?? raw.data) : []);
    const result: PierreCockpitTaskSummary[] = [];

    for (const t of tasks) {
      if (!isObject(t)) continue;
      const id = asStr(t.id);
      if (!id) continue;

      const taskType = asStr(t.type || t.task_type, "unknown");
      result.push({
        id,
        missionId: asStr(t.mission_id) || null,
        type: taskType,
        title: asStr(t.title || t.type, "Tâche sans titre"),
        description: asStr(t.description) || null,
        status: asStr(t.status, "unknown"),
        riskLevel: asStr(t.risk_level, "normal"),
        requiresValidation: asBool(t.approval_required),
        isEmailTask: EMAIL_TASK_TYPES.has(taskType),
        isSensitive: SENSITIVE_TASK_TYPES.has(taskType) || asBool(t.approval_required),
        executeAt: asStr(t.execute_at) || null,
        blockedReason: asStr(t.blocked_reason || t.error_message) || null,
        createdAt: asStr(t.created_at) || null,
      });
    }

    return result;
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// 3. DOCUMENT LIST
// ══════════════════════════════════════════════════════════════

export function normalizeDocumentList(raw: unknown): PierreCockpitDocumentSummary[] {
  try {
    const docs = Array.isArray(raw) ? raw : (isObject(raw) ? safeArray(raw.documents ?? raw.data ?? raw.items) : []);
    const result: PierreCockpitDocumentSummary[] = [];

    for (const d of docs) {
      if (!isObject(d)) continue;
      const id = asStr(d.id);
      if (!id) continue;

      const payload = isObject(d.payload_json) ? d.payload_json : {};
      const docType = asStr(d.doc_type || d.document_type || payload.document_kind || payload.kind, "document");
      const isPdf = docType.includes("pdf") || asStr(d.format).toLowerCase().includes("pdf");

      result.push({
        id,
        missionId: asStr(d.mission_id) || null,
        title: asStr(d.title || payload.title, "Document sans titre"),
        docType,
        status: asStr(d.status, "draft"),
        qualityScore: asNum(payload.quality_score ?? d.quality_score),
        requiresValidation: asBool(d.requires_human_validation ?? payload.requires_human_validation),
        validationMode: asStr(payload.validation_mode || d.validation_mode) || null,
        riskLevel: asStr(payload.risk_level || d.risk_level, "low"),
        isPdf,
        contentText: asStr(payload.content_text || d.content_text) || null,
        templateId: asStr(payload.template_id || d.template_id) || null,
        createdAt: asStr(d.created_at) || null,
      });
    }

    return result;
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// 4. EMPLOYEE FILE INDEX
// ══════════════════════════════════════════════════════════════

export function normalizeEmployeeFileIndex(raw: unknown): PierreCockpitEmployeeSummary[] {
  try {
    const data = isObject(raw) ? raw : {};
    const list = safeArray(data.files ?? data.employees ?? data.data ?? []);

    return list.map((item): PierreCockpitEmployeeSummary => {
      const emp = isObject(item.employee) ? item.employee : item;
      const profile = isObject(item.profile) ? item.profile : {};
      const snapshot = isObject(item.snapshot) ? item.snapshot : {};

      const missingInfoRaw = Array.isArray(item.missing_info)
        ? item.missing_info
        : Array.isArray(snapshot.missing_info)
          ? snapshot.missing_info
          : [];
      const missingInfo: string[] = missingInfoRaw
        .filter((m: unknown) => typeof m === "string" || (isObject(m) && typeof m.key === "string"))
        .map((m: unknown) => (typeof m === "string" ? m : (isObject(m) ? asStr(m.key || m.label, "") : "")))
        .filter(Boolean);

      const openTasks = safeArray(item.open_tasks ?? snapshot.open_tasks ?? []).length;
      const riskLevel = asStr(item.risk_level ?? snapshot.risk_level ?? emp.risk_level, "normal");

      return {
        id: asStr(emp.id || item.employee_id, ""),
        name: asStr(emp.name || emp.full_name || profile.name, "Salarié"),
        email: asStr(emp.email || profile.email) || null,
        role: asStr(emp.role || emp.job_title || profile.role) || null,
        contractType: asStr(emp.contract_type || profile.contract_type) || null,
        healthScore: asNum(item.health_score ?? snapshot.health_score),
        riskLevel,
        openTasks,
        missingInfo,
        lastActivity: asStr(item.last_activity_at ?? snapshot.last_activity_at ?? emp.updated_at) || null,
      };
    });
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// 5. CLONEADN PROFILE
// ══════════════════════════════════════════════════════════════

export function normalizeCloneADNProfile(raw: unknown): PierreCockpitCloneADNSummary {
  const fallback: PierreCockpitCloneADNSummary = {
    status: "not_configured",
    score: null,
    tone: null,
    autonomy: null,
    validationMode: null,
    signature: null,
    configured: false,
  };

  try {
    if (!isObject(raw)) return fallback;

    const data = isObject(raw.profile) ? raw.profile : isObject(raw.adn) ? raw.adn : raw;
    const communication = isObject(data.communication) ? data.communication : {};
    const validation = isObject(data.validation) ? data.validation : {};
    const autonomy = isObject(data.autonomy) ? data.autonomy : {};
    const document = isObject(data.document) ? data.document : {};

    const status = asStr(data.status ?? raw.status, "not_configured");

    return {
      status,
      score: asNum(data.score ?? raw.score),
      tone: asStr(communication.tone || data.tone) || null,
      autonomy: asStr(autonomy.level || data.autonomy_level) || null,
      validationMode: asStr(validation.mode || validation.validation_mode || data.validation_mode) || null,
      signature: asStr(document.footer || document.signature || data.signature) || null,
      configured: status !== "not_configured" && status !== "partial",
    };
  } catch {
    return fallback;
  }
}

// ══════════════════════════════════════════════════════════════
// 6. CUSTOMER SUCCESS REPORT
// ══════════════════════════════════════════════════════════════

export function normalizeCustomerSuccessReport(raw: unknown): PierreCockpitROI {
  const fallback: PierreCockpitROI = {
    hoursEstimated: null,
    valueEurLow: null,
    valueEurHigh: null,
    tasksCompleted: 0,
    documentsProduced: 0,
    healthStage: null,
    conversionScore: null,
    retentionScore: null,
    healthScore: null,
  };

  try {
    if (!isObject(raw)) return fallback;

    const data = isObject(raw.report) ? raw.report : raw;
    const value = isObject(data.value) ? data.value : {};
    const health = isObject(data.health) ? data.health : {};
    const conversion = isObject(data.conversion) ? data.conversion : {};
    const retention = isObject(data.retention) ? data.retention : {};
    const metrics = isObject(data.metrics) ? data.metrics : {};

    return {
      hoursEstimated: asNum(value.hours_saved ?? value.estimated_hours_saved ?? metrics.hours_saved),
      valueEurLow: asNum(value.estimated_monthly_value_eur_low ?? value.value_eur_low),
      valueEurHigh: asNum(value.estimated_monthly_value_eur_high ?? value.value_eur_high),
      tasksCompleted: asNum(metrics.completed_tasks ?? metrics.tasks_total) ?? 0,
      documentsProduced: asNum(metrics.documents_total ?? metrics.premium_documents) ?? 0,
      healthStage: asStr(data.stage ?? data.health_stage) || null,
      conversionScore: asNum(conversion.score ?? data.conversion_score),
      retentionScore: asNum(retention.score ?? data.retention_score),
      healthScore: asNum(health.score ?? data.health_score),
    };
  } catch {
    return fallback;
  }
}

// ══════════════════════════════════════════════════════════════
// 7. RELEASE CANDIDATE REPORT
// ══════════════════════════════════════════════════════════════

export function normalizeReleaseCandidateReport(raw: unknown): PierreCockpitRCStatus {
  const fallback: PierreCockpitRCStatus = {
    status: "unknown",
    score: 0,
    canStartCockpit: false,
    blockingIssues: 0,
    recommendation: null,
  };

  try {
    if (!isObject(raw)) return fallback;

    const report = isObject(raw.report) ? raw.report : raw;
    const decision = isObject(report.release_decision) ? report.release_decision : {};

    return {
      status: asStr(report.status, "unknown"),
      score: asNum(report.score) ?? 0,
      canStartCockpit: asBool(decision.can_start_cockpit),
      blockingIssues: Array.isArray(report.blocking_issues) ? report.blocking_issues.length : 0,
      recommendation: asStr(decision.recommendation) || null,
    };
  } catch {
    return fallback;
  }
}

// ══════════════════════════════════════════════════════════════
// 8. GOLDEN SCENARIOS
// ══════════════════════════════════════════════════════════════

export function normalizeGoldenScenarios(raw: unknown): PierreCockpitScenarioSummary[] {
  try {
    const data = isObject(raw) ? raw : {};
    const list = safeArray(data.scenarios ?? data.data ?? []);

    return list.map((s): PierreCockpitScenarioSummary => ({
      id: asStr(s.id, ""),
      officialId: asStr(s.official_id) || null,
      label: asStr(s.label || s.name, "Scénario"),
      description: asStr(s.description, ""),
      positive: asBool(s.positive ?? true),
      domain: asStr(s.domain || s.hr_domain, "general"),
    })).filter((s) => s.id);
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// 9. BRAIN HINT EXTRACTOR
// ══════════════════════════════════════════════════════════════

export function extractBrainHint(raw: unknown): Record<string, unknown> | null {
  try {
    if (!isObject(raw)) return null;
    const hint = raw.brain_final_hint ?? raw.brain_hint;
    if (isObject(hint)) return hint;
    return null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 10. PREMIUM DOCUMENT HINT
// ══════════════════════════════════════════════════════════════

export function extractPremiumDocumentHint(raw: unknown): Record<string, unknown> | null {
  try {
    if (!isObject(raw)) return null;
    const ctx = isObject(raw.context_snapshot_json) ? raw.context_snapshot_json : raw;
    const hint = ctx.document_template_capability ?? ctx.premium_document_hint;
    if (isObject(hint)) return hint;
    return null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 11. CLONEADN HINT EXTRACTOR
// ══════════════════════════════════════════════════════════════

export function extractCloneADNHint(raw: unknown): Record<string, unknown> | null {
  try {
    if (!isObject(raw)) return null;
    const ctx = isObject(raw.context_snapshot_json) ? raw.context_snapshot_json : raw;
    const hint = ctx.cloneadn_hint ?? ctx.clone_adn_hint;
    if (isObject(hint)) return hint;
    return null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 12. VALIDATION ALERTS EXTRACTOR
// ══════════════════════════════════════════════════════════════

export function extractValidationAlerts(tasks: PierreCockpitTaskSummary[]): PierreCockpitValidationSummary[] {
  try {
    return tasks
      .filter((t) => t.requiresValidation || t.status === "awaiting_approval" || t.status === "awaiting_info")
      .map((t): PierreCockpitValidationSummary => ({
        taskId: t.id,
        missionId: t.missionId,
        title: t.title,
        type: t.type,
        reason: t.blockedReason,
        riskLevel: t.riskLevel,
        isEmailTask: t.isEmailTask,
        isSensitive: t.isSensitive,
        requiresHuman: t.requiresValidation,
        createdAt: t.createdAt,
      }));
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// 13. COCKPIT CARDS FROM MISSION
// ══════════════════════════════════════════════════════════════

export function extractCockpitCardsFromMission(
  mission: PierreCockpitMissionSummary | null,
  tasks: PierreCockpitTaskSummary[],
  documents: PierreCockpitDocumentSummary[],
): PierreCockpitCard[] {
  try {
    const cards: PierreCockpitCard[] = [];

    if (mission) {
      cards.push({
        id: mission.id,
        kind: "mission",
        title: mission.title,
        subtitle: mission.summary ?? undefined,
        status: mission.status,
        riskLevel: mission.riskLevel,
        requiresValidation: mission.requiresValidation,
        meta: {
          tasksTotal: mission.tasksTotal,
          tasksDone: mission.tasksDone,
          tasksBlocked: mission.tasksBlocked,
        },
      });
    }

    for (const task of tasks.slice(0, 6)) {
      if (task.requiresValidation || task.status === "awaiting_approval") {
        cards.push({
          id: task.id,
          kind: "validation",
          title: task.title,
          subtitle: task.blockedReason ?? undefined,
          status: task.status,
          riskLevel: task.riskLevel,
          requiresValidation: true,
        });
      }
    }

    for (const doc of documents.slice(0, 4)) {
      cards.push({
        id: doc.id,
        kind: doc.isPdf ? "pdf" : "document",
        title: doc.title,
        subtitle: doc.docType,
        status: doc.status,
        requiresValidation: doc.requiresValidation,
        meta: { qualityScore: doc.qualityScore, templateId: doc.templateId },
      });
    }

    return cards;
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// 14. AI RUNTIME STATUS
// ══════════════════════════════════════════════════════════════

export function normalizeAIStatus(raw: unknown): PierreCockpitAIStatus {
  const fallback: PierreCockpitAIStatus = {
    configured: false,
    mockAvailable: false,
    providersCount: 0,
    contractsCount: 0,
  };

  try {
    if (!isObject(raw)) return fallback;
    const data = isObject(raw.status) ? raw.status : raw;
    const providers = Array.isArray(data.providers) ? data.providers : [];
    const mockProvider = providers.find((p: unknown) => isObject(p) && asStr(p.provider) === "mock");

    return {
      configured: providers.length > 0,
      mockAvailable: isObject(mockProvider) ? asBool(mockProvider.configured) : false,
      providersCount: providers.length,
      contractsCount: asNum(data.prompt_contracts_count) ?? 0,
    };
  } catch {
    return fallback;
  }
}
