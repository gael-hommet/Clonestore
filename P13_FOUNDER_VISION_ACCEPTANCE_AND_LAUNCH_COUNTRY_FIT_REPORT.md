# P13 — Founder Vision Acceptance & Launch Country Product Fit QA

**Date:** 2026-07-09 · **Nature:** a founder/product-feel QA gate + country-fit QA gate. **Not** a build phase, **not** a go-live, **not** legal validation. Nothing here activates production, applies a migration, or formulates final legal/tax/HR advice.

> **Verdict: P13 — FOUNDER VISION ACCEPTANCE & LAUNCH COUNTRY PRODUCT FIT VERIFIED.**

It answers Gaël's two questions with proof:
1. **Does the product feel like the exact vision?** → **YES** (scorecard **33/36** → ACCEPTED, browser proof P13_FOUNDER_FEEL_OK, 0 rejection triggers).
2. **Is Pierre launch-country credible for FR/BE/LU/CH without pretending legal validation is complete?** → **YES** (pricing/currency correct, safe country copy, 0 product overclaims, external legal/tax/provider/go-live disclosed as PENDING).

Independent 3-agent adversarial review: **9 claims, 5 HOLDS / 4 PARTIAL / 0 REFUTED, 0 security defects** — all 4 PARTIALs (honesty/methodology) addressed (see below).

---

## What P13 built (pure, testable — no second HR brain, no product rebuild)
All under `src/lib/clonestore/founder-acceptance/` (pure modules, no I/O):
- **[founder-vision-contract.ts](src/lib/clonestore/founder-acceptance/founder-vision-contract.ts)** — the founder vision as a testable contract: `FOUNDER_VISION_PILLARS` (12), `FOUNDER_ACCEPTANCE_CRITERIA`, `FOUNDER_REJECTION_CRITERIA`, `PRODUCT_FEEL_CHECKLIST`, `COUNTRY_FIT_CHECKLIST`, `evaluateFounderVisionAcceptance`, `evaluateCountryFitAcceptance`.
- **[founder-acceptance-scenarios.ts](src/lib/clonestore/founder-acceptance/founder-acceptance-scenarios.ts)** — the exact founder walkthroughs A–G (first login / dirigeant Global Cockpit / open Pierre / CloneRoom / Mon CloneStore / mobile / large screen) with expected feeling, `mustShow`, `passIf`, and `evaluateScenario`/`evaluateAllScenarios`.
- **[launch-country-fit.ts](src/lib/clonestore/founder-acceptance/launch-country-fit.ts)** — FR/BE/LU/CH matrix that **DERIVES from the verified P10/P11 modules** (imports `pricingForCountry`/`currencyForCountry` from P10, `evaluateLegalTaxReadiness`/`evaluateProviderReadiness`/`evaluateP11FinalGoLiveReadiness` from P11). `COUNTRY_EXPECTED_PRICING`, `COUNTRY_LEGAL_COPY_FORBIDDEN`, `COUNTRY_SAFE_COPY`, `evaluateCountryFit`, `evaluateAllLaunchCountries`.
- **[founder-acceptance-scorecard.ts](src/lib/clonestore/founder-acceptance/founder-acceptance-scorecard.ts)** — 12 dimensions × 0–3 (max 36), ≥30 accept, any dim ≤1 → founder review, any hard blocker (assistant framing / 2nd HR brain / legal-country overclaim / fake provider live / production enabled / country mispriced) → BLOCKED.

## Country fit — honest, derived matrix (FR/BE/LU/CH)
Every value is derived from the verified modules, not invented:

| Country | Pricing (P10) | Currency | product_ready | pricing_ready | legal_ready | tax_ready | provider_ready | launch_allowed | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| FR | 449 € / mois | EUR | ✅ | ✅ | ⏳ false | ⏳ false | ⏳ false | ❌ false | PENDING_EXTERNAL |
| BE | 449 € / mois | EUR | ✅ | ✅ | ⏳ false | ⏳ false | ⏳ false | ❌ false | PENDING_EXTERNAL |
| LU | 449 € / mois | EUR | ✅ | ✅ | ⏳ false | ⏳ false | ⏳ false | ❌ false | PENDING_EXTERNAL |
| CH | 499 CHF / mois | CHF | ✅ | ✅ | ⏳ false | ⏳ false | ⏳ false | ❌ false | PENDING_EXTERNAL |

