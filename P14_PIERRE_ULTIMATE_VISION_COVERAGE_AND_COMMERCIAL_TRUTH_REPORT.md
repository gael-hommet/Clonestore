# P14 — Pierre Ultimate Vision Coverage & Commercial Truth

**Date:** 2026-07-09 · **Nature:** an honest, evidence-based **truth matrix** comparing the founder's May "ultimate vision" of Pierre against what is *actually* proven today. **Not** a build phase, **not** a go-live, **not** legal validation. Nothing here enables production or presents legal/tax/country output as final advice.

> **Verdict: P14 — LAUNCH VISION VERIFIED / ULTIMATE VISION ROADMAP DISCLOSED.**

The May vision is converted into a **catalog of 58 requirements across all 50 groups** and each is classified by a **deterministic evaluator** grounded in P8–P13 evidence (never optimistic). Coverage computed from the real evaluator:

| Status | Count | Meaning |
|---|---|---|
| **VERIFIED** | 19 | code + the requirement's declared proofs present |
| **PARTIAL** | 21 | implemented + certified/governed, not independently E2E-demoed |
| ARCHITECTURE_READY | 2 | substrate exists, feature not complete |
| FUTURE_ROADMAP | 3 | no meaningful implementation yet |
| **LEGAL_BLOCKED** | 4 | needs external legal/tax review (absent) |
| EXTERNAL_BLOCKED | 2 | needs external activation |
| **PROVIDER_BLOCKED** | 1 | needs a live provider (Yousign) |
| **MUST_NOT_CLAIM** | 6 | must never be claimed |

**Launch-critical (17):** 14 VERIFIED · 0 partial · 2 legal/provider-blocked (disclosed) · 1 must-not · 0 roadmap.

---

## Answers to the 12 questions

**1. Does Pierre do everything in the May vision?** No — and it must not pretend to. Pierre covers the **launch-critical operating spine** (identity, mission engine, request analysis, tasks, controlled autonomy, trace, memory, source-of-truth, roles, error-handling, cockpit/CloneOS, mobile) as **VERIFIED**, a **broad band of operational HR execution as PARTIAL** (canon-certified & governed, not yet product-demoed), and honestly discloses roadmap / external-blocked / must-not-claim items.

**2. What exactly is VERIFIED now (19)?** Pierre = employé IA RH (not assistant); real mission engine; request analysis; task system; contract *preparation*; HR helpdesk; file/screenshot inputs; controlled autonomy; CloneTrace/audit; anti-hallucination/source-of-truth; durable memory; demo scenarios; mobile usable; error handling; roles/permissions; CloneOS orchestration; commercial positioning; responsibility doctrine; launch-vs-ultimate disclosure.

**3. What is PARTIAL (21)?** Employee dossier 360; recruitment ops; onboarding; personnel admin; absences/leave; pre-payroll *variables*; internal comms (drafting); sensitive-case *preparation*; interviews; performance; training; compensation *preparation*; reporting (analytics.compute); offboarding; document outputs; CloneADN footprint; CloneGuard/risk; multi-day continuity; quality control; proactivity; multi-site (isolation substrate). These are **real, canon-certified (P8.13 215/215), governed** capabilities — but not each independently proven by a dedicated browser E2E, and their sensitive/final steps stay human-gated. → *claim with caution*.

**4. What is roadmap (FUTURE/ARCHITECTURE, 5)?** CloneVoice/voice input; push notifications; 7-day value pack; planning-impact engine; delivered monthly ROI *report* (raw metrics exist via analytics.compute; a packaged ROI report does not).

**5. What is blocked externally (7)?** LEGAL_BLOCKED (4): contract legal validity, HR compliance workflow, sector legal adaptation, AI-Act/sensitive governance. PROVIDER_BLOCKED (1): live e-signature (Yousign, P8.7.4). EXTERNAL_BLOCKED (2): live email identity, external integrations (SIRH/Slack/…).

**6. What must NEVER be claimed (6 MUST_NOT_CLAIM)?** Full payroll engine / DSN; final disciplinary decisions; final salary/promotion decisions; **guarantee of country legal compliance**; **full replacement of human HR**; **autonomous DRH**. Plus the forbidden-claims list (assistant/chatbot framing, "conforme au droit", "production live", "Stripe/Yousign live", "sans erreur", "aucune validation humaine").

**7. What can be claimed at launch?** The 12 **ALLOWED_STRONG_CLAIMS** (Pierre is an AI HR employee, transforms requests into missions, prepares documents/emails/validations/follow-ups, centralizes in a cockpit, keeps trace, controlled autonomy, keeps sensitive decisions under human validation, faster/steadier/more traceable than a human team on repetitive operational work, 449 €/499 CHF) + the 4 **ALLOWED_CAUTION_CLAIMS** (can replace a large part of *daily operational* execution; can save many hours; may be cheaper than maintaining HR execution capacity). `evaluateClaimSafety` enforces this.

**8. Is Pierre credible against an expensive HR team?** Yes — positioned against **HR execution cost**, not against a generalist AI tool. The economic matrix uses **configurable assumptions** (no salary hardcoded as truth) and shows Pierre can become profitable if it absorbs only ~10–15 h/month of HR load, depending on internal hourly cost. Estimates only, never guaranteed.

