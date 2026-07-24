# Legal Test Matrix

## Static — `scripts/legal-public-copy-scan.mjs` (pre-existing canonical scanner, reused not reinvented)

| Check | Result |
|---|---|
| Public pages (homepage, checkout, paiement/success, paiement/cancel, `/agents/pierre`, `/questions`) — forbidden-phrase scan | **[CLEAN] on all 6 — zero blocking violations**, including after this block's checkout/questions/partenaires edits |
| `/legal/cgu` placeholders | 2 active: "Placeholder à valider juridiquement" (droit applicable), "Draft 1.0" (version marker) — expected, unchanged |
| `/legal/cgv` placeholders | 2 active: same pattern — expected, unchanged |
| `/legal/dpa` placeholders | 3 active — expected, unchanged |
| `/legal/mentions` placeholders | 6 active — expected, unchanged (identity genuinely missing) |
| `/legal/confidentialite` placeholders | **1 active: "Draft 1.0"** — this is a NEW, intentional result of this block's fix (adding `LegalValidationBanner`); previously this page had **zero** draft markers despite depending on the same unresolved identity, which was itself the inconsistency being corrected. This is progress, not a regression. |
| Legal entity fields (7 checked) | All 7 still `[PENDING]` — dénomination, forme juridique, adresse, SIREN/SIRET, directeur publication, email contact, hébergeur — correctly unresolved (no invented values) |
| Total placeholders | 14 across legal pages (up from ~13 before this block, due solely to the new, correct confidentialite banner) |

## Static — targeted grep sweep (this block)
- Repo-wide search for SIREN/SIRET/RCS/capital social/siège social/TVA intracommunautaire/immatriculation outside the known placeholder registry: **zero real values found** (see evidence file 07).
- Repo-wide sweep for forbidden claim patterns (garanti, zéro erreur, remplace un avocat, etc.) across public pages: **zero found**, confirmed independently by both the Explore agent (file 08) and the copy-scanner above.

## Functional
| Test | Result |
|---|---|
| `POST /api/checkout` refuses without `legal_acceptance` → `LEGAL_ACCEPTANCE_REQUIRED`, 400, zero Stripe session created | **PASS** — new test in `payment-path-country-checkout.test.ts` |
| `POST /api/checkout` succeeds with valid `legal_acceptance` (FR/BE/LU/CH, idempotency, anti-tampering) | **PASS** — all 11 pre-existing Payment Path Closure assertions still green after the acceptance gate was added |
| Checkout page: CGV/confidentialité links present, checkbox unchecked by default | **PASS** (code review — `checked={cgvAccepted}` initialized `useState(false)`) |
| Checkout page: purchase button disabled while checkbox unchecked | **PASS** (code review — `disabled={isLoading || !cgvAccepted}`) |
| Checkout page: version + timestamp sent to server on acceptance | **PASS** (code review + server-side test asserting `LEGAL_ACCEPTANCE_REQUIRED` fires when the field is absent, implying it's read and validated) |
| Signup page: CGU/confidentialité mention present with working links | **PASS** (code review — `Link href="/legal/cgu"` and `/legal/confidentialite"` added) |
| Footer: mentions/CGV/CGU/confidentialité/DPA all present and functional | **PASS** (code review — 5 legal links now in `site-footer.tsx`, up from 1) |
| `/legal/confidentialite`: draft banner + nav bar now present | **PASS** (confirmed by the copy-scan finding "Draft 1.0" placeholder now detected on this page) |

## Non-régression (executed live)
See `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` for the full command output. Summary: `npx vitest run src/app/api/checkout src/lib/legal-commercial src/lib/go-live src/app/legal src/app/signup` → **376/376 passed**; `npx vitest run src/app/api/checkout src/app/api/webhooks src/lib/clonestore/pricing src/lib/clonestore/production src/lib/partner-program src/app/api/partners src/lib/founder-access src/app/api/pierre/execute src/app/api/pierre/action src/app/api/router` → **470/470 passed** (P0.1, P0.2, Payment Path, pricing, webhooks, partner program, founder-access all green).

## Technique
| Check | Result |
|---|---|
| `npx tsc --noEmit` (cleared stale 5.7MB `tsconfig.tsbuildinfo` first, same OOM-cache pattern seen in the Payment Path block) | **0 errors** |
| ESLint scoped to the 9 files modified in this block | **exit 0**, 0 errors/warnings |
| Isolated production build (`NEXT_DIST_DIR=.next-legal-closure-final`) | **PASS.** Root cause of attempts 1-3 identified and fixed: an orphaned Next.js build-worker process from attempt 3 had never exited, silently holding ~5.78GB RAM (137MB free system-wide). Terminated, memory recovered to ~6.1GB free. Attempt 4, run alone with `--max-old-space-size=5120`: compiled in 2.7s, full build completed in 30.3min, **196/196 static pages generated**, `BUILD_ID=-3eJ-j4YWNesXfmF1Fcql`, real exit code `0`, all 10 target routes confirmed in the bundle, 0 secrets in the log. See `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` and `CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/build-final-result.txt` |
| Secret scan on all 21 deliverable/evidence files | No unredacted API keys/secrets found |
| Git-blocked-safe file inventory (mtime forensics, `gitaudit.cjs` known unreliable this session) | Confirmed only the files listed in evidence file 10 were touched; zero homepage/demo/Pierre-governance files modified |

## Browser tests
**NON TESTÉES** — the Playwright MCP server was not reconnected during this block's session. No browser interaction (footer link clicks, checkout checkbox interaction, mobile viewport checks) was performed; all functional claims above are code-review + automated-test based only, clearly marked as such rather than presented as browser-verified.
