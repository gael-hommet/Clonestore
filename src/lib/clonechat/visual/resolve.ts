// src/lib/clonechat/visual/resolve.ts
//
// Résolution DÉTERMINISTE du guidage visuel + détection d'obsolescence. Choisit une cible RÉELLE
// depuis le guide/diagnostic/action, applique les portes d'audience/contexte (isolation CloneContext)
// et l'obsolescence, et renvoie un VisualGuidance HONNÊTE : cible vérifiée → target_found ; ancre
// déclarée non vérifiée → ready (jamais présentée comme exacte) ; sinon fallback_text. Aucune
// coordonnée codée en dur (rect toujours null ici : seule une mesure navigateur le remplit).

import { getRouteEntry } from "@/lib/nav/route-registry";
import type { CloneChatContext } from "@/lib/clonechat/context";
import type { CloneChatDiagnosis } from "@/lib/clonechat/diagnosis";
import type { CloneGuide } from "@/lib/clonechat/guide";
import type { CloneActionPlan } from "@/lib/clonechat/actions";
import { getVisualTarget, declaredAnchorContract } from "./registry";
import {
  CLONECHAT_VISUAL_VERSION, VIEWPORTS, type VisualGuidance, type VisualTarget, type VisualViewport,
  type VisualState, type VisualConfidence, type LocationStrategy,
} from "./types";

// ── Obsolescence déterministe ─────────────────────────────────────────────────
export type StaleReason =
  | "anchor_absent" | "route_removed" | "viewport_unsupported" | "fingerprint_changed" | null;

export function detectStale(target: VisualTarget, opts: { viewport: VisualViewport; pageFingerprint?: string | null } = { viewport: "desktop" }): StaleReason {
  // Ancre déclarée disparue du contrat réel → obsolète.
  if (target.element.tourId && !declaredAnchorContract().has(target.element.tourId)) return "anchor_absent";
  // Route supprimée du registre.
  if (target.route !== "" && !getRouteEntry(target.route)) return "route_removed";
  // Viewport non supporté par la cible.
  if (!target.viewports.includes(opts.viewport)) return "viewport_unsupported";
  // Empreinte de page changée (si les deux sont connues et diffèrent).
  if (opts.pageFingerprint && target.pageFingerprint && opts.pageFingerprint !== target.pageFingerprint) return "fingerprint_changed";
  return null;
}

// ── Sélection de la cible depuis le pipeline ──────────────────────────────────
const GUIDE_TO_TARGET: Readonly<Record<string, string>> = {
  reserve_pierre: "vt_pierre_page",
  view_demo: "vt_demo",
  checkout: "vt_checkout",
  login: "vt_login",
  signup: "vt_signup",
  contact_support: "vt_support",
  unknown_route: "vt_home",
  resolve_no_company: "vt_resolve_company",
  select_company: "vt_select_company",
  resolve_no_pierre: "vt_reserve",
  recover_entitlement_lookup: "vt_recover",
  after_payment_diagnosis: "vt_checkout",
  resolve_tenant_or_permission: "vt_support",
};

export interface VisualResolveInput {
  readonly viewport: VisualViewport;
  readonly context: CloneChatContext;
  readonly guide?: CloneGuide | null;
  readonly diagnosis?: CloneChatDiagnosis | null;
  readonly actionPlan?: CloneActionPlan | null;
  readonly pageFingerprint?: string | null;
}

function selectTargetId(input: VisualResolveInput): string | null {
  if (input.actionPlan) {
    if (input.actionPlan.state === "awaiting_confirmation") return "vt_confirm_overlay";
    if (input.actionPlan.state === "blocked") return "vt_blocked_overlay";
  }
  if (input.diagnosis?.kind === "permission_denied") return "vt_blocked_overlay";
  if (input.guide) return GUIDE_TO_TARGET[input.guide.id] ?? null;
  return null;
}

function locationMethod(t: VisualTarget): LocationStrategy {
  if (t.accessibleRole && t.accessibleLabel) return "accessible_role_name";
  if (t.accessibleLabel) return "accessible_label";
  if (t.stableSelector) return "stable_attribute";
  return "structural_selector";
}

