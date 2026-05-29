// P-FINAL 01 — Phase 6 — Demo guard: blocks actions that would cost real money or data.
// Pure: no Supabase, no Next, no async, no throw.

import type { DemoGuardResult, DemoSession } from "./demo-types";
import { isDemoActionAllowed, BLOCKED_DEMO_ACTIONS_REASONS } from "./demo-safety-rules";

export type GuardableOperation =
  | "ai_api_call"
  | "email_send"
  | "stripe_checkout"
  | "database_write"
  | "account_create"
  | "demo_action";

export function guardDemoOperation(
  operation: GuardableOperation,
  actionType?: string
): DemoGuardResult {
  switch (operation) {
    case "ai_api_call":
      return {
        allowed: false,
        reason: BLOCKED_DEMO_ACTIONS_REASONS["real_ai_call"]!,
        is_safe: true,
        would_cost_real_money: true,
        would_send_real_data: false,
        would_create_real_account: false,
      };

    case "email_send":
      return {
        allowed: false,
        reason: BLOCKED_DEMO_ACTIONS_REASONS["real_email_send"]!,
        is_safe: true,
        would_cost_real_money: false,
        would_send_real_data: true,
        would_create_real_account: false,
      };

    case "stripe_checkout":
      return {
        allowed: false,
        reason: BLOCKED_DEMO_ACTIONS_REASONS["stripe_checkout"]!,
        is_safe: true,
        would_cost_real_money: true,
        would_send_real_data: false,
        would_create_real_account: false,
      };

    case "database_write":
      return {
        allowed: false,
        reason: BLOCKED_DEMO_ACTIONS_REASONS["real_data_write"]!,
        is_safe: true,
        would_cost_real_money: false,
        would_send_real_data: true,
        would_create_real_account: false,
      };

    case "account_create":
      return {
        allowed: false,
        reason: BLOCKED_DEMO_ACTIONS_REASONS["real_account_create"]!,
        is_safe: true,
        would_cost_real_money: false,
        would_send_real_data: false,
        would_create_real_account: true,
      };

    case "demo_action": {
      if (!actionType) {
        return { allowed: false, reason: "Action type required", is_safe: true, would_cost_real_money: false, would_send_real_data: false, would_create_real_account: false };
      }
      const allowed = isDemoActionAllowed(actionType as Parameters<typeof isDemoActionAllowed>[0]);
      return {
        allowed,
        reason: allowed ? "Action illustrative autorisée en démo" : "Action non autorisée en démo",
        is_safe: true,
        would_cost_real_money: false,
        would_send_real_data: false,
        would_create_real_account: false,
      };
    }

    default:
      return {
        allowed: false,
        reason: "Opération inconnue — bloquée par précaution",
        is_safe: true,
        would_cost_real_money: false,
        would_send_real_data: false,
        would_create_real_account: false,
      };
  }
}

export function isSessionValid(session: DemoSession): boolean {
  if (session.status !== "active") return false;
  if (session.action_count >= session.max_actions) return false;
  const now = new Date().toISOString();
  return session.expires_at > now;
}

export function isDemoSessionSafe(session: DemoSession): boolean {
  return (
    session.is_real_account === false &&
    session.is_real_data === false &&
    session.ai_calls_allowed === false &&
    session.email_send_allowed === false &&
    session.stripe_checkout_allowed === false
  );
}

export function canPerformAction(session: DemoSession, action: string): boolean {
  if (!isSessionValid(session)) return false;
  if (!isDemoSessionSafe(session)) return false;
  return guardDemoOperation("demo_action", action).allowed;
}
