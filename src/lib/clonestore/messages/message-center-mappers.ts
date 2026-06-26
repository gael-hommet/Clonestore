// src/lib/clonestore/messages/message-center-mappers.ts
// PHASE 3.1 — Messages Real Data Read-Only Hook — Mappers DB → MessageCenterItem
//
// Transforme les lignes brutes Supabase en MessageCenterItem.
// Toujours : is_real_data = true, read_only = true.
// Mapping conservateur : si incertitude sur statut → "pending".

import type {
  MessageCenterItem,
  MessageCenterTab,
  MessageCenterStatus,
  MessageCenterPriority,
} from "./message-center-types";
import { ALERT_STATUS_STRINGS } from "./message-center-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

function safeStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  return fallback;
}

function safeIso(value: unknown): string {
  if (typeof value !== "string") return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return value;
}

function mapStatusToAlertTab(status: string): boolean {
  const lower = status.toLowerCase();
  return ALERT_STATUS_STRINGS.some((s) => lower.includes(s));
}

function mapDbStatusToMessageStatus(raw: string | null | undefined): MessageCenterStatus {
  if (!raw) return "pending";
  const s = raw.toLowerCase();
  if (s === "blocked" || s === "block") return "blocked";
  if (s.includes("validation") || s.includes("requires")) return "requires_validation";
  if (s === "done" || s === "completed" || s === "success") return "done";
  if (s === "delivered" || s === "sent") return "delivered";
  if (s === "archived") return "archived";
  if (s === "error" || s === "failed" || s === "refused") return "blocked";
  return "pending";
}

function mapStatusToPriority(raw: string | null | undefined): MessageCenterPriority {
  if (!raw) return "normal";
  const s = raw.toLowerCase();
  if (s === "blocked" || s.includes("error") || s.includes("failed") || s.includes("refused")) return "urgent";
  if (s.includes("validation") || s.includes("requires")) return "high";
  if (s === "done" || s === "completed" || s === "delivered") return "low";
  return "normal";
}

function buildBaseTags(kind: string, status: string): string[] {
  const tags: string[] = [kind, "real_data", "lecture seule"];
  if (status && status !== "pending") tags.push(status);
  return tags;
}

// ── pierre_missions → suivis / alertes ───────────────────────────────────────
// Colonnes utilisées : id, title, request_text, summary, status, created_at, updated_at
// Toutes les colonnes sont optionnelles — fallback si manquantes.

export function mapPierreMissionToMessageItem(row: DbRow): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  const status = safeStr(row.status, "pending");
  const isAlert = mapStatusToAlertTab(status);

  const title =
    safeStr(row.title) ||
    safeStr(row.request_text).slice(0, 80) ||
    "Mission Pierre (lecture seule)";

  const summary =
    safeStr(row.summary) ||
    safeStr(row.request_text) ||
    "Lecture seule — aucune action exécutée.";

  return {
    id: `mission:${id}`,
    tab: isAlert ? "alertes" : "suivis",
    title,
    summary: summary.slice(0, 300),
    priority: mapStatusToPriority(status),
    status: mapDbStatusToMessageStatus(status),
    source: "pierre",
    employee_slug: "pierre",
    created_at: safeIso(row.created_at),
    updated_at: safeStr(row.updated_at) || undefined,
    tags: buildBaseTags("mission", status),
    action_kind: "open_cockpit_pierre",
    action_label: "Voir dans le cockpit Pierre",
    href: "/agents/pierre/use",
    metadata: {
      table: "pierre_missions",
      mission_id: id,
      db_status: status,
    },
    is_real_data: true,
    read_only: true,
  };
}

// ── pierre_tasks → suivis / alertes ──────────────────────────────────────────
// Colonnes utilisées : id, mission_id, title, type, status, created_at, updated_at