function make(input: VisualResolveInput, target: VisualTarget | null, o: {
  state: VisualState; confidence: VisualConfidence; unavailableReason: string | null; evidence: string[];
}): VisualGuidance {
  const goal = target?.goal ?? input.guide?.goal ?? "Accompagnement visuel.";
  const route = target ? (target.route === "" ? null : target.route) : (input.guide?.recommendedRoute ?? input.diagnosis?.recommendedRoute ?? null);
  const fallbackText = target?.fallbackText ?? (route ? `Ouvrez : ${route}` : "Je vous guide par texte : précisez ce que vous cherchez.");
  const instruction = target?.instruction ?? fallbackText;
  return Object.freeze({
    version: CLONECHAT_VISUAL_VERSION,
    goal,
    route,
    viewport: input.viewport,
    expectedPageState: target?.requiredPageState ?? null,
    target,
    locationMethod: target && o.state === "target_found" ? locationMethod(target) : null,
    rect: null, // aucune coordonnée non mesurée
    capture: null, // captures produites uniquement par le navigateur (jamais inventées)
    instruction,
    guideStepId: input.guide?.steps?.[Math.max(0, (input.guide.currentStep ?? 1) - 1)]?.id ?? null,
    actionId: input.actionPlan?.definition?.id ?? null,
    prerequisites: target?.prerequisites ?? input.guide?.missingPrerequisites ?? [],
    confidence: o.confidence,
    state: o.state,
    unavailableReason: o.unavailableReason,
    fallbackText,
    evidence: Object.freeze([...o.evidence]),
  });
}

/**
 * Résout le guidage visuel. Jamais de cible inventée : cibles vérifiées → target_found ; ancres
 * déclarées non vérifiées → ready (avec repli texte) ; obsolètes → stale ; sinon fallback_text.
 */
export function resolveVisualGuidance(input: VisualResolveInput): VisualGuidance {
  // Parcours terminé.
  if (input.guide?.state === "completed") {
    return make(input, null, { state: "completed", confidence: "high", unavailableReason: null, evidence: ["guide_completed"] });
  }

  const targetId = selectTargetId(input);
  const target = targetId ? getVisualTarget(targetId) : null;

  // Aucune cible → repli textuel honnête.
  if (!target) {
    return make(input, null, { state: "fallback_text", confidence: "low", unavailableReason: "no_reliable_target", evidence: ["no_visual_target"] });
  }

  // Obsolescence (jamais présentée comme exacte).
  const stale = detectStale(target, { viewport: input.viewport, pageFingerprint: input.pageFingerprint });
  if (stale === "route_removed") {
    return make(input, target, { state: "target_not_found", confidence: "low", unavailableReason: "route_removed", evidence: [`stale:${stale}`] });
  }
  if (stale === "anchor_absent" || stale === "fingerprint_changed") {
    return make(input, target, { state: "stale", confidence: "low", unavailableReason: stale, evidence: [`stale:${stale}`] });
  }
  if (stale === "viewport_unsupported") {
    return make(input, target, { state: "fallback_text", confidence: "low", unavailableReason: "viewport_unsupported", evidence: [`stale:${stale}`, `viewport:${input.viewport}`] });
  }

  // Portes d'audience / contexte (isolation CloneContext).
  if (target.audience === "authenticated" || target.audience === "gated") {
    if (!input.context.viewer.authenticated) {
      return make(input, target, { state: "needs_authentication", confidence: "medium", unavailableReason: "authentication_required", evidence: [`audience:${target.audience}`] });
    }
    if (target.prerequisites.includes("active_company") && !input.context.tenant.resolved) {
      return make(input, target, { state: "needs_context", confidence: "medium", unavailableReason: "company_context_required", evidence: ["prereq:active_company"] });
    }
  }

  // Statut de la cible.
  if (target.status === "verified") {
    return make(input, target, { state: "target_found", confidence: "high", unavailableReason: null, evidence: [target.provenance, `viewport:${input.viewport}`, `w=${VIEWPORTS[input.viewport].width}`] });
  }
  if (target.status === "declared") {
    // Ancre réelle mais non vérifiée navigateur ici → guidage prêt, jamais présenté comme mesuré/exact.
    return make(input, target, { state: "ready", confidence: "medium", unavailableReason: "not_browser_verified", evidence: [target.provenance, "status:declared"] });
  }
  if (target.status === "stale") {
    return make(input, target, { state: "stale", confidence: "low", unavailableReason: "declared_stale", evidence: ["status:stale"] });
  }
  // unavailable → repli texte au niveau route/surcouche.
  return make(input, target, { state: "fallback_text", confidence: target.route ? "medium" : "low", unavailableReason: "no_in_page_anchor", evidence: [target.provenance, "status:unavailable"] });
}
