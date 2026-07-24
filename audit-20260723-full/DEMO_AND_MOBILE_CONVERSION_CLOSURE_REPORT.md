# Demo and Mobile Conversion Closure — Report

Date: 2026-07-24. Repo: `C:\Users\homme\clonestore`. Continues from P0.1/P0.2/Payment Path/Legal Closure. **This block ran alongside a concurrent external workstream** that landed 4 build-fix commits mid-block (old HEAD `7e37d715f` → new HEAD `0b3d79e61`) — treated as already-integrated external work throughout, never reverted, never attributed to this block.

## Résumé exécutif
This block: (1) root-caused the ISSUE-04 hydration mismatch as highly-probable browser-extension DOM injection (not app code — exhaustive negative search, never 100%-proven since Playwright was unavailable) and applied a justified, narrowly-scoped mitigation; (2) fixed a real, repo-wide test-infrastructure gap (Vitest could not parse any `.tsx` component before this block — zero component tests existed anywhere); (3) built a homepage → demo contextual-invitation feature, feature-flagged OFF by default, with an explicit, tested arbitration preventing it from ever colliding with the pre-existing `GuidedTourProvider` welcome card; (4) added a missing `/demo/pierre → /demo` back-link; (5) closed a free-text-capture gap in `/demo/pierre`'s analytics tracker; (6) documented (without unifying — next block's scope) the 3 coexisting analytics systems; (7) discovered and transparently reported, without fixing, a critical pre-existing gap: `/api/pierre/execute` appears to invoke no governance evaluator at all, contradicting this session's own prior P0.1 closure record.

