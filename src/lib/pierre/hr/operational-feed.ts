// ═══════════════════════════════════════════════════════════
// Pierre HR Engine — Operational Feed / Messages / Alertes / Briefings
// Bloc 12.1 — Premium Hardening
// Module pur : pas de Supabase, pas de Next, pas d'async
// ═══════════════════════════════════════════════════════════

// ── Helpers internes ──────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function normalizeText(value: unknown): string {
  const s = asString(value);
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lowerText(value: unknown): string {
  const s = asString(value);
  return s ? s.toLowerCase() : "";
}

function safeJsonText(row: Record<string, unknown>): string {
  const directFields = [
    "title", "mission_summary", "message", "text_content", "description",
    "subject", "intent", "event_type", "doc_type", "type", "employee_name",
  ];
  const parts: string[] = [];
  for (const f of directFields) {
    const v = asString(row[f]);
    if (v) parts.push(v);
  }
  const nestedFields = [
    "payload_json", "brain_output_json", "meta_json", "context_snapshot_json",
  ];
  for (const f of nestedFields) {
    if (!isObject(row[f])) continue;
    const nested = row[f] as Record<string, unknown>;
    for (const k of ["title", "summary", "description", "intent", "type", "domain", "message"]) {
      const v = asString(nested[k]);
      if (v) parts.push(v);
    }
  }
  return parts.join(" ");
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = asString(row[k]);
    if (v) return v;
  }
  return null;
}

function extractEmployeeId(row: Record<string, unknown>): string | null {
  const direct = asString(row.employee_id);
  if (direct) return direct;
  const nestedKeys = ["payload_json", "brain_output_json", "context_snapshot_json", "meta_json"];
  for (const key of nestedKeys) {
    if (!isObject(row[key])) continue;
    const nested = row[key] as Record<string, unknown>;
    const fromDirect = asString(nested.employee_id);
    if (fromDirect) return fromDirect;
    if (isObject(nested.employee_context)) {
      const v = asString((nested.employee_context as Record<string, unknown>).employee_id);
      if (v) return v;
    }
    if (isObject(nested.employee_file_snapshot)) {
      const v = asString((nested.employee_file_snapshot as Record<string, unknown>).employee_id);
      if (v) return v;
    }
  }
  return null;
}

function extractEmployeeName(row: Record<string, unknown>): string | null {
  const direct = asString(row.employee_name);
  if (direct) return direct;
  const nestedKeys = ["payload_json", "brain_output_json", "context_snapshot_json", "meta_json"];
  for (const key of nestedKeys) {
    if (!isObject(row[key])) continue;
    const nested = row[key] as Record<string, unknown>;
    const fromDirect = asString(nested.employee_name) ?? asString(nested.name);
    if (fromDirect) return fromDirect;
    if (isObject(nested.employee_context)) {
      const ctx = nested.employee_context as Record<string, unknown>;
      const v = asString(ctx.employee_name) ?? asString(ctx.name);
      if (v) return v;
    }
    if (isObject(nested.employee_file_snapshot)) {
      const v = asString((nested.employee_file_snapshot as Record<string, unknown>).employee_name);
      if (v) return v;
    }
  }
  return null;
}

function extractCreatedAt(row: Record<string, unknown>): string | null {
  return asString(row.created_at) ?? null;
}

function extractRiskLevel(row: Record<string, unknown>): string {
  return lowerText(row.risk_level);
}

function extractStatus(row: Record<string, unknown>): string {
  return lowerText(row.status);
}

function extractType(row: Record<string, unknown>): string {
  return lowerText(row.type);
}

function simpleHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (((h << 5) + h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// ── Constantes ────────────────────────────────────────────

const PRIORITY_ORDER: Record<PierreOperationalFeedPriority, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
  low: 0,
};

const SEVERITY_ORDER: Record<PierreOperationalFeedSeverity, number> = {
  critical: 3,
  warning: 2,
  success: 1,
  info: 0,
};

const SECTION_LABELS: Record<PierreOperationalFeedCategory, string> = {
  alert: "Alertes",
  follow_up: "Suivis",
  delivery: "Livraisons",
  briefing: "Briefings",
};

const SECTION_ORDER: PierreOperationalFeedCategory[] = [
  "alert", "follow_up", "delivery", "briefing",
];

const PERIOD_LABELS: Record<PierreOperationalBriefingPeriod, string> = {
  instant: "Briefing instantané",
  daily: "Briefing quotidien",
  weekly: "Briefing hebdomadaire",
  monthly: "Briefing mensuel",
};

// ── Types exportés ────────────────────────────────────────

export type PierreOperationalFeedCategory =
  | "follow_up"
  | "briefing"
  | "delivery"
  | "alert";

export type PierreOperationalFeedSeverity =
  | "info"
  | "success"
  | "warning"
  | "critical";

export type PierreOperationalFeedPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type PierreOperationalFeedSourceType =
  | "mission"
  | "task"
  | "document"
  | "log"
  | "employee_file"
  | "continuity";

export type PierreOperationalBriefingPeriod =
  | "instant"
  | "daily"
  | "weekly"
  | "monthly";

export type PierreOperationalIntent =
  | "requires_human_validation"
  | "blocked_or_failed"
  | "sensitive_risk"
  | "ready_to_run"
  | "scheduled_followup"
  | "artifact_available"
  | "briefing_available"
  | "mission_progress"
  | "employee_file_attention"
  | "neutral";

export type PierreOperationalFeedActionKind =
  | "open_mission"
  | "open_task"
  | "open_employee_file"
  | "approve_task"
  | "run_task"
  | "provide_info"
  | "review_alert"
  | "open_document"
  | "read_briefing"
  | "none";

export type PierreOperationalFeedActionTarget = {
  kind: PierreOperationalFeedActionKind;
  label: string;
  href: string;
  method: "GET" | "POST";
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  document_id: string | null;
};

export type PierreOperationalFeedItem = {
  id: string;
  category: PierreOperationalFeedCategory;
  severity: PierreOperationalFeedSeverity;
  priority: PierreOperationalFeedPriority;
  title: string;
  message: string;
  source_type: PierreOperationalFeedSourceType;
  source_id: string | null;
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  created_at: string | null;
  action_required: boolean;
  action_label: string | null;
  tags: string[];
  raw: Record<string, unknown>;
  // Premium fields (Bloc 12.1)
  intent: PierreOperationalIntent;
  action_kind: PierreOperationalFeedActionKind;
  action_target: PierreOperationalFeedActionTarget | null;
  display_context: string | null;
  is_sensitive: boolean;
  is_blocking: boolean;
  is_delivery: boolean;
  is_briefing: boolean;
};

export type PierreOperationalFeedSummary = {
  total: number;
  follow_up: number;
  briefing: number;
  delivery: number;
  alert: number;
  urgent: number;
  high: number;
  normal: number;
  low: number;
  critical: number;
  warning: number;
  success: number;
  info: number;
  action_required: number;
};

export type PierrePremiumFeedSummary = {
  headline: string;
  status: "clear" | "active" | "attention_required" | "blocked" | "sensitive";
  top_priority: string | null;
  next_action_label: string | null;
  has_blocking_alert: boolean;
  has_sensitive_case: boolean;
  alerts_count: number;
  followups_count: number;
  deliveries_count: number;
  briefings_count: number;
  action_required_count: number;
};

export type PierreOperationalBriefing = {
  id: string;
  title: string;
  text: string;
  period: PierreOperationalBriefingPeriod;
  created_at: string;
  stats: PierreOperationalFeedSummary;
  highlights: string[];
  risks: string[];
  next_actions: string[];
  // Premium fields (Bloc 12.1)
  executive_summary: string;
  risk_summary: string | null;
  delivery_summary: string | null;
  followup_summary: string | null;
  validation_summary: string | null;
  recommended_next_actions: string[];
  employee_focus: string | null;
  mission_focus: string | null;
};

export type PierreOperationalFeedSection = {
  category: PierreOperationalFeedCategory;
  label: string;
  count: number;
  items: PierreOperationalFeedItem[];
};

export type PierreOperationalCommandCenter = {
  primary_message: string;
  secondary_message: string | null;
  urgent_items: PierreOperationalFeedItem[];
  blocking_items: PierreOperationalFeedItem[];
  validation_items: PierreOperationalFeedItem[];
  delivery_items: PierreOperationalFeedItem[];
  followup_items: PierreOperationalFeedItem[];
  briefing_items: PierreOperationalFeedItem[];
  recommended_order: PierreOperationalFeedItem[];
};

export type PierreOperationalFeed = {
  generated_at: string;
  items: PierreOperationalFeedItem[];
  summary: PierreOperationalFeedSummary;
  briefings: PierreOperationalBriefing[];
  sections: PierreOperationalFeedSection[];
  // Premium fields (Bloc 12.1)
  premium_summary: PierrePremiumFeedSummary;
  command_center: PierreOperationalCommandCenter;
};

// ── Fonctions exportées ───────────────────────────────────

export function normalizeFeedDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch (_e) {
      return null;
    }
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const d = new Date(value.trim());
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch (_e) {
      return null;
    }
  }
  return null;
}