export function mapPierreTaskToMessageItem(row: DbRow): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  const status = safeStr(row.status, "pending");
  const isAlert = mapStatusToAlertTab(status);

  const title =
    safeStr(row.title) ||
    `Tâche Pierre — ${safeStr(row.type, "inconnue")} (lecture seule)`;

  return {
    id: `task:${id}`,
    tab: isAlert ? "alertes" : "suivis",
    title,
    summary: "Lecture seule — tâche Pierre préparée. Aucune action exécutée depuis la messagerie.",
    priority: mapStatusToPriority(status),
    status: mapDbStatusToMessageStatus(status),
    source: "pierre",
    employee_slug: "pierre",
    created_at: safeIso(row.created_at),
    updated_at: safeStr(row.updated_at) || undefined,
    tags: buildBaseTags("task", status),
    action_kind: "open_cockpit_pierre",
    action_label: "Voir dans le cockpit Pierre",
    href: "/agents/pierre/use",
    metadata: {
      table: "pierre_tasks",
      task_id: id,
      mission_id: safeStr(row.mission_id) || null,
      task_type: safeStr(row.type) || null,
      db_status: status,
    },
    is_real_data: true,
    read_only: true,
  };
}

// ── pierre_task_logs → suivis (si utilisé) ───────────────────────────────────
// Table optionnelle — peut ne pas exister.

export function mapPierreTaskLogToMessageItem(row: DbRow): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  const status = safeStr(row.status, "pending");

  return {
    id: `task_log:${id}`,
    tab: "suivis",
    title: safeStr(row.message) || safeStr(row.event_type) || "Log Pierre (lecture seule)",
    summary: "Lecture seule — événement de trace Pierre. Aucune action exécutée.",
    priority: "low",
    status: mapDbStatusToMessageStatus(status),
    source: "clonetrace",
    employee_slug: "pierre",
    created_at: safeIso(row.created_at),
    tags: buildBaseTags("task_log", status),
    action_kind: "open_cockpit_pierre",
    href: "/agents/pierre/use",
    metadata: {
      table: "pierre_task_logs",
      log_id: id,
      db_status: status,
    },
    is_real_data: true,
    read_only: true,
  };
}

// ── pierre_documents → livraisons / alertes ───────────────────────────────────
// Colonnes utilisées : id, mission_id, task_id, title, type, status, created_at, updated_at
// Ne pas dire "document généré" — dire "document disponible" ou "brouillon"

export function mapPierreDocumentToMessageItem(row: DbRow): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  const status = safeStr(row.status, "pending");
  const docType = safeStr(row.type, "document");

  // Documents bloqués/en validation → Alertes
  const isAlert =
    status === "blocked" ||
    status.includes("refused") ||
    status.includes("validation");

  const title =
    safeStr(row.title) ||
    `Référence document — ${docType} (lecture seule)`;

  return {
    id: `document:${id}`,
    tab: isAlert ? "alertes" : "livraisons",
    title,
    summary:
      "Lecture seule — référence de document Pierre disponible. " +
      "Brouillon ou document préparé — validation humaine requise avant toute diffusion.",
    priority: mapStatusToPriority(status),
    status: mapDbStatusToMessageStatus(status),
    source: "pierre",
    employee_slug: "pierre",
    created_at: safeIso(row.created_at),
    updated_at: safeStr(row.updated_at) || undefined,
    tags: buildBaseTags("document", status),
    action_kind: "open_cockpit_pierre",
    action_label: "Ouvrir dans le cockpit Pierre",
    href: "/agents/pierre/use",
    metadata: {
      table: "pierre_documents",
      document_id: id,
      mission_id: safeStr(row.mission_id) || null,
      task_id: safeStr(row.task_id) || null,
      document_type: docType,
      db_status: status,
    },
    is_real_data: true,
    read_only: true,
  };
}

// ── pierre_outbound_emails → livraisons / alertes ─────────────────────────────
// Colonnes utilisées : id, mission_id, task_id, subject, status, created_at, updated_at
// JAMAIS "email envoyé" sans colonne explicite status = "sent" fiable.

