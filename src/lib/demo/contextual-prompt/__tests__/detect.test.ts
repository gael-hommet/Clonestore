import { describe, it, expect } from "vitest";
import {
  evaluateDemoContextualPrompt,
  isDemoPromptEligibleRoute,
  scrollDepthRatio,
  shouldSuppressHomepageAutoWelcome,
} from "../detect";
import { DEMO_PROMPT_SCROLL_THRESHOLD } from "../constants";

describe("evaluateDemoContextualPrompt — pure decision logic", () => {
  const base = {
    enabled: true,
    pathname: "/",
    scrollDepth: DEMO_PROMPT_SCROLL_THRESHOLD,
    dismissedThisSession: false,
  };

  it("shows once every gate passes", () => {
    expect(evaluateDemoContextualPrompt(base)).toEqual({ show: true, reason: "eligible" });
  });

  it("never shows when the feature flag is disabled — checked first, before any other gate", () => {
    expect(evaluateDemoContextualPrompt({ ...base, enabled: false })).toEqual({
      show: false,
      reason: "disabled",
    });
  });

  it("never shows off the homepage", () => {
    expect(evaluateDemoContextualPrompt({ ...base, pathname: "/demo" })).toEqual({
      show: false,
      reason: "wrong-route",
    });
    expect(evaluateDemoContextualPrompt({ ...base, pathname: "/agents/pierre" })).toEqual({
      show: false,
      reason: "wrong-route",
    });
  });

  it("never re-shows once dismissed for the session, regardless of scroll depth", () => {
    expect(
      evaluateDemoContextualPrompt({ ...base, dismissedThisSession: true, scrollDepth: 1 }),
    ).toEqual({ show: false, reason: "dismissed-this-session" });
  });

  it("does not show before the scroll threshold — not shown at first pixel", () => {
    expect(evaluateDemoContextualPrompt({ ...base, scrollDepth: 0 })).toEqual({
      show: false,
      reason: "not-engaged-yet",
    });
    expect(
      evaluateDemoContextualPrompt({ ...base, scrollDepth: DEMO_PROMPT_SCROLL_THRESHOLD - 0.01 }),
    ).toEqual({ show: false, reason: "not-engaged-yet" });
  });

  it("shows exactly at and above the threshold (inclusive boundary)", () => {
    expect(
      evaluateDemoContextualPrompt({ ...base, scrollDepth: DEMO_PROMPT_SCROLL_THRESHOLD }).show,
    ).toBe(true);
    expect(evaluateDemoContextualPrompt({ ...base, scrollDepth: 1 }).show).toBe(true);
  });

  it("honors an explicit scrollThreshold override for testability", () => {
    expect(
      evaluateDemoContextualPrompt({ ...base, scrollDepth: 0.1, scrollThreshold: 0.05 }).show,
    ).toBe(true);
  });
});

describe("isDemoPromptEligibleRoute", () => {
  it("is true only for the exact homepage path", () => {
    expect(isDemoPromptEligibleRoute("/")).toBe(true);
    expect(isDemoPromptEligibleRoute("/demo")).toBe(false);
    expect(isDemoPromptEligibleRoute("")).toBe(false);
    expect(isDemoPromptEligibleRoute("/index")).toBe(false);
  });
});

describe("scrollDepthRatio", () => {
  it("clamps to [0,1] and matches DemoExperience.tsx's own scrollY/(scrollHeight-innerHeight) idiom", () => {
    expect(scrollDepthRatio(0, 2000, 800)).toBe(0);
    expect(scrollDepthRatio(1200, 2000, 800)).toBe(1);
    expect(scrollDepthRatio(600, 2000, 800)).toBeCloseTo(0.5, 5);
  });

  it("returns 0 when the page is shorter than the viewport (no scroll possible), never divides by a negative/zero max", () => {
    expect(scrollDepthRatio(0, 500, 800)).toBe(0);
    expect(scrollDepthRatio(0, 800, 800)).toBe(0);
  });

  it("never returns a negative ratio for a negative scrollY (defensive, shouldn't occur in real browsers)", () => {
    expect(scrollDepthRatio(-50, 2000, 800)).toBe(0);
  });
});

describe("shouldSuppressHomepageAutoWelcome — overlay-collision arbitration", () => {
  it("suppresses the GuidedTour homepage auto-welcome ONLY when on '/' AND the demo prompt is enabled", () => {
    expect(shouldSuppressHomepageAutoWelcome("/", true)).toBe(true);
  });

  it("never suppresses when the demo prompt is disabled — flag OFF preserves historical GuidedTour behavior exactly", () => {
    expect(shouldSuppressHomepageAutoWelcome("/", false)).toBe(false);
  });

  it("never suppresses other routes' tours, even with the demo prompt enabled", () => {
    expect(shouldSuppressHomepageAutoWelcome("/profile", true)).toBe(false);
    expect(shouldSuppressHomepageAutoWelcome("/agents/pierre/use", true)).toBe(false);
    expect(shouldSuppressHomepageAutoWelcome("/assistant", true)).toBe(false);
  });

  it("treats an empty/unresolved pathname the same as a non-homepage route (fails closed, never suppresses by accident)", () => {
    expect(shouldSuppressHomepageAutoWelcome("", true)).toBe(false);
  });
});