export function buildDeterministicFeedId(input: Record<string, unknown>): string {
  const parts = [
    asString(input.source_type) ?? "",
    asString(input.source_id) ?? "",
    asString(input.mission_id) ?? "",
    asString(input.task_id) ?? "",
    asString(input.category) ?? "",
    asString(input.title) ?? "",
    asString(input.created_at) ?? "",
  ].join("|");
  return `feed_${simpleHash(parts)}`;
}

/**
 * Normalise un alias de catégorie (fr/en/technique) vers la valeur canonique.
 * Retourne null si non reconnu.
 */
export function normalizeFeedCategoryAlias(
  raw: string,
): PierreOperationalFeedCategory | null {
  const lower = raw.toLowerCase().trim();
  const MAP: Record<string, PierreOperationalFeedCategory> = {
    alert: "alert",
    alerts: "alert",
    alerte: "alert",
    alertes: "alert",
    follow_up: "follow_up",
    followups: "follow_up",
    suivi: "follow_up",
    suivis: "follow_up",
    delivery: "delivery",
    deliveries: "delivery",
    livraison: "delivery",
    livraisons: "delivery",
    briefing: "briefing",
    briefings: "briefing",
  };
  return MAP[lower] ?? null;
}

/**
 * Infère la catégorie d'un item du feed.
 * ORDRE DE PRIORITÉ :
 *   1. Alert (keywords harcel/licenci/disciplin/risk/error/blocked/approval/sensitive)
 *   2. Briefing (keywords briefing/digest/summary/report/continuity)
 *   3. Delivery (document/artifact/pdf/generated)
 *   4. Follow_up (défaut)
 *
 * Correction Bloc 12.1 : briefing vérifié AVANT delivery pour éviter
 * que "operational_briefing_generated" soit classé en delivery.
 */
export function inferFeedCategory(
  row: Record<string, unknown>,
  sourceType: PierreOperationalFeedSourceType,
): PierreOperationalFeedCategory {
  if (!isObject(row)) return "follow_up";

  const text = normalizeText(safeJsonText(row));
  const status = lowerText(extractStatus(row));
  const riskLevel = extractRiskLevel(row);
  const eventType = lowerText(asString(row.event_type) ?? asString(row.event) ?? "");
  const type = extractType(row);

  // ── Vérifications spécifiques par sourceType ──
  if (sourceType === "employee_file") {
    const efStatus = lowerText(asString(row.status) ?? "");
    if (efStatus === "sensitive" || efStatus === "attention_required") return "alert";
    if (riskLevel === "red" || riskLevel === "black") return "alert";
    return "follow_up";
  }

  if (sourceType === "continuity") return "briefing";
  if (sourceType === "document") return "delivery";

  // ── Conditions ALERT (priorité maximale) ──
  const alertKeywords = /harcel|licenci|disciplin|prudhomm|discrimin|agress|faute grave/;
  if (alertKeywords.test(text)) return "alert";

  if (status === "blocked" || status === "error") return "alert";
  if (status === "awaiting_approval") return "alert";

  if (
    riskLevel === "red" || riskLevel === "black" ||
    riskLevel === "high" || riskLevel === "critical"
  ) return "alert";

  if (
    eventType.includes("error") ||
    eventType.includes("blocked") ||
    eventType.includes("failed") ||
    eventType.includes("risk") ||
    eventType.includes("approval") ||
    eventType.includes("sensitive")
  ) return "alert";

  const snap = isObject(row.employee_file_snapshot) ? row.employee_file_snapshot as Record<string, unknown> : null;
  if (snap) {
    const snapStatus = lowerText(asString(snap.status) ?? "");
    if (snapStatus === "sensitive" || snapStatus === "attention_required") return "alert";
    const snapRisk = lowerText(asString(snap.risk_level) ?? "");
    if (snapRisk === "red" || snapRisk === "black") return "alert";
  }

  // ── Conditions BRIEFING (avant DELIVERY — fix Bloc 12.1) ──
  // "operational_briefing_generated" contient "briefing" → briefing ✓
  // "daily_summary_generated" contient "summary" → briefing ✓
  // "continuity_digest_generated" contient "digest" → briefing ✓
  if (
    eventType.includes("briefing") ||
    eventType.includes("summary") ||
    eventType.includes("digest") ||
    eventType.includes("report") ||
    eventType.includes("continuity")
  ) return "briefing";

  if (/synth[eè]se|briefing|r[eé]sum[eé]|rapport/.test(text)) return "briefing";

  // ── Conditions DELIVERY ──
  if (
    type === "doc.generate" || type === "pdf.generate" || type === "doc.rewrite" ||
    type === "generate_document"
  ) {
    if (status === "done" || status === "completed") return "delivery";
  }

  if (
    eventType.includes("document") ||
    eventType.includes("artifact") ||
    eventType.includes("generated") ||
    eventType.includes("delivery") ||
    eventType.includes("pdf")
  ) return "delivery";

  if (/document.g[eé]n[eé]r|livraison|pr[eê]t|finalis/.test(text)) return "delivery";

  // ── FOLLOW_UP par défaut ──
  return "follow_up";
}

