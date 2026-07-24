# Worktree Full Status Matrix — Validated Worktree Preservation and Commit Closure

Inventaire complet du dépôt exécuté le 2026-07-24 via `isomorphic-git` (statusMatrix scopé par
répertoire — `src/`, `audit-20260723-full/`, `docs/`, `e2e/`, `scripts/` — plus vérification
individuelle de tous les fichiers à la racine du dépôt ; `git.exe` natif reste bloqué au niveau
OS). **3878 chemins vérifiés, 1940 modifiés/ajoutés par rapport au HEAD actuel
(`0b3d79e61581cb7a8eec8f4a4ccaaf43b6e823be`).**

Chaque fichier appartient à exactement une des 10 catégories obligatoires du prompt maître.
Aucun fichier n'est laissé non classé — les catégories à fort volume (`AUDIT_DOCUMENTATION`,
`UNRELATED_PREEXISTING`) sont présentées de façon agrégée avec une liste brute complète en
fichier compagnon, plutôt qu'un tableau d'1940 lignes individuelles impraticable.

**Résumé des 10 catégories :**

| Catégorie | Fichiers | Décision |
|---|---|---|
| `P0_GOVERNANCE` | 10 | COMMIT (Commit 1) |
| `PAYMENT_PATH` | 12 | COMMIT (Commit 2) |
| `LEGAL_TRUST` | 7 | COMMIT (Commit 3) |
| `DEMO_MOBILE` | 17 | COMMIT (Commit 4) |
| `GITIGNORE_FIX` | 1 | COMMIT (Commit 0, créé par ce bloc) |
| `AUDIT_DOCUMENTATION` | 114 | COMMIT (Commit 5) |
| `LOCAL_ENVIRONMENT` | 4 | NE PAS COMMITER — hors périmètre |
| `TEMPORARY` | 7 | NE PAS COMMITER — hors périmètre |
| `BUILD_ARTIFACT` | 0 (dans le périmètre scanné) | N/A — voir note ci-dessous |
| `UNRELATED_PREEXISTING` | 1768 | NE PAS COMMITER — hors périmètre de ce bloc |

**Total classé : 1940 / 1940.**

**Note BUILD_ARTIFACT :** aucun répertoire `.next-*` n'a été inclus dans ce scan (le scan porte
sur des fichiers individuels, pas sur les ~40 répertoires `.next-*` présents à la racine, qui ne
sont jamais candidats au commit). Vérification directe de l'arbre Git du HEAD actuel :
**`.next-p10`, `.next-p11`, `.next-p12`, `.next-p13`, `.next-p96` sont déjà committés dans un
HEAD historique très antérieur à ce bloc** (bien avant les 5 blocs nommés ici). Ce n'est pas une
action de ce bloc et ils ne sont pas retirés (opération destructive hors périmètre) — une règle
`.gitignore` (`​.next-*/`) a été ajoutée pour empêcher toute récidive future, voir
`GITIGNORE_FIX` ci-dessous et `VALIDATED_WORKTREE_REMAINING_RISKS.md`.

---

## P0_GOVERNANCE (P0.1 + P0.2) (10 fichiers)

Dépendances : legacy-execute-governance.ts + cloneguard.ts + tests, tous requis ensemble (voir Phase 2)

