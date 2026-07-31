// src/lib/clonechat/care/care.ts
//
// Moteur DÉTERMINISTE de CloneCare. Le diagnostic (BLOC 4) est l'autorité sur la CAUSE ; le registre
// des problèmes connus (plus spécifique) précise la nature et la résolution ; CloneGuide (BLOC 5)
// fournit les étapes sûres ; seules les routes réelles sont utilisées. Une résolution n'est jamais
// déclarée « faite » — au mieux DISPONIBLE, avec une condition OBSERVABLE de vérification. Les refus
// de sécurité restent des refus, jamais des bugs à contourner. Aucun bug/délai/statut/équipe inventé.

import { getRouteEntry } from "@/lib/nav/route-registry";
import type { CloneChatContext } from "@/lib/clonechat/context";
import type { CloneChatDiagnosis } from "@/lib/clonechat/diagnosis";
import type { CloneGuide } from "@/lib/clonechat/guide";
import type { VoiceJourneyResult } from "@/lib/clonechat/voice";
import { matchKnownIssue, getKnownIssue, type KnownIssue } from "./known-issues";
import { buildTicketDraft } from "./ticket";
import {
  CLONECHAT_CARE_VERSION, type CloneCareResult, type CareStatus, type CarePriority,
  type CareConfidence, type CareInput, type TicketCategory, type SupportTicketDraft,
} from "./types";

function realRoute(path: string | null | undefined): string | null {
  return path && getRouteEntry(path) ? path : null;
}

/** Statut dérivé d'un problème connu (plus spécifique que le diagnostic générique). */
function statusFromIssue(issue: KnownIssue): CareStatus {
  if (issue.category === "product" && issue.status === "by_design") return "product_limitation";
  if (issue.category === "product") return issue.workaround ? "workaround_available" : "known_issue";
  if (issue.category === "access" && issue.severity === "high") return "human_escalation"; // suspension
  if (issue.category === "access" && issue.status === "transient") return "provider_outage"; // entreprise indispo
  if (issue.category === "provider" || issue.category === "entitlement") return "provider_outage";
  if (issue.id === "voice_transcription_outage") return "provider_outage";
  if (issue.officialResolution) return "resolution_available";
  if (issue.workaround) return "workaround_available";
  return "known_issue";
}

/** Statut de repli quand AUCUN problème connu ne correspond : le diagnostic fait autorité. */
function statusFromDiagnosis(d: CloneChatDiagnosis): CareStatus {
  switch (d.kind) {
    case "tenant_security_failure": return d.requiresEscalation ? "human_escalation" : "provider_outage";
    case "provider_failure": return "provider_outage";
    case "unknown_requires_escalation": return "human_escalation";
    case "missing_prerequisite": return "resolution_available";
    case "route_or_navigation_issue": return "resolution_available";
    case "confirmed_cause": return "known_issue";
    case "probable_cause": return "needs_information";
    case "insufficient_context": return "needs_information";
    case "no_blocker": return "no_support_needed";
    default: return "needs_information";
  }
}

function priorityFor(status: CareStatus): CarePriority {
  switch (status) {
    case "human_escalation": return "high";
    case "product_limitation": return "low";
    case "no_support_needed": return "low";
    default: return "normal";
  }
}

function ticketCategoryFor(status: CareStatus, issue: KnownIssue | null): TicketCategory {
  if (issue) return issue.category;
  if (status === "security_refusal") return "security";
  if (status === "provider_outage") return "provider";
  return "other";
}