- **Swiss can never be an EUR offer; FR/BE/LU can never be a CHF offer** (P10 canon; checkout guard fail-closed even if the currency is forged) — unit-tested.
- `legal_ready`/`tax_ready`/`provider_ready`/`launch_allowed` are honestly **false** (derived from `evaluateLegalTaxReadiness`/`evaluateProviderReadiness`/`evaluateP11FinalGoLiveReadiness`, which stay false without external attestation env). `PENDING_EXTERNAL` = credible product-fit with external items disclosed, **not** launch-ready. A mispriced country or an unsafe overclaim would flip a country to `COUNTRY_FIT_BLOCKED`.

## Country copy / claim QA (§5)
[country-copy-qa.json](.p13-proofs/p13-run1/country-copy-qa.json): a **fixed-lexicon denylist scan (14 phrases) + manual + adversarial classification** across **2440** TS/TSX files (`src/app` + `src/components` + `src/lib`) — not exhaustive NLP (disclosed). **0 unguarded product-facing overclaims.** Every dangerous-phrase hit is a security guard (`sk_live_` detection), an explicit disclaimer ("ne garantit pas la conformité", "à valider juridiquement"), a legal exclusion list ("Ce que le service ne comprend PAS"), an internal-ops *pending* framing ("Repo prêt ≠ Commercialement lançable"), or a denylist definition. "Conforme au droit suisse/belge/luxembourgeois" appears **only** as a P13 denylist string, never in copy. Two softer conformity strings outside the lexicon (`profile/messages/page.tsx` "CloneGuard a évalué la conformité" / "Note de conformité Guard") were surfaced by the adversarial review and are contextually safe (disclaimed at point of use — "validation humaine requise avant toute diffusion externe"). Legal/tax/provider/production limits are disclosed as PENDING.

## Founder-feel browser proof (§6)
[browser-founder-feel.json](.p13-proofs/p13-run1/browser-founder-feel.json) — **P13_FOUNDER_FEEL_OK / pass:true**, isolated dev server (`:3273`, `.next-p13`), ephemeral ready-client user, **ZERO RESIDUE**, **0 real console errors** (under a *tightened* filter that no longer swallows hydration/parse errors — see the honesty note). All founder signals TRUE on **large-1600** / desktop-1280 / tablet-768 / mobile-390:
- **A/CloneOS-first**: `/cockpit` shows the CloneOS command surface first (title "CloneOS", composer, suggestions) — not a marketing page.
- **B/Global Cockpit (dirigeant)**: Main-d'œuvre IA + Missions en cours + Validations en attente + Blocages + Santé système + Résultat récent.
- **C/Pierre (RH)**: "Employé IA RH" framing, real work desk (missions/validations/documents/evidence/autonomy/activity), mission composer — **no** assistant/chatbot/copilote.
- **D/CloneRoom (salon)**: 6 participants (desktop+mobile), one composer, **content-carrying action extraction proven** (directSeed + cloneRoomFlow both `ok` — a message's exact text reaches Pierre's real composer).
- **E/Mon CloneStore (admin)**: distinct surface (not `cos-root`), 10 sections, "Ouvrir le Cockpit" link.
- **F/mobile**: bottom-nav, composer reachable, no horizontal overflow, no page scroll.
- **G/large**: 3-pane console (rail + context), tablet icon-rail + drawer, mobile bottom-nav.
- The public footer does **not** leak into the console (P12 fix holds).

