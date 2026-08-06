// src/lib/clonechat/analytics/instrument.ts
//
// Dérivation DÉTERMINISTE des événements d'analytics à partir d'un résultat de pipeline (BLOC 11).
// N'observe QUE ce qui s'est réellement produit : aucun événement inventé, aucun faux succès, aucune
// mission déclarée exécutée (le pipeline phase 1 ne fait qu'analyser/préparer). Ne lit jamais le
// message brut, la réponse, un transcript ou une pièce jointe : uniquement des états/étapes/codes.

import type { OnboardAndMissionResult } from "@/lib/clonechat/onboarding";
import type { CloneChatContext } from "@/lib/clonechat/context";
import type { AnalyticsResult, MetaValue } from "./types";

export interface DerivedEvent {
  readonly eventName: string;
  readonly result: AnalyticsResult;
  readonly route?: string | null;
  readonly meta?: Readonly<Record<string, MetaValue>>;
  readonly provider?: string | null;
  readonly errorCode?: string | null;
}

/** Ordre STABLE : request → brain → context → diagnosis → guide → care → actions → visual → inspector → onboarding → mission → security. */
export function deriveEventsFromDecision(base: OnboardAndMissionResult, ctx: CloneChatContext, securityRefusal: boolean): DerivedEvent[] {
  const out: DerivedEvent[] = [];
  const route = ctx.navigation.routePath ?? null;

  // 1) Requête reçue.
  out.push({ eventName: "clonechat.request_received", result: "ok", route });

  // 2) Décision Brain.
  out.push({ eventName: "brain.decision_made", result: securityRefusal ? "refused" : "ok", meta: { mode: base.decision.mode } });

  // 3) Contexte résolu / incomplet. Incomplet = prérequis manquants OU état non pleinement résolu
  //    (authentifié sans entreprise active, hors panne sécurité) OU vérification Pierre indisponible.
  const contextIncomplete = ctx.missingPrerequisites.length > 0
    || (ctx.viewer.authenticated && !ctx.tenant.resolved && !ctx.tenant.securityFailure)
    || ctx.pierre.lookupFailed;
  if (contextIncomplete) out.push({ eventName: "context.incomplete", result: "incomplete", meta: { missing: ctx.missingPrerequisites.length } });
  else out.push({ eventName: "context.resolved", result: "ok" });

  // 4) Diagnostic.
  out.push({ eventName: "diagnosis.produced", result: "ok", meta: { kind: base.diagnosis.kind } });
  if (base.diagnosis.kind === "insufficient_context") out.push({ eventName: "diagnosis.clarification_needed", result: "needs_clarification" });
  if (base.diagnosis.kind === "provider_failure") out.push({ eventName: "provider.failure", result: "failed", meta: { providerKind: "model" } });

  // 5) Guide.
  const g = base.guide;
  if (g) {
    const gRoute = g.recommendedRoute ?? g.startRoute ?? null;
    if (g.state === "ready") out.push({ eventName: "guide.produced", result: "ready", route: gRoute, meta: { guide: g.id } });
    else if (g.state === "blocked") out.push({ eventName: "guide.blocked", result: "blocked", meta: { guide: g.id } });
    else if (g.state === "completed") out.push({ eventName: "guide.completed", result: "completed", meta: { guide: g.id } });
    else if (g.state === "escalate") out.push({ eventName: "guide.escalated", result: "escalated", meta: { guide: g.id } });
  }

  // 6) Care.
  switch (base.care.status) {
    case "known_issue": out.push({ eventName: "care.known_issue", result: "ok" }); break;
    case "resolution_available": out.push({ eventName: "care.resolution_available", result: "ok" }); break;
    case "workaround_available": out.push({ eventName: "care.workaround_available", result: "ok" }); break;
    case "human_escalation": out.push({ eventName: "care.escalation", result: "escalated" }); break;
    case "provider_outage": out.push({ eventName: "provider.failure", result: "failed", meta: { providerKind: "support" } }); break;
    default: break;
  }

  // 7) Actions (plan phase 1 ; jamais d'exécution ici).
  const plan = base.actionPlan;
  if (plan) {
    const action = plan.request.actionId;
    const decision = base.guard?.decision ?? plan.guard.decision;
    if (decision === "block") out.push({ eventName: "action.guard_refused", result: "blocked", meta: { action } });
    else if (decision === "needs_confirmation") {
      out.push({ eventName: "action.planned", result: "needs_confirmation", route: plan.route, meta: { action } });
      out.push({ eventName: "action.confirmation_requested", result: "needs_confirmation", meta: { action } });
    } else out.push({ eventName: "action.planned", result: "ok", route: plan.route, meta: { action } });
  }

  // 8) Guidage visuel.
  switch (base.visualGuidance.state) {
    case "target_found": out.push({ eventName: "visual.target_found", result: "ok", route: base.visualGuidance.route }); break;
    case "stale": out.push({ eventName: "visual.target_stale", result: "stale" }); break;
    case "target_not_found": out.push({ eventName: "visual.fallback_text", result: "not_found" }); break;
    case "fallback_text": out.push({ eventName: "visual.fallback_text", result: "fallback" }); break;
    default: break;
  }

  // 9) Inspecteur (si une pièce a été inspectée).
  const insp = base.inspection;
  if (insp) {
    switch (insp.status) {
      case "analyzed": out.push({ eventName: "inspection.succeeded", result: "ok" }); break;
      case "partially_analyzed": out.push({ eventName: "inspection.partial", result: "partial" }); break;
      case "security_refusal": out.push({ eventName: "inspection.refused", result: "refused", meta: { reason: "security_refusal" } }); break;
      case "invalid": out.push({ eventName: "inspection.refused", result: "refused", meta: { reason: "invalid" } }); break;
      case "unsupported": out.push({ eventName: "inspection.refused", result: "refused", meta: { reason: "unsupported" } }); break;
      case "provider_failure": out.push({ eventName: "inspection.failed", result: "failed" }); break;
      default: break;
    }
  }

  // 10) Onboarding.
  const ob = base.onboarding;
  out.push(ob.resumeState === "resumed"
    ? { eventName: "onboarding.resumed", result: "resumed", meta: { journey: ob.journeyId } }
    : { eventName: "onboarding.started", result: "started", meta: { journey: ob.journeyId } });
  if (ob.interruptionReason === "user_interrupted") out.push({ eventName: "onboarding.interrupted", result: "interrupted", meta: { journey: ob.journeyId } });
  switch (ob.status) {
    case "blocked": out.push({ eventName: "onboarding.blocked", result: "blocked", meta: { journey: ob.journeyId } }); break;
    case "escalate": out.push({ eventName: "onboarding.blocked", result: "escalated", meta: { journey: ob.journeyId } }); break;
    case "ready": out.push({ eventName: "onboarding.ready", result: "ready", meta: { journey: ob.journeyId } }); break;
    case "completed": out.push({ eventName: "onboarding.completed", result: "completed", meta: { journey: ob.journeyId } }); break;
    case "skipped": out.push({ eventName: "onboarding.abandoned", result: "abandoned", meta: { journey: ob.journeyId } }); break;
    case "expired": out.push({ eventName: "onboarding.expired", result: "expired", meta: { journey: ob.journeyId } }); break;
    default: break;
  }

  // 11) Mission (JAMAIS executed/running/completed).
  const m = base.mission;
  out.push({ eventName: "mission.intake_started", result: "started", meta: { missionType: m.type } });
  switch (m.status) {
    case "needs_clarification": out.push({ eventName: "mission.clarification_needed", result: "needs_clarification", meta: { missionType: m.type } }); break;
    case "collecting_information": out.push({ eventName: "mission.clarification_needed", result: "needs_information", meta: { missionType: m.type } }); break;
    case "ready_to_prepare": out.push({ eventName: "mission.ready_to_prepare", result: "ready", meta: { missionType: m.type } }); break;
    case "prepared": out.push({ eventName: "mission.prepared", result: "prepared", meta: { missionType: m.type } }); break;
    case "requires_confirmation": out.push({ eventName: "mission.prepared", result: "needs_confirmation", meta: { missionType: m.type } }); break;
    case "unavailable": out.push({ eventName: "mission.unavailable", result: "unavailable", meta: { missionType: m.type } }); break;
    case "blocked": out.push({ eventName: "mission.unavailable", result: "blocked", meta: { missionType: m.type } }); break;
    case "requires_human_review": out.push({ eventName: "mission.sensitive_escalated", result: "escalated", meta: { missionType: m.type } }); break;
    default: break;
  }

  // 12) Refus de sécurité transverse.
  if (securityRefusal) out.push({ eventName: "security.refusal", result: "refused", meta: { kind: "governance_or_injection" } });

  return out;
}
