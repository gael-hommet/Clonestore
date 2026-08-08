# CloneChat — BLOC 13 : Production Hardening & Runtime Readiness

**Verdict local : BLOC 13 PASS — READY FOR BLOC 14 FINAL PROOF/E2E.** Le runtime durci est RÉELLEMENT
câblé sur le chemin actif servi ; le readiness est FAIL-CLOSED (evidence explicite, jamais vrai par
défaut) ; la configuration invalide est diagnostiquée et bloque `active` ; la file est ABORTABLE et
bornée dans le budget TOTAL ; le streaming réel est gaté ; les cas pipeline BLOC 0→12 sont réellement
testés ; l'état loading est réellement observé au navigateur. **Aucune capacité structurante du BLOC 13
n'est reportée au BLOC 14.** Le BLOC 14 ne fera que les preuves finales/E2E du système déjà terminé. Ce
bloc ne prétend PAS « Production validée » (`productionReadyClaim` toujours false) : le verdict signifie
uniquement « prêt pour les preuves finales du BLOC 14 ».

## Lignée
- **Première implémentation (INCOMPLÈTE)** : `97e3b69f62731849725ac3fe20b2ef081a18e096` — `feat(clonechat): BLOC 13 production hardening and runtime readiness`. Owner l'a rouverte : readiness vacuement vert, runtime non câblé au chemin actif, streaming non prouvé, file non abortable, config invalide masquée, cas pipeline non prouvés, loading non asserté, limites transport après parsing.
- **2e commit correctif** : `e9ba08c106ebc8dea2d6819b9bc46174c4c142cc` — `fix(clonechat): close BLOC 13 real runtime hardening gate`, parent DIRECT `97e3b69f`. A corrigé la majorité des 8 blockers A→H. CONSERVÉ intégralement.
- **3e commit correctif final (CE commit)** : `fix(clonechat): enforce fail-closed active runtime on served path`, parent DIRECT `e9ba08c1`, SANS amend. Ferme les 3 défauts de fermeture restants : **(1)** ACTIVE demandé + NON prêt = **FAIL-CLOSED**, jamais un repli vers le provider historique ; **(2)** concurrence + backpressure + budget **TOTAL** réellement utilisés par le chemin actif servi ; **(3)** retry servi RÉEL (unaire) ou explicitement 0 (streaming, documenté). Lignée : `97e3b69f → e9ba08c1 → (ce commit)`, les trois conservés.
- **Git remote** : `origin/main` distant réel = `4a6fa93f1369ac039b52c5731b701438bf6e5b72` (lecture autoritative `git.listServerRefs` — origin a avancé indépendamment ; ni fetché ni mergé ni poussé ici).

## Les 3 défauts de fermeture (3e commit)
- **Défaut 1 — ACTIVE refusé ≠ OFF.** Avant : `hActive = enforce && activeAllowed` ; si active demandé mais readiness non verte, `hActive` devenait faux et la requête retombait sur le chemin **historique** (qui rappelle le provider sans durcissement). Après : dès que `effect.enforce` (mode active) ET `!activeAllowed`, la route renvoie une réponse SÛRE (`config_invalid` / `circuit_open` / `runtime_disabled`) AVANT tout travail provider — voie publique ET voie entreprise fail-closent. **Circuit ouvert ne peut donc JAMAIS atteindre le provider (durci NI historique).**
- **Défaut 2 — concurrence/backpressure/budget total réellement servis.** `runServedActiveStream`/`runServedActiveUnary` acquièrent un slot d'un limiteur servi PERSISTANT (tenant-scopé, clé jamais dérivée du texte utilisateur), démarrent le budget TOTAL AVANT l'attente de file (il enveloppe attente-file + démarrage provider + streaming complet + finalisation) et rendent le slot EXACTEMENT une fois ; abort/timeout en file retire le waiter (provider jamais appelé).
- **Défaut 3 — retry.** Streaming : `maxRetries=0` par construction (documenté ; rejouer après le 1er delta corromprait la sortie). Unaire servi : `config.retry` (borné, idempotent, avant tout output) — plus de valeur de retry fantôme.