export function inferFeedSeverity(
  row: Record<string, unknown>,
  sourceType: PierreOperationalFeedSourceType,
): PierreOperationalFeedSeverity {
  if (!isObject(row)) return "info";

  const text = normalizeText(safeJsonText(row));
  const status = lowerText(extractStatus(row));
  const riskLevel = extractRiskLevel(row);
  const eventType = lowerText(asString(row.event_type) ?? asString(row.event) ?? "");

  if (riskLevel === "black") return "critical";
  if (/harcel|faute grave|prudhomm|discrimin|agress/.test(text)) return "critical";
  if (status === "error") return "critical";
  if (sourceType === "employee_file" && lowerText(asString(row.status) ?? "") === "sensitive") return "critical";

  if (status === "blocked" || status === "awaiting_approval") return "warning";
  if (riskLevel === "red" || riskLevel === "orange" || riskLevel === "high") return "warning";
  if (sourceType === "employee_file") {
    const efStatus = lowerText(asString(row.status) ?? "");
    if (efStatus === "attention_required" || efStatus === "incomplete") return "warning";
    const missingCount = asNumber(row.missing_info_count) ?? 0;
    if (missingCount > 0) return "warning";
  }
  if (status === "awaiting_info") return "warning";
  if (eventType.includes("blocked") || eventType.includes("failed") || eventType.includes("error")) return "warning";

  if (sourceType === "document") return "success";
  if (status === "done" || status === "completed") return "success";
  if (
    eventType.includes("completed") ||
    eventType.includes("generated") ||
    eventType.includes("execution_completed") ||
    eventType.includes("document")
  ) return "success";

  return "info";
}

export function inferFeedPriority(
  row: Record<string, unknown>,
  sourceType: PierreOperationalFeedSourceType,
): PierreOperationalFeedPriority {
  if (!isObject(row)) return "normal";

  const text = normalizeText(safeJsonText(row));
  const status = lowerText(extractStatus(row));
  const riskLevel = extractRiskLevel(row);
  const approval = asBool(row.approval_required);

  if (riskLevel === "black") return "urgent";
  if (/harcel|faute grave|prudhomm|discrimin|agress/.test(text)) return "urgent";
  if (status === "error") return "urgent";
  if (sourceType === "employee_file" && lowerText(asString(row.status) ?? "") === "sensitive") return "urgent";

  if (approval) return "high";
  if (status === "blocked" || status === "awaiting_approval") return "high";
  if (riskLevel === "red" || riskLevel === "orange" || riskLevel === "high") return "high";
  if (sourceType === "employee_file" && lowerText(asString(row.status) ?? "") === "attention_required") return "high";
  if (status === "awaiting_info") return "high";

  if (
    status === "ready" || status === "retry" || status === "scheduled" ||
    status === "active" || status === "running"
  ) return "normal";

  if (
    status === "done" || status === "completed" || status === "cancelled" ||
    status === "archived"
  ) return "low";

  if (sourceType === "employee_file" && lowerText(asString(row.status) ?? "") === "complete") return "low";

  return "normal";
}

/**
 * Infère l'intention opérationnelle d'un item du feed.
 * Permet à l'UI de savoir quoi afficher/proposer sans reparser les statuts.
 */
export function inferOperationalIntent(
  row: Record<string, unknown>,
  sourceType: PierreOperationalFeedSourceType,
): PierreOperationalIntent {
  if (!isObject(row)) return "neutral";

  const status = lowerText(extractStatus(row));
  const riskLevel = extractRiskLevel(row);
  const approval = asBool(row.approval_required);
  const eventType = lowerText(asString(row.event_type) ?? "");

  // requires_human_validation
  if (status === "awaiting_approval" || approval) return "requires_human_validation";
  if (eventType.includes("approval") || eventType.includes("validation")) return "requires_human_validation";

  // blocked_or_failed
  if (status === "blocked" || status === "error") return "blocked_or_failed";
  if (
    eventType.includes("blocked") ||
    eventType.includes("failed") ||
    eventType.includes("error")
  ) return "blocked_or_failed";

  // sensitive_risk
  if (riskLevel === "black" || riskLevel === "red") return "sensitive_risk";
  if (sourceType === "employee_file") {
    const efStatus = lowerText(asString(row.status) ?? "");
    if (efStatus === "sensitive") return "sensitive_risk";
    if (efStatus === "attention_required") return "employee_file_attention";
    if (efStatus === "incomplete") return "employee_file_attention";
    return "employee_file_attention";
  }

  // ready_to_run
  if (status === "ready" || status === "retry") return "ready_to_run";

  // scheduled_followup
  if (status === "scheduled") return "scheduled_followup";

  // artifact_available
  if (sourceType === "document") return "artifact_available";
  if (
    eventType.includes("document") ||
    eventType.includes("artifact") ||
    eventType.includes("pdf")
  ) return "artifact_available";

  // briefing_available
  if (sourceType === "continuity") return "briefing_available";
  if (
    eventType.includes("briefing") ||
    eventType.includes("digest") ||
    eventType.includes("summary") ||
    eventType.includes("report")
  ) return "briefing_available";

  // mission_progress
  if (sourceType === "mission") return "mission_progress";

  return "neutral";
}

/**
 * Construit la cible d'action pour un item du feed.
 * Les hrefs permettent à l'UI de naviguer directement.
 */
export function buildFeedActionTarget(
  row: Record<string, unknown>,
  sourceType: PierreOperationalFeedSourceType,
  category: PierreOperationalFeedCategory,
): PierreOperationalFeedActionTarget | null {
  if (!isObject(row)) return null;

  const status = lowerText(extractStatus(row));
  const approval = asBool(row.approval_required);

  // IDs disponibles selon le contexte
  const rawTaskId =
    asString(row.task_id) ??
    (sourceType === "task" ? asString(row.id) : null);
  const rawMissionId =
    asString(row.mission_id) ??
    (sourceType === "mission" ? asString(row.id) : null);
  const rawEmployeeId = extractEmployeeId(row);
  const rawDocumentId =
    asString(row.document_id) ??
    (sourceType === "document" ? asString(row.id) : null);

  // Task : awaiting_approval → approve_task
  if (sourceType === "task" && (status === "awaiting_approval" || approval)) {
    return {
      kind: "approve_task",
      label: "Valider la tâche",
      href: rawTaskId ? `/api/pierre/use/task/${rawTaskId}/approve` : "",
      method: "POST",
      mission_id: rawMissionId,
      task_id: rawTaskId,
      employee_id: rawEmployeeId,
      document_id: null,
    };
  }

  // Task : ready/retry sans approval → run_task
  if (sourceType === "task" && (status === "ready" || status === "retry") && !approval) {
    return {
      kind: "run_task",
      label: "Lancer la tâche",
      href: rawTaskId ? `/api/pierre/use/task/${rawTaskId}/run` : "",
      method: "POST",
      mission_id: rawMissionId,
      task_id: rawTaskId,
      employee_id: rawEmployeeId,
      document_id: null,
    };
  }

  // Blocage ou info manquante → provide_info
  if (status === "blocked" || status === "awaiting_info" || status === "awaiting_approval") {
    const href = rawMissionId
      ? `/agents/pierre/use?mission=${rawMissionId}`
      : "/agents/pierre/use";
    return {
      kind: "provide_info",
      label: sourceType === "task" ? "Débloquer la tâche" : "Compléter les informations",
      href,
      method: "GET",
      mission_id: rawMissionId,
      task_id: rawTaskId,
      employee_id: rawEmployeeId,
      document_id: null,
    };
  }

  // Mission → open_mission
  if (sourceType === "mission") {
    const mId = asString(row.id) ?? rawMissionId;
    return {
      kind: "open_mission",
      label: "Voir la mission",
      href: mId ? `/agents/pierre/use?mission=${mId}` : "/agents/pierre/use",
      method: "GET",
      mission_id: mId,
      task_id: null,
      employee_id: rawEmployeeId,
      document_id: null,
    };
  }

  // Employee file → open_employee_file
  if (sourceType === "employee_file" && rawEmployeeId) {
    return {
      kind: "open_employee_file",
      label: "Voir le dossier salarié",
      href: `/agents/pierre/use?employee=${rawEmployeeId}`,
      method: "GET",
      mission_id: null,
      task_id: null,
      employee_id: rawEmployeeId,
      document_id: null,
    };
  }

  // Document → open_document
  if (sourceType === "document") {
    return {
      kind: "open_document",
      label: "Voir le document",
      href: rawDocumentId ? `/api/pierre/use/employee/${rawDocumentId}/file` : "",
      method: "GET",
      mission_id: rawMissionId,
      task_id: null,
      employee_id: rawEmployeeId,
      document_id: rawDocumentId,
    };
  }

  // Briefing → read_briefing
  if (category === "briefing" || sourceType === "continuity") {
    return {
      kind: "read_briefing",
      label: "Lire le briefing",
      href: "/api/pierre/use/messages/briefing",
      method: "POST",
      mission_id: null,
      task_id: null,
      employee_id: null,
      document_id: null,
    };
  }

  // Alert sans target claire → review_alert
  if (category === "alert") {
    return {
      kind: "review_alert",
      label: "Examiner l'alerte",
      href: "/api/pierre/use/messages/alert",
      method: "GET",
      mission_id: rawMissionId,
      task_id: rawTaskId,
      employee_id: rawEmployeeId,
      document_id: null,
    };
  }

  return null;
}

