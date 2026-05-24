// src/lib/pierre/channels/permissions.ts
// B33 — Pierre-specific channel permission rules. Pure, no async, no DB.

import type { ChannelIdentity, ChannelRiskLevel } from "../../cloneos/channels/types";
import type { PierreChannelSendRequest } from "./types";

// Pierre always requires human validation for these message types
const ALWAYS_REQUIRE_HUMAN_VALIDATION: string[] = ["sensitive", "hr_communication"];

// Pierre never auto-sends at these risk levels
const NEVER_AUTO_SEND_RISK_LEVELS: ChannelRiskLevel[] = ["sensitive", "blocked", "high"];

export function pierreRequiresApproval(
  request: PierreChannelSendRequest,
  resolvedRiskLevel: ChannelRiskLevel,
): boolean {
  if (request.approval_required === true) return true;
  if (NEVER_AUTO_SEND_RISK_LEVELS.includes(resolvedRiskLevel)) return true;
  if (ALWAYS_REQUIRE_HUMAN_VALIDATION.includes(request.message_type)) return true;
  return false;
}

export function isPierreAuthorizedForChannel(
  identity: ChannelIdentity,
  agentSlug: string,
): boolean {
  return identity.agent_slug === agentSlug;
}

export function pierreCanAutoReply(
  identity: ChannelIdentity,
  riskLevel: ChannelRiskLevel,
): boolean {
  if (riskLevel === "sensitive" || riskLevel === "blocked") return false;
  if (identity.autonomy_level === "draft_only") return false;
  if (identity.autonomy_level === "validation_required") return false;
  if (identity.requires_human_validation_by_default) return false;
  return true;
}
