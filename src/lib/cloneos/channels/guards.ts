// src/lib/cloneos/channels/guards.ts
// B33 — Main send guard. Pure, no async, no DB.
// checkChannelSendGuards() is the single entry point before any send.

import type {
  ChannelIdentity,
  ChannelSendRequest,
  ChannelSendUsage,
  ChannelGuardDecision,
  ChannelRiskLevel,
} from "./types";
import { isChannelActive, isChannelVerified, isChannelOutbound, channelRequiresHumanValidation, getChannelDefaultRiskLevel } from "./identity";
import { checkChannelVerification, checkChannelStatusForSend, isOwnerAuthorized } from "./verification";
import { checkSendPermissions } from "./permissions";
import { getChannelConfig } from "./config";

// ── Sensitive keyword detector ────────────────────────────────────────────────

const SENSITIVE_KEYWORDS = /licenci|harcèl|harcel|disciplin|faute.?grave|prud.?homm|discrimin|contentieux|liciti|sancti|démission|destitut/i;

export function containsSensitiveContent(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  return SENSITIVE_KEYWORDS.test(text);
}

// ── Risk level resolver ───────────────────────────────────────────────────────

export function resolveRequestRiskLevel(
  identity: ChannelIdentity,
  request: ChannelSendRequest,
): ChannelRiskLevel {
  // Explicit risk on request overrides default, but "sensitive" and "blocked" always win
  const explicit = request.risk_level;

  if (explicit === "blocked") return "blocked";
  if (explicit === "sensitive") return "sensitive";

  // Check content
  const textToCheck = [
    request.subject ?? "",
    request.body ?? "",
  ].join(" ");

  if (containsSensitiveContent(textToCheck)) return "sensitive";

  if (explicit === "high") return "high";
  if (explicit === "medium") return "medium";
  if (explicit === "low") return "low";

  return getChannelDefaultRiskLevel(identity);
}

// ── Main guard ────────────────────────────────────────────────────────────────

export function checkChannelSendGuards(params: {
  identity: ChannelIdentity;
  request: ChannelSendRequest;
  usage: ChannelSendUsage;
  requestedByUserId?: string | null;
}): ChannelGuardDecision {
  const { identity, request, usage, requestedByUserId } = params;
  const warnings: string[] = [];
  const config = getChannelConfig();

  // 1. Runtime mode disabled check (caller should block before reaching here, but guard it too)
  if (!identity.company_id) {
    return {
      allowed: false,
      approval_required: true,
      risk_level: "blocked",
      blocked_reason: "Canal sans company_id — envoi bloqué.",
      warnings,
    };
  }

  // 2. Channel status
  const statusCheck = checkChannelStatusForSend(identity);
  if (!statusCheck.ok) {
    return {
      allowed: false,
      approval_required: true,
      risk_level: "blocked",
      blocked_reason: statusCheck.errors.join("; "),
      warnings: [...warnings, ...statusCheck.warnings],
    };
  }
  warnings.push(...statusCheck.warnings);

  // 3. Verification check
  if (!config.allow_unverified_send) {
    const verifyCheck = checkChannelVerification(identity);
    if (!verifyCheck.ok) {
      return {
        allowed: false,
        approval_required: true,
        risk_level: "blocked",
        blocked_reason: verifyCheck.errors.join("; "),
        warnings: [...warnings, ...verifyCheck.warnings],
      };
    }
    warnings.push(...verifyCheck.warnings);
  } else {
    if (!isChannelVerified(identity)) {
      warnings.push("Canal non vérifié — envoi autorisé via CHANNEL_ALLOW_UNVERIFIED_SEND=true.");
    }
  }

  // 4. Direction
  if (!isChannelOutbound(identity)) {
    return {
      allowed: false,
      approval_required: false,
      risk_level: "blocked",
      blocked_reason: `Canal "${identity.label}" est inbound uniquement.`,
      warnings,
    };
  }

  // 5. Owner / sender authorization
  if (requestedByUserId !== null && requestedByUserId !== undefined) {
    if (!isOwnerAuthorized(identity, requestedByUserId)) {
      return {
        allowed: false,
        approval_required: true,
        risk_level: "high",
        blocked_reason: `Utilisateur "${requestedByUserId}" non autorisé à envoyer depuis ce canal.`,
        warnings,
      };
    }
  }

  // 6. Permissions (message type, recipients, rate limits)
  const permCheck = checkSendPermissions({ identity, request, usage });
  warnings.push(...permCheck.warnings);
  if (!permCheck.ok) {
    return {
      allowed: false,
      approval_required: false,
      risk_level: "blocked",
      blocked_reason: permCheck.errors.join("; "),
      warnings,
    };
  }

  // 7. Risk level + human validation
  const riskLevel = resolveRequestRiskLevel(identity, request);

  if (riskLevel === "blocked") {
    return {
      allowed: false,
      approval_required: true,
      risk_level: "blocked",
      blocked_reason: "Message bloqué par niveau de risque.",
      warnings,
    };
  }

  const approvalRequired =
    (request.approval_required === true) ||
    channelRequiresHumanValidation(identity, riskLevel);

  if (riskLevel === "sensitive") {
    return {
      allowed: true,
      approval_required: true,
      risk_level: "sensitive",
      blocked_reason: null,
      warnings: [...warnings, "Contenu sensible détecté — validation humaine obligatoire avant envoi."],
    };
  }

  return {
    allowed: true,
    approval_required: approvalRequired,
    risk_level: riskLevel,
    blocked_reason: null,
    warnings,
  };
}