| Fichier | Statut | Secret possible | Décision |
|---|---|---|---|
| `src/app/api/pierre/action/__tests__/p0-2-governance-closure.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/app/api/pierre/action/route.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/app/api/pierre/execute/route.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/app/api/router/__tests__/p0-2-router-neutralized.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/app/api/router/route.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/lib/pierre/__tests__/legacy-execute-governance.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/lib/pierre/__tests__/p0-transversal-consistency.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/lib/pierre/hr/cloneguard.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |
| `src/lib/pierre/legacy-execute-governance.ts` | *added, staged | Non (scan 0/161) | COMMIT — P0_GOVERNANCE |

## PAYMENT_PATH (12 fichiers)

Dépendances : pricing-flags.ts + p15-checkout-reconciliation-gate.ts + checkout/page.tsx + webhooks/stripe/route.ts

| Fichier | Statut | Secret possible | Décision |
|---|---|---|---|
| `src/app/api/checkout/__tests__/payment-path-country-checkout.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/app/api/webhooks/stripe/__tests__/founder-stripe-webhook-er2.test.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/app/api/webhooks/stripe/__tests__/invoice-payment-failed-api-drift.test.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/app/api/webhooks/stripe/__tests__/orders-ledger-replay.test.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/app/api/webhooks/stripe/__tests__/payment-path-country-reconciliation.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/app/api/webhooks/stripe/route.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/app/checkout/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/components/pricing/CountryPricingCard.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/lib/clonestore/pricing/__tests__/pricing-flags-revealed-default.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/lib/clonestore/pricing/pricing-flags.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/lib/clonestore/production/__tests__/p15-reconciliation-revealed-default.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |
| `src/lib/clonestore/production/p15-checkout-reconciliation-gate.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — PAYMENT_PATH |

## LEGAL_TRUST (7 fichiers)

Dépendances : checkout/page.tsx (déjà dans PAYMENT_PATH, contenu cumulatif) + pages légales + footer

| Fichier | Statut | Secret possible | Décision |
|---|---|---|---|
| `src/app/api/checkout/__tests__/customer-mapping-route.test.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |
| `src/app/api/checkout/route.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |
| `src/app/legal/confidentialite/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |
| `src/app/partenaires/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |
| `src/app/questions/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |
| `src/app/signup/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |
| `src/components/site/site-footer.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — LEGAL_TRUST |

## DEMO_MOBILE (17 fichiers)

