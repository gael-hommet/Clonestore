// src/lib/pierre/channels/types.ts
// B33 — Pierre-specific channel types. Bridges CloneOS channels to Pierre's mission/task model.

import type { ChannelKind, ChannelRiskLevel } from "../../cloneos/channels/types";

// ── Inbound routing decision for Pierre ──────────────────────────────────────

export type PierreInboundAction =
  | "create_mission"
  | "attach_to_existing_mission"
  | "ask_for_more_info"
  | "blocked_sensitive"
  | "ignored_not_for_pierre";

export type PierreInboundDecision = {
  action: PierreInboundAction;
  channel_identity_id: string | null;
  matched_agent_slug: string | null;
  risk_level: ChannelRiskLevel;
  blocked_reason: string | null;
  suggested_mission_id: string | null;
  metadata: Record<string, unknown>;
};

export type PierreInboundChannelRequest = {
  from: string;
  to: string[];
  subject: string | null;
  body_text: string | null;
  channel_kind: ChannelKind;
  company_id: string;
  received_at: string;
  raw_message_id?: string | null;
  metadata?: Record<string, unknown>;
};

// ── Outbound send request for Pierre ─────────────────────────────────────────

export type PierreChannelSendRequest = {
  company_id: string;
  agent_slug: string;
  channel_identity_id: string;
  to: string[];
  subject?: string | null;
  body: string;
  body_html?: string | null;
  message_type: "hr_communication" | "notification" | "document" | "confirmation" | "reminder" | "sensitive" | "other";
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;
  requested_by_user_id?: string | null;
  approval_required?: boolean;
  risk_level?: ChannelRiskLevel;
  metadata?: Record<string, unknown>;
};
