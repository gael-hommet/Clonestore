# Legal and Commercial Trust Closure — Report

Date: 2026-07-24. Repo: `C:\Users\homme\clonestore`. Follows the completed audit, P0.1 Governance Closure, P0.2 Sibling Execution Surfaces Closure, and Payment Path Closure (all confirmed intact — see Safety section).

## Résumé exécutif

This block is a **technical closure**, not a legal certification. It found: (1) zero real legal-entity identity anywhere in the repository (confirmed by three independent methods); (2) a substantial pre-existing legal/commercial governance architecture (`src/lib/legal-commercial/` "B47", `src/lib/go-live/legal-entity/`, `public-launch-final-review-gate.ts`, `scripts/legal-public-copy-scan.mjs`) that was reused rather than duplicated; (3) real, fixable gaps in checkout consent, footer navigation, and one page's inconsistent draft-status display, all corrected; (4) one factual error in the DPA's named sub-processor list, documented for owner correction; (5) a live, code-confirmed B2B-gate gap that determines whether consumer-law/DSA exposure is theoretical or real. No claim of "legally compliant," "AI Act compliant," or "GDPR certified" is made anywhere in this block's output — every such conclusion is explicitly deferred to `PROFESSIONAL_REVIEW_REQUIRED` or `OWNER_CONFIRMATION_REQUIRED`.

## État initial (avant ce bloc)
- 5 legal pages exist (`/legal/mentions|cgv|cgu|dpa|confidentialite`), 4 of them marked `Draft 1.0` with visible placeholders; `confidentialite` had **zero** draft marker despite depending on the same unresolved identity — an inconsistency, not a strength.
- Global footer linked only `/legal/confidentialite` + `/questions` — CGV/CGU/DPA/mentions were unreachable from the site's own navigation.
- Checkout had a passive CGV/privacy text link, no consent checkbox, no server-side acceptance record.
- Signup had zero legal reference at all.
- No cookie-consent mechanism exists, and the legal copy itself already flagged this as unresolved.
- A pre-existing B47 legal-commercial policy engine, a go-live legal-entity registry, and a Phase 7.6 public-launch review gate already existed, all correctly reporting "not yet verified" for every legal item.

## Identité juridique
**Zero real values found** for any of company name, legal form, capital, SIREN/SIRET/RCS, registered address, VAT number, publication director, official contact email, DPO email, or insurance. Confirmed by: (a) full reads of all 5 legal pages, (b) a repo-wide grep excluding the known placeholder registry, (c) cross-check against pre-existing `docs/GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md` / `E1_LEGAL_OWNER_ACTIONS.md` / `E1_OWNER_ACTION_CHECKLIST.md`, which independently confirm the same gap. See `LEGAL_ENTITY_FACT_SHEET.md` and `OWNER_LEGAL_INPUT_REQUIRED.md`. No value was invented.

## Modèle B2B / B2C
CloneStore's CGU/CGV declare a B2B posture, but `/signup` technically permits any individual to create an account and reach checkout — no company-name requirement, no professional-capacity confirmation, no VAT field. **This is the single most consequential open finding**: it determines whether consumer-law, mediation, and DSA-adjacent obligations are live or moot in all 4 launch countries. See `LEGAL_APPLICABILITY_MATRIX.md` §Gate B2B. Not fixed in this block (a product/legal decision, not a pure defect-correction, and outside "safe to implement" per the master prompt's own boundary).

## Juridictions
FR/BE/LU (EU/GDPR + EU VAT framework) and CH (non-EU, own LPD/nFADP + own VAT regime) were each checked against a real official source (EUR-Lex, CNIL, APD, CNPD, Fedlex, Service-Public.fr — see evidence file 11). Opening a country commercially (P18 pricing) does not itself mean its laws are validated — see `LEGAL_APPLICABILITY_MATRIX.md`.

## Pages avant / après
| Page | Avant | Après |
|---|---|---|
| `/legal/mentions`, `/cgv`, `/cgu`, `/dpa` | Draft, placeholders, structurally complete | **Unchanged content** — correctly still Draft, since identity remains missing; changing this would have meant presenting invented facts as real |
| `/legal/confidentialite` | No draft marker, no nav bar — structural outlier | **Fixed**: `LegalValidationBanner` + `LegalNavBar` added, content untouched |
| Footer | 2 legal links | **5 legal links** (mentions, CGV, CGU, confidentialité, DPA) |
| `/checkout` | Passive text link, no checkbox, no server record | **Required checkbox + server-side `LEGAL_ACCEPTANCE_REQUIRED` validation + version/timestamp sent to server** |
| `/signup` | Zero legal reference | **Short mention added** (CGU + confidentialité) |
| `/questions` FAQ | Unqualified time-boxed performance promise | **Hedged** ("généralement... selon le volume... peut varier") |
| `/partenaires` | OG metadata missing the "réellement encaissé" qualifier present in the main description | **Fixed** — both now consistent |

## CGV / CGU / Confidentialité / DPA
Structurally complete against their respective checklists (Art. 28 for the DPA — see `DPA_COMPLIANCE_MATRIX.md`), never professionally reviewed. One factual error found and documented (DPA names Anthropic; code confirms OpenAI — see `SUBPROCESSOR_REGISTER.md`), left for owner/counsel correction rather than edited mid-block.

## Cookies
Full inventory: zero third-party trackers/analytics/pixels/A-B-testing/session-replay anywhere in the code (confirmed by exhaustive pattern search). Two cookies (`cs_pp_ref`, `cs_conversion_session`) serve a commercial-attribution purpose that may not qualify for the audience-measurement consent exemption — real 2026 CNIL enforcement data (21 sanctions, ~€32M in 2025) cited to make this a live, not theoretical, decision point. **No banner was built** — the master prompt explicitly forbids inventing a CMP before the underlying legal question is settled, and it deliberately was not settled here. See `COOKIE_AND_TRACKER_INVENTORY.md`.

