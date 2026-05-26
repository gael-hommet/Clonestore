// src/lib/security/audit.ts
// B41 — In-memory security audit. No Supabase required in tests.

import type { SecurityAuditEvent, SecurityDecisionStatus, SecurityDataSensitivity } from "./types";
import { hashForAudit, safeJsonForAudit } from "./redaction";

// ── In-memory store ───────────────────────────────────────────────────────────

export type InMemorySecurityAudit = {
  events: SecurityAuditEvent[];
};

export function createInMemorySecurityAudit(): InMemorySecurityAudit {
  return { events: [] };
}

// ── Event builder ─────────────────────────────────────────────────────────────

let _auditSeq = 0;
function nextAuditId(): string {
  return `sec_audit_${Date.now()}_${++_auditSeq}`;
}

export function buildSecurityAuditEvent(params: {
  event_type: string;
  actor_user_id?: string | null;
  company_id?: string | null;
  organization_id?: string | null;
  agent_slug?: string | null;
  route_id?: string | null;
  decision_status: SecurityDecisionStatus;
  data_sensitivity: SecurityDataSensitivity;
  resource_type?: string | null;
  resource_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
}): SecurityAuditEvent {
  return {
    id: nextAuditId(),
    event_type: params.event_type,
    actor_user_id: params.actor_user_id ?? null,
    company_id: params.company_id ?? null,
    organization_id: params.organization_id ?? null,
    agent_slug: params.agent_slug ?? null,
    route_id: params.route_id ?? null,
    decision_status: params.decision_status,
    data_sensitivity: params.data_sensitivity,
    resource_type: params.resource_type ?? null,
    resource_id: params.resource_id ?? null,
    ip_hash: params.ip ? hashForAudit(params.ip) : null,
    user_agent_hash: params.user_agent ? hashForAudit(params.user_agent) : null,
    metadata_redacted: safeJsonForAudit(params.metadata ?? {}),
    created_at: new Date().toISOString(),
  };
}

// ── Record to store ───────────────────────────────────────────────────────────

export function recordSecurityAuditEvent(
  audit: InMemorySecurityAudit,
  event: SecurityAuditEvent,
): void {
  audit.events.push(event);
}

// ── Query ─────────────────────────────────────────────────────────────────────

export function listSecurityAuditEvents(
  audit: InMemorySecurityAudit,
  filter?: {
    actor_user_id?: string;
    company_id?: string;
    decision_status?: SecurityDecisionStatus;
    route_id?: string;
    limit?: number;
  },
): SecurityAuditEvent[] {
  let events = [...audit.events];

  if (filter?.actor_user_id) {
    events = events.filter((e) => e.actor_user_id === filter.actor_user_id);
  }
  if (filter?.company_id) {
    events = events.filter((e) => e.company_id === filter.company_id);
  }
  if (filter?.decision_status) {
    events = events.filter((e) => e.decision_status === filter.decision_status);
  }
  if (filter?.route_id) {
    events = events.filter((e) => e.route_id === filter.route_id);
  }

  return filter?.limit ? events.slice(-filter.limit) : events;
}

export function summarizeSecurityAudit(audit: InMemorySecurityAudit): {
  total: number;
  blocked: number;
  allowed: number;
  by_status: Record<string, number>;
  by_sensitivity: Record<string, number>;
} {
  const by_status: Record<string, number> = {};
  const by_sensitivity: Record<string, number> = {};

  let blocked = 0;
  let allowed = 0;

  for (const event of audit.events) {
    by_status[event.decision_status] = (by_status[event.decision_status] ?? 0) + 1;
    by_sensitivity[event.data_sensitivity] = (by_sensitivity[event.data_sensitivity] ?? 0) + 1;

    if (event.decision_status === "allow") {
      allowed++;
    } else {
      blocked++;
    }
  }

  return {
    total: audit.events.length,
    blocked,
    allowed,
    by_status,
    by_sensitivity,
  };
}