## Fichiers (module `src/lib/clonechat/hardening/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | Contrat versionné (`hardening-1`) : modes, taxonomie d'erreurs, limites, budgets, concurrence, retry, circuit, actions, readiness. |
| `config.ts` | Constantes canoniques + `resolveHardeningConfig` → `{config, valid, diagnostics}` : ABSENT=default OK, PRÉSENT-INVALIDE=diagnostic BLOQUANT ; mode/kill-switch inconnu → diagnostic ; provider>total → diagnostic. |
| `errors.ts` | Taxonomie SÛRE + mapping HTTP + `toSafeError` (jamais stack/secret/SQL/chemin/tenant). |
| `limits.ts` | Limites d'entrée + bornage de sortie (troncature honnête). |
| `timeout.ts` | `withTimeout` (timeout dur + AbortSignal chaîné) + `withBoundedRetry` (borné, non idempotent jamais relancé). |
| `circuit-breaker.ts` | Circuit déterministe (temps injecté) + registre isolé PAR provider + `reset()` (tests). |
| `concurrency.ts` | Concurrence + backpressure ABORTABLE : waiter retiré atomiquement sur abort (jamais démarré plus tard), file bornée, plafond tenant, slot toujours rendu. |
| `readiness.ts` | Gate FAIL-CLOSED par EVIDENCE (`proven`/`unknown`/`failed`) : sans evidence → blocked ; `config_valid` dérivé des diagnostics réels ; `provider_healthy` dégradant ; `productionReadyClaim` toujours false. |
| `runtime.ts` | `guard()` : off passthrough / shadow observe / active enforce. **Budget TOTAL enveloppe attente-file + exécution** (un client parti ne lance jamais le handler plus tard). Active refusé si readiness ≠ ready_for_b14. |
| `provider-guard.ts` | `guardProviderCall` : circuit → timeout → retry borné, autour d'un appel provider réel. |
| `stream-guard.ts` | `pumpHardenedStream` : streaming durci (fermeture unique, aucun send-after-close, budget de sortie, abort→cancelled, timeout, erreur avant/après deltas, circuit, aucun secret). |
| `chat-active.ts` | Câblage ACTIVE : config+readiness+breaker module, `buildActiveHardenedStream` (→ encodeStreamEvent), seam provider synthétique fail-closed (tests). |
| `body-guard.ts` | `readBoundedRequestText` : lecture BORNÉE au transport (Content-Length + cumul réel ; corps mensonger/chunké plafonné). |
| `observe.ts` | Corrélation opaque/pseudonymisée + champs de log sûrs. |
| `chat-precheck.ts` / `index.ts` | Garde d'entrée additive (raw attachment count avant slice) ; barrel. |
| `__tests__/hardening.test.ts` | Suite unité (39). |
| `src/lib/clonechat/hardening/__tests__/hardening-stream.test.ts` | Gate streaming réel (10). |
| `src/lib/clonechat/hardening/__tests__/hardening-pipeline.test.ts` | Intégration BLOC 0→12 réelle (8). |
| `src/app/api/assistant/chat/route.ts` | Câblage ACTIF réel : body borné + precheck raw-count + branche streaming ACTIVE (buildActiveHardenedStream + breaker). Off/shadow strictement inchangés. |
| `src/app/api/assistant/chat/__tests__/hardening-route.test.ts` | Chemin actif servi : flux SSE durci, breaker réellement ouvert par les échecs, 413 raw-count, kill switch (4). |
| `e2e/clonechat-assistant-hardening.spec.ts` | Navigateur : loading OBSERVÉ (SSE réel retardé), interruption, erreur contrôlée (5). |

## Correctifs des blockers (A→H)
- **A — readiness FAIL-CLOSED** : refonte par EVIDENCE. Aucun booléen architectural vrai par défaut ;
  `createHardenedRuntime` sans evidence → active bloqué. `config_valid` dérivé des diagnostics serveur.
  Tests : aucune evidence→blocked, evidence manquante→blocked, failed→blocked, provider unhealthy→degraded
  (active refusé), tout prouvé→ready_for_b14, `productionReadyClaim` toujours false.
- **B — runtime RÉELLEMENT câblé** : `/api/assistant/chat` en mode `active` passe le streaming par le
  circuit breaker module + timeout provider + budget de sortie + fermeture unique (via
  `buildActiveHardenedStream`/`pumpHardenedStream`), et applique body-bounding + limites. Prouvé au
  niveau route (`hardening-route.test.ts`). Rien de structurant reporté au BLOC 14.
