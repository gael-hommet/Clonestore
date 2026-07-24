# Demo Contextual Prompt — Specification

## Trigger
Single, simple, testable: scroll-depth ratio ≥ `DEMO_PROMPT_SCROLL_THRESHOLD` (0.35), computed with the same clamped `scrollY / (scrollHeight - innerHeight)` idiom `DemoExperience.tsx` already uses for its own scroll-depth events (`src/lib/demo/contextual-prompt/detect.ts::scrollDepthRatio`). Never shown at first pixel. No second mechanism (no time-on-page timer, no exit-intent) — deliberately not stacked, per the master prompt's instruction not to combine multiple aggressive triggers.

## Frequency
At most once per session. Dismissed (via either button) → `sessionStorage` key `cs.demoPrompt.dismissed` set → never re-shown for the remainder of the session, even across further scroll or a return to `/`.

## Text
Card title: "Voir Pierre travailler". Body: "Une démonstration interactive, sans engagement." Primary CTA: "Voir la démonstration" → `/demo`. Secondary: "Plus tard" (dismiss). No guaranteed-result language anywhere (verified by a dedicated test asserting absence of "garanti"/"zéro erreur"/"totalement autonome"/"24/7" in the rendered markup).

## Accessibility
`role="dialog"` (non-modal — no `aria-modal`, no backdrop, matching the only other floating card precedent in this codebase, `InstallPrompt.tsx`), `aria-label="Invitation à voir la démonstration de Pierre"` on the card, `aria-label="Fermer l'invitation"` on the dismiss button, both interactive controls are real `<button type="button">` elements (native keyboard operability, no custom keydown handling needed), safe-area-aware bottom padding (`env(safe-area-inset-bottom)`), `motion-reduce:transition-none` on the outer wrapper.

## Analytics
Three new, closed-enum events added to the founder-access canonical system (`CLIENT_ANALYTICS_EVENTS`): `homepage_demo_prompt_seen` (fires once, guarded by a ref, when `show` transitions to `true` — never on mount, never twice), `homepage_demo_prompt_clicked`, `homepage_demo_prompt_dismissed`. No BLOC3 wiring added in this block (BLOC3's organic-traffic persistence gap is out of scope here — see `DEMO_REMAINING_RISKS.md` and the next block, ANALYTICS FUNNEL AND LAUNCH MEASUREMENT CLOSURE). No PII, no free text — `emitFounderEvent`'s `FounderEventMeta` only ever receives `{landingPath: pathname}`.

## Feature flag
`NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED`, exact-string `"true"` comparison, **defaults to `false`** (never hardcoded true) — this is a brand-new, unvalidated UX experiment; Phase 18's 30-external-tester protocol has not run. Turning it on live is a deliberate owner decision after reviewing placement/copy in a real browser, not an ambient default this block ships live. **Not enabled in production by this block** — the variable to configure later, when the owner decides to turn it on, is documented here and in the main report.

## Dismissal
`sessionStorage` (not `localStorage` — session-scoped, not permanent), matching the master prompt's explicit "fermeture mémorisée pour la session" requirement (as opposed to the PWA install-prompt's 14-day timestamp cooldown, which is a different, longer-lived pattern intentionally not reused here).

## Rollback
Set `NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED` to anything other than the exact string `"true"` (or unset it) — the component returns `null` and mounts nothing; zero residual DOM, zero scroll listener, zero analytics call, and (per the collision-arbitration fix below) the pre-existing `GuidedTourProvider` homepage welcome reverts to its exact historical behavior with no code change needed on that side.

## Overlay-collision arbitration (mandatory gate)

**Problem found during audit**: `GuidedTourProvider` already shows an automatic floating welcome card on `/` (`PUBLIC_DISCOVERY_WELCOME`) after a flat 1200ms timer. Enabling the new scroll-triggered `DemoContextualPrompt` without coordination would allow **two independent automatic floating cards** to exist on the homepage — exactly what this block's gate forbids ("il ne doit jamais exister deux invitations flottantes concurrentes sur la homepage").

**Resolution implemented (the master prompt's "Option recommandée")**: `GuidedTourProvider.tsx`'s homepage auto-welcome effect now calls a new pure function, `shouldSuppressHomepageAutoWelcome(pathname, isDemoContextualPromptEnabled())` (`src/lib/demo/contextual-prompt/detect.ts`). When this returns `true` (i.e., `pathname === "/"` AND the demo-prompt flag is `"true"`), the effect returns early with `setWelcome(null)` — **no automatic welcome timer is armed for the homepage at all** while the new prompt is enabled.

**What is explicitly preserved, unconditionally**:
- Manual tour launch (`startTour(PUBLIC_DISCOVERY_TOUR_ID)` via the `GuidedTourApi` context) — untouched; the suppression only affects the automatic 1200ms-timer welcome path, not the tour engine itself.
- Every other route's contextual tour (`/profile`, `/agents/pierre/use`, `/assistant`) — the guard is scoped to `pathname === "/"` specifically.
- All existing snooze/progress `localStorage` keys and logic (`shouldOfferTour`, `writeSnooze`, `readProgress`) — not touched at all, since the suppression short-circuits *before* any of that logic runs, rather than modifying it.
- Accessibility (focus save/restore, inert/aria-hidden background, keyboard Escape/arrows) — entirely inside the tour-running code path, unaffected by a welcome-card gate.

**What happens when the flag is OFF (default)**: `isDemoContextualPromptEnabled()` returns `false`, `shouldSuppressHomepageAutoWelcome("/", false)` returns `false`, and the homepage auto-welcome behaves **exactly as it did before this block** — proven by a dedicated unit test asserting this exact input pair, and by the pre-existing `homepage-nonregression.test.ts` suite passing unchanged.

**Proof of no double-invitation**: see `CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/contextual-overlay-arbitration-proof.txt` for the exact test-by-test walkthrough of both flag states.
