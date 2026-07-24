# Raw finding — Mobile detection / reduced-motion / feature-flag conventions

Source: read-only Explore agent, direct Grep/Read across `src/components/demo/primitives/motion.tsx`, `src/lib/pwa/**`, `src/components/pwa/**`, `src/lib/clonestore/cloneos/cloneos-app-shell-contract.ts`.

## Reduced-motion — established, SSR-safe convention
`motion.tsx` deliberately never reads `prefers-reduced-motion` directly in its variants (explicit header comment: reading it in render would cause a hydration mismatch). Gating happens via `<MotionConfig reducedMotion="user">` at the page/orchestrator root (`DemoExperience.tsx`, `PartenairesLanding.tsx`, `LiquidGlassPanel.tsx` — same pattern, same comment, verbatim reused 3×). `useDemoReducedMotion()` is the escape hatch for imperative code.

## No canonical viewport/mobile-detection hook exists
Zero matches for `useIsMobile`/`useViewport`/`useMediaQuery`. **Five independent, duplicated ad-hoc implementations** found instead (`demo-analytics.ts`'s `deviceFamily()`, `PresencePing.tsx`'s `deviceCategory()`, `GuidedTourProvider.tsx`'s `readViewport()`, two duplicated scrollbar-width calculations, CSS-only breakpoints). This block did not need viewport JS detection (the contextual prompt uses only a scroll-ratio, not a device-type branch), so no new duplicate was added and none of the five was consolidated (out of scope).

## PWA install-invite pattern — the reuse template for this block's contextual prompt
`evaluateInstallInvite()` (`src/lib/pwa/detect.ts`) is a pure function taking explicit state (no direct DOM reads) → `{show, kind, reason}`. Precedence: already-installed check first, then platform-support, then cooldown-since-dismissal (timestamp-based, ignorable only via an explicit `manual` flag), then minimum-engagement (visit count), then platform-specific presentation. Storage: `PWA_STORAGE` key object (`cs.pwa.*` namespaced), dismissal stored as a **timestamp** not a boolean (time-based cooldown, not permanent). Route eligibility: explicit fail-closed whitelist (`isPwaAutoInvitePath`), with a documented rationale for excluding the commercial funnel. **This block's `evaluateDemoContextualPrompt()` mirrors this exact shape**: pure function, explicit `DemoPromptState` input, `{show, reason}` output, `DEMO_PROMPT_STORAGE` key object, fail-closed route whitelist (homepage-only) — see `src/lib/demo/contextual-prompt/detect.ts`.

## Feature-flag convention (3 precedents, one shape)
`isGlobalOnboardingServerPersistenceEnabled()`, `isEnterpriseFootprintServerPersistenceEnabled()`, `isCloneOsHistoryServerPersistenceEnabled()` — all: exact-string `=== "true"` comparison (never truthy coercion), `try/catch` guarding `typeof process === "undefined"` (SSR/edge safety), default `false`, one file per feature, explicit "never hardcode true" comment. **`isDemoContextualPromptEnabled()` in this block follows this exact shape.**

## `100dvh`/`100svh` — proven fix for the mobile-viewport-height bug, already shipped twice
`.cos-root` (CloneOS shell, P12): `height:100vh; height:100dvh; overflow:hidden` cascade (vh fallback before dvh override, old-browser-safe). `/demo` and `/demo/pierre` both already use `calc(100svh - var(--demo-header-height, 88px))` paired with a live `useDemoHeaderHeightVar()` hook measuring the real header height into a CSS var — the established fix for "mobile browser chrome eats 100vh" in this codebase. Plain unpaired `100vh` still exists in several older `globals.css` spots (not migrated, pre-existing inconsistency, not touched in this block).

## Bottom-sheet/drawer precedent used for this block's card styling
`InstallPrompt.tsx` (bottom floating card, non-modal, `role="dialog"`, safe-area aware) is the closest sibling to what this block needed (a non-modal floating invitation, not a document-heavy drawer like `DemoDrawer.tsx`) — **`DemoContextualPromptCard.tsx` copies this exact accessibility scaffolding** (role="dialog" non-modal, `aria-label`, keyboard-safe dismiss button, safe-area padding) rather than inventing new accessibility semantics.
