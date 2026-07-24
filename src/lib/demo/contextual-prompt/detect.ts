// DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — pure decision logic (no DOM, no
// window/navigator/storage reads), mirroring src/lib/pwa/detect.ts's contract: inputs are
// passed explicitly so this is deterministic and testable in plain Node/vitest. The DOM
// adapter (scroll listener, sessionStorage read/write) lives only in the "use client"
// component that calls this.

import { DEMO_PROMPT_SCROLL_THRESHOLD } from "./constants";

export type DemoPromptEligibleRoute = "/";

/** Only the homepage, for now — this block's scope is homepage → demo specifically. */
export function isDemoPromptEligibleRoute(pathname: string): pathname is DemoPromptEligibleRoute {
  return pathname === "/";
}

export interface DemoPromptState {
  enabled: boolean;
  pathname: string;
  /** 0..1, same ratio DemoExperience.tsx already computes for its own scroll-depth events. */
  scrollDepth: number;
  dismissedThisSession: boolean;
  scrollThreshold?: number;
}

export interface DemoPromptDecision {
  show: boolean;
  reason:
    | "disabled"
    | "wrong-route"
    | "dismissed-this-session"
    | "not-engaged-yet"
    | "eligible";
}

export function evaluateDemoContextualPrompt(state: DemoPromptState): DemoPromptDecision {
  const threshold = state.scrollThreshold ?? DEMO_PROMPT_SCROLL_THRESHOLD;

  if (!state.enabled) return { show: false, reason: "disabled" };
  if (!isDemoPromptEligibleRoute(state.pathname)) return { show: false, reason: "wrong-route" };
  if (state.dismissedThisSession) return { show: false, reason: "dismissed-this-session" };
  if (state.scrollDepth < threshold) return { show: false, reason: "not-engaged-yet" };

  return { show: true, reason: "eligible" };
}

/** Same clamped-ratio idiom as DemoExperience.tsx's depth(), extracted so both the
 * component and its tests share one implementation instead of two hand-rolled copies. */
export function scrollDepthRatio(scrollY: number, scrollHeight: number, innerHeight: number): number {
  const max = scrollHeight - innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / max));
}

/**
 * Overlay-collision arbitration (2026-07-24) — GuidedTourProvider's automatic homepage
 * welcome (PUBLIC_DISCOVERY_WELCOME, a flat 1200ms-timer floating card) and this feature's
 * DemoContextualPrompt (a scroll-depth-triggered floating card) must never both be able to
 * auto-appear on `/`. Pure, so both GuidedTourProvider and its tests share one source of
 * truth instead of an inline boolean duplicated in the component.
 *
 * Only the homepage's AUTOMATIC welcome is affected — manual tour launch, every other
 * route's contextual tour, and all existing snooze/progress storage are untouched by this
 * function (it does not gate them at all; GuidedTourProvider only calls this for the
 * specific "/" auto-welcome effect).
 */
export function shouldSuppressHomepageAutoWelcome(pathname: string, demoPromptEnabled: boolean): boolean {
  return pathname === "/" && demoPromptEnabled;
}
