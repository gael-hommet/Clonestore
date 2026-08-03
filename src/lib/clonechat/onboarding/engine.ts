// src/lib/clonechat/onboarding/engine.ts
//
// Moteur DÉTERMINISTE d'onboarding contextuel. Sélectionne le parcours depuis l'état RÉEL
// (CloneContext), calcule l'étape/statut à partir des portes de prérequis, reprend un état persisté
// (validé + tenant-scopé + non expiré + version courante), et attache une cible Visual Guidance
// vérifiée quand elle existe. Ne suppose jamais un état ; ne persiste aucune donnée sensible ; temps
// INJECTÉ (jamais Date.now).

import { getRouteEntry } from "@/lib/nav/route-registry";
import { getVisualTarget } from "@/lib/clonechat/visual";
import { redactText } from "@/lib/clonechat/care";
import type { CloneChatContext } from "@/lib/clonechat/context";
import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import { getJourney, type JourneyBlueprint, type JourneyStepSpec } from "./journeys";
import { onboardingKey, loadValidOnboarding, type OnboardingStore } from "./store";
import {
  CLONECHAT_ONBOARDING_VERSION, type OnboardingState, type OnboardingStep, type OnboardingStatus,
  type OnboardingJourneyId, type OnboardingStepState, type OnboardingPersisted, type ResumeState,
} from "./types";

export const DEFAULT_ONBOARDING_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export type OnboardingGoal = "discovery" | "signup" | "login" | "demo" | "pierre" | "mission" | "support";

export interface OnboardingInput {
  readonly context: CloneChatContext;
  readonly goal?: OnboardingGoal;
  readonly store?: OnboardingStore;
  readonly nowMs: number;
  readonly ttlMs?: number;
  readonly cancelled?: boolean; // abandon volontaire
  readonly alreadyOnboarded?: boolean;
  readonly providedInfo?: Readonly<Record<string, string>>;
  readonly idSeed?: string;
}

function viewerKeyOf(ctx: CloneChatContext): string {
  return ctx.viewer.authenticated && ctx.viewer.userId ? `user:${ctx.viewer.userId}` : "anon";
}
function tenantKeyOf(ctx: CloneChatContext): string {
  return ctx.tenant.resolved && ctx.tenant.companyId ? `co:${ctx.tenant.companyId}` : "none";
}
function prereqSatisfied(ctx: CloneChatContext, p: CloneChatPrerequisite): boolean {
  if (p === "authentication") return ctx.viewer.authenticated;
  if (p === "active_company") return ctx.tenant.resolved;
  return ctx.pierre.granted;
}
function realRoute(path: string | null): string | null {
  return path && getRouteEntry(path) ? path : null;
}

/** Sélectionne le parcours selon l'état RÉEL (échelle « où en êtes-vous »), avec override d'objectif. */
function selectJourney(ctx: CloneChatContext, goal: OnboardingGoal | undefined): OnboardingJourneyId {
  if (!ctx.viewer.authenticated) {
    if (goal === "signup") return "signup";
    if (goal === "login") return "login";
    if (goal === "demo") return "view_demo";
    if (goal === "pierre") return "discover_pierre";
    if (goal === "support") return "contact_support";
    return "public_discovery";
  }
  if (goal === "support") return "contact_support";
  if (ctx.tenant.securityFailure) return "contact_support"; // suspendu / indisponible → escalade
  if (!ctx.tenant.resolved) {
    return ctx.tenant.refusalCode === "COMPANY_SELECTION_REQUIRED" ? "select_company" : "resolve_company";
  }
  if (ctx.pierre.lookupFailed) return "recover_entitlement";
  if (!ctx.pierre.granted) return goal === "pierre" ? "reserve_pierre" : "understand_pierre_access";
  // Tout est prêt.
  if (goal === "mission") return "start_mission_prep";
  return "enter_pierre_space";
}

const INFO_REQUIRED: Partial<Record<OnboardingJourneyId, readonly string[]>> = {
  start_mission_prep: ["objectif", "resultat_attendu"],
};

function buildSteps(ctx: CloneChatContext, bp: JourneyBlueprint, priorCompleted: readonly string[], securityFailure: boolean): {
  steps: OnboardingStep[]; currentStep: number; completedStepIds: string[]; blockedStepIds: string[];
} {
  const done = new Set<string>(priorCompleted);
  const isDone = (s: JourneyStepSpec): boolean => {
    if (s.gate) return (s.prerequisites ?? []).every((p) => prereqSatisfied(ctx, p));
    return done.has(s.id);
  };
  let currentIndex = bp.steps.findIndex((s) => !isDone(s));
  if (currentIndex === -1) currentIndex = bp.steps.length; // tout fait

  const completedStepIds = [...new Set([...priorCompleted, ...bp.steps.filter((s) => s.gate && isDone(s)).map((s) => s.id)])];
  const blockedStepIds: string[] = [];
  const steps: OnboardingStep[] = bp.steps.map((s, i) => {
    let state: OnboardingStepState;
    if (i < currentIndex || isDone(s)) state = "done";
    else if (i === currentIndex) state = securityFailure ? "blocked" : "current";
    else state = "pending";
    if (state === "blocked") blockedStepIds.push(s.id);
    return {
      id: s.id, text: s.text, route: realRoute(s.route),
      visualTargetId: s.visualTargetId && getVisualTarget(s.visualTargetId) ? s.visualTargetId : null,
      prerequisites: Object.freeze([...(s.prerequisites ?? [])]), gate: s.gate === true, state,
    };
  });
  const total = bp.steps.length;
  const currentStep = total === 0 ? 0 : currentIndex < total ? currentIndex + 1 : total;
  return { steps, currentStep, completedStepIds, blockedStepIds };
}

