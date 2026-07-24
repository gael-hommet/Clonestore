# Raw finding — Homepage full cartography

Source: read-only Explore agent, direct Grep/Read of `src/app/page.tsx`, `layout.tsx`, `site-header.tsx`, `site-footer.tsx`.

## Section order (identical DOM order desktop/mobile — confirmed no reordering)
0. `SiteHeader` (global, before `<main>`) · 1. Desktop-only section-jump rail (`display:none` below 1180px, not reordered — absent) · **2. `<section id="overview">` — THE HERO, `page.tsx:544-648`** · 3. "Employé IA, pas assistant" comparison/pricing (650-715) · 4. `#employees` (717-756) · 5. `#technologies` (758-776) · 6. `#cockpit` (778-799) · 7. `#trust` (801-831) · 8. Final CTA (833-872) · 9. `SiteFooter`.

Confirmed via exhaustive grep: zero `md:order-`, `flex-col-reverse`, viewport-conditional rendering anywhere in `page.tsx`. Column-count changes only (CSS Grid), DOM order never changes.

## Exact hero boundary (for the protected-zone determination)
**`src/app/page.tsx:544` to `:648`** — `<section id="overview" data-tour-id="homepage-primary">`. Contains: eyebrow pills, `<h1>` slogan "Gagnez du temps / et de l'argent." (569-607), body paragraph, 3 CTAs (Voir la démo Pierre → `/demo/pierre`, Découvrir les employés → `/agents`, Parler à CloneChat → `/assistant`), 3-metric grid ("24/7", "Traçable", "Contrôlé"), `CloneCoreOrbit` animated visual. **Everything from line 650 onward is unambiguously below the hero.** A prior mobile-fit tuning comment already exists at `page.tsx:579-581` re: the `clamp()` font floor to prevent horizontal overflow on 320-430px screens — this hero has already been the subject of careful mobile tuning.

## CTAs to /demo, /demo/pierre, /agents/pierre, /reserver/pierre, /checkout
`/checkout` — **not linked anywhere on the homepage** (reached only downstream). All others: header nav "Démo"→`/demo` and "Réserver Pierre"→`/reserver/pierre` (both above hero, global header); hero CTA "Voir la démo Pierre"→`/demo/pierre` (inside hero); 2nd-section CTAs "Voir la démo Pierre"→`/demo/pierre` + "Réserver Pierre"→`/reserver/pierre` (below hero); `EmployeeCard` "Voir la fiche"→`/agents/pierre` + "Voir la démo"→`/demo/pierre` (below hero, `#employees`).

## Sticky header / mobile nav
`site-header.tsx` — hamburger toggles a `max-h-0`→`max-h-[80vh]` Tailwind-transition dropdown (no bottom sheet, no JS animation library). Suppressed on cockpit/admin routes only, always shown on `/`.

## Heavy animations
`CloneCoreOrbit` (hero visual) + `CloneTechnologyConstellation`: CSS `@keyframes` running continuously (24s/31s loops), gated only by `prefers-reduced-motion`, never by viewport visibility. No `<video>`, no `next/dynamic`, no lazy-loading anywhere in `page.tsx`.

## Existing contextual-prompt-like mechanisms (critical prior-art finding)
**`GuidedTourProvider`** (global, `layout.tsx:80`) already shows a fixed bottom-center welcome card on `/` after a flat 1200ms timer (not scroll/engagement-based), offering a full 7-step multi-page product tour — NOT specifically a "go see the demo proof" nudge. Persisted via localStorage, 24h snooze. **Separately, the PWA install-prompt is explicitly excluded from `/`** via a route whitelist (`isPwaAutoInvitePath`) specifically because "a floating card that covers a CTA... would degrade the commercial demo" (`detect.ts:192-197` comment). **Decision made in this block: the new `DemoContextualPrompt` is deliberately scoped narrower and differently-triggered (scroll-depth, not a timer) than the guided tour, and does not fire simultaneously with it** — see `DEMO_CONTEXTUAL_PROMPT_SPEC.md`.

## Hydration-mismatch candidates in the homepage's own render tree
**None found that synchronously read window/Date/Math.random/storage during render.** Every risky read (`site-footer.tsx:49` `new Date().getFullYear()`, `PresencePing`, `topbar-auth-slot.tsx`'s auth resolution, `GuidedTourProvider`'s `window.innerWidth`/`localStorage`, PWA's `matchMedia`/`navigator`) is deferred into `useEffect`/callbacks. The one soft, pre-existing, non-blocking finding: `topbar-auth-slot.tsx` shows a loading skeleton in both SSR and first client render, then swaps to guest/auth CTAs once its effect resolves — a visible post-hydration content swap, not a React hydration **error**. Documented as a minor finding, not fixed (out of this block's narrow hydration-mismatch scope, which is specifically about the ISSUE-04 caret-color report on `/demo`).