## Scorecard (§7)
[founder-acceptance-scorecard.json](.p13-proofs/p13-run1/founder-acceptance-scorecard.json): **33/36 → ACCEPTED** (≥30, no dimension ≤1, no hard blocker; recomputed via `evaluateFounderScorecard`, not hand-asserted). Honest, not inflated — three dimensions scored **2 (pass, not excellent)**:
- `cloneroom_salon_clarity` = 2 — a real group-chat shell + real hand-off to Pierre's composer, but not a multi-agent simulation (only human + a canned CloneOS reply speak; other participants are chips). *(disclosed in P12.)*
- `country_launch_credibility` = 2 — pricing/product credible + honest disclosure, but legal/tax/provider/go-live are external-pending, so credible ≠ launch-ready.
- `mobile_usability` = 2 *(review A1)* — mobile affordances proven (bottom-nav, composer reachable, no overflow, no scroll; Pierre's compose **button element** present+visible on 390), but its "Confier une mission" **label is icon-only on mobile** (`hidden sm:inline`) — a minor clarity caveat.

## Adversarial review (§11)
[adversarial-review.json](.p13-proofs/p13-run1/adversarial-review.json) — 3 independent Opus attackers: **9 claims → 5 HOLDS / 4 PARTIAL / 0 REFUTED, 0 security defects.** The load-bearing claims HOLD (country-fit truly derives from P10/P11; pricing correct; launch_allowed false with the P10 const hard floor; P8–P12 + Pierre V1 untouched; no 2nd HR brain; production off). The 4 PARTIALs were honesty/methodology issues, all addressed:
- **A1** (mobile_usability): strengthened the proof (measures the mobile compose **button element**) + scored 34→33 + disclosed the icon-only-label caveat.
- **A2** (copy-scan completeness): reframed as a fixed-lexicon denylist + manual/adversarial classification (not exhaustive NLP), added the 2 outside-lexicon strings (contextually safe), fixed count to 2440.
- **A3** (evaluators gate only synthetic inputs): added a test that feeds the **real measured browser signals** through the **real** `evaluateAllScenarios` (A–G) and recomputes the 33/36 via `evaluateFounderScorecard` — closing the tautology.
- **C3** ("0 console errors" swallowed real errors; large screen untested): **tightened the filter** (no longer hides hydration/parse), added a true **1600** viewport. Re-running surfaced hydration/`Invalid or unexpected token` — **investigated with 4 evidence points** (`caret-color` absent from all source; 0 errors on public pages; 0 on a clean authed load — only a benign `ERR_ABORTED`; only under heavy dev multi-context nav) → classified as **dev/HMR transients**, **recorded transparently** in `devTransients` (14, non-blocking), with the hydration matcher requiring the proven `caret-color` attribute so a real hydration bug on any other attribute still fails. **Real console errors = 0.**

> **Honesty note:** the browser proof runs on `next dev`, so dev/HMR console transients exist; they are investigated, classified, and *recorded* (not silently swallowed). The country-copy scan is a denylist + manual classification, not exhaustive NLP. The scorecard's per-dimension scores are calibrated editorial judgments backed by the proof + code; the ACCEPT/BLOCK **gating logic** is fully unit-tested and now also fed the real browser signals.

## Gates
- **P13 tests 32/32** (`src/lib/clonestore/founder-acceptance`, incl. the real-signal A3 test + recomputed 33/36) · guardrail suites **361/361** (cloneos + pricing + production) · **tsc 0 source errors**.
- **Browser proof P13_FOUNDER_FEEL_OK** (4 viewports incl. true 1600, all founder signals true, extraction proven, **0 real console errors** + 14 transparently-recorded dev transients, ZERO RESIDUE).
- **No second HR brain** (all HR data via the real V1 hook; P13 modules are pure evaluators) · **Pierre never assistant/chatbot/copilote** · **0 product overclaims** · **production OFF** (`PRODUCTION_AUTHORIZED=false`) · **Pierre V1 + P8/P9/P10/P11/P12 untouched** · no migration · nothing staged/committed/pushed/deployed.

Proofs: [.p13-proofs/p13-run1/](.p13-proofs/p13-run1/) · Screenshots: [docs/qa-screenshots/p13-founder/](docs/qa-screenshots/p13-founder/).
