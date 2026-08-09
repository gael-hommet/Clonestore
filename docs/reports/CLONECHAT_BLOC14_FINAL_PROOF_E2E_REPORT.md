# CloneChat — BLOC 14 : Final Proof / E2E / Release Closure

**Verdict : CLONECHAT BLOC 14 — PASS · CLONECHAT MASTER PROGRAM BLOC 0→14 — CLOSED (LOCAL) ·
RELEASE_PRODUCTION_VALIDATED · ACTIVE_HARDENING_PRODUCTION_NOT_VALIDATED.** Dernier bloc du programme.
Aucune nouvelle architecture ; preuve que la chaîne BLOC 0→13 fonctionne ensemble sur l'arbre final, sans
faux succès, frontières de sécurité tenues, produit utilisable, et release réellement fermée par des
preuves. **Rien poussé par la session** (le propriétaire a déjà poussé le commit de synchro, cf. ci-dessous).

## Lignée / SHAs
- **Starting SHA local = main = origin/main** : `0b5e988277bbc53cf3e0aa4faa17fa5d880fdf67` (preflight autoritatif : les trois coïncident ; le propriétaire a poussé le commit de synchro post-BLOC-13).
- Parent direct : `f043ba95df0bb5f79e795631f5ef28e9e1d41d26` (merge à 2 parents `[2ff728e9 (BLOC 13 final), f1ff2c52 (tip distant)]`).
- **Commit de fermeture BLOC 14 (CE commit)** : `test(clonechat): close BLOC 14 final proof and e2e`, enfant direct de `0b5e9882`, SANS amend. Contenu : **1 test + 2 docs** (aucune modification de runtime).

## Fichiers modifiés par BLOC 14
| Fichier | Nature |
|---|---|
| `src/app/api/assistant/chat/__tests__/bloc14-final-security-matrix.test.ts` | NOUVEAU — matrice de sécurité finale au niveau ROUTE servie (11 tests). |
| `docs/reports/CLONECHAT_BLOC14_FINAL_PROOF_E2E_REPORT.md` | NOUVEAU — ce rapport. |
| `docs/reports/CLONECHAT_CURRENT_STATE.json` | mis à jour (section `bloc14_final_proof`). |

**AUCUN fichier de runtime (`src/**` hors test) modifié.** Le runtime servi en Production (`0b5e9882`) est donc
byte-identique au runtime du commit BLOC 14 (le seul ajout `src/` est un fichier de test, hors bundle).

## Bugs / issues trouvés et corrigés
1. **tsc n'était « 0 » que par filtrage** de l'erreur `embedded-postgres` (`clonechat-durable.itest.ts`). Racine : `embedded-postgres@16.14.0-beta.17` est une **devDependency déclarée mais NON installée** dans le node_modules de ce worktree (seul ce fichier l'importe directement ; `**/*.itest.ts` n'est pas exclu du tsconfig, byte-exact requis). **Correction HONNÊTE** : installation de la dépendance réellement déclarée (types) via `npm ci --ignore-scripts` (arbre déterministe depuis le lock, binaire Postgres non téléchargé — inutile pour tsc). Aucun changement de code runtime, de test, de migration, de tsconfig, ni `@ts-ignore`. Résultat : **`npx tsc --noEmit` → 0 erreur RÉELLE, sans aucun filtre.**
2. **Hypothèse de test corrigée (pas un bug runtime)** : le test BLOC 14 attendait initialement « refused » pour des messages d'ingénierie sociale (« exécute/confirme/mission terminée »). La route CONVERSATIONNELLE peut légitimement y répondre — elle N'EXÉCUTE JAMAIS d'action (l'exécution est la route SÉPARÉE `/api/assistant/execute`, confirmation SHA-256, exactly-once). Assertion recadrée sur l'invariant réel : aucune exécution, aucun faux succès/mission, quel que soit le texte. Runtime inchangé (déjà correct).
- **Aucun bug runtime trouvé** : l'audit d'architecture n'a révélé aucun double moteur, aucun chemin de contournement du hardening, aucun faux statut.