/**
 * Construit le contexte d'affichage court d'un item (pour l'UI).
 */
export function buildFeedDisplayContext(item: PierreOperationalFeedItem): string | null {
  if (item.employee_name) return `Dossier salarié — ${item.employee_name}`;
  if (item.source_type === "document") {
    return item.title ? `Document — ${item.title}` : "Document RH";
  }
  if (item.source_type === "continuity") return "Briefing Pierre";
  if (item.source_type === "log" && item.mission_id) return `Mission ${item.mission_id}`;
  if (item.mission_id) return `Mission ${item.mission_id}`;
  if (item.task_id) return `Tâche ${item.task_id}`;
  return null;
}

// ── Helper interne pour display_context depuis variables locales ──

function computeDisplayContext(
  sourceType: PierreOperationalFeedSourceType,
  employeeName: string | null,
  missionId: string | null,
  taskId: string | null,
  title: string,
): string | null {
  if (employeeName) return `Dossier salarié — ${employeeName}`;
  if (sourceType === "document") return `Document — ${title}`;
  if (sourceType === "continuity") return "Briefing Pierre";
  if (missionId) return `Mission ${missionId}`;
  if (taskId) return `Tâche ${taskId}`;
  return null;
}

// ── Builders d'items ──────────────────────────────────────

export function buildFeedItemFromMission(row: Record<string, unknown>): PierreOperationalFeedItem {
  const sourceId = asString(row.id) ?? null;
  const missionId = sourceId;
  const created_at = normalizeFeedDate(extractCreatedAt(row));
  const status = lowerText(extractStatus(row));
  const riskLevel = extractRiskLevel(row);
  const approval = asBool(row.approval_required);

  const brain = isObject(row.brain_output_json) ? row.brain_output_json as Record<string, unknown> : null;
  const rawTitle =
    asString(row.mission_summary) ??
    asString(brain?.title) ??
    asString(brain?.intent) ??
    null;

  const employeeId = extractEmployeeId(row);
  const employeeName = extractEmployeeName(row);

  const category = inferFeedCategory(row, "mission");
  const severity = inferFeedSeverity(row, "mission");
  const priority = inferFeedPriority(row, "mission");
  const intent = inferOperationalIntent(row, "mission");

  // Titre premium : préférer le salarié si connu
  const subjectLabel = employeeName ? ` (salarié : ${employeeName})` : "";
  const baseTitle = rawTitle ?? "Mission RH";
  const title = baseTitle;

  // Message premium
  let message = "";
  switch (status) {
    case "blocked":
      message = employeeName
        ? `Mission bloquée — ${baseTitle}${subjectLabel}`
        : `Mission bloquée — intervention requise : ${baseTitle}`;
      break;
    case "awaiting_approval":
      message = employeeName
        ? `Validation requise — ${baseTitle}${subjectLabel}`
        : `Validation humaine requise : ${baseTitle}`;
      break;
    case "awaiting_info":
      message = `Information manquante — ${baseTitle}${subjectLabel}`;
      break;
    case "error":
      message = `Erreur mission — vérification requise : ${baseTitle}`;
      break;
    case "done":
      message = `Mission terminée — ${baseTitle}`;
      break;
    case "active":
      message = employeeName
        ? `Suivi actif — ${baseTitle}${subjectLabel}`
        : `Mission en cours : ${baseTitle}`;
      break;
    case "scheduled":
      message = `Mission planifiée : ${baseTitle}`;
      break;
    default:
      message = `Mission RH : ${baseTitle}`;
  }

  if (riskLevel === "high" || riskLevel === "red" || riskLevel === "black") {
    message += ` — Risque ${riskLevel}.`;
  }

  const actionRequired =
    status === "blocked" ||
    status === "error" ||
    status === "awaiting_approval" ||
    status === "awaiting_info" ||
    approval ||
    riskLevel === "black" ||
    riskLevel === "red";

  let actionLabel: string | null = null;
  if (status === "blocked") actionLabel = "Débloquer la mission";
  else if (status === "awaiting_approval" || approval) actionLabel = "Valider la mission";
  else if (status === "error") actionLabel = "Investiguer l'erreur";
  else if (status === "awaiting_info") actionLabel = "Compléter les informations";
  else if (riskLevel === "black") actionLabel = "Cas sensible — revue humaine requise";
  else if (riskLevel === "red") actionLabel = "Revue de mission risquée";

  const tags: string[] = ["mission"];
  if (status) tags.push(status);
  if (riskLevel && riskLevel !== "low" && riskLevel !== "") tags.push(`risk:${riskLevel}`);
  if (approval) tags.push("approval_required");

  const id = buildDeterministicFeedId({
    source_type: "mission",
    source_id: sourceId ?? "",
    mission_id: missionId ?? "",
    task_id: "",
    category,
    title,
    created_at: created_at ?? "",
  });

  const is_sensitive = riskLevel === "black" || riskLevel === "red";
  const is_blocking = status === "blocked" || status === "error";
  const action_target = buildFeedActionTarget(row, "mission", category);
  const action_kind = action_target?.kind ?? "none";
  const display_context = computeDisplayContext("mission", employeeName, missionId, null, title);

  return {
    id,
    category,
    severity,
    priority,
    title,
    message,
    source_type: "mission",
    source_id: sourceId,
    mission_id: missionId,
    task_id: null,
    employee_id: employeeId,
    employee_name: employeeName,
    created_at,
    action_required: actionRequired,
    action_label: actionLabel,
    tags,
    raw: row,
    intent,
    action_kind,
    action_target,
    display_context,
    is_sensitive,
    is_blocking,
    is_delivery: false,
    is_briefing: false,
  };
}

