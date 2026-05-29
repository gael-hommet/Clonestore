// P-FINAL 01 — Phase 6 — Demo session management.
// No real auth, no real database, no persistence.
// Pure: no Supabase, no Next, no async, no throw.

import type { DemoSession, DemoSessionStatus } from "./demo-types";

const DEMO_DURATION_MINUTES = 30;
const DEMO_MAX_ACTIONS = 20;

export function createDemoSession(overrides?: Partial<DemoSession>): DemoSession {
  const now = new Date();
  const expires = new Date(now.getTime() + DEMO_DURATION_MINUTES * 60 * 1000);

  return {
    session_id: `demo_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    started_at: now.toISOString(),
    expires_at: expires.toISOString(),
    status: "active",
    is_real_account: false,
    is_real_data: false,
    ai_calls_allowed: false,
    email_send_allowed: false,
    stripe_checkout_allowed: false,
    actions_performed: [],
    action_count: 0,
    max_actions: DEMO_MAX_ACTIONS,
    ...overrides,
  };
}

export function terminateDemoSession(session: DemoSession): DemoSession {
  return { ...session, status: "terminated" };
}

export function expireDemoSession(session: DemoSession): DemoSession {
  return { ...session, status: "expired" };
}

export function getDemoSessionStatus(session: DemoSession): DemoSessionStatus {
  const now = new Date().toISOString();
  if (session.status === "terminated") return "terminated";
  if (session.expires_at < now) return "expired";
  if (session.action_count >= session.max_actions) return "expired";
  return session.status;
}

export function getDemoSessionSummary(session: DemoSession): {
  is_valid: boolean;
  status: DemoSessionStatus;
  actions_remaining: number;
  is_real_account: false;
  is_real_data: false;
} {
  const status = getDemoSessionStatus(session);
  return {
    is_valid: status === "active",
    status,
    actions_remaining: Math.max(0, session.max_actions - session.action_count),
    is_real_account: false,
    is_real_data: false,
  };
}

export const DEMO_MAX_ACTIONS_CONSTANT = DEMO_MAX_ACTIONS;
export const DEMO_DURATION_MINUTES_CONSTANT = DEMO_DURATION_MINUTES;