**9. Is Pierre *better than a human HR team* on operational digital execution?** On **operational, digital, repetitive, documentary, follow-up and coordination** work: plausibly yes on speed, memory, relance, structure, continuity, traceability, no fatigue, parallelism. **Not** on judgment, legal responsibility, disciplinary/managerial decisions, or empathy — those stay human. The claim is bounded to operational dimensions only.

**10. Is Pierre legally ready in CH/BE/LU (and FR)?** **No.** Country legal/tax readiness is `false` without external attestation (P11); country legal validity/compliance = LEGAL_BLOCKED / MUST_NOT_CLAIM. Pricing is correct (FR/BE/LU 449 €, CH 499 CHF) but legal adaptation requires external review.

**11. Is production live?** **No.** `PRODUCTION_AUTHORIZED = false`; no requirement is marked production-live VERIFIED.

**12. What should the founder say publicly?** *"Pierre est votre employé IA RH opérationnel : il transforme vos demandes en missions, prépare vos documents et suivis RH, centralise tout dans un cockpit tracé — et garde les décisions sensibles sous votre validation."* Compare Pierre to the **operational HR workload it absorbs**, never claim legal compliance, payroll replacement, autonomous decisions, or full HR replacement.

## Modules (pure, additive, no second HR brain)
[pierre-ultimate-vision-catalog.ts](src/lib/clonestore/founder-acceptance/pierre-ultimate-vision-catalog.ts) · [pierre-ultimate-coverage-evaluator.ts](src/lib/clonestore/founder-acceptance/pierre-ultimate-coverage-evaluator.ts) · [pierre-commercial-truth-matrix.ts](src/lib/clonestore/founder-acceptance/pierre-commercial-truth-matrix.ts) · [pierre-economic-value-matrix.ts](src/lib/clonestore/founder-acceptance/pierre-economic-value-matrix.ts). Coverage/commercial/economic proofs are **computed from the real evaluator** (not hand-authored).

## Adversarial review (§9)
[adversarial-review.json](.p14-proofs/p14-run1/adversarial-review.json) — 3 independent Opus attackers: **17 claims → 10 HOLDS / 6 PARTIAL / 1 REFUTED, 0 security defects.** The doctrine HOLDS (no roadmap counted VERIFIED, blockers surfaced, sensitive automation hard-floored MUST_NOT_CLAIM, payroll/full-HR/country-guarantee forbidden, ROI cautious, pricing consistent, P8–P13 untouched, production off). The findings were real quality issues — all **FIXED**:
- **REFUTED — claim linter green-lit reworded forbidden claims** ("assure la conformité", "tranche seul les licenciements", "gère la paie", "remplace vos ressources humaines"). **Fixed**: broadened the forbidden patterns to cover synonyms **and** added a `SENSITIVE_SIGNALS` guard that runs *before* the operational heuristic — any risky-but-unmatched claim now returns `unknown_review` (human review), **never** `allowed_*`. (The runtime automation hard-floor was never affected.)
- **B1a — a legal-gated code-only item flipped to VERIFIED with a `legalProof` override.** **Fixed**: VERIFIED now requires code + all declared internal proofs + **at least one real proof** (test/report/browser); code alone → ARCHITECTURE_READY. `sector.adaptation` stays LEGAL_BLOCKED (or at most ARCHITECTURE_READY), never VERIFIED.
- **A1 — "Multi-site" was VERIFIED** while only the isolation substrate is proven. **Fixed**: → PARTIAL (VERIFIED 20→19).
- **A5 — proof drift + missing JSONs.** **Fixed**: regenerated all proofs from the real evaluator in one pass (coverage-matrix and may-vision now agree 19/21); wrote the full proof bundle.

## Gates
- **P14 tests 28/28** (truth-matrix incl. reworded-claim + B1a lock tests + 2 computed-proof) · founder-acceptance suite **61/61** (+ pricing/production green) · **tsc 0 source errors** · non-regression **6777/6777**.
- **No legal/tax/provider/go-live overclaim** (fail-closed to LEGAL/PROVIDER/EXTERNAL_BLOCKED; 6 MUST_NOT_CLAIM) · **commercial claim linter fails SAFE** (reworded forbidden claims → forbidden/`unknown_review`, never `allowed_*`; allowed "n'est pas un assistant" not false-blocked) · **ROI matrix cautious** (configurable, disclaimer, never guaranteed).
- **P8/P9/P10/P11/P12/P13 + Pierre V1 untouched** (additive-only; 0 real P14 markers in protected dirs) · **production OFF** · no migration · nothing staged/committed/pushed/deployed.

> **Honesty note:** the coverage VERIFIED flags are the author's grounded assessment of P8–P13 evidence (each requirement cites `provenBy`); the evaluator computes the deterministic rule over those flags. The claim linter is a heuristic denylist + sensitive-signal guard (not semantic NLP) that now fails safe — a human still reviews anything not in the allowed list.

Proofs: [.p14-proofs/p14-run1/](.p14-proofs/p14-run1/) (ultimate-vision-catalog · coverage-matrix · may-vision-coverage-matrix · commercial-truth-matrix · economic-value-matrix · tests · perimeter · adversarial-review · final-verdict).