export function buildFeedItemFromTask(row: Record<string, unknown>): PierreOperationalFeedItem {
  const sourceId = asString(row.id) ?? null;
  const missionId = asString(row.mission_id) ?? null;
  const taskId = sourceId;
  const created_at = normalizeFeedDate(extractCreatedAt(row));
  const status = lowerText(extractStatus(row));
  const type = extractType(row);
  const approval = asBool(row.approval_required);
  const riskLevel = extractRiskLevel(row);

  const rawTitle = asString(row.title) ?? asString(row.type) ?? null;
  const title = rawTitle ?? "Tâche RH";

  const category = inferFeedCategory(row, "task");
  const severity = inferFeedSeverity(row, "task");
  const priority = inferFeedPriority(row, "task");
  const intent = inferOperationalIntent(row, "task");

  const employeeId = extractEmployeeId(row);
  const employeeName = extractEmployeeName(row);

  const subjectLabel = employeeName ? ` (salarié : ${employeeName})` : "";

  // Message premium
  let message = "";
  switch (status) {
    case "blocked":
      message = `Tâche bloquée — action requise : ${title}${subjectLabel}`;
      break;
    case "error":
      message = `Erreur tâche — investigation nécessaire : ${title}`;
      break;
    case "awaiting_approval":
      message = employeeName
        ? `Validation requise — ${title}${subjectLabel}`
        : `Validation requise : ${title}`;
      break;
    case "done":
    case "completed":
      message = `Tâche exécutée avec succès : ${title}`;
      break;
    case "ready":
    case "retry":
      message = `Tâche prête à être lancée : ${title}${subjectLabel}`;
      break;
    case "scheduled":
      message = `Tâche planifiée : ${title}`;
      break;
    case "running":
      message = `Tâche en cours d'exécution : ${title}`;
      break;
    default:
      message = `Tâche RH : ${title}`;
  }

  const actionRequired =
    status === "blocked" ||
    status === "error" ||
    status === "awaiting_approval" ||
    approval;

  let actionLabel: string | null = null;
  if (status === "blocked") actionLabel = "Débloquer la tâche";
  else if (status === "error") actionLabel = "Investiguer l'erreur";
  else if (status === "awaiting_approval" || approval) actionLabel = "Valider la tâche";
  else if (status === "ready" || status === "retry") actionLabel = "Lancer la tâche";
  else if (status === "scheduled") actionLabel = "Suivre la planification";

  const tags: string[] = ["task"];
  if (type) tags.push(type);
  if (status) tags.push(status);
  if (approval) tags.push("approval_required");
  if (riskLevel && riskLevel !== "") tags.push(`risk:${riskLevel}`);

  const id = buildDeterministicFeedId({
    source_type: "task",
    source_id: sourceId ?? "",
    mission_id: missionId ?? "",
    task_id: taskId ?? "",
    category,
    title,
    created_at: created_at ?? "",
  });

  const is_sensitive = riskLevel === "black" || riskLevel === "red";
  const is_blocking = status === "blocked" || status === "error";
  const action_target = buildFeedActionTarget(row, "task", category);
  const action_kind = action_target?.kind ?? "none";
  const display_context = computeDisplayContext("task", employeeName, missionId, taskId, title);

  return {
    id,
    category,
    severity,
    priority,
    title,
    message,
    source_type: "task",
    source_id: sourceId,
    mission_id: missionId,
    task_id: taskId,
    employee_id: employeeId,
    employee_name: employeeName,
    created_at,
    action_required: actionRequired,
    action_label: actionLabel,
    tags,
    raw: row,
    intent,
    action_kind,
    action_target,
    display_context,
    is_sensitive,
    is_blocking,
    is_delivery: false,
    is_briefing: false,
  };
}

export function buildFeedItemFromDocument(row: Record<string, unknown>): PierreOperationalFeedItem {
  const sourceId = asString(row.id) ?? null;
  const missionId = asString(row.mission_id) ?? null;
  const taskId = asString(row.task_id) ?? null;
  const created_at = normalizeFeedDate(extractCreatedAt(row));

  const rawTitle = asString(row.title) ?? asString(row.doc_type) ?? null;
  const title = rawTitle ?? "Document RH";

  const docType = asString(row.doc_type) ?? "document_rh";
  const employeeId = extractEmployeeId(row);
  const employeeName = extractEmployeeName(row);

  const message = employeeName
    ? `Livraison disponible — ${title} (salarié : ${employeeName})`
    : `Livraison disponible — ${title}`;

  const tags: string[] = ["document", docType];

  const id = buildDeterministicFeedId({
    source_type: "document",
    source_id: sourceId ?? "",
    mission_id: missionId ?? "",
    task_id: taskId ?? "",
    category: "delivery",
    title,
    created_at: created_at ?? "",
  });

  const action_target = buildFeedActionTarget(row, "document", "delivery");
  const action_kind = action_target?.kind ?? "open_document";
  const display_context = computeDisplayContext("document", employeeName, missionId, taskId, title);

  return {
    id,
    category: "delivery",
    severity: "success",
    priority: "low",
    title,
    message,
    source_type: "document",
    source_id: sourceId,
    mission_id: missionId,
    task_id: taskId,
    employee_id: employeeId,
    employee_name: employeeName,
    created_at,
    action_required: false,
    action_label: null,
    tags,
    raw: row,
    intent: "artifact_available",
    action_kind,
    action_target,
    display_context,
    is_sensitive: false,
    is_blocking: false,
    is_delivery: true,
    is_briefing: false,
  };
}

export function buildFeedItemFromLog(row: Record<string, unknown>): PierreOperationalFeedItem {
  const sourceId = asString(row.id) ?? null;
  const missionId = asString(row.mission_id) ?? null;
  const taskId = asString(row.task_id) ?? null;
  const created_at = normalizeFeedDate(extractCreatedAt(row));

  // Schéma correct : event_type / message / meta_json
  const eventType = asString(row.event_type) ?? asString(row.event) ?? null;
  const rawMessage =
    asString(row.message) ??
    (isObject(row.meta_json) ? asString((row.meta_json as Record<string, unknown>).message) : null) ??
    asString(eventType) ??
    "Événement RH";

  const title = rawMessage.length > 80 ? rawMessage.slice(0, 77) + "…" : rawMessage;
  const category = inferFeedCategory(row, "log");
  const severity = inferFeedSeverity(row, "log");
  const priority = inferFeedPriority(row, "log");
  const intent = inferOperationalIntent(row, "log");

  const employeeId = extractEmployeeId(row);
  const employeeName = extractEmployeeName(row);

  const eventTypeLower = lowerText(eventType);
  const messageLower = lowerText(rawMessage);
  const actionRequired =
    eventTypeLower.includes("approval") ||
    eventTypeLower.includes("blocked") ||
    eventTypeLower.includes("error") ||
    eventTypeLower.includes("risk") ||
    eventTypeLower.includes("sensitive") ||
    eventTypeLower.includes("failed") ||
    messageLower.includes("approbation") ||
    messageLower.includes("validation requise") ||
    messageLower.includes("bloqué");

  const actionLabel = actionRequired ? "Examiner l'événement" : null;

  const tags: string[] = ["log"];
  if (eventType) tags.push(eventType);

  const id = buildDeterministicFeedId({
    source_type: "log",
    source_id: sourceId ?? "",
    mission_id: missionId ?? "",
    task_id: taskId ?? "",
    category,
    title,
    created_at: created_at ?? "",
  });

  const is_sensitive = eventTypeLower.includes("sensitive") || eventTypeLower.includes("risk");
  const is_blocking = eventTypeLower.includes("blocked") || eventTypeLower.includes("error") || eventTypeLower.includes("failed");
  const is_delivery = category === "delivery";
  const is_briefing = category === "briefing";
  const action_target = buildFeedActionTarget(row, "log", category);
  const action_kind = action_target?.kind ?? "none";
  const display_context = computeDisplayContext("log", employeeName, missionId, taskId, title);

  return {
    id,
    category,
    severity,
    priority,
    title,
    message: rawMessage,
    source_type: "log",
    source_id: sourceId,
    mission_id: missionId,
    task_id: taskId,
    employee_id: employeeId,
    employee_name: employeeName,
    created_at,
    action_required: actionRequired,
    action_label: actionLabel,
    tags,
    raw: row,
    intent,
    action_kind,
    action_target,
    display_context,
    is_sensitive,
    is_blocking,
    is_delivery,
    is_briefing,
  };
}

