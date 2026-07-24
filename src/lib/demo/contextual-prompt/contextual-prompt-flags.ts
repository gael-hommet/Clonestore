// DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — feature flag for the homepage
// contextual demo-invitation prompt. Mirrors the repo's existing NEXT_PUBLIC_* flag
// convention (e.g. src/lib/clonestore/onboarding/global-onboarding-flags.ts): exact-string
// comparison to "true", SSR-safe, defaults CLOSED.
//
// Default is OFF (never hardcode true): this is a brand-new, unvalidated UX experiment —
// Phase 18's 30-tester protocol has not been run (EXTERNAL_VALIDATION_PENDING). Turning it
// on is a deliberate owner decision after reviewing placement/copy in a real browser, not an
// ambient default this block silently ships live. See DEMO_CONTEXTUAL_PROMPT_SPEC.md.
import { DEMO_PROMPT_ENV_KEY } from "./constants";

export function isDemoContextualPromptEnabled(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return process.env[DEMO_PROMPT_ENV_KEY] === "true";
  } catch {
    return false;
  }
}