/** Construit le résultat CloneCare complet (gèle + valeurs par défaut sûres). */
function makeCare(p: {
  status: CareStatus; observedProblem: string | null; issue: KnownIssue | null;
  confidence: CareConfidence; evidence: readonly string[]; safeSteps: readonly string[];
  proposedResolution: string | null; workaround: string | null; resolutionCondition: string | null;
  missingInformation: readonly string[]; escalationReason: string | null; ticketDraft: SupportTicketDraft | null;
}): CloneCareResult {
  const escalationRequired = p.status === "human_escalation";
  return Object.freeze({
    version: CLONECHAT_CARE_VERSION,
    status: p.status,
    observedProblem: p.observedProblem,
    knownIssueId: p.issue?.id ?? null,
    knownIssueTitle: p.issue?.title ?? null,
    confidence: p.confidence,
    evidence: Object.freeze([...p.evidence]),
    proposedResolution: p.proposedResolution,
    workaround: p.workaround,
    safeSteps: Object.freeze([...p.safeSteps]),
    resolutionCondition: p.resolutionCondition,
    missingInformation: Object.freeze([...p.missingInformation]),
    priority: priorityFor(p.status),
    escalationRequired,
    escalationReason: escalationRequired ? p.escalationReason : null,
    supportRoute: realRoute("/questions"),
    ticketNeeded: escalationRequired,
    ticketDraft: escalationRequired ? p.ticketDraft : null,
  });
}

/**
 * Évalue le support pour une situation. Priorité : refus de sécurité (jamais un bug) ; puis un
 * problème connu correspondant (plus spécifique — peut reclasser une escalade « opaque » du
 * diagnostic en statut connu) ; puis le diagnostic générique.
 */
export function assessCare(
  ctx: CloneChatContext,
  diagnosis: CloneChatDiagnosis,
  guide: CloneGuide | null,
  input: CareInput = {},
): CloneCareResult {
  const issue = matchKnownIssue(ctx, diagnosis);
  const safeSteps = guide ? guide.steps.map((s) => s.text) : [];

  // 1) Refus de sécurité : conservé comme refus, jamais un bug ni un contournement.
  const status: CareStatus =
    diagnosis.kind === "permission_denied" ? "security_refusal"
      : issue ? statusFromIssue(issue)
        : statusFromDiagnosis(diagnosis);

  const proposedResolution = issue?.officialResolution ?? (status === "resolution_available" && guide ? `Suivre : ${guide.goal}` : null);
  const workaround = issue?.workaround ?? null;
  const resolutionCondition = issue?.resolutionVerification
    ?? (guide?.steps.find((s) => s.successCondition)?.successCondition ?? null);

  const missingInformation = [...diagnosis.missingInformation];
  const evidence = [...diagnosis.evidence, issue ? `known_issue:${issue.id}` : "no_known_issue_match"];

  const escalationReason = status === "human_escalation"
    ? (issue?.escalation ?? diagnosis.rootCause ?? "Aucune résolution sûre disponible sans intervention humaine.")
    : null;

  // Ticket UNIQUEMENT en cas d'escalade humaine (jamais pour un refus de sécurité, une panne à
  // réessayer, une limitation produit, un besoin d'information ou une résolution self-service).
  let ticketDraft: SupportTicketDraft | null = null;
  if (status === "human_escalation") {
    const affectedRoute = realRoute(diagnosis.recommendedRoute)
      ?? realRoute(ctx.navigation.routePath)
      ?? realRoute(issue?.surfaces?.[0] ?? null);
    ticketDraft = buildTicketDraft({
      summary: `[${ticketCategoryFor(status, issue)}] ${diagnosis.observedProblem ?? issue?.title ?? "Situation nécessitant une intervention"}`,
      category: ticketCategoryFor(status, issue),
      priority: priorityFor(status),
      affectedRoute,
      errorCodes: [...ctx.surfacedErrors, ...diagnosis.evidence],
      attemptedSteps: input.attemptedSteps ?? [],
      expectedResult: guide?.goal ?? "La demande aboutit normalement.",
      observedResult: diagnosis.observedProblem ?? issue?.description ?? "Blocage rencontré.",
      evidence: [issue ? `known_issue:${issue.id}` : "unrecognized", `diagnosis:${diagnosis.kind}`],
      // Tenant : uniquement si le caller l'autorise, si l'entreprise est résolue, et si nécessaire.
      tenantRef: input.includeTenantRef && ctx.tenant.resolved ? ctx.tenant.companyId : null,
    });
  }

  return makeCare({
    status,
    observedProblem: diagnosis.observedProblem,
    issue,
    confidence: diagnosis.confidence as CareConfidence,
    evidence,
    safeSteps,
    proposedResolution,
    workaround,
    resolutionCondition,
    missingInformation,
    escalationReason,
    ticketDraft,
  });
}

