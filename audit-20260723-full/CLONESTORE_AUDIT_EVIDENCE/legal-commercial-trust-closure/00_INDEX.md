# Legal and Commercial Trust Closure — Evidence Index

Generated 2026-07-24. Read-only research + code-change evidence for the Legal and Commercial Trust Closure block. All raw findings below fed directly into the 13 deliverables in `audit-20260723-full/` (see `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` for the synthesis).

## Contents

| File | Covers |
|---|---|
| `01-legal-pages-audit-raw.md` | Full read of `/legal/mentions`, `/legal/cgv`, `/legal/cgu`, `/legal/confidentialite`, `/legal/dpa`, shared components, footer, checkout/signup/founding-partners/reservation/partner acceptance flows |
| `02-forms-data-collection-raw.md` | Every form/flow collecting personal or company data, destination, sensitivity |
| `03-cookies-trackers-raw.md` | Full cookie/localStorage/sessionStorage/analytics/CMP inventory |
| `04-subprocessors-raw.md` | Every real third-party provider actually called by the code |
| `05-pierre-hr-governance-raw.md` | CloneGuard, human-only floors, HR capability canon, autonomy pipeline, special-category data handling |
| `06-pricing-checkout-fiscal-raw.md` | Exact price/currency/VAT display and Stripe session tax configuration |
| `07-legal-entity-identity-search-raw.md` | Repo-wide search for real company identity (SIREN/SIRET/TVA/address/etc.) — none found; prior GO-LIVE/E1 owner-input scaffolding discovered |
| `08-commercial-claims-raw.md` | Every quantified/absolute claim on public pages, with disclaimer-adjacency analysis |
| `09-canonical-architecture-discovery.md` | Pre-existing `src/lib/legal-commercial/` (B47), `src/lib/pierre/legal/`, `src/lib/go-live/legal-entity/`, `public-launch-final-review-gate.ts`, and `scripts/legal-public-copy-scan.mjs` — why this block reuses rather than duplicates them |
| `10-code-changes-diff-summary.md` | Exact list of files modified/created in this block |
| `11-test-results.md` | tsc / ESLint / vitest / build results |

## Method note

Six of eight planned research passes were dispatched as parallel read-only Explore agents and returned complete structured findings (files 01–06). Two more (legal entity identity beyond `/legal/*`, and commercial claims extraction) were run as a direct repo-wide grep and one additional Explore agent respectively (files 07–08), since they had not actually been dispatched in the prior turn despite being planned. No agent output was fabricated or assumed — every citation below is file:line traceable to the repo as it stood on 2026-07-24.
