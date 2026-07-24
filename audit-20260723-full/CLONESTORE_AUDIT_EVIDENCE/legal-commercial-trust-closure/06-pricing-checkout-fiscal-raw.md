# Raw finding — Pricing, checkout & fiscal display audit

Source: read-only Explore agent, exact code/string citations. Purely factual (no legal conclusion drawn here).

## Price display strings
- `CountryPricingCard.tsx:95,99`: `"449 € / mois"` (EUR), `"499 CHF / mois"` (CHF). L167-169 (rendered disclaimer): **"Prix HT, hors taxes applicables. Le pays de facturation est revérifié au paiement."** — only "HT" mention in this component; no "TTC" anywhere.
- `checkout/page.tsx` static `AGENTS` map: `pierre.price = "449€/mois"` (no space, no "HT" qualifier in this file at all).
- **Two parallel pricing/copy sources found**: the country-aware canon (`country-pricing.ts`, display strings without "HT" in the number itself) vs. an older single-price constant family (`commercial-state.ts`, `public-catalog.ts`, `founder-access/commercial.ts`) whose strings **do** append "HT" inline (`"449 € HT/mois"`) — used across ~8 marketing/demo/partner pages. Not a legal defect (both convey the same fact), but a real display-format inconsistency, documented as a low-priority backlog item, not fixed in this block (out of scope: touching 8 files across marketing/demo pages for a cosmetic inline-format difference is disproportionate).

## Stripe session tax configuration
Exact `stripe.checkout.sessions.create` call (`api/checkout/route.ts:410-437`, unchanged by this block except the added `legal_acceptance` validation earlier in the function): `billing_address_collection:"required"`, `customer_update:{address:"auto",name:"auto"}`. **Zero occurrences** of `tax_behavior`, `automatic_tax`, or `tax_id_collection` as actual Stripe API parameters anywhere in `src/`.

## Canonical pricing table (`country-pricing.ts:37-42`)
`FR/BE/LU: EUR 449 (44900 minor), display "449 € / mois"`. `CH: CHF 499 (49900 minor), display "499 CHF / mois"`. No HT/TTC field or comment in this file at all — pure amount/currency/display, no fiscal semantics baked in.

## Customer VAT number
No code path collects/validates a **customer's** VAT number at checkout — no `tax_id_collection` anywhere. Two unrelated `vat_number` fields exist: (1) CloneStore's own (seller's) VAT placeholder in `legal-entity-registry.ts` (still blank), (2) the Pierre customer's company's own VAT field on `pierre_rt_companies` (used only for generating HR documents like payslips, never collected via checkout). A `geo/country-profiles.ts` module defines VAT-format patterns per country (FR/BE/LU/CH, all `required:false`) but is **not wired into checkout** — general-purpose utility, unused by the purchase flow.

## Invoicing
No invoice template/PDF generation/numbering exists in the repo — invoicing is delegated entirely to Stripe's own hosted Billing Portal (`api/billing/portal/route.ts:57-60`). Raw Stripe Price IDs never appear in any user-facing string; a test explicitly asserts this (`p11-stripe-live-readiness.test.ts:58-59`: `expect(blob).not.toContain("price_eur")`).

## "Autoliquidation"/reverse charge
Appears only in internal go-live/readiness documentation-as-code (`p11-legal-tax-readiness.ts:39,87`, `p11-final-golive-readiness.ts:113`) explicitly marked "à décider avec l'avocat/comptable" / `external_pending` — never in checkout logic or UI.

## Reconciliation code (defensive, not a tax feature)
`p15-checkout-reconciliation-gate.ts:45-48` reads `customer_details.tax_ids[0].country` IF Stripe Tax happens to be enabled at the Stripe-account level (outside this repo's code) and flags a `STRIPE_TAX_COUNTRY_CONFLICT`/`review_required` if it disagrees with the expected billing country. This is an audit/reconciliation safety net, not evidence that Stripe Tax is actually configured.

## CGV pricing/tax text (`legal/cgv/page.tsx`)
L57: `"Tarif standard : 449 € / mois (hors taxes applicables)."` L95: `"Les prix sont exprimés hors taxes. La TVA applicable selon la réglementation en vigueur peut s'ajouter au prix HT."` L98-102: `"TVA et taxes — Placeholder à valider : ... Ce point doit être précisé par un conseil juridique ou fiscal."`

## Conclusion for this pass (factual only)
The code is internally consistent about the price being HT (tax-exclusive) with VAT to be added "as applicable," but **no VAT is actually calculated, collected, or displayed anywhere in the live checkout flow**, and Stripe Tax is not configured. Whether this is currently compliant depends entirely on CloneStore's actual VAT/tax registration status per country — a professional determination, not a code fact — see `TAX_AND_PRICE_DISCLOSURE_MATRIX.md`.
