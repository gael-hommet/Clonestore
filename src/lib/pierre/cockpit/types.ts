// src/lib/pierre/cockpit/types.ts
// Pierre Cockpit B31 — Pure client types.
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
