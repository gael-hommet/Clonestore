// src/lib/pierre/cockpit/types.ts
// Pierre Cockpit B31 + B40 — Pure client types.
// No Supabase, no Next, no async, no side effects.

export type PierreCockpitWorkspace =
  | "mission"
  | "validations"
  | "documents"
  | "emails"
  | "pdf"
  | "employees"
  | "cloneadn"
  | "trace"
  | "value"
  | "scenarios"
  | "settings";

export type PierreCockpitViewMode = "simple" | "pilot" | "advanced";

export type PierreCockpitMessageRole = "user" | "pierre" | "system";

export type PierreCockpitCardKind =
  | "mission"
  | "task"
  | "document"
  | "email"
  | "pdf"
  | "employee"
  | "risk"
  | "validation"
  | "value"
  | "scenario";

export type PierreCockpitCard = {
  id: string;
  kind: PierreCockpitCardKind;
  title: string;
  subtitle?: string;
  status?: string;
  riskLevel?: string;
  requiresValidation?: boolean;
  meta?: Record<string, unknown>;
};

export type PierreCockpitMessage = {
  id: string;
  role: PierreCockpitMessageRole;
  content: string;
  createdAt: string;
  cards?: PierreCockpitCard[];
  status?: "pending" | "done" | "error";
};

export type PierreCockpitMissionSummary = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  riskLevel: string;
  requiresValidation: boolean;
  tasksTotal: number;
  tasksDone: number;
  tasksBlocked: number;
  tasksAwaiting: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PierreCockpitTaskSummary = {
  id: string;
  missionId: string | null;
  type: string;
  title: string;
  description: string | null;
  status: string;
  riskLevel: string;
  requiresValidation: boolean;
  isEmailTask: boolean;
  isSensitive: boolean;
  executeAt: string | null;
  blockedReason: string | null;
  createdAt: string | null;
};

export type PierreCockpitDocumentSummary = {
  id: string;
  missionId: string | null;
  title: string;
  docType: string;
  status: string;
  qualityScore: number | null;
  requiresValidation: boolean;
  validationMode: string | null;
  riskLevel: string;
  isPdf: boolean;
  contentText: string | null;
  templateId: string | null;
  createdAt: string | null;
};

export type PierreCockpitEmployeeSummary = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  contractType: string | null;
  healthScore: number | null;
  riskLevel: string;
  openTasks: number;
  missingInfo: string[];
  lastActivity: string | null;
};

export type PierreCockpitValidationSummary = {
  taskId: string;
  missionId: string | null;
  title: string;
  type: string;
  reason: string | null;
  riskLevel: string;
  isEmailTask: boolean;
  isSensitive: boolean;
  requiresHuman: boolean;
  createdAt: string | null;
  // PHASE 8.2-C — V1 validation identity (the cockpit decides validations, not tasks).
  validationId?: string;
  version?: number;
  status?: string;
};

export type PierreCockpitRiskSummary = {
  level: "low" | "medium" | "high" | "critical";
  label: string;
  count: number;
  items: string[];
};

export type PierreCockpitROI = {
  hoursEstimated: number | null;
  valueEurLow: number | null;
  valueEurHigh: number | null;
  tasksCompleted: number;
  documentsProduced: number;
  healthStage: string | null;
  conversionScore: number | null;
  retentionScore: number | null;
  healthScore: number | null;
};

export type PierreCockpitApiState = {
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
};

export type PierreCockpitActionResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  status?: number;
};

export type PierreCockpitCloneADNSummary = {
  status: string;
  score: number | null;
  tone: string | null;
  autonomy: string | null;
  validationMode: string | null;
  signature: string | null;
  configured: boolean;
};

export type PierreCockpitRCStatus = {
  status: string;
  score: number;
  canStartCockpit: boolean;
  blockingIssues: number;
  recommendation: string | null;
};

export type PierreCockpitScenarioSummary = {
  id: string;
  officialId: string | null;
  label: string;
  description: string;
  positive: boolean;
  domain: string;
};

export type PierreCockpitAIStatus = {
  configured: boolean;
  mockAvailable: boolean;
  providersCount: number;
  contractsCount: number;
};

// ── B40: Cockpit State Machine ────────────────────────────────────────────────

export type PierreCockpitState =
  | "loading"             // Initial load in progress
  | "ready"               // Cockpit operational
  | "blocked_not_active"  // Pierre not activated (no order)
  | "blocked_not_paid"    // Order expired or cancelled
  | "blocked_no_company"  // No company_id resolvable from session
  | "blocked_no_access"   // Authenticated but access denied (wrong role/plan)
  | "degraded"            // Partial data — some services failed but cockpit usable
  | "error";              // Fatal unrecoverable error

// ── B40: Tenant Context ───────────────────────────────────────────────────────

export type PierreTenantContext = {
  organization_id: string | null;
  company_id: string | null;     // Resolved server-side — never trusted from client
  user_id: string | null;
  access_level: "anonymous" | "logged_unpaid" | "trial" | "paid_customer" | "internal_admin";
  active_agent_slug: "pierre";
  owns_pierre: boolean;          // has active/trialing order for pierre
  pierre_enabled: boolean;       // owns_pierre AND not emergency_shutdown
  source: "supabase_auth" | "mock_test" | "unknown";
};

// ── B40: Budget Status ────────────────────────────────────────────────────────

export type PierreBudgetStatus = {
  ai_mode: "disabled" | "mock" | "production";
  daily_used_cents: number | null;
  daily_cap_cents: number | null;
  monthly_used_cents: number | null;
  monthly_cap_cents: number | null;
  shield_active: boolean;
  emergency_shutdown: boolean;
  budget_ok: boolean;            // true when below caps
};

// ── B40: Runtime Mode Summary ─────────────────────────────────────────────────

export type PierreRuntimeModes = {
  ai_mode: string;               // mock | production | disabled
  email_mode: string;            // mock | dry_run | sandbox | live
  email_send_live: boolean;
  file_mode: string;             // mock | local | production
  channel_mode: string;          // mock | disabled | production
};

// ── B40: Cockpit Snapshot ─────────────────────────────────────────────────────

export type PierreCockpitSnapshot = {
  tenant: PierreTenantContext;
  state: PierreCockpitState;
  current_mission: PierreCockpitMissionSummary | null;
  missions: PierreCockpitMissionSummary[];
  tasks: PierreCockpitTaskSummary[];
  validations: PierreCockpitValidationSummary[];
  deliverables: PierreCockpitDocumentSummary[];
  timeline: PierreCockpitMessage[];
  memory_summary: PierreCockpitCloneADNSummary;
  channel_status: { email_mode: string; email_live: boolean };
  budget_status: PierreBudgetStatus;
  runtime_modes: PierreRuntimeModes;
  warnings: string[];
  next_actions: string[];
  generated_at: string;          // ISO timestamp
};
