// src/lib/pierre/context/types.ts
// B35 — Pierre Memory & Context Layer — all shared types.
// Pure types only: no async, no DB, no AI calls, no side effects.

// ── Scopes ────────────────────────────────────────────────────────────────────

export type PierreContextScope =
  | "company"
  | "employee"
  | "mission"
  | "task"
  | "file"
  | "channel"
  | "history"
  | "rules"
  | "validation"
  | "risk"
  | "preference"
  | "adn";

// ── Sources ───────────────────────────────────────────────────────────────────

export type PierreContextSource =
  | "company_memory"
  | "clone_adn"
  | "employee_profile"
  | "mission_record"
  | "task_record"
  | "file_record"
  | "channel_identity"
  | "audit_log"
  | "inferred"
  | "heuristic"
  | "default";

// ── Signal types ──────────────────────────────────────────────────────────────

export type PierreContextSignalType =
  | "identity"
  | "status"
  | "risk_flag"
  | "preference"
  | "rule"
  | "validation_gate"
  | "history_event"
  | "missing_info"
  | "recommendation"
  | "constraint"
  | "capability"
  | "relationship";

// ── Priority ──────────────────────────────────────────────────────────────────

export type PierreContextPriority =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

// ── Risk ──────────────────────────────────────────────────────────────────────

export type PierreContextRisk =
  | "blocked"
  | "sensitive"
  | "high"
  | "medium"
  | "low"
  | "none";

// ── Signal ────────────────────────────────────────────────────────────────────

export type PierreContextSignal = {
  id: string;
  company_id: string;
  agent_slug: "pierre";
  scope: PierreContextScope;
  source: PierreContextSource;
  type: PierreContextSignalType;
  priority: PierreContextPriority;
  risk: PierreContextRisk;
  title: string;
  content: string;
  confidence: number;
  relevance_score: number;
  freshness_score: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  related_employee_id: string | null;
  related_mission_id: string | null;
  related_task_id: string | null;
  related_file_id: string | null;
  related_channel_id: string | null;
  related_document_id: string | null;
  metadata: Record<string, unknown>;
};

// ── Context pack ──────────────────────────────────────────────────────────────

export type PierreContextPack = {
  id: string;
  company_id: string;
  agent_slug: "pierre";
  built_for: string;
  employee_id: string | null;
  mission_id: string | null;
  task_id: string | null;
  file_id: string | null;
  channel_identity_id: string | null;
  signals: PierreContextSignal[];
  top_rules: PierreContextSignal[];
  top_preferences: PierreContextSignal[];
  top_warnings: PierreContextSignal[];
  missing_info: string[];
  risk_summary: string;
  validation_summary: string;
  employee_summary: string | null;
  mission_summary: string | null;
  file_summary: string | null;
  channel_summary: string | null;
  recommended_next_action: string | null;
  should_require_validation: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
};

// ── Build input ───────────────────────────────────────────────────────────────

export type PierreContextBuildInput = {
  company_id: string;
  built_for: string;
  // Optional context identifiers
  employee_id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  file_id?: string | null;
  channel_identity_id?: string | null;
  // Raw data from DB/memory (passed in — no async fetching here)
  company_memory?: Record<string, unknown> | null;
  clone_adn_profile?: Record<string, unknown> | null;
  employee_profile?: Record<string, unknown> | null;
  employees?: Record<string, unknown>[];
  mission?: Record<string, unknown> | null;
  tasks?: Record<string, unknown>[];
  files?: Record<string, unknown>[];
  channel_identity?: Record<string, unknown> | null;
  channel_identities?: Record<string, unknown>[];
  recent_logs?: Record<string, unknown>[];
  recent_missions?: Record<string, unknown>[];
  // Scoring modifiers
  current_task_type?: string | null;
  current_domain?: string | null;
  current_risk_level?: string | null;
};

// ── Build result ──────────────────────────────────────────────────────────────

export type PierreContextBuildResult = {
  pack: PierreContextPack;
  signal_count: number;
  missing_info: string[];
  should_require_validation: boolean;
  recommended_next_action: string | null;
  warnings: string[];
  build_duration_ms: number;
};
