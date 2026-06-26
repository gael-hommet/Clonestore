# PIERRE FINAL INTERACTIVE DEMO

Immersive, controlled, conversion-oriented demonstration served at **`/demo/pierre`**.
In under three minutes a director understands that Pierre is an *operational HR
employee* — not a chatbot or a document generator.

> **Show, don't claim.** The demo shows Pierre working. Every capability shown
> maps to a truth registry, every proof number is derived from the scenario, and
> no real action is ever taken.

---

## 1. Architecture

```
src/app/demo/pierre/
  page.tsx                 # client shell: renders the experience + SEO/legal/price frame
  layout.tsx               # (unchanged) variant hero + DemoEventTracker (first-party analytics)
  pierre-demo.css          # route-scoped premium styling (.pd-*), ivory/champagne/graphite

src/lib/pierre/demo/       # PURE, deterministic, isolated simulation layer (no side effects)
  demo-types.ts            # type model
  demo-truth-registry.ts   # capability truth + 6 narrated technologies
  demo-scenarios.ts        # the 3 controlled scenarios (fictional data)
  demo-engine.ts           # guided step machine + scenario-derived metrics
  demo-analytics.ts        # privacy-safe analytics, maps onto the existing tracker
  demo-validation.ts       # honesty invariants (capabilities, claims, CTAs, metrics)
  index.ts                 # barrel
  __tests__/               # engine / truth-registry / validation / analytics

src/components/pierre/demo/
  PierreDemoExperience.tsx  # orchestrator (guided + exploration)
  MissionComposer.tsx       # the natural-language request (typed out)
  MissionUnderstanding.tsx  # first wow: objectives/tasks/… detected
  CompanyContextPanel.tsx   # second value moment: enterprise context recall
  TechnologyPulse.tsx       # technologies surfaced while they act
  MissionControl.tsx        # the big wow: parallel mission centre
  DemoMessaging.tsx         # premium messaging proof
  DemoDocumentViewer.tsx    # structured premium document
  DemoApproval.tsx          # interactive human validation
  GuardrailMoment.tsx       # the trust moment (controlled refusal)
  CloneTraceTimeline.tsx    # history with filters
  DemoResult.tsx            # final proof (scenario-derived)
  CapabilityExplorer.tsx    # 8 capability domains (exploration depth)
  ConversionMoment.tsx      # discreet mid-demo CTA
  DemoFinalCTA.tsx          # final conversion screen
  DemoDrawer.tsx            # accessible side drawer
  parts.tsx                 # shared primitives + status mapping
```

The interactive journey is **fully isolated**: the demo layer imports nothing
that can write data, send email, call a signature provider, touch Stripe, or read
a secret. Analytics flow exclusively through the existing first-party conversion
tracker (`DemoEventTracker` in `layout.tsx`).

---

## 2. The two levels

### Level 1 — Guided journey (≈ 2 min, target band 110–180 s)
Ordered steps (`demo-engine.ts → GUIDED_STEPS`):

`composer → understanding → context → technology → mission_control → messaging →
document → approval → guardrail → trace → result`

The visitor keeps control at all times: **Précédent / Pause-Lecture / Suivant /
Recommencer / Quitter**, keyboard arrows, and a scenario switch. Auto-advance is
pausable and is disabled by default under `prefers-reduced-motion`.

### Level 2 — Exploration mode (unlocked after the result)
Open any document/message, browse the CloneTrace timeline, and open the 8
capability domains. *The guided mode proves the value; the exploration proves the
depth.*

---

## 3. Value moments (the "wow")

| When | Moment | What it proves |
|------|--------|----------------|
| < 10 s | Hero + real mission surface | value is obvious immediately |
| < 30 s | Understanding counts | Pierre organised, not just answered |
| ~30 s | Company context + missing info | Pierre uses context, never invents |
| < 90 s | **Parallel mission centre** | Pierre is an employee, not a tool |
| ~100 s | Messaging + interactive validation | concrete, governed work |
| ~120 s | Guardrail moment | powerful **and** safe |
| ~140 s | CloneTrace + result | everything is tracked and quantified |

---

## 4. Scenarios (`demo-scenarios.ts`)

1. **`semaine_rh`** — *Une semaine RH gérée par Pierre* (recommended, default).
   Onboarding (Lina) · relance (Marc) · recrutement commercial · avenant (Nora).
2. **`recrutement`** — *Recruter sans perdre le fil.*
3. **`contrat_sensible`** — *Préparer un contrat sensible.*

