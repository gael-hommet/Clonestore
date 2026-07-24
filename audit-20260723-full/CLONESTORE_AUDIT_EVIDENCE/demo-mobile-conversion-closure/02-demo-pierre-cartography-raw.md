# Raw finding — /demo/pierre full cartography

Source: read-only Explore agent, direct Grep/Read of `src/app/demo/pierre/**`, `src/components/pierre/demo/**`.

## Component tree
`layout.tsx` (server, sets metadata, resolves an A/B variant from a signed cookie, renders `VariantHero` only for A/B session visitors) → `page.tsx` (client) → `PierreDemoExperience` (hero + 7-phase auto-advancing cockpit: Demandes reçues → Analyse → Organisation → Exécution → Validation → Continuité → Bilan, ~83s total scripted dwell time) → `ConversionMoment` (mid-demo dismissible CTA) → `DemoFinalCTA` → `DemoDrawer` (document/tech side panel) → back in `page.tsx`: `PierreModes` + footer (safety chips, Réserver Pierre CTA, legal links).

## Final commercial CTA
`DemoFinalCTA` "Réserver Pierre" → `/reserver/pierre`, `data-conversion-cta="purchase"`, `data-cta-name="demo_final_reserve"` — reinforced by an identical CTA in the page footer. Clean, single, unambiguous.

## Horizontal-scroll risk
**None found.** All grids/flex use `flex-wrap`/breakpoint-gated column counts; cockpit tabs collapse to one visible zone below 1080px (structural, not just resized); drawer becomes a full-width bottom sheet ≤560px; CTA buttons go full-width ≤560px. No `overflow-x`, no fixed-width containers, no `<table>` (also asserted by an existing test, `pierre-demo-responsive.test.ts:37-39`).

## False "live" labeling
**None found — the opposite.** Every place a real-time claim could appear is explicitly disclaimed ("Données de démonstration... Aucune trace réelle n'est enregistrée", "aucun email n'est envoyé dans cette démonstration", "Aucune communication réelle · aucune donnée modifiée"). Literal uses of "live" are both negations.

## Loading states / artificial delays
Phase auto-advance uses `setTimeout` purely for narrative pacing (8-15s dwell per phase) — no spinner, no real async operation, no server round-trip anywhere in the interaction itself (page-level comment confirms: "no AI call, no Supabase write, no Stripe, no email").

## Analytics
Two layers: `trackDemoEvent()` (CustomEvent dispatch) + real network `emitConversionEvent()` (BLOC3, POSTs to `/api/conversion/events`, consumed only by `DemoEventTracker.tsx`). Every event is either mount-once (`landing_viewed`) or explicit-interaction-gated (clicks) — nothing fires on scroll-into-view on this specific route.

## Hydration-mismatch candidates
**None found.** Every `window`/`matchMedia`/`Date`/`Math.random`/storage read on this route is inside `useEffect` or an event handler — confirmed by direct code reading, none execute synchronously during the render path.

## `/demo` ↔ `/demo/pierre` navigation (finding acted upon in this block)
**No link existed from `/demo/pierre` back to `/demo`.** `/demo → /demo/pierre` exists (Act6Pierre's "Voir Pierre travailler" shared-element transition + a demoted tertiary "Revoir la démonstration" link). **Fixed in this block**: a small "← Retour à la démo générale" link added above `<PierreDemoExperience/>` in `page.tsx` (see file 06).

## Mobile-specific structural differences
Cockpit zone visibility is structurally different below 1080px (one zone visible at a time via tabs, not just resized) vs. desktop full-cockpit (all 3 zones simultaneously). Guided mode collapses to single-column even on desktop. All CSS-driven, no JS viewport-branching duplicated logic found.
