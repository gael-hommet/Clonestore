// src/lib/clonestore/cloneos-history/cloneos-history-types.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Types
//
// Types pour la persistence de l'historique CloneOS.
// Ces types sont la forme persistable (compacte, sécurisée) de CloneOSCommandCenterResult.
//
// Invariants :
//   - raw_request jamais stocké complet si trop long/sensible
//   - préférer raw_request_summary (≤ 280 chars)
//   - metadata toujours redacted
//   - read_only = true pour affichage UI
//   - aucune clé secrète, token, sk_live_ dans les items

// ── Source des items ──────────────────────────────────────────────────────────

export type CloneOSHistorySource =
  | "localstorage"   // item depuis localStorage (PHASE 2.4)
  | "server"         // item depuis DB Supabase (PHASE 3.3+)
  | "imported";      // item importé depuis un autre contexte

// ── Mode de persistence ───────────────────────────────────────────────────────
// localstorage_only : mode actuel (PHASE 2.4 + 3.2)
// server_draft      : schéma défini, table non encore créée (PHASE 3.2)
// server_active     : table créée et RLS appliquée (PHASE 3.3+)

export type CloneOSHistoryPersistenceMode =
  | "localstorage_only"
  | "server_draft"
  | "server_active";

// ── Statuts ───────────────────────────────────────────────────────────────────
// Alignés sur CloneOSCommandStatus (TECH-08)

export type CloneOSHistoryStatus =
  | "received"
  | "classified"
  | "routed"
  | "planned"
  | "guarded"
  | "trace_ready"
  | "ready_for_execution"
  | "requires_validation"
  | "blocked"
  | "refused"
  | "failed"
  | "unknown";

// ── Niveau de risque ──────────────────────────────────────────────────────────

export type CloneOSHistoryRiskLevel = "low" | "medium" | "high" | "critical";

// ── Domaine ───────────────────────────────────────────────────────────────────

export type CloneOSHistoryDomain =
  | "hr" | "support" | "finance" | "admin" | "legal"
  | "sales" | "marketing" | "ops" | "engineering"
  | "general" | "unknown";

// ── Résumés imbriqués ─────────────────────────────────────────────────────────

export type CloneOSHistoryGuardSummary = {
  overall_decision: string;
  has_blocked_tasks: boolean;
  has_refused_tasks: boolean;
  has_validation_required_tasks: boolean;
  critical_action_count: number;
};

export type CloneOSHistoryTraceSummary = {
  timeline_id: string;
  event_count: number;
  trace_ready: boolean;
};

export type CloneOSHistoryMissionSummary = {
  mission_id: string;
  title: string;
  domain: CloneOSHistoryDomain;
  task_count: number;
  validation_required: boolean;
};

export type CloneOSHistoryTaskSummary = {
  task_id: string;
  title: string;
  requires_validation: boolean;
  guard_decision?: string;
};

// ── Item principal ────────────────────────────────────────────────────────────
// CloneOSHistoryItem est la forme persistable compacte.

export type CloneOSHistoryItem = {
  id: string;                             // id local (UUID ou prefixé "local:")
  command_id: string;                     // command_id CloneOS
  user_id?: string;                       // optionnel en localStorage
  company_id: string;                     // company_id ou "demo_company"
  raw_request_summary: string;            // résumé tronqué ≤ 280 chars JAMAIS le texte complet
  domain: CloneOSHistoryDomain;
  intent: string;
  status: CloneOSHistoryStatus;
  risk_level: CloneOSHistoryRiskLevel;
  employee_slug?: string;                 // employé routé si disponible
  employee_display_name?: string;
  mission_title?: string;
  mission_summary?: string;
  task_count: number;
  guard_decision?: string;
  human_validation_required: boolean;
  blocked: boolean;
  refused: boolean;
  trace_event_count: number;
  next_action?: string;
  source: CloneOSHistorySource;
  created_at: string;                     // ISO string
  updated_at: string;                     // ISO string
  read_only: true;                        // invariant absolu pour UI
  metadata: Record<string, unknown>;      // toujours redacted avant persistence
};

// ── Payload persistable ───────────────────────────────────────────────────────
// Forme envoyée vers la DB — jamais raw_request complet.

export type CloneOSHistoryPersistablePayload = Omit<CloneOSHistoryItem,
  "id" | "source" | "read_only"
> & {
  user_id: string; // obligatoire pour persistence serveur
};

// ── Résultats ─────────────────────────────────────────────────────────────────

export type CloneOSHistoryReadResult = {
  items: CloneOSHistoryItem[];
  source: CloneOSHistorySource;
  count: number;
  error: string | null;
};

export type CloneOSHistoryWriteResult = {
  ok: boolean;
  command_id: string;
  persisted: boolean;
  source: CloneOSHistorySource;
  error: string | null;
};

// ── Validation ────────────────────────────────────────────────────────────────

export type CloneOSHistoryValidationIssue = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type CloneOSHistoryValidationReport = {
  valid: boolean;
  issues: CloneOSHistoryValidationIssue[];
  issue_count: number;
};

// ── Constantes ────────────────────────────────────────────────────────────────

export const CLONEOS_HISTORY_TABLE_NAME = "clonestore_cloneos_history" as const;
export const CLONEOS_HISTORY_MAX_SUMMARY_LENGTH = 280;
export const CLONEOS_HISTORY_MAX_ITEMS = 20;
export const CLONEOS_HISTORY_PERSISTENCE_MODE: CloneOSHistoryPersistenceMode =
  "server_draft"; // Non encore activé — PHASE 3.3

// Clés à redacter dans metadata (secrets potentiels)
export const CLONEOS_HISTORY_REDACT_KEYS = [
  "password", "token", "secret", "api_key", "authorization",
  "stripe", "supabase", "openai", "anthropic", "private_key",
  "webhook_secret", "sk_live_", "whsec_", "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY", "bearer",
] as const;

// Phrases interdites dans items
export const CLONEOS_HISTORY_UNSAFE_PATTERNS = [
  "public launch go",
  "zéro erreur", "zero erreur",
  "conformité garantie", "conformite garantie",
  "clonevoice actif production",
  "mission exécutée avec succès",
  "document généré avec succès",
  "email envoyé avec succès",
] as const;