## État initial
ISSUE-04 (hydration) and ISSUE-27-adjacent mobile/analytics gaps were known from the original audit. No contextual demo-invitation existed. `/demo/pierre` had no way back to `/demo`. Component-level testing was categorically impossible in this repo (jsx:"preserve" blocking Vitest's transform).

## Parcours initial
Homepage → `/demo/pierre` (hero CTA) or `/demo` (general demo) → Pierre demo cockpit → `/reserver/pierre` (final commercial CTA). Fully cartographed (4 parallel research agents); see evidence files 01-04.

## Qualité des analytics
3 independent systems, none unified in this block (see `DEMO_FUNNEL_EVENT_CONTRACT.md`). BLOC3's organic-traffic persistence confirmed silently dead in production. No internal-traffic filter exists anywhere. This block adds exactly 3 new, closed-enum events to the one real, server-persisted system (founder-access) for its new feature — no renaming of existing canonical events, no new duplication introduced.

## Cause du mismatch d'hydratation
Highly probable (not proven) third-party browser extension DOM injection. See `DEMO_HYDRATION_ROOT_CAUSE_REPORT.md` for the full exhaustive-search evidence and the exact required honest phrasing.

## Correction d'hydratation
`suppressHydrationWarning` on exactly 3 elements (2 in `CapacityCalculator.tsx`, 1 in `ValueChapter.tsx`), each justified inline, verified to mask nothing beyond the externally-injected style attribute (SSR determinism + no-caret-color-of-our-own both proven by new tests).

## Problèmes mobile / Corrections mobile
No CSS/spacing change made — no concrete, evidenced defect was found that a live browser wasn't required to verify (none available). Only structural/functional fixes made: `/demo/pierre` back-link, free-text analytics fix, contextual-prompt mount (fixed-position, does not alter any existing layout). See `MOBILE_UX_CHANGE_REGISTER.md`.

## Homepage protégée
Hero (`page.tsx:544-648`), slogan, schemas, illustrations, animations: proven unchanged (`HOMEPAGE_PROTECTED_ELEMENTS_PROOF.md`). Exactly 2 lines added to `page.tsx`, both outside and before the hero, both non-visual mount points.

## Invitation contextuelle
Built exactly as specified: single scroll-depth trigger (35%), session-only dismissal, no aggressive dark patterns, feature-flagged OFF by default (new, unvalidated UX — Phase 18 not run). See `DEMO_CONTEXTUAL_PROMPT_SPEC.md`.

**Mandatory collision fix**: `GuidedTourProvider`'s homepage auto-welcome (a pre-existing, independent floating card on a flat 1200ms timer) is now suppressed specifically on `/` whenever the new flag is `"true"`, via a new pure function (`shouldSuppressHomepageAutoWelcome`) — manual tour launch, other routes' tours, and all existing storage/accessibility remain fully intact. Proven by 165 passing tests (including the entire pre-existing, unmodified guided-tour test suite). See `contextual-overlay-arbitration-proof.txt`.

## Démo générale / Démo Pierre
No first-proof-timing or narrative changes made (out of evidenced-need scope). `/demo/pierre`'s free-text analytics fallback removed (closed `data-step-id` enum only, matching 4 already-tagged button groups). Back-link to `/demo` added.

## CTA commercial
Unchanged — already single, clear, unambiguous (`DemoFinalCTA` → `/reserver/pierre`), confirmed by cartography, not touched.

## Analytics canonique
Documented, mapped against the master prompt's requested names (no duplication of existing canonical events), 3 new events created for the new feature only. Full unification explicitly deferred.

## Accessibilité / Performance / Réseau / Compatibilité
Static/code-review only — see dedicated matrices. No live measurement possible this block (Playwright unavailable).

## Tests
23 new tests (4 files) + 1432 pre-existing non-regression tests, all green, reproducible. One transient cross-test flake observed and reproduced-away (unrelated to this block). One deterministic, pre-existing, out-of-scope failure (`p0-governance-closure.test.ts`, 9/10) — investigated in depth, root cause reported, not fixed (protected).

**Statut explicite requis** : `P0_1_EXECUTE_ROUTE_GOVERNANCE_GAP_PREEXISTING — BLOCKER CRITIQUE HORS PÉRIMÈTRE DÉCOUVERT PENDANT LE BLOC`. P0.2 reste vert. P0.1 (`/api/pierre/execute`) reste rouge, 9/10 tests en échec, non attribuable à ce bloc ni aux 4 commits externes (comportement identique sur l'ancien et le nouveau HEAD). Ne pas confondre avec une clôture globale : ce sous-bloc Demo est fermé techniquement, la sécurité globale du lancement CloneStore ne l'est pas.

## Build
**Résolu, vert, à la deuxième tentative.** Tentative 1 : compilation réussie en 4,5s, puis crash opaque du worker Next.js (code `4294967295`, aucune erreur applicative/TypeScript, environnement propre après coup — 8,7 Go libres, HEAD stable). Une seule relance effectuée (pas de troisième tentative automatique) : **succès complet** — compilation en 11,5s, build complet en 36,7min, `REAL_EXIT_CODE=0`, `BUILD_ID=k8CJnDblN6dLdp3lKOy4r`, **196/196 pages statiques générées**, les 12 routes requises (`/`, `/demo`, `/demo/pierre`, `/agents/pierre`, `/reserver/pierre`, `/checkout`, `/api/founder-access/funnel`, `/api/founder-access/presence`, `/api/conversion/events`, `/api/pierre/execute`, `/api/pierre/action`, `/api/router`) confirmées présentes dans le manifeste, aucun secret dans le log, HEAD inchangé, `PRODUCTION_AUTHORIZED=false` intact. Voir `CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/build-final-verification.txt`.

**Important — ce succès de build ne dit rien de la gouvernance** : `/api/pierre/execute` compile et se bundle sans erreur, ce qui ne prouve absolument pas qu'une évaluation de gouvernance y est présente (elle ne l'est pas — voir ci-dessous et `DEMO_REMAINING_RISKS.md` RISQUE-1).

## Validation humaine
Not run — protocol prepared (`DEMO_EXTERNAL_VALIDATION_PROTOCOL.md`), `EXTERNAL_VALIDATION_PENDING`.

## Risques
See `DEMO_REMAINING_RISKS.md` (9 items — 1 critical/out-of-scope, several tooling-availability-driven, none blocking this block's own technical closure).

## Verdict
See the mandatory 30-question verdict delivered in the same turn as this report.
