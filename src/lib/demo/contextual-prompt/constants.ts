// DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — homepage contextual demo-invitation.
// Mirrors the established PWA install-invite convention (src/lib/pwa/constants.ts):
// storage-key object + documented numeric thresholds, nothing hidden inline.

export const DEMO_PROMPT_STORAGE = {
  /** sessionStorage — dismissed for THIS session only (never localStorage/permanent). */
  dismissed: "cs.demoPrompt.dismissed",
} as const;

/**
 * Scroll-depth ratio (0..1, same `scrollY / (scrollHeight - innerHeight)` idiom already
 * used by src/components/demo/DemoExperience.tsx) past which a visitor reading the
 * homepage without having opened the demo is considered "exploring, not yet convinced" —
 * the single, simple, testable trigger this feature uses (deliberately not stacking scroll
 * + time + exit-intent, per the instruction not to combine multiple aggressive mechanisms).
 */
export const DEMO_PROMPT_SCROLL_THRESHOLD = 0.35;

export const DEMO_PROMPT_ENV_KEY = "NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED" as const;