All data is clearly fictional. The recommended scenario yields the prescribed
headline proof, **derived** (never hardcoded) by `computeScenarioMetrics`:

```
1 demande · 4 missions · 11 tâches · 3 documents · 4 communications
2 validations · 2 suivis · 1 blocage · 0 information inventée
```

`understandingIsConsistent()` asserts the on-screen "understanding" counts equal
the structure; `demo-validation.ts` asserts no number is invented.

---

## 5. Technologies (human language, shown while they act)

CloneOS · CloneADN · CloneGuard · CloneTrust · CloneContinuum · CloneTrace.
ClonePolicy is framed only as an internal engine of CloneGuard. CloneVoice is
**never** shown as active.

---

## 6. Truth registry & honesty guarantees

`demo-truth-registry.ts` declares every capability with a `productionStatus`:

| Capability | Status |
|------------|--------|
| document generation, human approval, email preparation, traceability, planning, context recall, missing-info detection, continuity | `available` |
| real email send | `available_with_validation` |
| signature preparation | `prepared_not_executed` |
| live external signature, voice call | `demo_only` (never shown active) |

`demo-validation.ts` enforces: every capability shown is declared and not
demo-only; CTA destinations are real routes; no forbidden commercial claim
appears; metrics never invent information; message→document links are never dead.
The test `pierre-demo-validation.test.ts` includes negative controls.

---

## 7. Conversion & CTA destinations

All destinations are real, existing routes (`demo-validation.ts → DEMO_CTA_DESTINATIONS`):

- **Réserver Pierre** → `/reserver/pierre` (`data-conversion-cta="purchase"`)
- **Découvrir l'offre Pierre** → `/agents/pierre` (`data-conversion-cta="assistance"`)
- **Obtenir mon diagnostic RH** → `/diagnostic-rh`
- Legal: `/legal/cgu`, `/legal/cgv`, `/legal/confidentialite`

Price truth comes from the conversion contract (`449 € HT/mois`,
"Aucun paiement aujourd'hui"). No fabricated time-savings figure is shown.

---

## 8. Design

Route-scoped `pierre-demo.css` (`.pd-*`): ivory / champagne / graphite with a
single restrained cool accent (`--pd-cool`, used only for live/active/technology).
Primary CTA = graphite gradient (premium dark-on-light). No violet/blue dominance
imported from the Founder Command Center. Premium glass surfaces, soft shadows,
subtle motion guarded by `prefers-reduced-motion`.

---

## 9. Accessibility

Keyboard navigation (arrows + focusable controls), visible `:focus-visible`,
semantic landmarks, ARIA progressbar, labelled modal drawer with Escape, status
conveyed by **icon + text** (never colour alone), decorative icons `aria-hidden`,
`prefers-reduced-motion` respected. Covered by `pierre-demo-accessibility.test.ts`.

---

## 10. Responsive

Desktop: immersive composition (request → plan → board → detail). Tablet: two-zone.
Mobile: vertical flow, full-width CTAs, sticky controls, bottom-sheet drawer.
Tested visually at 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768,
1280×720, 1440×900, 1920×1080. Covered by `pierre-demo-responsive.test.ts`.

---

## 11. Safety & isolation

No email sent, no business data written, no contract created, no worker launched,
no signature provider called, no Stripe, no admin route, no secret, no private
object key. Guaranteed by `pierre-demo-no-side-effects.test.ts` (scans every demo
source file).

---

## 12. Tests

```
npm run test:pierre-demo-final
```

runs: engine, truth-registry, validation, analytics, route, conversion,
no-side-effects, accessibility, responsive, and golive05. Also keep green:
`npm run test:pfinal01`, `npm run test:pfinal02`, `npm run build`.

---

## 13. Updating the demo when Pierre evolves

1. **New capability** → add a `DemoCapabilityTruth` entry (with honest status +
   evidence path) *before* referencing it in a scenario. `demo-validation.ts`
   fails otherwise.
2. **A `demo_only` capability becomes real** → change its `productionStatus`; it
   then becomes usable in scenarios.
3. **New scenario** → add to `demo-scenarios.ts`; metrics derive automatically.
   Keep `understanding` consistent (the engine test enforces it).
4. **New CTA route** → add it to `DEMO_CTA_DESTINATIONS` (must be a real route).
5. Re-run `npm run test:pierre-demo-final` + `npm run build`.

See `PIERRE_DEMO_CONVERSION_ANALYTICS.md` for the analytics contract.
