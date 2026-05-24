// src/lib/pierre/context/channel-context.ts
// B35 — Channel context signals from B33 ChannelIdentity data.

import type { PierreContextSignal } from "./types";
import type { PierreContextRisk } from "./types";
import { buildContextSignal } from "./context-signals";

function safeStr(v: unknown, maxLen = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

function channelRiskToContextRisk(riskLevel: string | null): PierreContextRisk {
  switch (riskLevel) {
    case "blocked": return "blocked";
    case "sensitive": return "sensitive";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    default: return "none";
  }
}

export function buildChannelContextSignals(params: {
  company_id: string;
  channel_identity_id: string | null | undefined;
  channel_identity: Record<string, unknown> | null | undefined;
  channel_identities?: Record<string, unknown>[];
  mission_id?: string | null;
  employee_id?: string | null;
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];

  const channel =
    params.channel_identity ??
    (params.channel_identity_id && params.channel_identities
      ? params.channel_identities.find(
          (c) => safeStr(c.id) === params.channel_identity_id,
        ) ?? null
      : null);

  const allChannels = params.channel_identities ?? (channel ? [channel] : []);

  // Return early only if channel context was not requested at all
  if (!channel && !params.channel_identity_id && params.channel_identities === undefined) {
    return signals;
  }

  // ── Specific channel signal ───────────────────────────────────────────────

  if (channel) {
    const channelId = safeStr(channel.id) ?? params.channel_identity_id ?? "unknown";
    const kind = safeStr(channel.kind);
    const address = safeStr(channel.address) ?? safeStr(channel.email) ?? safeStr(channel.phone_number);
    const status = safeStr(channel.status);
    const verificationStatus = safeStr(channel.verification_status);
    const riskLevel = safeStr(channel.risk_level);
    const label = safeStr(channel.label) ?? safeStr(channel.display_name);
    const contextRisk = channelRiskToContextRisk(riskLevel);

    const isVerified = verificationStatus === "verified";
    const isSuspended = status === "suspended" || status === "revoked" || status === "failed";
    const isInactive = !isVerified || isSuspended;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "channel",
        source: "channel_identity",
        type: isSuspended ? "risk_flag" : isInactive ? "constraint" : "status",
        priority: isSuspended ? "critical" : isInactive ? "high" : "medium",
        risk: isSuspended ? "blocked" : isInactive ? "high" : contextRisk,
        title: `Canal: ${label ?? kind ?? "inconnu"}`,
        content: [
          kind ? `Type: ${kind}` : null,
          address ? `Adresse: ${address}` : null,
          status ? `Statut: ${status}` : null,
          verificationStatus ? `Vérification: ${verificationStatus}` : null,
          isSuspended ? "⚠ Canal suspendu — envoi bloqué." : null,
          !isVerified && !isSuspended ? "⚠ Canal non vérifié — envoi limité." : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.95,
        related_channel_id: channelId,
        related_mission_id: params.mission_id,
        related_employee_id: params.employee_id,
        currentTaskType: params.current_task_type,
        metadata: { kind, status, verification_status: verificationStatus, risk_level: riskLevel },
      }),
    );

    // ── Unverified channel constraint ─────────────────────────────────────

    if (!isVerified) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "channel",
          source: "channel_identity",
          type: "constraint",
          priority: "high",
          risk: "high",
          title: "Canal non vérifié — envoi interdit",
          content: `Pierre ne peut pas envoyer depuis un canal non vérifié (${kind ?? "inconnu"} — ${address ?? "adresse inconnue"}). Vérification requise avant tout envoi.`,
          confidence: 1.0,
          related_channel_id: channelId,
          metadata: { verification_required: true, kind, address },
        }),
      );
    }
  } else if (params.channel_identity_id) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "channel",
        source: "default",
        type: "missing_info",
        priority: "medium",
        risk: "none",
        title: "Canal introuvable",
        content: `Aucun canal trouvé pour l'identifiant ${params.channel_identity_id}.`,
        confidence: 1.0,
        related_channel_id: params.channel_identity_id,
      }),
    );
  }

  // ── All channels overview ─────────────────────────────────────────────────

  if (allChannels.length > 1) {
    const verified = allChannels.filter((c) => c.verification_status === "verified").length;
    const active = allChannels.filter((c) => c.status === "active").length;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "channel",
        source: "channel_identity",
        type: "status",
        priority: "low",
        risk: "none",
        title: `Canaux de communication (${allChannels.length})`,
        content: `${allChannels.length} canal/canaux disponibles — ${verified} vérifié(s), ${active} actif(s).`,
        confidence: 0.85,
        metadata: { total: allChannels.length, verified, active },
      }),
    );
  }

  if (allChannels.length === 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "channel",
        source: "default",
        type: "missing_info",
        priority: "low",
        risk: "none",
        title: "Aucun canal configuré",
        content: "Aucun canal de communication configuré pour cette entreprise. Pierre ne peut pas envoyer de messages.",
        confidence: 1.0,
      }),
    );
  }

  return signals;
}