export function buildFeedItemFromEmployeeFileSnapshot(
  row: Record<string, unknown>,
): PierreOperationalFeedItem {
  const employeeId = asString(row.employee_id) ?? null;
  const employeeName = asString(row.employee_name) ?? null;
  const status = lowerText(asString(row.status) ?? "");
  const riskLevel = extractRiskLevel(row);
  const healthScore = asNumber(row.health_score) ?? 100;
  const missingCount = asNumber(row.missing_info_count) ?? 0;
  const openTasksCount = asNumber(row.open_tasks_count) ?? 0;
  const pendingApprovalCount = asNumber(row.pending_approval_count) ?? 0;
  const created_at = normalizeFeedDate(row.latest_event_at);

  const nameLabel = employeeName ?? "salarié";
  const title = employeeName
    ? `Dossier salarié — ${employeeName}`
    : "Dossier salarié";

  let category: PierreOperationalFeedCategory;
  if (status === "sensitive" || status === "attention_required" || riskLevel === "red" || riskLevel === "black") {
    category = "alert";
  } else {
    category = "follow_up";
  }

  let severity: PierreOperationalFeedSeverity;
  if (status === "sensitive" || riskLevel === "black") {
    severity = "critical";
  } else if (status === "attention_required" || riskLevel === "red" || riskLevel === "orange") {
    severity = "warning";
  } else if (status === "incomplete") {
    severity = "warning";
  } else {
    severity = "info";
  }

  let priority: PierreOperationalFeedPriority;
  if (status === "sensitive" || riskLevel === "black") {
    priority = "urgent";
  } else if (status === "attention_required" || riskLevel === "red" || riskLevel === "orange") {
    priority = "high";
  } else if (status === "incomplete") {
    priority = "normal";
  } else {
    priority = "low";
  }

  let message = "";
  let actionLabel: string | null = null;
  const actionRequired = status !== "complete";

  switch (status) {
    case "sensitive":
      message = `Alerte RH — dossier salarié sensible : ${nameLabel}. Score santé : ${healthScore}/100.`;
      actionLabel = "Revoir le dossier sensible";
      break;
    case "attention_required":
      message = `Dossier salarié — attention requise : ${nameLabel}.${openTasksCount > 0 ? ` ${openTasksCount} tâche(s) ouvertes.` : ""}`;
      actionLabel = "Traiter le dossier salarié";
      break;
    case "incomplete":
      message = `Dossier salarié incomplet — ${nameLabel} : ${missingCount} information(s) manquante(s).${pendingApprovalCount > 0 ? ` ${pendingApprovalCount} approbation(s) requise(s).` : ""}`;
      actionLabel = "Compléter le dossier salarié";
      break;
    default:
      message = `Dossier salarié complet et à jour : ${nameLabel}. Score santé : ${healthScore}/100.`;
      actionLabel = null;
  }

  const tags: string[] = ["employee_file"];
  if (employeeId) tags.push(`employee:${employeeId}`);
  if (riskLevel && riskLevel !== "green" && riskLevel !== "") tags.push(`risk:${riskLevel}`);
  if (status) tags.push(status);

  const id = buildDeterministicFeedId({
    source_type: "employee_file",
    source_id: employeeId ?? "",
    mission_id: "",
    task_id: "",
    category,
    title,
    created_at: created_at ?? "",
  });

  const intent = inferOperationalIntent(row, "employee_file");
  const action_target = buildFeedActionTarget(row, "employee_file", category);
  const action_kind = action_target?.kind ?? (employeeId ? "open_employee_file" : "none");
  const is_sensitive = status === "sensitive" || riskLevel === "black" || riskLevel === "red";
  const display_context = `Dossier salarié — ${nameLabel}`;

  return {
    id,
    category,
    severity,
    priority,
    title,
    message,
    source_type: "employee_file",
    source_id: employeeId,
    mission_id: null,
    task_id: null,
    employee_id: employeeId,
    employee_name: employeeName,
    created_at,
    action_required: actionRequired,
    action_label: actionLabel,
    tags,
    raw: row,
    intent,
    action_kind,
    action_target,
    display_context,
    is_sensitive,
    is_blocking: false,
    is_delivery: false,
    is_briefing: false,
  };
}

// ── Builder interne continuity ─────────────────────────────

function buildFeedItemFromContinuityItem(row: Record<string, unknown>): PierreOperationalFeedItem {
  const text = pickFirstString(row, ["text", "message", "digest", "summary"]) ?? "Résumé continuité RH";
  const title = text.length > 80 ? text.slice(0, 77) + "…" : text;
  const created_at = normalizeFeedDate(extractCreatedAt(row));
  const missionId = asString(row.mission_id) ?? null;

  const id = buildDeterministicFeedId({
    source_type: "continuity",
    source_id: asString(row.id) ?? "",
    mission_id: missionId ?? "",
    task_id: "",
    category: "briefing",
    title,
    created_at: created_at ?? "",
  });

  const action_target: PierreOperationalFeedActionTarget = {
    kind: "read_briefing",
    label: "Lire le briefing",
    href: "/api/pierre/use/messages/briefing",
    method: "POST",
    mission_id: missionId,
    task_id: null,
    employee_id: null,
    document_id: null,
  };

  return {
    id,
    category: "briefing",
    severity: "info",
    priority: "normal",
    title,
    message: text,
    source_type: "continuity",
    source_id: asString(row.id) ?? null,
    mission_id: missionId,
    task_id: null,
    employee_id: null,
    employee_name: null,
    created_at,
    action_required: false,
    action_label: null,
    tags: ["continuity", "briefing"],
    raw: row,
    intent: "briefing_available",
    action_kind: "read_briefing",
    action_target,
    display_context: "Briefing Pierre",
    is_sensitive: false,
    is_blocking: false,
    is_delivery: false,
    is_briefing: true,
  };
}

// ── Utilitaires du feed ────────────────────────────────────

export function dedupeFeedItems(
  items: PierreOperationalFeedItem[],
): PierreOperationalFeedItem[] {
  const map = new Map<string, PierreOperationalFeedItem>();
  for (const item of items) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    if (PRIORITY_ORDER[item.priority] > PRIORITY_ORDER[existing.priority]) {
      map.set(item.id, item);
      continue;
    }
    if (PRIORITY_ORDER[item.priority] === PRIORITY_ORDER[existing.priority]) {
      const existTs = existing.created_at ? new Date(existing.created_at).getTime() : 0;
      const newTs = item.created_at ? new Date(item.created_at).getTime() : 0;
      if (!isNaN(newTs) && !isNaN(existTs) && newTs > existTs) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values());
}

export function sortFeedItems(
  items: PierreOperationalFeedItem[],
): PierreOperationalFeedItem[] {
  return [...items].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDiff !== 0) return severityDiff;

    if (a.action_required && !b.action_required) return -1;
    if (!a.action_required && b.action_required) return 1;

    if (a.created_at && b.created_at) {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      if (!isNaN(da) && !isNaN(db) && db !== da) return db - da;
    }
    if (a.created_at && !b.created_at) return -1;
    if (!a.created_at && b.created_at) return 1;

    return a.title.localeCompare(b.title);
  });
}