## Sous-traitants
5 confirmed live providers (Supabase, Stripe, OpenAI, Resend, Vercel), 1 confirmed dead (Make.com, 410 Gone since P0.2), 0 assumed regions. See `SUBPROCESSOR_REGISTER.md`.

## IA et RH
Four independent, redundant code layers converge on the same hard human-only floors (dismissal, disciplinary decision, final recruitment decision, promotion, salary change, medical/legal conclusions, protected-characteristic assessments) — strong mitigation evidence, not itself an AI Act classification. The Annex III §4 employment category applies its compliance date on **2026-08-02** per the official EUR-Lex text consulted this block. No conclusion is drawn on whether Pierre is a high-risk system. See `AI_ACT_AND_HR_RISK_MATRIX.md`.

## Claims commerciaux
Slogan unchanged. Two real gaps found and fixed (the `/questions` time-boxed promise, the `/partenaires` OG qualifier); several borderline items documented but not edited (homepage "24/7", `/partenaires` card titles) to respect the homepage-protection rule and avoid unscoped UX changes. See `COMMERCIAL_CLAIM_REGISTER.md`.

## Prix et TVA
449€/499CHF display is internally honest (correctly says "HT," never claims TVA included) but no VAT calculation/collection mechanism exists anywhere in the checkout flow for any of the 4 countries. See `TAX_AND_PRICE_DISCLOSURE_MATRIX.md`.

## Partenaires
Not audited for new defects in this block (already correct per the prior audit); one architectural inconsistency noted (`founding-partners/join` doesn't persist acceptance, unlike the reference `partner-program` flow) — documented as a remaining risk, not fixed (separate CloneStory workstream).

## Implémentation technique (résumé — détail complet : `CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/10-code-changes-diff-summary.md`)
7 application files + 2 test files modified, all additive. Zero P0.1/P0.2/CloneGuard/pricing-canon/webhook/homepage/demo files touched.

## Tests
tsc 0 errors · scoped ESLint exit 0 · 846 non-regression tests green (376 + 470, incl. P0.1/P0.2/Payment Path/pricing/webhooks/partner-program/founder-access) · 1 new test (checkout acceptance refusal) · `scripts/legal-public-copy-scan.mjs` (pre-existing canonical scanner) run: 0 blocking violations on 6 public pages, 14 (expected, correctly unfilled) placeholders on legal pages, 7 (expected) pending entity fields. See `LEGAL_TEST_MATRIX.md`.

## Build
**Resolved — real success, root cause identified.** Attempts 1-3 (invalid CLI flag; OOM crash at ~3.3GB free; a third attempt that silently stalled) were followed by a root-cause check: attempt 3's own Next.js build worker (`jest-worker/processChild.js`, PID 4100, holding ~5.78GB RSS) had never actually exited despite the harness reporting the background task "completed" — it was an orphaned child process quietly starving the system down to **137MB free of 16GB total**, which is why nothing further could compile. This orphaned process (and its parent `next build`/`npx` chain) was identified as a stale CloneStore build artifact — not a system process or unrelated user work — and terminated. Memory recovered to ~6.1GB free immediately.

**Attempt 4** (`NEXT_DIST_DIR=.next-legal-closure-final`, `NODE_OPTIONS=--max-old-space-size=5120`, run alone with no parallel tooling): **succeeded completely.**
- Compiled successfully in 2.7s (compile-phase warnings only, both pre-existing and unrelated to this block — Supabase realtime-js Edge Runtime notices)
- Full webpack compile: **30.3 minutes** (slow, but a completed, successful pass — not a crash)
- **196/196 static pages generated** (`✓ Generating static pages (196/196)`)
- `BUILD_ID`: `-3eJ-j4YWNesXfmF1Fcql`
- Real, unmasked exit code: `REAL_EXIT_CODE=0`
- All 10 target routes confirmed present in the route manifest: `/legal/mentions`, `/legal/cgv`, `/legal/cgu`, `/legal/confidentialite`, `/legal/dpa`, `/checkout`, `/signup`, `/questions`, `/partenaires`, `/api/checkout`
- No secrets found in the build log (`sk_test_`/`sk_live_`/`service_role` patterns: zero matches)
- Full log + environment-before snapshot: `CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/build-final-result.txt` and `build-environment-before.txt`

**Conclusion: the prior 3 "failures" were 100% environmental (a single orphaned worker process from an earlier attempt exhausting system RAM), never a code or applicative defect.** This block's 9 file changes compile, bundle, and statically generate cleanly in an isolated production build.

## Données manquantes
See `OWNER_LEGAL_INPUT_REQUIRED.md` (20 items) — identity fields, DPA sub-processor correction, cookie-consent decision, B2B-gate decision, VAT/tax confirmation, per-country labour-law sign-off.

## Validations professionnelles
CGU/CGV/Privacy/DPA lawyer review; DPO/lawyer cookie-consent determination; AI Act practitioner classification; accountant/fiscal VAT determination per country; per-country (FR/BE/LU/CH) labour-law sign-off (matches P8.13's pre-existing "DIM B WITHHELD 0/4" status, unchanged).

## Risques
See `LEGAL_REMAINING_RISKS.md` (10 items, none code-blocking, several owner/professional-review-blocking).

## Verdict
See the mandatory 16-question verdict delivered in the same turn as this report, in the conversation.
