# Canonical architecture discovery — why this block reuses rather than duplicates

Before writing any new registry, this block located and read in full a substantial pre-existing "B47" legal/commercial governance layer, plus adjacent "GO-LIVE 03" and "E1" scaffolding. This confirms the architecture-reuse rule was followed.

## `src/lib/legal-commercial/` ("B47")
Pure, side-effect-free modules already implementing exactly the kind of claims/disclaimer/pricing/demo policy engine this block might otherwise have reinvented:
- `types.ts` — `LegalRiskLevel`, `CommercialClaimCategory` (productivity/cost_saving/automation/replacement/compliance/legal/payroll/hr_decision/security/data_protection/ai_capability/pricing/demo_trial), `ClaimDecision` (allowed/allowed_with_disclaimer/needs_human_review/forbidden), `DisclaimerType`, `PricingPolicy`, `DemoCapabilityKey`, `AcceptanceChecklistItem`, `LegalCommercialVerdict`.
- `claims-policy.ts` — a static registry of ~22 claims (9 allowed, 4 allowed-with-disclaimer, 13 forbidden with `safe_rewrite` text for each), plus `evaluateCommercialClaim(text)` and `rewriteUnsafeClaim(text)` functions and a `FORBIDDEN_PATTERNS` keyword list (garantit, zéro erreur, remplace un avocat, licencie automatiquement, etc.).
- `acceptance-checklist.ts` — an 18-item pre-launch checklist (`CHECKLIST_ITEMS`) covering CGU/CGV/privacy/DPA/RLS/Stripe billing/no-zero-error-promise/etc., each flagged `blocking_b48`/`legal_review_needed`; `computeLegalCommercialReadiness()` scores it.
- `legal-verdict.ts` — `buildLegalCommercialVerdict()` aggregates the above into a single verdict object (`status`, `score_0_to_100`, `launch_blockers`, `followups`) — **already states, unprompted, that legal review is required and CGU/CGV/privacy/DPA/RLS are launch blockers.**
- `forbidden-phrases.ts`, `disclaimers.ts`, `output-guardrails.ts`, `marketing-guardrails.ts`, `pricing-policy.ts`, `demo-policy.ts` — supporting pure modules, plus `__tests__/legal-commercial-b47.test.ts`.
- `src/lib/pierre/legal/pierre-commercial-claims.ts` + `pierre-legal-taxonomy.ts` — a Pierre-specific companion (12 sensitive HR categories, each `autonomous_decision_allowed:false`).

**Decision: reused, not duplicated.** `COMMERCIAL_CLAIM_REGISTER.md` (this block's deliverable) cross-references every claim found on public pages against this existing registry's `evaluateCommercialClaim()` output, and explicitly calls out the small number of claims (the `/questions` FAQ, the `/partenaires` card titles) that are NOT caught by the current `FORBIDDEN_PATTERNS` list — flagged as a coverage gap recommendation for the registry owner, not silently patched into a second competing list.

## `src/lib/go-live/legal-entity/`
`legal-entity-registry.ts` (`LEGAL_ENTITY_FIELDS`, 11 fields with `required_for_public_launch`/`required_for_private_pilot` flags and `placeholder_markers`), `legal-entity-validator.ts`, `legal-entity-verdict.ts` (`getLegalEntityVerdict()` → `complete|draft|missing` + `blocks_public_launch`), `types.ts`.

**Decision: reused, not duplicated.** `LEGAL_ENTITY_FACT_SHEET.md` and `OWNER_LEGAL_INPUT_REQUIRED.md` use the exact same 11 field keys as this registry (not a reinvented field list), so a future run of `getLegalEntityVerdict()` against the real mentions page will agree with this block's manual assessment.

## `src/lib/clonestore/runtime-integration/public-launch-final-review-gate.ts` (Phase 7.6)
Already read in full in this session's prior turn. A pure, abstract aggregation gate (`buildLegalCommercialFinalMatrix`, `buildAllowedProductClaims`, `buildForbiddenProductClaims`, `buildBlockingConditions`, `buildFinalPublicLaunchDecision`, `buildPhase7ClosureVerdict`) whose `legal_commercial_final_matrix` already lists `lc_cgu/lc_cgv/lc_privacy/lc_dpa/lc_legal_entity/lc_hr_guardrails/lc_commercial_claims/lc_liability` all as `verified:false, manual_review_required:true, blocking_public_launch:true`.

**Decision: NOT modified.** Every one of those `verified:false` flags remains factually accurate after this block's work — no professional legal review has occurred, so flipping any of them to `true` would be exactly the "transformer un document interne en fausse preuve juridique externe" the master prompt forbids. Confirmed via a fresh review after this block's code changes (see `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md`).

## `scripts/legal-public-copy-scan.mjs`
A pre-existing Node script that scans public pages for 10 forbidden patterns + 6 placeholder markers, and legal-entity fields for placeholders, writing evidence to `go-live-evidence/legal-public-copy/legal-public-copy-scan.txt` and printing 10 `pending` proof-ID templates. **Run in this block** as part of the static-placeholder test pass (see `LEGAL_TEST_MATRIX.md`) rather than reimplementing an equivalent scanner.

## `docs/GO_LIVE_03_*`, `E1_LEGAL_OWNER_ACTIONS.md`, `E1_OWNER_ACTION_CHECKLIST.md`
Prior owner-input checklists covering exactly the same 11 legal-entity fields and the same "never invent, always defer to lawyer/accountant/greffe" discipline this block follows. **Cross-referenced, not superseded** — `OWNER_LEGAL_INPUT_REQUIRED.md` points back to these files rather than re-deriving a competing checklist from scratch.