Dépendances : contextual-prompt/* + GuidedTourProvider.tsx + vitest.config.ts (jsx automatic)

| Fichier | Statut | Secret possible | Décision |
|---|---|---|---|
| `src/app/demo/pierre/_variant/DemoEventTracker.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/app/demo/pierre/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/app/page.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/demo/acts/ValueChapter.tsx` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/demo/cost/__tests__/capacity-calculator-hydration.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/demo/cost/CapacityCalculator.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/guided-tour/GuidedTourProvider.tsx` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/home/__tests__/demo-contextual-prompt-card.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/home/DemoContextualPrompt.tsx` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/components/home/DemoContextualPromptCard.tsx` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/lib/demo/contextual-prompt/__tests__/contextual-prompt-flags.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/lib/demo/contextual-prompt/__tests__/detect.test.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/lib/demo/contextual-prompt/constants.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/lib/demo/contextual-prompt/contextual-prompt-flags.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/lib/demo/contextual-prompt/detect.ts` | *added, staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `src/lib/founder-access/types.ts` | *added(?) modified-staged | Non (scan 0/161) | COMMIT — DEMO_MOBILE |
| `vitest.config.ts` | *modified | Non (scan 0/161) | COMMIT — DEMO_MOBILE |

## GITIGNORE_FIX (nouveau, créé par ce bloc) (1 fichiers)

Dépendances : aucune (fichier de config seul)

| Fichier | Statut | Secret possible | Décision |
|---|---|---|---|
| `.gitignore` | *modified | Non (scan 0/161) | COMMIT — GITIGNORE_FIX |

## AUDIT_DOCUMENTATION (114 fichiers)

Dépendances : aucune. Décision : COMMIT (commit documentaire séparé, Commit 6). Secret possible : Non (scan 0/161, voir COMMIT_SECRET_SCAN.md). Liste complète :

- `audit-20260723-full/AI_ACT_AND_HR_RISK_MATRIX.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/agents-pierre-desktop-1440-abovefold.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/build-and-dev-perf-log.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-desktop-1440-abovefold.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-desktop-1440-end-of-scroll.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/00_INDEX.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/01-homepage-cartography-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/02-demo-pierre-cartography-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/03-analytics-contract-audit-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/04-mobile-utilities-audit-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/05-hydration-root-cause-investigation.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/06-code-changes-diff-summary.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/07-test-results.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/build-final-result.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/build-final-verification.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/concurrent-head-baseline.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/contextual-overlay-arbitration-proof.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/demo-mobile-conversion-closure/phase-b-external-commit-review.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/eslint-misconfiguration-proof.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/homepage-desktop-1440-full.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/homepage-mobile-375x667-iphoneSE-abovefold.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/homepage-mobile-390-abovefold.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/homepage-mobile-390-full.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/homepage-tablet-820x1180-abovefold.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/00_INDEX.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/01-legal-pages-audit-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/02-forms-data-collection-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/03-cookies-trackers-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/04-subprocessors-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/05-pierre-hr-governance-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/06-pricing-checkout-fiscal-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/07-legal-entity-identity-search-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/08-commercial-claims-raw.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/09-canonical-architecture-discovery.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/10-code-changes-diff-summary.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/11-official-sources-register.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/build-environment-before.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/build-final-result.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/00_BASELINE.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/01_git_forensics_raw.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/02_caller_and_make_search.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/03_test_results_raw.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/04_typescript_eslint_raw.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/05_secret_scan.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/06_final_file_inventory.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/07_build_result.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-2-sibling-surfaces-closure/build-result.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-2-sibling-surfaces-closure/test-and-validation-results.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/paiement-500-error.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/payment-path-closure/build-result.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/payment-path-closure/cta-suisse-checkout-CH.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/payment-path-closure/paiement-stable-production.png` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/payment-path-closure/stripe-real-test-proof.txt` (*added, staged)
- `audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/worktree-preservation/00_BASELINE.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_FULL_AUDIT.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_FUNNEL_AUDIT.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_ISSUE_REGISTER.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_LAUNCH_READINESS.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_MOBILE_AUDIT.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_OPTIMIZATION_BACKLOG.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_PIERRE_AUDIT.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_ROUTE_INVENTORY.md` (*added, staged)
- `audit-20260723-full/CLONESTORE_TECHNICAL_AUDIT.md` (*added, staged)
- `audit-20260723-full/COMMERCIAL_CLAIM_REGISTER.md` (*added, staged)
- `audit-20260723-full/COOKIE_AND_TRACKER_INVENTORY.md` (*added, staged)
- `audit-20260723-full/DEMO_ACCESSIBILITY_MATRIX.md` (*added, staged)
- `audit-20260723-full/DEMO_AND_MOBILE_CONVERSION_CLOSURE_REPORT.md` (*added, staged)
- `audit-20260723-full/DEMO_BROWSER_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/DEMO_CONTEXTUAL_PROMPT_SPEC.md` (*added, staged)
- `audit-20260723-full/DEMO_EXTERNAL_VALIDATION_PROTOCOL.md` (*added, staged)
- `audit-20260723-full/DEMO_FUNNEL_BEFORE_AFTER_MATRIX.md` (*added, staged)
- `audit-20260723-full/DEMO_FUNNEL_EVENT_CONTRACT.md` (*added, staged)
- `audit-20260723-full/DEMO_HYDRATION_ROOT_CAUSE_REPORT.md` (*added, staged)
- `audit-20260723-full/DEMO_PERFORMANCE_MATRIX.md` (*added, staged)
- `audit-20260723-full/DEMO_REMAINING_RISKS.md` (*added, staged)
- `audit-20260723-full/DEMO_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/DPA_COMPLIANCE_MATRIX.md` (*added, staged)
- `audit-20260723-full/HOMEPAGE_PROTECTED_ELEMENTS_PROOF.md` (*added, staged)
- `audit-20260723-full/LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` (*added, staged)
- `audit-20260723-full/LEGAL_APPLICABILITY_MATRIX.md` (*added, staged)
- `audit-20260723-full/LEGAL_ENTITY_FACT_SHEET.md` (*added, staged)
- `audit-20260723-full/LEGAL_REMAINING_RISKS.md` (*added, staged)
- `audit-20260723-full/LEGAL_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/MOBILE_UX_CHANGE_REGISTER.md` (*added, staged)
- `audit-20260723-full/MOBILE_VIEWPORT_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/OWNER_LEGAL_INPUT_REQUIRED.md` (*added, staged)
- `audit-20260723-full/P0_1_BUILD_EVIDENCE.md` (*added, staged)
- `audit-20260723-full/P0_1_CALLER_AND_SURFACE_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_1_CURRENT_ROUTE_BEFORE_AFTER.md` (*added, staged)
- `audit-20260723-full/P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md` (*added, staged)
- `audit-20260723-full/P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_VERDICT.md` (*added, staged)
- `audit-20260723-full/P0_1_GIT_FORENSIC_TIMELINE.md` (*added, staged)
- `audit-20260723-full/P0_1_GOVERNANCE_DECISION_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_1_PREVIOUS_REPORT_RECONCILIATION.md` (*added, staged)
- `audit-20260723-full/P0_1_REMAINING_RISKS.md` (*added, staged)
- `audit-20260723-full/P0_1_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_2_CALLER_INVENTORY.md` (*added, staged)
- `audit-20260723-full/P0_2_EXECUTION_SURFACES_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_2_REMAINING_EXECUTION_RISKS.md` (*added, staged)
- `audit-20260723-full/P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md` (*added, staged)
- `audit-20260723-full/P0_2_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_EXECUTION_PATH_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_GOVERNANCE_CLOSURE_REPORT.md` (*added, staged)
- `audit-20260723-full/P0_GOVERNANCE_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/P0_REMAINING_GOVERNANCE_RISKS.md` (*added, staged)
- `audit-20260723-full/PAYMENT_COUNTRY_PRICE_MATRIX.md` (*added, staged)
- `audit-20260723-full/PAYMENT_PATH_CLOSURE_REPORT.md` (*added, staged)
- `audit-20260723-full/PAYMENT_REMAINING_RISKS.md` (*added, staged)
- `audit-20260723-full/PAYMENT_ROUTE_AND_STATE_MATRIX.md` (*added, staged)
- `audit-20260723-full/PAYMENT_STRIPE_TEST_EVIDENCE.md` (*added, staged)
- `audit-20260723-full/PAYMENT_TEST_MATRIX.md` (*added, staged)
- `audit-20260723-full/PRIVACY_DATA_PROCESSING_MATRIX.md` (*added, staged)
- `audit-20260723-full/SUBPROCESSOR_REGISTER.md` (*added, staged)
- `audit-20260723-full/TAX_AND_PRICE_DISCLOSURE_MATRIX.md` (*added, staged)

## LOCAL_ENVIRONMENT (4 fichiers — NON COMMITÉS, hors périmètre)

| Fichier | Statut | Pourquoi non commité |
|---|---|---|
| `.claudeignore` | *added | Configuration d'outillage local (Claude/graphify/vercel), non liée à un bloc produit nommé — non mélangé par prudence |
| `.graphifyignore` | *added | Configuration d'outillage local (Claude/graphify/vercel), non liée à un bloc produit nommé — non mélangé par prudence |
| `.vercelignore` | *added | Configuration d'outillage local (Claude/graphify/vercel), non liée à un bloc produit nommé — non mélangé par prudence |
| `CLAUDE.md` | *added | Configuration d'outillage local (Claude/graphify/vercel), non liée à un bloc produit nommé — non mélangé par prudence |

## TEMPORARY (7 fichiers — NON COMMITÉS, hors périmètre)

| Fichier | Statut | Pourquoi non commité |
|---|---|---|
| `_captures5.mjs` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |
| `_qa4.mjs` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |
| `scratch_probe2.mjs` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |
| `scratch_probe5.mjs` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |
| `scratch_probe6.mjs` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |
| `Usershommeclonestore.git-head-route.ts.tmp` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |
| `Usershommeclonestore.tsconfig-head.tmp` | *added | Fichier de travail ponctuel (script scratch/probe ou artefact de chemin malformé), non lié à un bloc produit |

## UNRELATED_PREEXISTING (1768 fichiers — NON COMMITÉS, hors périmètre de ce bloc)

Ces fichiers représentent des semaines/mois de travail d'autres blocs jamais nommés dans ce prompt maître (P9.x-P20, C1.1-C1.9, T1/T2, E1.x, PARTNER_*, PWA_*, MPA1, etc.) — la conséquence directe et déjà documentée du "Git Blocked Gotcha" mémorisé. Les committer ferait exactement ce que ce bloc interdit ("ne mélange pas arbitrairement les blocs") et constituerait une opération séparée, à bien plus grande échelle, nécessitant sa propre revue dédiée. Répartition par préfixe de premier niveau :

| Préfixe | Nombre de fichiers |
|---|---|
| `src/` | 1319 |
| `docs/` | 185 |
| `scripts/` | 136 |
| `(fichiers racine individuels)` | 103 |
| `e2e/` | 25 |

Liste brute complète (chemin + statut, 1 ligne par fichier) : voir `CLONESTORE_AUDIT_EVIDENCE/worktree-preservation/08_unrelated_preexisting_full_list.txt`.