export function buildFeedSummary(
  items: PierreOperationalFeedItem[],
): PierreOperationalFeedSummary {
  const summary: PierreOperationalFeedSummary = {
    total: items.length,
    follow_up: 0,
    briefing: 0,
    delivery: 0,
    alert: 0,
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0,
    critical: 0,
    warning: 0,
    success: 0,
    info: 0,
    action_required: 0,
  };

  for (const item of items) {
    summary[item.category]++;
    summary[item.priority]++;
    summary[item.severity]++;
    if (item.action_required) summary.action_required++;
  }

  return summary;
}

export function buildFeedSections(
  items: PierreOperationalFeedItem[],
): PierreOperationalFeedSection[] {
  const byCategory = new Map<PierreOperationalFeedCategory, PierreOperationalFeedItem[]>();
  for (const cat of SECTION_ORDER) {
    byCategory.set(cat, []);
  }
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
  }

  return SECTION_ORDER.map((cat) => ({
    category: cat,
    label: SECTION_LABELS[cat],
    count: (byCategory.get(cat) ?? []).length,
    items: byCategory.get(cat) ?? [],
  }));
}

/**
 * Construit un résumé premium du feed opérationnel.
 */
export function buildPremiumFeedSummary(
  items: PierreOperationalFeedItem[],
): PierrePremiumFeedSummary {
  const hasSensitive = items.some((i) => i.is_sensitive || i.intent === "sensitive_risk");
  const hasBlocking = items.some((i) => i.is_blocking || i.intent === "blocked_or_failed");
  const hasAlert = items.some((i) => i.category === "alert");
  const alerts = items.filter((i) => i.category === "alert");
  const followups = items.filter((i) => i.category === "follow_up");
  const deliveries = items.filter((i) => i.category === "delivery");
  const briefings = items.filter((i) => i.category === "briefing");
  const actionItems = items.filter((i) => i.action_required);

  // Statut global
  let status: PierrePremiumFeedSummary["status"];
  if (hasSensitive) {
    status = "sensitive";
  } else if (hasBlocking) {
    status = "blocked";
  } else if (alerts.some((i) => i.priority === "high" || i.priority === "urgent")) {
    status = "attention_required";
  } else if (items.length > 0) {
    status = "active";
  } else {
    status = "clear";
  }

  // Top priority item
  const sorted = sortFeedItems(items);
  const topItem = sorted.length > 0 ? sorted[0] : null;

  // Headline premium
  let headline = "";
  if (status === "sensitive") {
    const sensitiveItem = items.find((i) => i.is_sensitive);
    headline = sensitiveItem
      ? `Cas sensible — ${sensitiveItem.title}`
      : "Situation RH sensible — revue humaine requise";
  } else if (status === "blocked") {
    headline = `${alerts.length} alerte(s) — intervention requise`;
  } else if (status === "attention_required") {
    headline = `${alerts.length} alerte(s) à traiter — ${followups.length} suivi(s) actif(s)`;
  } else if (deliveries.length > 0 && alerts.length === 0) {
    headline = `${deliveries.length} livraison(s) disponible(s) — poste RH actif`;
  } else if (items.length === 0) {
    headline = "Poste RH à jour — aucune action requise";
  } else {
    headline = `${items.length} message(s) Pierre — ${followups.length} suivi(s), ${alerts.length} alerte(s)`;
  }

  return {
    headline,
    status,
    top_priority: topItem ? topItem.title : null,
    next_action_label: topItem?.action_label ?? topItem?.action_kind !== "none" ? (topItem?.action_label ?? null) : null,
    has_blocking_alert: hasBlocking || hasAlert,
    has_sensitive_case: hasSensitive,
    alerts_count: alerts.length,
    followups_count: followups.length,
    deliveries_count: deliveries.length,
    briefings_count: briefings.length,
    action_required_count: actionItems.length,
  };
}

/**
 * Construit le centre de commandement opérationnel Pierre.
 */
export function buildOperationalCommandCenter(
  items: PierreOperationalFeedItem[],
): PierreOperationalCommandCenter {
  const sorted = sortFeedItems(items);

  const urgentItems = sorted.filter((i) => i.priority === "urgent").slice(0, 5);
  const blockingItems = sorted.filter((i) => i.is_blocking).slice(0, 5);
  const validationItems = sorted
    .filter((i) => i.intent === "requires_human_validation")
    .slice(0, 5);
  const deliveryItems = sorted.filter((i) => i.is_delivery || i.category === "delivery").slice(0, 5);
  const followupItems = sorted.filter((i) => i.category === "follow_up").slice(0, 10);
  const briefingItems = sorted.filter((i) => i.is_briefing || i.category === "briefing").slice(0, 3);

  // Ordre recommandé : urgent → bloqué → validation → briefing → suivi → livraison
  const seen = new Set<string>();
  const recommendedOrder: PierreOperationalFeedItem[] = [];
  for (const list of [urgentItems, blockingItems, validationItems, briefingItems, followupItems, deliveryItems]) {
    for (const item of list) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        recommendedOrder.push(item);
      }
    }
  }

  // Primary message
  let primaryMessage = "Poste RH opérationnel — ";
  if (urgentItems.length > 0) {
    primaryMessage = `${urgentItems.length} action(s) urgente(s) requises — ${urgentItems[0].title}`;
  } else if (validationItems.length > 0) {
    primaryMessage = `${validationItems.length} validation(s) en attente — ${validationItems[0].title}`;
  } else if (blockingItems.length > 0) {
    primaryMessage = `${blockingItems.length} tâche(s) bloquée(s) — intervention requise`;
  } else if (deliveryItems.length > 0) {
    primaryMessage = `${deliveryItems.length} livraison(s) disponible(s) — ${deliveryItems[0].title}`;
  } else if (followupItems.length > 0) {
    primaryMessage = `${followupItems.length} suivi(s) actif(s) en cours`;
  } else {
    primaryMessage = "Poste RH à jour — aucune action urgente";
  }

  let secondaryMessage: string | null = null;
  if (briefingItems.length > 0) {
    secondaryMessage = `Briefing disponible : ${briefingItems[0].title}`;
  } else if (deliveryItems.length > 0 && urgentItems.length > 0) {
    secondaryMessage = `${deliveryItems.length} livraison(s) disponible(s) en parallèle`;
  }

  return {
    primary_message: primaryMessage,
    secondary_message: secondaryMessage,
    urgent_items: urgentItems,
    blocking_items: blockingItems,
    validation_items: validationItems,
    delivery_items: deliveryItems,
    followup_items: followupItems,
    briefing_items: briefingItems,
    recommended_order: recommendedOrder.slice(0, 20),
  };
}

/**
 * Génère un briefing opérationnel premium (instant / daily / weekly / monthly).
 */