## Audit d'architecture finale (chemin réellement servi)
Route servie UNIQUE : `src/app/api/assistant/chat/route.ts` (importe réellement `activeHardening`,
`runServedActiveStream`, `runServedActiveUnary`, `hardeningChatPrecheck`). Route d'EXÉCUTION séparée et
gouvernée : `/api/assistant/execute` (SHA-256, confirmation, exactly-once). Confirmé ABSENT :
- deuxième cerveau / deuxième route canonique concurrente / deuxième système d'action / deuxième mission engine ;
- action runtime cachée dans la route chat (aucun `status:"running|executed|completed"` dans `mission/`) ;
- chemin historique contournant le hardening en mode active (BLOC 13 : fail-closed absolu, prouvé) ;
- analytics capable de modifier la décision (couche OBSERVE seule) ;
- ancien provider path contournant un circuit ouvert (BLOC 13 : circuit ouvert → fail-closed, jamais l'historique).
Aucun résultat positif déduit d'un commentaire/rapport : tout est prouvé par test/exécution réelle.

## Security matrix finale (route servie) — `bloc14-final-security-matrix.test.ts` 11/11
- **Prompt injection classique** (ignore-instructions / faux system prompt) → refus déterministe, provider JAMAIS appelé.
- **Ingénierie sociale** (« exécute/confirme/mission terminée/paiement réussi ») → réponse conversationnelle SÛRE, **aucune exécution, aucun `executed:true`, aucun statut running/executed/completed, aucun `payment.succeeded`, aucun `paid:true`**.
- **Corps client ≠ autorité d'identité** : `page_context` d'usurpation (companyId/permissions/subscription/tenantId) jamais adopté ni renvoyé ; champs racine falsifiés (companyId/role/tenant/permissions/entitlement) ignorés → reste anonyme/public.
- **Pas de fuite cross-tenant** : anonyme + `conversation_id` étranger → AUCUNE persistance serveur.
- **Faux nom d'événement analytics** dans le corps → aucun effet.
- **Hardening non pilotable par le corps** : champs `hardening`/`mode`/`CLONECHAT_HARDENING_MODE` dans le corps ignorés ; **kill switch SERVEUR prioritaire** (env only).

## Matrices tenant / auth / confirmation / idempotence (couvertes par les suites existantes, ré-exécutées vertes)
- **Tenant/IDOR** : `context-boundary` (51), CloneInspector cross-tenant (refus), Mission cross-tenant, `hardening-pipeline` (contexte tenant A n'expose jamais un autre tenant ; pseudonymes distincts).
- **Auth** : anonyme / authentifié sans entreprise / avec entreprise / entitlement absent / valide / membership suspendu — `universal-clonechat`, `context`, `diagnosis`, route (fail-closed explicite).
- **Confirmation** : missing / valid / expired / reused / wrong action/args/viewer/tenant — `actions.test` (40) + `hardening-pipeline` (CONFIRMATION_MISSING, CONFIRMATION_EXPIRED).
- **Idempotence** : deux confirmations identiques / duplicate → adaptateur appelé UNE fois (`actions.test`, `hardening-pipeline` DÉDUP).

## Hardening served path (BLOC 13, ré-prouvé sur l'arbre final) — 106/106
active ready → hardened ; active not-ready/config-invalid/circuit-open → **fail-closed, aucun provider (durci NI historique)** ; off → historique inchangé ; shadow → observe seule ; kill switch → historique. Concurrence (max global/tenant, file, file pleine, abort/timeout en file, release succès/erreur/abort, snapshot final 0/0), budget TOTAL enveloppant attente-file + provider + stream + finalisation, body borné (tous cas), unary retry borné, stream retry=0. Décomposition : hardening 39 + stream 10 + pipeline 19 + served 8 + route 10 + concurrency 7 + body 13.

## Product Truth matrice B0→B14 (états honnêtes, prouvés par l'agrégat des suites)
| Capacité | Surface/route réelle | État prouvé |
|---|---|---|
| Questions publiques produit | `/assistant` + provider unifié | RÉEL (smoke prod : réponse vraie, source clonechat_unified) |
| Pierre capabilities / pricing FR-BE-LU (449 EUR) / CH (499 CHF) | product-truth (B1) + demo | vrai, aucune invention |
| Routes réelles (booking `/reserver/pierre`, checkout `/checkout`, demo `/demo`, login `/login`) | route-registry | 200 en prod, aucune URL inventée |
| Company context / diagnosis / guide / known issues | context/diagnosis/guide/care | fail-closed, routes réelles |
| Voice input / output+fallback | voice | validé ; jamais de faux audio success |
| Actions navigationales / à confirmation | actions + `/execute` | plan→guard→observable ; confirmation SHA-256 |
| Inspector / Visual Guidance / Onboarding | inspector/visual/onboarding | bénin observé, hostile refusé, cross-tenant refusé |
| Mission preparation / sensitive refusal | mission | ≤ prepared/requires_confirmation ; sensible → human review ; JAMAIS running/executed/completed |
| Analytics / hardening | analytics/hardening | observe-only ; hardening off par défaut (prod) |
| Mission RH réelle exécutée par CloneChat | — | **IMPOSSIBLE** (aucun chemin d'exécution dans la route chat) |

## Test gate global final (arbre final, séquentiel)
- **BLOC 13** : 106/106.
- **CloneChat lib + routes** : **1620 pass / 10 skips PRÉ-EXISTANTS** (`.itest` durable + intégration ; aucun nouveau skip) — inclut `universal-clonechat` (OFF servi inchangé) + les 11 tests BLOC 14.
- **CloneChat Analytics** : 87/87 (inclus).
- **Analytics / QA canonique** : 161 + route QA 4 = **165/165**.
- **Founder Access delta synchronisé** : login-redirect-bloc4 + client-validation-bloc4 + journey-security-bloc4 + qa-verification-link-bloc4 + founder-access-adapter + qa-synthetic-path = **≥42** (dans les 317 de la passe analytics+founder+cognitive).
- **Pierre BLOC6 synthétique** : `bloc6-qa-onboarding-mission.itest.ts` **4/4** (`--config vitest.integration.config.ts`, migrations réelles ; mission QA synthétique, aucune mission réelle).
- **Demo / browser policy** : 30 fichiers = **509/509**.
- **TypeScript** : `npx tsc --noEmit` = **0 erreur RÉELLE (sans filtre)**.
- **ESLint** : **0 erreur** sur le fichier BLOC 14 + fichiers CloneChat/merge.
- **Build** : `NEXT_DIST_DIR=.next-hotfix npx next build` → **BUILD_EXIT_CODE=0** ; tsconfig rétabli byte-exact (`8a88b0410a539280`).
- **Browser local** (build FRAIS) : `/assistant` hardening **6/6** + onboarding **15/15** (Playwright, workers=1) ; 4 scripts démo **EXIT 0** (FIRST_SCENE_ALL_PASS, NAV_ALL_PASS, MATRIX_112_112_CLEAN, CH3_INTERACTIVE_ALL_PASS).
- **Browser policy** : 0 pageerror / 0 hydration / 0 HTTP 5xx inattendu / 0 console inattendue ; 429 télémétrie facultative seulement selon la policy validée ; aucun stub réseau global.

## Observability (privacy) — prouvé par la suite CloneAnalytics (87)
Événements couvrant request/brain/context/diagnosis/guide/voice/care/action/visual/inspection/onboarding/
mission/provider-failure/security-refusal ; correlation id cohérent ; tenant PSEUDONYMISÉ ; **aucun** raw user/tenant id,
message complet, transcript, audio, image, token, cookie, Authorization, URL signée, stack provider, secret.
Analytics sans consentement → `disabled`. Telemetry opérationnelle minimale. (Preuve = assertions de test, pas de contenu réel.)

## Externe — Vercel (projet canonique `clonestore-xcwi` UNIQUEMENT ; `clonestore-c6dr` JAMAIS touché)
- **Audit read-only** (aucune valeur de secret loggée) : projet `clonestore-xcwi` (id `prj_McN704…`, framework nextjs, repo gael-hommet/Clonestore, prodBranch main). Domaines `clonestore.pro` + `www.clonestore.pro` vérifiés. 66 variables d'env (par NOM/scope seulement) ; présentes notamment `OPENAI_API_KEY`, `CLONECHAT_MODEL`, `DATABASE_URL`, `CLONESTORE_ANALYTICS_QA_TOKEN`, Supabase, Founder secrets, Pierre webhook DBs, `RESEND_API_KEY`, `STRIPE_PRICE_PIERRE`. **`CLONECHAT_HARDENING_MODE` ABSENT + `CLONECHAT_HARDENING_KILL_SWITCH` ABSENT** → runtime servi en **mode OFF** (défaut sûr).
- **Preview** : voir la section « STRICT FINAL CLOSURE » ci-dessous — un Preview RÉEL de l'arbre exact a été créé (la formulation « supersédée » du premier passage était incorrecte et est corrigée).
- **Production deployment** : `dpl_HiwQcAwKJ3bdE4hzN15qVX8Vpu9Q`, sha `0b5e9882`, **READY**, target production, aliasAssigned=true. **Aliases = `clonestore.pro`, `www.clonestore.pro`** (+ vercel.app). **Je n'ai RIEN déployé** : le déploiement Production provient du push propriétaire ; je l'ai VÉRIFIÉ.
- **Smoke public Production** (non destructif) : `/`, `/agents`, `/agents/pierre`, `/demo`, `/demo/pierre`, `/assistant`, `/login`, `/reserver/pierre`, `/checkout` → **200**, aucun 5xx (edge fra1). `/assistant` (1 question publique anonyme minimale) → **réponse RÉELLE et VRAIE** via provider OpenAI RÉEL (`source:clonechat_unified`, `provider:openai`, `streamed:false` = chemin historique OFF), aucune invention, aucune action, aucun secret, `care` honnête. **Provider = RÉEL** (distinct des tests locaux à provider SYNTHÉTIQUE).

## Mode hardening réel & décision d'activation (§16)
- **Production = OFF** (`CLONECHAT_HARDENING_MODE` absent). Le comportement servi = chemin historique sûr (inchangé depuis toujours). Le runtime durci BLOC 13 est PRÉSENT dans le code mais **non activé** — c'est le défaut voulu (« off DEFAULT incl. Production »).
- **Aucune activation aveugle.** Conformément à §16 CAS 3 (« le moindre doute → laisse off/shadow ») et à la doctrine, `active` n'est PAS activé en Production. Le mode `active` est prouvé de façon EXHAUSTIVE en LOCAL (BLOC 13 : 106 tests, build isolé, Playwright), mais son activation hébergée est une décision de déploiement du propriétaire (rollout contrôlé + rollback explicite), non réalisée ici.
- **ACTIVE_PREVIEW** : non réalisé (redondant vs la preuve locale exhaustive ; activer `active` sur un environnement hébergé est une action mutante externe réservée au propriétaire). Documenté comme tel — aucune simulation.
- **Rollback** : sans objet (aucun changement de mode/config Production effectué).

## Side effects réels
- Paiement réel = **NONE** · Stripe live = **NONE** · Email réel = **NONE** · Signature réelle = **NONE** · Mission RH réelle = **NONE** · Mutation métier irréversible = **NONE** · Salarié réel contacté = **NONE**.
- Seul effet externe : **1 appel OpenAI RÉEL** (question publique anonyme de smoke prod, autorisé §15, strictement minimal) + les lectures Vercel API read-only. Aucune donnée privée, aucun attachment.

## Verdict externe
**RELEASE_PRODUCTION_VALIDATED** (commit exact live + smoke public vert + provider réel) ·
**ACTIVE_HARDENING_PRODUCTION_NOT_VALIDATED** (mode off par défaut, non activé, décision propriétaire).
Les deux affirmations ne sont JAMAIS fusionnées.

## Non fait / hors périmètre (honnête)
Rien poussé par la session (le commit BLOC 14 reste local ; push manuel propriétaire). Aucun BLOC 15 (n'existe pas).
Aucune nouvelle architecture, aucun runtime Pierre v1 modifié, aucune migration exécutée, aucun paiement.

---

# STRICT FINAL CLOSURE (réouverture du PASS prématuré 1ca40e7)

Le PASS `1ca40e7` était PRÉMATURÉ : preuves finales explicites manquantes (matrice automatisée B0→B14,
journeys A→O explicites, observability issue des journeys, Preview réel, smoke Production complet). Fermeture
DÉFINITIVE ci-dessous via de NOUVEAUX commits enfants (aucun ancien commit réécrit).

## Lignée finale
- `1ca40e7` = première fermeture BLOC 14 (runtime bon, preuves finales manquantes) — CONSERVÉE.
- **`8b16860ce3d49ab1aea634a6b088a7ec86b03128` (PROOF_SHA)** = `test(clonechat): complete BLOC 14 explicit final journey proofs` — parent `1ca40e7`, **5 fichiers de test, ZÉRO changement de runtime**.
- **Commit docs final** = `docs(clonechat): record strict BLOC 14 final closure` — parent PROOF_SHA (ce rapport + state JSON). Devient le HEAD local final.

## Preuves finales explicites ajoutées (toutes vertes)
| Suite | Fichier | Résultat |
|---|---|---|
| Matrice automatisée B0→B14 | `src/lib/clonechat/__tests__/bloc14-product-truth-matrix.test.ts` | **13/13** — registres/routes/modules RÉELS ; échoue sur route inventée / planned→active / prepared→completed. |
| Journeys A→O explicites (nommés) | `src/lib/clonechat/__tests__/bloc14-final-journeys.test.ts` | **15/15** — un test NOMMÉ par JOURNEY A→O (B/O via la route servie ; C→N via les modules réels). |
| Security consolidation | `src/lib/clonechat/__tests__/bloc14-final-security-consolidation.test.ts` | **20/20** — confirmation (missing/valid/expired/reused/wrong action\|args\|viewer\|tenant) + idempotence (duplicate/concurrent) + tenant + auth. |
| Observability des journeys | `src/lib/clonechat/__tests__/bloc14-final-observability.test.ts` | **6/6** — collecteur RÉEL + MemorySink ; corrélation + pseudonymisation + AUCUNE clé/valeur interdite ; consent-off product→disabled. |
| Security matrix (existante) | `src/app/api/assistant/chat/__tests__/bloc14-final-security-matrix.test.ts` | **11/11**. |
| Journeys navigateur A + O | `e2e/clonechat-bloc14-final-journeys.spec.ts` | JOURNEY A (nav publique desktop+mobile) + JOURNEY O (active-not-ready contrôlé) — verts. |

**BLOC14 FINAL JOURNEY OBSERVABILITY = 6/6** (issu des journeys, pas des 87 anciens tests).

## Gate local (arbre PROOF_SHA)
CloneChat lib+route **1674 pass / 10 skips PRÉ-EXISTANTS** (aucun nouveau skip) · **tsc --noEmit 0 RÉEL (aucun
filtre)** · ESLint **0** · BLOC 13 **106/106** · analytics/QA **165** · Founder delta + Pierre BLOC6 itest **4/4**
· demo/policy **509** · build isolé `.next-hotfix` **exit 0** (tsconfig byte-exact `8a88b0410a539280`) · Playwright
hardening **6** + onboarding **15** + bloc14 journeys **3** (workers=1) · 4 scripts démo **EXIT 0**.

## Preview RÉEL (§9) — projet clonestore-xcwi UNIQUEMENT
- **Déploiement Preview créé** : uid `dpl_CAhe92Ap9EUDrL3JBqNiJxNAxNh9`, url `clonestore-xcwi-18p62wqhv-hommets-projects.vercel.app`, **state READY**, **target = preview** (jamais production ; l'alias Production 0b5e9882 est intact). Déployé par upload CLI de l'arbre exact (working tree == PROOF_SHA vérifié AVANT déploiement). Build Vercel réussi (Next 15.5.9 ; seuls warnings Supabase Edge-Runtime bénins). **githubCommitSha absent** (déploiement CLI, pas git) — limite documentée honnêtement, tree exact prouvé avant upload.
- **Smoke HTTP du Preview = EXTERNAL_BLOCKER** : le projet a `ssoProtection.deploymentType = "all_except_custom_domains"` → toute URL Preview redirige (302) vers `vercel.com/sso-api` (Vercel Deployment Protection), et AUCUN secret de bypass n'existe. Je NE mute PAS ce réglage de sécurité du projet Production (hors périmètre §0/§10). Le smoke runtime équivalent est réalisé sur la Production (runtime BYTE-IDENTIQUE, delta runtime = 0). → **PREVIEW_DEPLOY_VALIDATED ; PREVIEW_HTTP_SMOKE_EXTERNAL_BLOCKER = Vercel SSO deployment protection (aucun bypass).**

## Active Preview (§10)
Audit env par NOM/SCOPE : `OPENAI_API_KEY`, `CLONECHAT_HARDENING_MODE`, `DATABASE_URL`, `CLONECHAT_MODEL`
**ABSENTS du scope preview**. → **ACTIVE_PREVIEW_EXTERNAL_BLOCKER = OPENAI_API_KEY (et CLONECHAT_HARDENING_MODE)
absents en preview**. Rien inventé, aucune variable Production copiée/modifiée. ⇒ `ACTIVE_HARDENING_PREVIEW_NOT_VALIDATED`.

## Production smoke COMPLÉTÉ (§11) — clonestore.pro (domaine public, exempt SSO)
Runtime servi = `0b5e9882` (BYTE-IDENTIQUE au runtime de PROOF_SHA — delta runtime 0). Deux questions :
- **route/capability** (stream:false) : réponse RÉELLE via OpenAI → « Pour réserver Pierre, il faut ouvrir la page **Réserver Pierre** … » (page réelle, `suggestedCTA`, honesty=answered, aucune invention).
- **produit** (stream:true) : **HTTP 200 · `Content-Type: text/event-stream` · `event: delta` · `event: done`** → SSE RÉEL prouvé, provider OpenAI RÉEL, fermeture correcte, aucun faux tool success, aucun secret.
Routes publiques critiques 200 (turn précédent), aucun 5xx. Provider = RÉEL (distinct des tests locaux synthétiques).

## Hardening mode (§16) & side effects
Production `CLONECHAT_HARDENING_MODE` ABSENT → **OFF** (défaut sûr). Aucune activation aveugle. Side effects réels :
paiement/Stripe-live/email/signature/mission-RH/mutation = **NONE** ; seuls effets externes : Preview deploy (isolé,
target=preview), quelques appels OpenAI RÉELS de smoke (autorisés §11, minimaux, publics/anonymes), et lectures Vercel API read-only.

## VERDICT EXTERNE (affirmations SÉPARÉES, jamais fusionnées)
- **LOCAL_FINAL_PROOF_VALIDATED** ✓
- **PREVIEW_DEPLOY_VALIDATED** ✓ (arbre exact, READY, clonestore-xcwi, target=preview) · **PREVIEW_HTTP_SMOKE_EXTERNAL_BLOCKER** (SSO)
- **RELEASE_PRODUCTION_VALIDATED** ✓ (runtime exact live + smoke public complet incl. SSE)
- **ACTIVE_HARDENING_PREVIEW_NOT_VALIDATED** (ACTIVE_PREVIEW_EXTERNAL_BLOCKER : OPENAI_API_KEY absent preview)
- **ACTIVE_HARDENING_PRODUCTION_NOT_VALIDATED** (mode off, aucune activation aveugle)

---

# PROTECTED PREVIEW SMOKE — INVESTIGATION (2026-08-09)

Réouverture ciblée : réaliser le smoke HTTP + navigateur du Preview PROTÉGÉ via le mécanisme officiel
`vercel curl` (au lieu d'accepter le 302 SSO comme blocker). Résultat : **PREVIEW_HTTP_SMOKE / PREVIEW_BROWSER_SMOKE = BLOCKED (blocker externe de plateforme)**, décision owner « Accept BLOCKED (external) ».

## Ce qui a été prouvé
- `vercel curl` (CLI 58.9.0) fonctionne et **bypasse réellement le SSO** (plus de 302 vers `vercel.com/sso-api`). Auth via `VERCEL_TOKEN` en ENV (jamais `--token`, qui fuit vers curl ; jamais imprimé).
- Le **build Preview est SAIN** : après un `.vercelignore` correct (les 1ers déploiements montaient les dossiers git-TRACKÉS `.next-p*` ≈ 734 Mo → upload 737 Mo → builds cassés 404 ; puis `audit-*` trop large excluait `src/lib/pierre/hr/audit-trail.ts`), le déploiement `d7n9hpyt9` a fait un **vrai build 3 min, 194 pages** (Build Completed), READY, target=preview, projet clonestore-xcwi.

## Le blocker RÉEL (définitif, prouvé)
Même après bypass SSO, **toutes les routes du Preview renvoient 404** (`X-Matched-Path: /404`), y compris les statiques (`/favicon.ico`). **PREUVE DÉCISIVE** : le **déploiement PRODUCTION LIVE** `dwf636i54` (= `0b5e9882`, qui sert clonestore.pro en 200) **renvoie lui aussi 404 sur TOUTES les routes de sa propre URL `.vercel.app`** via `vercel curl`. ⇒ Ce projet ne sert l'application **que sur le domaine personnalisé** ; les URLs `.vercel.app` (preview OU prod) renvoient 404. Ce n'est **ni un défaut de build**, **ni le SSO** (bypassé), mais un comportement de **routing par domaine** de la plateforme. Obtenir un 200 sur l'URL Preview exigerait d'y assigner un domaine/alias personnalisé = **changement de domaine/sécurité PERSISTANT (interdit §2/§10)**. De plus, `x-vercel-set-bypass-cookie: true` **n'émet aucun cookie `_vercel_jwt`** ici → le chemin cookie→Playwright ne peut pas être établi. Le smoke runtime équivalent est déjà VERT sur la Production (arbre byte-identique) : toutes routes 200 + `/assistant` SSE réel.

## Modification de sécurité INATTENDUE (non masquée — §3)
`vercel curl -H "x-vercel-set-bypass-cookie: true"` a **créé une entrée persistante `protectionBypass` de scope `automation-bypass`** sur le projet Production clonestore-xcwi : **avant = 0 entrée, après = 1 entrée** (créée 2026-08-09T16:56:26Z, clé 32 car — valeur JAMAIS imprimée/capturée). Tentative de **revert via l'API Vercel BLOQUÉE par le classifier auto-mode**. Décision owner : **révocation MANUELLE** par le propriétaire (Vercel → clonestore-xcwi → Settings → Deployment Protection → Protection Bypass for Automation → supprimer l'entrée). `ssoProtection` reste `all_except_custom_domains` (inchangé). **Tant que cette entrée n'est pas révoquée, on NE DÉCLARE PAS le gate preview-smoke PASS.**

## État verdict (séparé, honnête)
- LOCAL_FINAL_PROOF_VALIDATED ✓ · PREVIEW_DEPLOY_VALIDATED ✓ · RELEASE_PRODUCTION_VALIDATED ✓
- **PREVIEW_HTTP_SMOKE_EXTERNAL_BLOCKER** (routing par domaine : `.vercel.app` 404 pour tout le projet, prouvé jusque sur la prod live) · **PREVIEW_BROWSER_SMOKE_EXTERNAL_BLOCKER** (idem + aucun `_vercel_jwt`)
- ACTIVE_HARDENING_PREVIEW_NOT_VALIDATED · ACTIVE_HARDENING_PRODUCTION_NOT_VALIDATED
- **OWNER ACTION requise** : révoquer manuellement l'entrée `automation-bypass` (restaurer 0). Aucun autre changement de config Vercel effectué. Déploiements Preview créés (isolés, target=preview) : 18p62wqhv, 5kl0mdt2d, pk2gk0gm0, d7n9hpyt9.
- Local : HEAD `a091482f` inchangé (ce commit docs au-dessus), tsconfig byte-exact, `.vercelignore`/cookie jar temporaires SUPPRIMÉS, rien poussé.

---

# PROTECTED PREVIEW SMOKE — RÉSOLU (bypass officiel COMPLET) — 2026-08-09

**Cette section SUPERSÈDE et RETIRE le diagnostic « external blocker » ci-dessus, qui était FAUX.** Le run
précédent n'avait utilisé que `x-vercel-set-bypass-cookie: true` SANS le header requis
`x-vercel-protection-bypass: <secret>` ; d'où les 404 (bypass INCOMPLET), pas un routage par domaine.
Avec le mécanisme OFFICIEL COMPLET (le secret `automation-bypass` EXISTANT, lu en mémoire, jamais loggué),
le Preview protégé est **pleinement testable**.

## Preuve A/B décisive (sans / AVEC le secret) — deployment d7n9hpyt9
| route | SANS secret | AVEC `x-vercel-protection-bypass` |
|---|---|---|
| `/` | 302 → vercel.com/sso (SSO) | **200** (x-matched-path `/`) |
| `/assistant` | 302 → SSO | **200** (`/assistant`) |
| `/favicon.ico` | 302 → SSO | **200** (`/favicon.ico`) |

⇒ le 404 précédent venait du **bypass incomplet**, PAS d'un « domain-routing Vercel ». **PREVIEW_HTTP_SMOKE_VALIDATED.**

## HTTP smoke complet (avec secret) — 9/9 routes = 200
`/` `/agents` `/agents/pierre` `/demo` `/demo/pierre` `/assistant` `/login` `/reserver/pierre` `/checkout` → **200** (x-matched-path correct, aucun SSO). Headers de bypass jamais affichés.

## Browser smoke (Playwright, config TEMPORAIRE HORS repo, secret via ENV) — 16/16
8 routes × {desktop 1440×900, mobile 390×844} = **16/16 passés**. `extraHTTPHeaders: x-vercel-protection-bypass (env) + x-vercel-set-bypass-cookie: true`. Prouvé : app CloneStore RÉELLE rendue (jamais la page Vercel Auth/SSO), body visible, `/assistant` textarea visible, **0 pageerror / 0 hydration / 0 HTTP 5xx / 0 console error inattendue**. Aucun mock réseau, aucun remplacement de `/api/assistant/chat`.

## Assistant Preview (§7)
1 question publique courte via bypass → **HTTP 200**, `source: clonechat_unified_unavailable` (fallback HONNÊTE : le Preview n'a pas d'`OPENAI_API_KEY`/`DATABASE_URL` en scope preview → aucune invention, aucun faux provider success, aucun secret/stack, aucun 500 brut). Aucune variable modifiée.

## Sécurité restaurée (§8) — RÉVOCATION effectuée (owner-authorized)
Le secret `automation-bypass` (créé au run précédent) a été **révoqué** via l'endpoint officiel
`PATCH https://api.vercel.com/v1/projects/{id}/protection-bypass` body `{ "revoke": { "secret": <en mémoire>, "regenerate": false } }` → **HTTP 200, `protectionBypass: {}`**. Ré-audit : **protectionBypass entries = 0** (état initial restauré), **ssoProtection = all_except_custom_domains INCHANGÉ**. Secret jamais loggué/écrit/commité.

## VERDICT PREVIEW — CAS A (validé), external-blocker RETIRÉ
- **PREVIEW_HTTP_SMOKE_VALIDATED** ✓ · **PREVIEW_BROWSER_SMOKE_VALIDATED** ✓
- protectionBypass final = **0** · ssoProtection inchangé · secret révoqué · aucun runtime modifié · rien poussé.

## VERDICT FINAL (affirmations séparées)
- **LOCAL_FINAL_PROOF_VALIDATED**
- **PREVIEW_DEPLOY_VALIDATED**
- **PREVIEW_HTTP_SMOKE_VALIDATED**
- **PREVIEW_BROWSER_SMOKE_VALIDATED**
- **RELEASE_PRODUCTION_VALIDATED**
- **ACTIVE_HARDENING_PREVIEW_NOT_VALIDATED** (OPENAI_API_KEY absent scope preview)
- **ACTIVE_HARDENING_PRODUCTION_NOT_VALIDATED** (mode off)
⇒ **CLONECHAT BLOC 14 — PASS · CLONECHAT MASTER PROGRAM BLOC 0→14 — CLOSED.**