// ── Consommation depuis un résultat vocal DÉJÀ sécurisé (sans audio ni transcript) ─────────────

/** Résultat Care minimal (sans ticket) pour les cas vocaux gérés hors contexte CloneChat complet. */
function careDirect(p: {
  status: CareStatus; issueId: string | null; observedProblem: string; workaround: string | null;
  resolutionCondition: string | null; missingInformation?: readonly string[]; escalationReason?: string | null;
}): CloneCareResult {
  const issue = p.issueId ? getKnownIssue(p.issueId) : null;
  return makeCare({
    status: p.status,
    observedProblem: p.observedProblem,
    issue,
    confidence: "high",
    evidence: [issue ? `known_issue:${issue.id}` : "voice_layer"],
    safeSteps: [],
    proposedResolution: issue?.officialResolution ?? null,
    workaround: p.workaround ?? issue?.workaround ?? null,
    resolutionCondition: p.resolutionCondition ?? issue?.resolutionVerification ?? null,
    missingInformation: p.missingInformation ?? [],
    escalationReason: p.escalationReason ?? null,
    ticketDraft: null,
  });
}

/**
 * Transforme un résultat vocal DÉJÀ sécurisé en résultat Care, SANS recopier l'audio ni le
 * transcript (ni dans le résultat, ni dans un ticket : on ne consomme que ctx/diagnostic/guide).
 */
export function careFromVoiceResult(vr: VoiceJourneyResult, input: CareInput = {}): CloneCareResult {
  if (vr.state === "cancelled") {
    return careDirect({ status: "no_support_needed", issueId: null, observedProblem: "Parcours vocal annulé.", workaround: null, resolutionCondition: null });
  }

  if (vr.error) {
    const { category, stage } = vr.error;
    if (category === "security_refusal") {
      return careDirect({ status: "security_refusal", issueId: null, observedProblem: "Demande vocale refusée par la gouvernance.", workaround: null, resolutionCondition: null });
    }
    if (stage === "transcription" || category === "provider_failure" || category === "timeout") {
      return careDirect({ status: "provider_outage", issueId: "voice_transcription_outage", observedProblem: "La transcription vocale a échoué ou expiré.", workaround: null, resolutionCondition: null });
    }
    if (category === "unsupported_format" || category === "user_error") {
      return careDirect({
        status: "needs_information", issueId: null,
        observedProblem: "L'audio n'a pas pu être exploité (format non supporté ou enregistrement vide).",
        workaround: "Réessayer avec un enregistrement audio valide (MP3, WebM/Opus, MP4/AAC).",
        resolutionCondition: "Un transcript est produit à partir d'un audio valide.",
        missingInformation: ["un enregistrement audio exploitable"],
      });
    }
    return careDirect({ status: "human_escalation", issueId: null, observedProblem: "Situation vocale non résolue.", workaround: null, resolutionCondition: null, escalationReason: "Aucune résolution sûre disponible pour le parcours vocal." });
  }

  // Réponse texte obtenue : on évalue le support sur le contexte/diagnostic réels (jamais le transcript).
  if (vr.context && vr.diagnosis) {
    const care = assessCare(vr.context, vr.diagnosis, vr.guide, input);
    // Dégradation TTS : la réponse texte existe déjà → contournement (fallback texte), jamais un bug.
    if (vr.tts?.error && care.status === "no_support_needed") {
      return careDirect({
        status: "workaround_available", issueId: "voice_tts_unavailable",
        observedProblem: "La lecture vocale a échoué ; la réponse reste disponible en texte.",
        workaround: null, resolutionCondition: null,
      });
    }
    return care;
  }

  return careDirect({ status: "needs_information", issueId: null, observedProblem: "Demande vocale incomplète.", workaround: null, resolutionCondition: null, missingInformation: ["une demande vocale exploitable"] });
}
