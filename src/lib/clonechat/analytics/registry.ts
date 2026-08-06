// src/lib/clonechat/analytics/registry.ts
//
// Registre CANONIQUE, typé, versionné et déterministe des événements. Un événement n'existe QUE s'il
// correspond à une étape / un résultat réellement présent dans le pipeline (blocs 0→11). Aucun
// événement ne représente une mission exécutée alors qu'elle est seulement préparée, un paiement sans
// preuve, un succès sans condition observable, ou un utilisateur/entreprise/entitlement non résolu.

import {
  CLONECHAT_ANALYTICS_VERSION, type AnalyticsEventSpec, type AnalyticsCategory, type PipelineStage,
  type AnalyticsNature, type CollectionBasis, type SensitivityLevel, type SamplingPolicy,
  type DedupStrategy, type AnalyticsResult,
} from "./types";

const V = CLONECHAT_ANALYTICS_VERSION;
const ALWAYS: SamplingPolicy = { kind: "always" };

interface SpecInit {
  category: AnalyticsCategory; stage: PipelineStage; nature: AnalyticsNature; basis: CollectionBasis;
  sensitivity?: SensitivityLevel; requiredMeta?: readonly string[]; allowedMeta?: readonly string[];
  results: readonly AnalyticsResult[]; sampling?: SamplingPolicy; dedup?: DedupStrategy;
  retentionDays?: number | null; provenance: string; metricsFed: readonly string[]; requiresObservableProof?: boolean;
}

function spec(name: string, i: SpecInit): AnalyticsEventSpec {
  return {
    name, version: V, category: i.category, stage: i.stage, nature: i.nature, basis: i.basis,
    sensitivity: i.sensitivity ?? "pseudonymous",
    requiredMeta: Object.freeze([...(i.requiredMeta ?? [])]),
    allowedMeta: Object.freeze([...(i.allowedMeta ?? [])]),
    allowedResults: Object.freeze([...i.results]),
    sampling: i.sampling ?? ALWAYS, dedup: i.dedup ?? "none",
    retentionDays: i.retentionDays ?? null, provenance: i.provenance,
    metricsFed: Object.freeze([...i.metricsFed]),
    ...(i.requiresObservableProof ? { requiresObservableProof: true } : {}),
  };
}