export function buildOperationalBriefing(
  items: PierreOperationalFeedItem[],
  period: PierreOperationalBriefingPeriod,
  now?: Date,
): PierreOperationalBriefing {
  const ts = now ?? new Date();
  const dateStr = ts.toISOString().slice(0, 10);
  const stats = buildFeedSummary(items);

  // Highlights : livraisons + tâches terminées
  const highlights: string[] = [];
  const deliveries = items.filter((i) => i.category === "delivery").slice(0, 3);
  for (const d of deliveries) highlights.push(d.title);
  const completedTasks = items.filter((i) => i.source_type === "task" && i.severity === "success").length;
  if (completedTasks > 0) highlights.push(`${completedTasks} tâche(s) terminée(s)`);
  if (stats.delivery > 0 && highlights.length === 0) {
    highlights.push(`${stats.delivery} livraison(s) disponible(s)`);
  }

  // Risks : alertes et items critiques
  const risks: string[] = [];
  const alertItems = items
    .filter((i) => i.category === "alert" || i.severity === "critical")
    .slice(0, 5);
  for (const a of alertItems) risks.push(a.title);

  // Next actions
  const nextActions: string[] = [];
  const actionItems = items
    .filter((i) => i.action_required && (i.priority === "urgent" || i.priority === "high"))
    .slice(0, 5);
  for (const a of actionItems) nextActions.push(a.action_label ?? a.title);

  // Texte principal
  const parts: string[] = [];
  if (stats.urgent > 0) {
    parts.push(`${stats.urgent} alerte(s) urgente(s) requièrent une action immédiate.`);
  } else if (stats.alert > 0) {
    parts.push(`${stats.alert} alerte(s) active(s) à traiter.`);
  }
  if (stats.delivery > 0) parts.push(`${stats.delivery} livraison(s) disponible(s).`);
  if (stats.follow_up > 0) parts.push(`${stats.follow_up} suivi(s) RH en cours.`);
  if (stats.action_required > 0) parts.push(`${stats.action_required} action(s) requises.`);
  if (parts.length === 0) parts.push("Aucune action urgente — dossiers RH à jour.");
  const text = parts.join(" ");

  // Executive summary premium
  const sensitiveItems = items.filter((i) => i.is_sensitive);
  const blockingItems = items.filter((i) => i.is_blocking);
  let executive_summary = `${PERIOD_LABELS[period]} Pierre — `;
  if (sensitiveItems.length > 0) {
    executive_summary += `${sensitiveItems.length} cas sensible(s) détecté(s). `;
  }
  if (blockingItems.length > 0) {
    executive_summary += `${blockingItems.length} blocage(s) à résoudre. `;
  }
  executive_summary += `${stats.total} message(s) au total : ${stats.alert} alerte(s), ${stats.delivery} livraison(s), ${stats.follow_up} suivi(s).`;

  // Risk summary
  const risk_summary = risks.length > 0
    ? `Risques actifs : ${risks.slice(0, 3).join(" · ")}`
    : null;

  // Delivery summary
  const delivery_summary = stats.delivery > 0
    ? `${stats.delivery} livraison(s) : ${highlights.filter((h) => !h.includes("tâche")).slice(0, 2).join(", ") || "disponibles"}`
    : null;

  // Follow-up summary
  const followupItems = items.filter((i) => i.category === "follow_up");
  const followup_summary = followupItems.length > 0
    ? `${followupItems.length} suivi(s) actif(s) — ${followupItems.slice(0, 2).map((i) => i.title).join(", ")}`
    : null;

  // Validation summary
  const validationItems = items.filter((i) => i.intent === "requires_human_validation");
  const validation_summary = validationItems.length > 0
    ? `${validationItems.length} validation(s) humaine(s) en attente`
    : null;

  // Recommended next actions (enriched)
  const recommendedNextActions: string[] = [];
  for (const a of actionItems.slice(0, 3)) {
    recommendedNextActions.push(a.action_label ?? a.title);
  }
  if (recommendedNextActions.length === 0 && stats.follow_up > 0) {
    recommendedNextActions.push("Consulter les suivis actifs");
  }

  // Employee focus
  const employeeItems = items.filter((i) => i.employee_name !== null);
  const uniqueEmployees = [...new Set(employeeItems.map((i) => i.employee_name).filter(Boolean))];
  const employee_focus = uniqueEmployees.length > 0
    ? `Salariés concernés : ${uniqueEmployees.slice(0, 3).join(", ")}`
    : null;

  // Mission focus
  const missionItems = items.filter((i) => i.mission_id !== null && i.source_type === "mission");
  const mission_focus = missionItems.length > 0
    ? `${missionItems.length} mission(s) active(s)`
    : null;

  const idInput = `${period}|${dateStr}|${stats.total}|${stats.alert}|${stats.delivery}`;

  return {
    id: `brief_${simpleHash(idInput)}`,
    title: `${PERIOD_LABELS[period]} — ${dateStr}`,
    text,
    period,
    created_at: ts.toISOString(),
    stats,
    highlights,
    risks,
    next_actions: nextActions,
    // Premium fields
    executive_summary,
    risk_summary,
    delivery_summary,
    followup_summary,
    validation_summary,
    recommended_next_actions: recommendedNextActions,
    employee_focus,
    mission_focus,
  };
}

/**
 * Construit le feed opérationnel complet depuis toutes les sources disponibles.
 */
export function buildPierreOperationalFeed(params: {
  missions?: unknown[];
  tasks?: unknown[];
  documents?: unknown[];
  logs?: unknown[];
  employee_file_snapshots?: unknown[];
  continuity_items?: unknown[];
  now?: Date;
  limit?: number;
}): PierreOperationalFeed {
  const now = params.now ?? new Date();
  const limit =
    typeof params.limit === "number" && params.limit > 0 ? params.limit : undefined;

  const rawItems: PierreOperationalFeedItem[] = [];

  const missions = Array.isArray(params.missions) ? params.missions : [];
  for (const m of missions) {
    if (!isObject(m)) continue;
    try { rawItems.push(buildFeedItemFromMission(m)); } catch (_e) { /* skip malformed row */ }
  }

  const tasks = Array.isArray(params.tasks) ? params.tasks : [];
  for (const t of tasks) {
    if (!isObject(t)) continue;
    try { rawItems.push(buildFeedItemFromTask(t)); } catch (_e) { /* skip malformed row */ }
  }

  const documents = Array.isArray(params.documents) ? params.documents : [];
  for (const d of documents) {
    if (!isObject(d)) continue;
    try { rawItems.push(buildFeedItemFromDocument(d)); } catch (_e) { /* skip malformed row */ }
  }

  const logs = Array.isArray(params.logs) ? params.logs : [];
  for (const l of logs) {
    if (!isObject(l)) continue;
    try { rawItems.push(buildFeedItemFromLog(l)); } catch (_e) { /* skip malformed row */ }
  }

  const snapshots = Array.isArray(params.employee_file_snapshots)
    ? params.employee_file_snapshots
    : [];
  for (const s of snapshots) {
    if (!isObject(s)) continue;
    try { rawItems.push(buildFeedItemFromEmployeeFileSnapshot(s)); } catch (_e) { /* skip malformed row */ }
  }

  const continuityItems = Array.isArray(params.continuity_items)
    ? params.continuity_items
    : [];
  for (const c of continuityItems) {
    if (!isObject(c)) continue;
    try { rawItems.push(buildFeedItemFromContinuityItem(c)); } catch (_e) { /* skip malformed row */ }
  }

  const deduped = dedupeFeedItems(rawItems);
  const sorted = sortFeedItems(deduped);
  const items = limit !== undefined ? sorted.slice(0, limit) : sorted;

  const summary = buildFeedSummary(items);
  const sections = buildFeedSections(items);
  const briefings = [buildOperationalBriefing(items, "instant", now)];
  const premium_summary = buildPremiumFeedSummary(items);
  const command_center = buildOperationalCommandCenter(items);

  return {
    generated_at: now.toISOString(),
    items,
    summary,
    briefings,
    sections,
    premium_summary,
    command_center,
  };
}