export function mapPierreOutboundEmailToMessageItem(row: DbRow): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  const status = safeStr(row.status, "pending");
  const subject = safeStr(row.subject, "Email Pierre (lecture seule)");

  // Emails bloqués → Alertes
  const isAlert = mapStatusToAlertTab(status);

  // N'afficher "envoyé" que si status = "sent" de façon fiable
  const isSent = status.toLowerCase() === "sent";

  return {
    id: `email:${id}`,
    tab: isAlert ? "alertes" : "livraisons",
    title: isSent ? `Email envoyé : ${subject}` : `Brouillon email : ${subject}`,
    summary: isSent
      ? "Email envoyé via Pierre — lecture seule depuis la messagerie. Aucune action exécutée depuis ici."
      : "Brouillon email préparé par Pierre — non envoyé. Validation humaine requise avant envoi.",
    priority: mapStatusToPriority(status),
    status: mapDbStatusToMessageStatus(status),
    source: "pierre",
    employee_slug: "pierre",
    created_at: safeIso(row.created_at),
    updated_at: safeStr(row.updated_at) || undefined,
    tags: buildBaseTags("email", status),
    action_kind: "open_cockpit_pierre",
    action_label: "Voir dans le cockpit Pierre",
    href: "/agents/pierre/use",
    metadata: {
      table: "pierre_outbound_emails",
      email_id: id,
      mission_id: safeStr(row.mission_id) || null,
      task_id: safeStr(row.task_id) || null,
      is_sent: isSent,
      db_status: status,
    },
    is_real_data: true,
    read_only: true,
  };
}

// ── agent_runs → suivis / alertes (si table disponible) ──────────────────────
// Table optionnelle — filtrée par agent_slug = "pierre".
// PIERRE_AGENT_SLUG constant documente le filtre agent_slug.

const PIERRE_AGENT_SLUG = "pierre" as const;

export function mapAgentRunToMessageItem(row: DbRow): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  // Filtrage agent_slug = "pierre" si présent dans la row
  const agentSlug = safeStr(row.agent_slug);
  if (agentSlug && agentSlug !== PIERRE_AGENT_SLUG) return null;

  const status = safeStr(row.status, "pending");
  const isAlert = mapStatusToAlertTab(status);

  return {
    id: `agent_run:${id}`,
    tab: isAlert ? "alertes" : "suivis",
    title: safeStr(row.title) || `Exécution Pierre (lecture seule)`,
    summary: "Lecture seule — référence d'exécution Pierre. Aucune action exécutée depuis la messagerie.",
    priority: mapStatusToPriority(status),
    status: mapDbStatusToMessageStatus(status),
    source: "pierre",
    employee_slug: PIERRE_AGENT_SLUG,
    created_at: safeIso(row.created_at),
    updated_at: safeStr(row.updated_at) || undefined,
    tags: buildBaseTags("agent_run", status),
    action_kind: "open_cockpit_pierre",
    href: "/agents/pierre/use",
    metadata: {
      table: "agent_runs",
      run_id: id,
      agent_slug: agentSlug || PIERRE_AGENT_SLUG,
      db_status: status,
    },
    is_real_data: true,
    read_only: true,
  };
}

// ── Fallback générique ────────────────────────────────────────────────────────

export function mapUnknownRowToMessageItem(
  row: DbRow,
  source: string
): MessageCenterItem | null {
  const id = safeStr(row.id);
  if (!id) return null;

  return {
    id: `unknown:${id}`,
    tab: "suivis",
    title: safeStr(row.title) || `Élément Pierre — ${source}`,
    summary: "Lecture seule — donnée Pierre. Aucune action exécutée depuis la messagerie.",
    priority: "low",
    status: "pending",
    source: "pierre",
    employee_slug: "pierre",
    created_at: safeIso(row.created_at),
    tags: ["real_data", "lecture seule", source],
    action_kind: "open_cockpit_pierre",
    href: "/agents/pierre/use",
    metadata: { table: source, raw_id: id },
    is_real_data: true,
    read_only: true,
  };
}