- **C — streaming GATÉ** sur le VRAI code (`pumpHardenedStream`/`buildActiveHardenedStream`) avec
  provider synthétique : normal, abort avant 1er chunk (provider reçoit le signal), timeout, erreur
  avant/après deltas (pas de faux succès, pas de double close, pas d'enqueue-after-close), circuit
  ouvert (provider non appelé), budget de sortie, aucun secret, déterminisme.
- **D — file ABORTABLE + budget TOTAL** : waiter retiré atomiquement sur abort/timeout (jamais démarré
  plus tard) ; le budget total (via `withTimeout` autour de `limiter.run`) englobe l'attente-file.
  Tests : queue normale/full, abort avant enqueue, abort pendant attente, slot rendu (succès/throw),
  isolation tenant, snapshot final 0.
- **E — config invalide DIAGNOSTIQUÉE** : `{config, valid, diagnostics}` ; absent=default, présent-invalide
  =blocking ; mode/kill-switch inconnu → diagnostic ; en active, config invalide → readiness blocked.
- **F — cas pipeline RÉELS** (`hardening-pipeline.test.ts`, modules BLOC 0→12) : injection n'altère jamais
  la politique, tenant absent (aucun companyId), cross-tenant (pseudonymes distincts), mission JAMAIS
  exécutée, analytics no-op (persisted=false, réponse préservée), panne analytics (réponse préservée),
  provider indisponible→circuit_open→fallback sûr (jamais inventé), consentement absent→disabled,
  structured historique compatible.
- **G — loading RÉELLEMENT observé** : le spec asserte le bouton « Interrompre » visible APRÈS envoi et
  AVANT le résultat (backend SSE synthétique retardé), puis le résultat, l'interruption et l'erreur
  contrôlée, sur desktop/iPhone/Android.
- **H — limites transport AVANT parsing** : `readBoundedRequestText` borne le cumul réel d'octets
  (Content-Length = signal précoce seulement) ; nombre BRUT de pièces jointes vérifié AVANT slice.
  Tests unité (body-guard) + route (413 too_many_attachments sur 9 pièces jointes en active).

## Modes & readiness
`off` (défaut, y compris Production) → passthrough, comportement historique inchangé. `shadow` → observe
read-only, aucun effet. `active` → enforcement, accepté UNIQUEMENT si readiness intégralement vert
(evidence complète + config valide) ; jamais activé en Production ici. Kill switch serveur prioritaire →
passthrough. Le readiness `active` du chemin servi est prouvé par EVIDENCE réelle
(`chat-active.activeReadinessFacts` : structurel prouvé par construction + config depuis diagnostics +
garanties route falsifiables) ; `provider_healthy` dérivé du VRAI breaker (circuit ouvert → degraded →
active retiré, fail-closed).

## Tests exacts (séquentiels après la dernière modification)
- **Suite BLOC 13 = 106** : hardening unité **39** + streaming **10** + pipeline **19** + adaptateur servi **8** (`hardening-served`) + route **10** + concurrence route **7** (`hardening-route-concurrency`) + body route **13** (`hardening-route-body`).
- **CloneChat lib + route** : passe séquentielle **1609 pass / 10 skips** pré-existants (`.itest` durable ; `universal-clonechat` = chemin servi OFF strictement inchangé).
- **Analytics/QA canonique** **161** + route QA **4** = **165/165**.
- **Démo + policy navigateur** 30 fichiers = **509/509**.
- **TypeScript** global : 0 erreur nouvelle (1 pré-existante `embedded-postgres`). **ESLint** : 0 erreur (2 warnings PRÉ-EXISTANTS `no-console` dans la route, non introduits).

## Build & navigateur (build FRAIS, aucun appel payant)
- **Build Next isolé** `.next-hotfix` : **BUILD_EXIT_CODE=0** réel.
- **Playwright /assistant** desktop/iPhone/Android **6/6** : rendu, saisie, **loading OBSERVÉ** (bouton Interrompre avant résultat), résultat via le VRAI protocole event-stream, **interruption** (UI réutilisable), **erreur 503 contrôlée**, **FAIL-CLOSED contrôlé** (active non prêt → réponse sûre, UI réutilisable, aucun faux résultat), a11y clavier, aucune fuite, 0 pageerror / 0 hydration / 0 HTTP 5xx inattendu / 0 erreur console inattendue. Backend SSE synthétique.
- **CloneChat onboarding** **15/15**. **4 scripts démo officiels EXIT 0** : demo-first-scene, demo-nav-check (NAV_ALL_PASS), demo-visual-matrix (MATRIX_112_112_CLEAN), demo-ch3-interactive (CH3_INTERACTIVE_ALL_PASS).
- Serveur arrêté proprement ; `.next-hotfix` + `test-results` supprimés ; `tsconfig.json` byte-exact (`8a88b0410a539280`).

## Deux couches analytics — inchangées
`src/lib/clonechat/analytics/**` (BLOC 12) et `src/lib/analytics/**` (canonique/QA distant) préservées,
non fusionnées, non modifiées. Bloc QA distant intact (toggle OFF par défaut, external-only, bot/automated
toujours exclus, réservation QA server-secret-only, aucun email QA).

## Limites restantes (honnêtes) — aucune capacité structurante reportée
- `active` n'est jamais activé en Production ici : il est prouvé LOCALEMENT (provider synthétique injecté,
  aucun appel payant). Le BLOC 14 fera les preuves finales/E2E de bout en bout du système déjà câblé.
