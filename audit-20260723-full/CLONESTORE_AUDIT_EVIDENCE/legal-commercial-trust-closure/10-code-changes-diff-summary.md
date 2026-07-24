# Code changes made in this block — exact file inventory

All changes are additive/minimal. None touch P0.1/P0.2/CloneGuard/human-only floors/the v1-hr engine/the country-price canon/Stripe Price IDs/the canonical webhook/`PRODUCTION_AUTHORIZED`/the homepage hero/slogan/schemas/illustrations/animations/the demo experience.

## Modified — application code (7 files)
1. `src/components/site/site-footer.tsx` — added links to `/legal/mentions`, `/legal/cgv`, `/legal/cgu`, `/legal/dpa` (previously only `/legal/confidentialite` + `/questions` were reachable from the global footer).
2. `src/app/legal/confidentialite/page.tsx` — added `LegalNavBar` + `LegalValidationBanner version="Draft 1.0"` (top and bottom), importing the same shared components already used by the other 4 legal pages, without touching any of its substantive content. Fixes the inconsistency where this was the only legal page with zero draft/review marker.
3. `src/app/checkout/page.tsx` — added a required, non-precocked checkbox ("J'accepte les CGV et la politique de confidentialité") gating the purchase button; on submit, sends `legal_acceptance: { cgv_version, privacy_version, accepted_at }` in the POST body. Two version constants declared inline (`CGV_ACCEPTANCE_VERSION`, `PRIVACY_ACCEPTANCE_VERSION`, both `"Draft 1.0"`, matching the pages' own declared version).
4. `src/app/api/checkout/route.ts` — added server-side validation requiring `legal_acceptance.{cgv_version,privacy_version,accepted_at}` to be present and `accepted_at` to be a parseable date, before any Stripe session is created; returns `400 LEGAL_ACCEPTANCE_REQUIRED` otherwise. No change to price resolution, idempotency, or customer-binding logic (Payment Path Closure untouched).
5. `src/app/signup/page.tsx` — added a short passive mention below the submit button linking to `/legal/cgu` and `/legal/confidentialite` (previously zero legal reference on this page).
6. `src/app/questions/page.tsx` — softened one FAQ answer ("Pourquoi Pierre vaut 449€/mois?") that previously stated results "doivent être perceptibles dès la première semaine" (unqualified) to "sont généralement perceptibles dès les premières semaines... selon le volume RH... un résultat individuel peut varier."
7. `src/app/partenaires/page.tsx` — added the "réellement encaissé" qualifier to the OpenGraph `description` (the main meta `description` already had it; the OG one didn't).

## Modified — tests (2 files)
8. `src/app/api/checkout/__tests__/payment-path-country-checkout.test.ts` — `post()` helper now injects a default valid `legal_acceptance` payload unless the caller overrides it; added one new test asserting `LEGAL_ACCEPTANCE_REQUIRED`/400/zero-sessions-created when acceptance is omitted.
9. `src/app/api/checkout/__tests__/customer-mapping-route.test.ts` — added a default `legal_acceptance` payload to its single hardcoded request body (test is about Stripe customer mapping, not acceptance).

## Created — evidence + reports
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/` (this folder, 11 files).
- 13 required deliverables directly under `audit-20260723-full/` (see `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` for the full list).

## Explicitly NOT modified (verified)
- `src/lib/pierre/legacy-execute-governance.ts`, `src/app/api/pierre/execute/route.ts`, `src/app/api/pierre/action/route.ts`, `src/app/api/router/route.ts` (P0.1/P0.2).
- `src/lib/clonestore/pricing/pricing-flags.ts`, `checkout-pricing-server.ts`, `country-pricing.ts`, `p15-checkout-reconciliation-gate.ts` (Payment Path canon).
- `src/lib/clonestore/production/p10-production-gate.ts` (`PRODUCTION_AUTHORIZED = false as const` — reconfirmed unchanged, see file 11).
- `src/lib/legal-commercial/**`, `src/lib/go-live/legal-entity/**`, `src/lib/clonestore/runtime-integration/public-launch-final-review-gate.ts` (canonical architecture, reused not modified — see file 09).
- `src/app/page.tsx` (homepage) — zero edits, including the "24/7" metric flagged in file 08 (documented as a finding, not fixed, to respect the absolute homepage-protection rule).
- `src/app/demo/**`, `src/components/demo/**` — zero edits.
- Any file under `src/app/legal/mentions|cgv|cgu|dpa/page.tsx` content itself — only `confidentialite/page.tsx` received the structural banner addition; the other 4 pages' text was read but not changed (their placeholders remain, correctly, since the missing identity is genuinely unavailable).
