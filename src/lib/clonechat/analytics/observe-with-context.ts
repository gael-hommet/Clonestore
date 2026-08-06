// src/lib/clonechat/analytics/observe-with-context.ts
//
// Intégration ADDITIVE au-dessus de BLOC 11 : Onboarding + Mission (+ tout le pipeline) PUIS
// observation analytics. Le RÉSULTAT FONCTIONNEL est calculé d'abord et renvoyé INCHANGÉ ; les
// analytics n'influencent jamais la décision/diagnostic/guide/action, ne contournent pas CloneGuard,
// n'accordent aucune permission, ne changent aucun tenant. Une panne analytics est ABSORBÉE (jamais
// une exception ne remonte) : CloneChat n'est jamais cassé, ralenti au-delà d'un émetteur en mémoire,
// ni exposé à une erreur technique brute. `structured` reste inchangé. Ne renvoie jamais le contenu
// complet des événements — seulement des statuts d'émission sûrs.

import {
  onboardAndPrepareMissionWithCloneChat, type OnboardAndMissionResult, type OnboardAndMissionOptions,
} from "@/lib/clonechat/onboarding";
import type { ContextualInput, CloneChatContext } from "@/lib/clonechat/context";
import { hash } from "@/lib/clonechat/actions/keys";
import { deriveEventsFromDecision } from "./instrument";
import { createCloneAnalytics, type CloneAnalytics } from "./collector";
import { createNoopSink } from "./sink";
import { createDefaultPseudonymizer } from "./privacy";
import { CLONECHAT_ANALYTICS_VERSION, type EmitStatus } from "./types";

export interface AnalyticsObservation {
  readonly version: typeof CLONECHAT_ANALYTICS_VERSION;
  readonly correlationId: string;
  readonly emitted: ReadonlyArray<{ readonly name: string; readonly status: EmitStatus }>;
  readonly accepted: number;
  readonly buffered: number;
  readonly partial: number;
  readonly rejected: number;
  readonly disabled: number;
  readonly duplicate: number;
  readonly sampledOut: number;
  readonly failed: number;
  /** true quand aucun événement n'a été réellement livré (ex. sink no-op par défaut) — honnête. */
  readonly persisted: boolean;
}

export interface ObservedResult extends OnboardAndMissionResult {
  readonly analytics: AnalyticsObservation;
}

export interface ObserveOptions extends OnboardAndMissionOptions {
  readonly analytics?: CloneAnalytics;
  readonly requestId?: string | null;
  readonly sessionId?: string | null;
  readonly environment?: string;
}

function keysOf(ctx: CloneChatContext): { viewerKey: string; tenantKey: string } {
  return {
    viewerKey: ctx.viewer.authenticated && ctx.viewer.userId ? `user:${ctx.viewer.userId}` : "anon",
    tenantKey: ctx.tenant.resolved && ctx.tenant.companyId ? `co:${ctx.tenant.companyId}` : "none",
  };
}

/**
 * Exécute le pipeline BLOC 11 puis émet les événements d'observation. Le résultat fonctionnel est
 * strictement celui de onboardAndPrepareMissionWithCloneChat ; `analytics` est purement additif.
 */
export async function onboardPrepareMissionAndObserveWithCloneChat(
  input: ContextualInput,
  ctx: CloneChatContext,
  opts: ObserveOptions,
): Promise<ObservedResult> {
  // 1) RÉSULTAT FONCTIONNEL (inchangé). Toute erreur ici est une vraie erreur du pipeline, pas des analytics.
  const base = await onboardAndPrepareMissionWithCloneChat(input, ctx, opts);

  // 2) Observation analytics — totalement isolée (ne peut jamais casser le résultat ci-dessus).
  const { viewerKey, tenantKey } = keysOf(ctx);
  const correlationId = `trc_${hash([viewerKey, tenantKey, String(opts.nowMs), String((input.message ?? "").length)].join("|"))}`;

  const analytics: CloneAnalytics = opts.analytics
    ?? createCloneAnalytics({ environment: opts.environment ?? ctx.environment, pseudonymizer: createDefaultPseudonymizer("clonechat-analytics"), sink: createNoopSink(), consent: "operational_only" });

  const emitted: Array<{ name: string; status: EmitStatus }> = [];
  const tally = { accepted: 0, buffered: 0, partial: 0, rejected: 0, disabled: 0, duplicate: 0, sampledOut: 0, failed: 0 };
  try {
    const securityRefusal = base.diagnosis.kind === "permission_denied"
      || base.decision.requestedAction?.refusedReason === "governance_bypass_or_injection";
    const derived = deriveEventsFromDecision(base, ctx, securityRefusal);
    for (const d of derived) {
      const r = analytics.emit({
        eventName: d.eventName, result: d.result, surface: "clonechat", correlationId,
        requestId: opts.requestId ?? null, sessionId: opts.sessionId ?? null,
        route: d.route ?? null, meta: d.meta ? { ...d.meta } : undefined,
        provider: d.provider ?? null, errorCode: d.errorCode ?? null,
        viewerKey, tenantKey, nowMs: opts.nowMs,
      });
      emitted.push({ name: r.eventName, status: r.status });
      if (r.status === "accepted") tally.accepted++;
      else if (r.status === "buffered") tally.buffered++;
      else if (r.status === "partial") tally.partial++;
      else if (r.status === "rejected") tally.rejected++;
      else if (r.status === "disabled") tally.disabled++;
      else if (r.status === "duplicate") tally.duplicate++;
      else if (r.status === "sampled_out") tally.sampledOut++;
      else if (r.status === "failed") tally.failed++;
    }
  } catch {
    // Panne analytics : absorbée. Le résultat fonctionnel reste intact.
  }

  // Honnête : « persisté » seulement si au moins un événement a été réellement accepté par un sink capable.
  const persisted = tally.accepted > 0;
  const analyticsObservation: AnalyticsObservation = {
    version: CLONECHAT_ANALYTICS_VERSION, correlationId, emitted, ...tally, persisted,
  };
  return { ...base, analytics: analyticsObservation };
}