- Aucune preuve de CHARGE réelle (interdit) : concurrence/backpressure/circuit/timeout prouvés par
  dépendances synthétiques déterministes.
- **CORRECTION (vs 2e commit).** Quand le circuit provider est ouvert — ou tout autre readiness NON vert —
  en mode active, la route **NE RETOMBE PLUS** sur le chemin historique : elle **FAIL-CLOSE** (aucun
  provider durci NI historique, réponse sûre honnête `circuit_open`/`config_invalid`/`runtime_disabled`).
  La voie ENTREPRISE en mode active fail-close aussi (hors périmètre servi durci) plutôt que d'appeler le
  provider sans durcissement — jamais un bypass. Off/shadow/kill switch : chemin historique inchangé.

## Pourquoi « ready_for_BLOC14 » et NON « Production validée »
`productionReadyClaim` reste **false** par construction : rien n'est déployé, `active` n'est pas activé en
Production, et les preuves finales E2E (BLOC 14) ne sont pas encore faites. Toutes les capacités
structurantes du BLOC 13 (runtime câblé, readiness fail-closed, config validée, file abortable, budget
total, streaming gaté, pipeline testé, loading observé) sont TERMINÉES localement et vertes.

## POST-BLOC-13 FINAL SYNCHRONIZATION — PASS LOCAL
Merge NON destructif de la lignée distante dans la lignée BLOC 13. Détail machine dans
`CLONECHAT_CURRENT_STATE.json` → `post_bloc13_synchronization`.
- **BLOC 13 final** : `2ff728e9e5ea1605e8ff0b4a3a3c45bdb897dd65`.
- **Tip distant fusionné** : `f1ff2c529ff6d4b804a373dfc638f91a2bec34fc` (chaîne `df8b404f → 61b9e338 → 4a6fa93f → f1ff2c52`).
- **Merge SHA** : `f043ba95df0bb5f79e795631f5ef28e9e1d41d26`, DEUX parents `[2ff728e9, f1ff2c52]`, merge-base `df8b404f`. Un commit docs distinct au-dessus (`docs(clonechat): record post-BLOC-13 final synchronization`). Aucun amend/rebase/force-push.
- **0 conflit** (lignées disjointes). changed-vs-ours = exactement les 15 fichiers distants (Founder Access + vitest.config + Pierre BLOC6). **Aucun fichier BLOC 13 touché** ; aucun chemin interdit ; **aucune nouvelle modif `src/lib/pierre/v1/**` de ma part** (les 2 fichiers Pierre v1 du delta pris byte-faithfully de f1ff2c52, vérifiés).
- **Tests du delta distant** : Founder Access + cognitive **42/42** (proof-of-possession mono-reservationId, no-secret→fail-closed, tamper/replay refusés, TTL, QA token requis, external jamais ciblable par la voie QA, trafficClass `test` serveur-autoritaire, aucun email réel, redirect login `next`) ; Pierre BLOC6 intégration `bloc6-qa-onboarding-mission.itest.ts` **4/4** (mission QA synthétique create→plan→run, documents internes, WAIT approval→approval→completion, idempotence, isolation cross-tenant, hard-floor, aucun email/signature/employé réel, fixture overdue stable).
- **Non-régression** : BLOC 13 **106/106** ; CloneChat lib+route **1609 pass / 10 skips pré-existants** (aucun nouveau skip) ; Analytics/QA **165** ; démo/policy **509** ; **tsc 0 nouvelle** ; **ESLint 0 erreur** sur le delta merge.
- **Build & navigateur** (arbre MERGÉ) : build isolé `.next-hotfix` **exit 0** (compile les nouvelles routes Founder Access) ; tsconfig byte-exact ; Playwright /assistant **6/6** (workers=1) ; onboarding **15/15** ; 4 scripts démo **EXIT 0** (FIRST_SCENE_ALL_PASS / NAV_ALL_PASS / MATRIX_112_112_CLEAN / CH3_INTERACTIVE_ALL_PASS).
- **Rien poussé**, aucun déploiement, aucune variable d'env. Statut inchangé : **READY FOR BLOC 14 FINAL PROOF/E2E — PAS Production validated**. BLOC 14 NON commencé. Push manuel : `git push origin main` (f1ff2c52 → f043ba95).
