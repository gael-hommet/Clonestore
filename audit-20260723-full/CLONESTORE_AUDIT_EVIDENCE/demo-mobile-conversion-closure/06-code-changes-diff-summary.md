# Code changes made in this block — exact file inventory

All changes are additive/minimal. None touch P0.1/P0.2/CloneGuard/human-only floors/the v1-hr engine/the country-price canon/Stripe Price IDs/the canonical webhook/`PRODUCTION_AUTHORIZED`/the homepage hero (lines 544-648)/slogan/schemas/illustrations/animations/legal page text/DPA/partner rules.

## Modified — application code (6 files)
1. `src/components/demo/cost/CapacityCalculator.tsx` — `suppressHydrationWarning` + justification comment added to the number and range inputs (ISSUE-04 fix). No other change — value/onChange/controlled behavior untouched.
2. `src/components/demo/acts/ValueChapter.tsx` — same fix, same justification, on its one range input.
3. `src/lib/founder-access/types.ts` — 3 new event names added to `CLIENT_ANALYTICS_EVENTS` (`homepage_demo_prompt_seen`, `homepage_demo_prompt_clicked`, `homepage_demo_prompt_dismissed`), for the new contextual prompt. No existing event renamed or removed.
4. `src/app/page.tsx` — 1 import added, 1 line added (`<DemoContextualPrompt />`) as a sibling to the existing `<PresencePing/>` mount point, immediately inside `<main>`. Hero (lines 544-648, now shifted by +2 lines only from these 2 insertions above it) untouched in content/structure.
5. `src/app/demo/pierre/page.tsx` — 1 icon import added, 1 small "← Retour à la démo générale" link added above `<PierreDemoExperience/>` (Phase 10 requirement — no back-link existed).
6. `vitest.config.ts` — added `oxc.jsx = {runtime:"automatic"}`. Vitest-only config (does not touch `tsconfig.json`, which Next.js's own SWC build still uses unchanged with `"jsx":"preserve"`). Unblocks component-level SSR/hydration testing repo-wide — previously zero component tests were possible in this repo at all.

## Created — new feature code (5 files)
7. `src/lib/demo/contextual-prompt/constants.ts` — storage key, scroll threshold (0.35), env-flag key name.
8. `src/lib/demo/contextual-prompt/contextual-prompt-flags.ts` — `isDemoContextualPromptEnabled()`, mirrors the repo's 3 existing `NEXT_PUBLIC_*` flag precedents exactly; defaults **false** (documented reasoning: new, unvalidated UX, Phase 18 external validation not yet run).
9. `src/lib/demo/contextual-prompt/detect.ts` — pure `evaluateDemoContextualPrompt()` + `scrollDepthRatio()`, no DOM/window reads, mirrors `src/lib/pwa/detect.ts`'s contract exactly.
10. `src/components/home/DemoContextualPromptCard.tsx` — presentational card, mirrors `InstallPrompt.tsx`'s accessibility scaffolding (role="dialog" non-modal, safe-area aware, keyboard-safe dismiss).
11. `src/components/home/DemoContextualPrompt.tsx` — DOM adapter (scroll listener, sessionStorage, feature flag, analytics), calls the pure logic above.

## Created — tests (5 files)
12. `src/components/demo/cost/__tests__/capacity-calculator-hydration.test.ts` — 4 tests: SSR determinism, no caret-color of our own, controlled value correctness, exactly 2 justified `suppressHydrationWarning` occurrences.
13. `src/lib/demo/contextual-prompt/__tests__/detect.test.ts` — 11 tests covering every decision branch + scroll-ratio edge cases.
14. `src/lib/demo/contextual-prompt/__tests__/contextual-prompt-flags.test.ts` — 3 tests: default-false, non-"true" values rejected, exact-"true" accepted.
15. `src/components/home/__tests__/demo-contextual-prompt-card.test.ts` — 5 tests: SSR determinism, no caret-color, accessible name + 3 real `<button>` elements, no forbidden claim wording, non-modal (no `aria-modal`).

## Created — evidence + reports
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/` (this folder).
- 14 required deliverables directly under `audit-20260723-full/`.

## Explicitly NOT modified (verified via mtime forensics, see file 07)
- `src/app/page.tsx` lines 1-543 and 650-878 unchanged in substance (only the 2-line insertion noted above).
- `src/lib/pierre/legacy-execute-governance.ts`, `/api/pierre/execute|action`, `/api/router`, CloneGuard, human-only floors, `p10-production-gate.ts`.
- `src/lib/clonestore/pricing/**`, checkout canon, Stripe webhook, `/legal/**` page content, DPA, partner-program rules.
- `src/components/demo/DemoExperience.tsx`, all `Act*.tsx` files (read for investigation, never edited), `ScenarioComparator.tsx`, `pinned.tsx`, `motion.tsx`, `useSequentialReveal.ts`.
- `GuidedTourProvider`/`PUBLIC_DISCOVERY_TOUR` — read to avoid duplicating it, never modified.