/** Résout l'état d'onboarding. Persiste un snapshot sûr (si un store est fourni et disponible). */
export function resolveOnboarding(input: OnboardingInput): OnboardingState {
  const ctx = input.context;
  const viewerKey = viewerKeyOf(ctx);
  const tenantKey = tenantKeyOf(ctx);
  const key = onboardingKey(viewerKey, tenantKey);
  const ttl = input.ttlMs ?? DEFAULT_ONBOARDING_TTL_MS;
  const prior = input.store ? loadValidOnboarding(input.store, key, viewerKey, tenantKey, input.nowMs) : null;

  const journeyId = selectJourney(ctx, input.goal);
  const bp = getJourney(journeyId);
  const priorCompleted = prior && prior.journeyId === journeyId ? prior.completedStepIds : [];
  const securityFailure = ctx.tenant.securityFailure;

  const { steps, currentStep, completedStepIds, blockedStepIds } = buildSteps(ctx, bp, priorCompleted, securityFailure);
  const gates = bp.steps.filter((s) => s.gate);
  const allGatesSatisfied = gates.every((s) => (s.prerequisites ?? []).every((p) => prereqSatisfied(ctx, p)));
  const missingPrerequisites: CloneChatPrerequisite[] = [...new Set(gates.flatMap((s) => (s.prerequisites ?? []).filter((p) => !prereqSatisfied(ctx, p))))];

  const providedInfo = redactInfo({ ...(prior?.providedInfo ?? {}), ...(input.providedInfo ?? {}) });
  const requestedInfo = (INFO_REQUIRED[journeyId] ?? []).filter((k) => !providedInfo[k]);

  // ── Statut ──────────────────────────────────────────────────────────────────
  let status: OnboardingStatus;
  let interruptionReason: string | null = prior?.interruptionReason ?? null;
  if (input.cancelled) { status = "skipped"; interruptionReason = "user_abandon"; }
  else if (input.alreadyOnboarded || (prior?.status === "completed" && prior.journeyId === journeyId)) status = "completed";
  else if (journeyId === "contact_support" && securityFailure) status = "escalate";
  else if (journeyId === "recover_entitlement") status = "blocked";
  else if (!allGatesSatisfied) status = "in_progress"; // on guide vers la porte
  else if (requestedInfo.length > 0) status = "awaiting_input";
  else status = "ready";

  const currentSpec = bp.steps[Math.min(currentStep - 1, bp.steps.length - 1)] ?? bp.steps[bp.steps.length - 1];
  const currentRoute = realRoute(ctx.navigation.routePath ?? null);
  const recommendedRoute = realRoute(currentSpec?.route ?? null);
  const visualTargetId = currentSpec?.visualTargetId && getVisualTarget(currentSpec.visualTargetId) ? currentSpec.visualTargetId : null;

  const resumeState: ResumeState = prior ? "resumed" : "fresh";
  const createdAtMs = prior?.createdAtMs ?? input.nowMs;
  const updatedAtMs = input.nowMs;
  const expiresAtMs = input.nowMs + ttl;
  const id = prior?.id ?? `ob_${input.idSeed ?? viewerKey}_${journeyId}`;

  const state: OnboardingState = Object.freeze({
    version: CLONECHAT_ONBOARDING_VERSION, id, viewerKey, tenantKey, goal: bp.goal, journeyId,
    currentStep: status === "completed" ? steps.length : currentStep,
    totalSteps: steps.length,
    completedStepIds: Object.freeze(completedStepIds), blockedStepIds: Object.freeze(blockedStepIds),
    missingPrerequisites: Object.freeze(missingPrerequisites),
    currentRoute, recommendedRoute, visualTargetId,
    requestedInfo: Object.freeze(requestedInfo), providedInfo: Object.freeze(providedInfo),
    createdAtMs, updatedAtMs, expiresAtMs, resumeState, interruptionReason, status,
    steps: Object.freeze(steps),
  });

  // Persistance sûre (snapshot minimal, jamais de contenu sensible). Store indisponible → honnête.
  if (input.store) {
    const persisted: OnboardingPersisted = {
      version: CLONECHAT_ONBOARDING_VERSION, id, viewerKey, tenantKey, journeyId,
      completedStepIds, providedInfo, createdAtMs, updatedAtMs, expiresAtMs, status, interruptionReason,
    };
    try { input.store.save(key, persisted); } catch { /* stockage indisponible : reprise fraîche future */ }
  }

  return state;
}

/** Redige les valeurs d'info (jamais un secret ; borné). */
function redactInfo(info: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(info)) {
    if (/(token|secret|password|api[_-]?key|cookie|authorization|bearer|rib|iban|carte)/i.test(k)) continue; // clé sensible : jamais stockée
    out[k] = redactText(String(v)).slice(0, 300);
  }
  return out;
}
