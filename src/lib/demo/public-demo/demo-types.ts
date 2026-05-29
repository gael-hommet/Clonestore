// P-FINAL 01 — Phase 6 — Public demo types.
// Pure types only. No imports, no side effects.
// ABSOLUTE: Demo must never call real AI, send real emails, or create real accounts.

export type DemoActionType =
  | "view_dashboard"
  | "view_employee"
  | "view_task"
  | "view_document"
  | "simulate_task"
  | "simulate_email_draft"
  | "view_audit_trail";

export type DemoActionResult = "simulated" | "blocked" | "error";

export type DemoSessionStatus = "active" | "expired" | "terminated";

export interface DemoSession {
  session_id: string;
  started_at: string;
  expires_at: string;
  status: DemoSessionStatus;
  is_real_account: false;
  is_real_data: false;
  ai_calls_allowed: false;
  email_send_allowed: false;
  stripe_checkout_allowed: false;
  actions_performed: DemoActionType[];
  action_count: number;
  max_actions: number;
}

export interface DemoAction {
  type: DemoActionType;
  label: string;
  description: string;
  allowed: boolean;
  blocked_reason?: string;
  simulated_output?: string;
}

export interface DemoGuardResult {
  allowed: boolean;
  reason: string;
  is_safe: boolean;
  would_cost_real_money: boolean;
  would_send_real_data: boolean;
  would_create_real_account: boolean;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  persona: string;
  steps: DemoStep[];
  is_illustrative: boolean;
  uses_real_data: false;
}

export interface DemoStep {
  id: string;
  title: string;
  description: string;
  simulated_pierre_response: string;
  action_type: DemoActionType;
}