const SPECS: readonly AnalyticsEventSpec[] = [
  // ── Requête / Brain / Contexte ──────────────────────────────────────────────
  spec("clonechat.request_received", { category: "lifecycle", stage: "request", nature: "operational", basis: "operational", allowedMeta: ["channel"], results: ["ok"], dedup: "per_correlation", provenance: "api/assistant/chat + orchestrator BLOC 11", metricsFed: ["requests"] }),
  spec("brain.decision_made", { category: "decision", stage: "brain", nature: "operational", basis: "operational", requiredMeta: ["mode"], results: ["ok", "refused"], provenance: "clonechat/brain (BLOC 2)", metricsFed: ["byBrainMode"] }),
  spec("context.resolved", { category: "resolution", stage: "context", nature: "operational", basis: "operational", results: ["ok"], provenance: "clonechat/context (BLOC 3)", metricsFed: ["incompleteContextRate"] }),
  spec("context.incomplete", { category: "resolution", stage: "context", nature: "quality", basis: "operational", allowedMeta: ["missing"], results: ["incomplete"], provenance: "clonechat/context (BLOC 3)", metricsFed: ["incompleteContextRate"] }),
  // ── Diagnostic ──────────────────────────────────────────────────────────────
  spec("diagnosis.produced", { category: "resolution", stage: "diagnosis", nature: "operational", basis: "operational", requiredMeta: ["kind"], results: ["ok"], provenance: "clonechat/diagnosis (BLOC 4)", metricsFed: ["byDiagnosis"] }),
  spec("diagnosis.clarification_needed", { category: "quality", stage: "diagnosis", nature: "quality", basis: "operational", results: ["needs_clarification"], provenance: "clonechat/diagnosis (BLOC 4)", metricsFed: ["clarificationRate"] }),
  // ── Guide ─────────────────────────────────────────────────────────────────────
  spec("guide.produced", { category: "guidance", stage: "guide", nature: "operational", basis: "operational", allowedMeta: ["guide"], results: ["ready"], provenance: "clonechat/guide (BLOC 5)", metricsFed: ["byGuideStatus"] }),
  spec("guide.blocked", { category: "guidance", stage: "guide", nature: "quality", basis: "operational", allowedMeta: ["guide"], results: ["blocked"], provenance: "clonechat/guide (BLOC 5)", metricsFed: ["byGuideStatus"] }),
  spec("guide.completed", { category: "guidance", stage: "guide", nature: "product", basis: "product", allowedMeta: ["guide"], results: ["completed"], provenance: "clonechat/guide (BLOC 5)", metricsFed: ["byGuideStatus"] }),
  spec("guide.escalated", { category: "guidance", stage: "guide", nature: "quality", basis: "operational", allowedMeta: ["guide"], results: ["escalated"], provenance: "clonechat/guide (BLOC 5)", metricsFed: ["byGuideStatus"] }),
  // ── Voice ─────────────────────────────────────────────────────────────────────
  spec("voice.transcription_succeeded", { category: "resolution", stage: "voice", nature: "operational", basis: "operational", allowedMeta: ["confidence"], results: ["ok"], provenance: "clonechat/voice (BLOC 6)", metricsFed: ["byErrorCode"] }),
  spec("voice.transcription_refused", { category: "security", stage: "voice", nature: "security", basis: "operational", results: ["refused"], provenance: "clonechat/voice (BLOC 6)", metricsFed: ["securityRefusals"] }),
  spec("voice.transcription_failed", { category: "reliability", stage: "voice", nature: "operational", basis: "operational", allowedMeta: ["category"], results: ["failed"], provenance: "clonechat/voice (BLOC 6)", metricsFed: ["providerFailures"] }),
  spec("voice.tts_succeeded", { category: "resolution", stage: "voice", nature: "operational", basis: "operational", results: ["ok"], provenance: "clonechat/voice (BLOC 6)", metricsFed: [] }),
  spec("voice.tts_fallback_text", { category: "quality", stage: "voice", nature: "quality", basis: "operational", results: ["fallback"], provenance: "clonechat/voice (BLOC 6)", metricsFed: ["fallbackRate"] }),
  // ── Care ─────────────────────────────────────────────────────────────────────
  spec("care.known_issue", { category: "support", stage: "care", nature: "product", basis: "product", allowedMeta: ["issue"], results: ["ok"], provenance: "clonechat/care (BLOC 7)", metricsFed: ["byCareStatus"] }),
  spec("care.resolution_available", { category: "support", stage: "care", nature: "product", basis: "product", allowedMeta: ["issue"], results: ["ok"], provenance: "clonechat/care (BLOC 7)", metricsFed: ["byCareStatus"] }),
  spec("care.workaround_available", { category: "support", stage: "care", nature: "product", basis: "product", allowedMeta: ["issue"], results: ["ok"], provenance: "clonechat/care (BLOC 7)", metricsFed: ["byCareStatus"] }),
  spec("care.escalation", { category: "support", stage: "care", nature: "quality", basis: "operational", allowedMeta: ["issue"], results: ["escalated"], provenance: "clonechat/care (BLOC 7)", metricsFed: ["byCareStatus"] }),
  // ── Actions ────────────────────────────────────────────────────────────────
  spec("action.planned", { category: "action", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action"], results: ["ok", "blocked", "needs_confirmation"], provenance: "clonechat/actions (BLOC 8)", metricsFed: ["byActionState"] }),
  spec("action.guard_refused", { category: "security", stage: "actions", nature: "security", basis: "operational", requiredMeta: ["action"], results: ["blocked", "refused"], provenance: "clonechat/actions CloneGuard (BLOC 8)", metricsFed: ["byGuardDecision", "securityRefusals"] }),
  spec("action.confirmation_requested", { category: "action", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action"], results: ["needs_confirmation"], provenance: "clonechat/actions confirmation (BLOC 8)", metricsFed: ["confirmations.requested"] }),
  spec("action.confirmation_received", { category: "action", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action"], results: ["ok"], provenance: "clonechat/actions confirmation (BLOC 8)", metricsFed: ["confirmations.received"] }),
  spec("action.confirmation_expired", { category: "security", stage: "actions", nature: "security", basis: "operational", requiredMeta: ["action"], results: ["expired", "refused"], provenance: "clonechat/actions confirmation (BLOC 8)", metricsFed: ["confirmations.expired"] }),
  spec("action.confirmation_invalid", { category: "security", stage: "actions", nature: "security", basis: "operational", requiredMeta: ["action"], results: ["refused"], provenance: "clonechat/actions confirmation (BLOC 8)", metricsFed: ["confirmations.invalid"] }),
  spec("action.executed", { category: "action", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action", "observable"], allowedMeta: ["adapter"], results: ["executed"], provenance: "clonechat/actions execute (BLOC 8)", metricsFed: ["byActionState"], requiresObservableProof: true }),
  spec("action.failed", { category: "reliability", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action"], allowedMeta: ["adapter"], results: ["failed"], provenance: "clonechat/actions execute (BLOC 8)", metricsFed: ["byActionState"] }),
  spec("action.cancelled", { category: "action", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action"], results: ["cancelled"], provenance: "clonechat/actions execute (BLOC 8)", metricsFed: ["byActionState"] }),
  spec("action.deduplicated", { category: "action", stage: "actions", nature: "operational", basis: "operational", requiredMeta: ["action"], results: ["duplicate"], dedup: "per_dedup_key", provenance: "clonechat/actions idempotence (BLOC 8)", metricsFed: ["byActionState"] }),
  // ── Visual ─────────────────────────────────────────────────────────────────
  spec("visual.target_found", { category: "guidance", stage: "visual", nature: "operational", basis: "operational", allowedMeta: ["target"], results: ["ok"], provenance: "clonechat/visual (BLOC 9)", metricsFed: ["byVisualState"] }),
  spec("visual.target_stale", { category: "quality", stage: "visual", nature: "quality", basis: "operational", allowedMeta: ["target"], results: ["stale"], provenance: "clonechat/visual (BLOC 9)", metricsFed: ["byVisualState"] }),
  spec("visual.fallback_text", { category: "quality", stage: "visual", nature: "quality", basis: "operational", results: ["fallback", "not_found"], provenance: "clonechat/visual (BLOC 9)", metricsFed: ["byVisualState", "fallbackRate"] }),
  // ── Inspector ────────────────────────────────────────────────────────────────
  spec("inspection.succeeded", { category: "evidence", stage: "inspector", nature: "operational", basis: "operational", results: ["ok"], provenance: "clonechat/inspector (BLOC 10)", metricsFed: ["byInspectionStatus"] }),
  spec("inspection.partial", { category: "evidence", stage: "inspector", nature: "quality", basis: "operational", results: ["partial"], provenance: "clonechat/inspector (BLOC 10)", metricsFed: ["byInspectionStatus"] }),
  spec("inspection.refused", { category: "security", stage: "inspector", nature: "security", basis: "operational", allowedMeta: ["reason"], results: ["refused"], provenance: "clonechat/inspector (BLOC 10)", metricsFed: ["byInspectionStatus", "securityRefusals"] }),
  spec("inspection.failed", { category: "reliability", stage: "inspector", nature: "operational", basis: "operational", results: ["failed"], provenance: "clonechat/inspector (BLOC 10)", metricsFed: ["byInspectionStatus", "providerFailures"] }),
  // ── Onboarding ──────────────────────────────────────────────────────────────
  spec("onboarding.started", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["started"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus"] }),
  spec("onboarding.resumed", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["resumed"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus", "onboardingResumes"] }),
  spec("onboarding.interrupted", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["interrupted"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus"] }),
  spec("onboarding.abandoned", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["abandoned"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus", "onboardingAbandons"] }),
  spec("onboarding.expired", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["expired"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus"] }),
  spec("onboarding.blocked", { category: "quality", stage: "onboarding", nature: "quality", basis: "operational", allowedMeta: ["journey"], results: ["blocked", "escalated"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus"] }),
  spec("onboarding.ready", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["ready"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus"] }),
  spec("onboarding.completed", { category: "onboarding", stage: "onboarding", nature: "product", basis: "product", allowedMeta: ["journey"], results: ["completed"], provenance: "clonechat/onboarding (BLOC 11)", metricsFed: ["byOnboardingStatus"] }),
  // ── Mission (JAMAIS executed/running/completed) ────────────────────────────────
  spec("mission.intake_started", { category: "mission", stage: "mission", nature: "product", basis: "product", requiredMeta: ["missionType"], results: ["started"], provenance: "clonechat/mission (BLOC 11)", metricsFed: ["byMissionStatus"] }),
  spec("mission.clarification_needed", { category: "mission", stage: "mission", nature: "product", basis: "product", requiredMeta: ["missionType"], results: ["needs_clarification", "needs_information"], provenance: "clonechat/mission (BLOC 11)", metricsFed: ["byMissionStatus"] }),
  spec("mission.ready_to_prepare", { category: "mission", stage: "mission", nature: "product", basis: "product", requiredMeta: ["missionType"], results: ["ready"], provenance: "clonechat/mission (BLOC 11)", metricsFed: ["byMissionStatus"] }),
  spec("mission.prepared", { category: "mission", stage: "mission", nature: "product", basis: "product", requiredMeta: ["missionType"], results: ["prepared", "needs_confirmation"], provenance: "clonechat/mission prepare (BLOC 11)", metricsFed: ["byMissionStatus"] }),
  spec("mission.unavailable", { category: "mission", stage: "mission", nature: "product", basis: "product", requiredMeta: ["missionType"], results: ["unavailable", "blocked"], provenance: "clonechat/mission (BLOC 11)", metricsFed: ["byMissionStatus"] }),
  spec("mission.sensitive_escalated", { category: "security", stage: "mission", nature: "security", basis: "operational", requiredMeta: ["missionType"], results: ["escalated"], provenance: "clonechat/mission readiness (BLOC 11)", metricsFed: ["byMissionStatus"] }),
  // ── Transverses ────────────────────────────────────────────────────────────
  spec("provider.failure", { category: "reliability", stage: "provider", nature: "operational", basis: "operational", requiredMeta: ["providerKind"], allowedMeta: ["category"], results: ["failed"], provenance: "voice/model/entitlement/support failures (BLOC 4/6/7)", metricsFed: ["providerFailures"] }),
  spec("security.refusal", { category: "security", stage: "security", nature: "security", basis: "operational", allowedMeta: ["kind"], results: ["refused"], provenance: "context-boundary + CloneGuard + gouvernance (BLOC 0/8)", metricsFed: ["securityRefusals"] }),
  spec("internal.error", { category: "reliability", stage: "internal", nature: "operational", basis: "operational", results: ["failed"], provenance: "erreur interne sûre (jamais de stack brute)", metricsFed: ["byErrorCode"] }),
];

const REGISTRY: ReadonlyMap<string, AnalyticsEventSpec> = new Map(SPECS.map((s) => [s.name, s]));

export function getEventSpec(name: string): AnalyticsEventSpec | null {
  return REGISTRY.get(name) ?? null;
}
export function isKnownEvent(name: string): boolean {
  return REGISTRY.has(name);
}
export function allEventSpecs(): readonly AnalyticsEventSpec[] {
  return SPECS;
}
export const ANALYTICS_EVENT_NAMES = SPECS.map((s) => s.name);
