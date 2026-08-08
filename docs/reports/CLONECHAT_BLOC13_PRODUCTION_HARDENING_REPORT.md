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
- **Commit correctif final (CE commit)** : `fix(clonechat): close BLOC 13 real runtime hardening gate`, parent DIRECT `97e3b69f`. Le commit `97e3b69f` est CONSERVÉ intégralement ; ce correctif est un nouveau commit enfant (sans amend).
- **Git remote** : `origin/main` distant réel = `4a6fa93f1369ac039b52c5731b701438bf6e5b72` (lecture autoritative `git.listServerRefs` — origin a ENCORE avancé, indépendamment ; ni fetché ni mergé ni poussé ici). Le BLOC 13 est construit localement sur `97e3b69f`.

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
- **Suite BLOC 13 = 61** : hardening unité **39/39**, streaming **10/10**, pipeline **8/8**, route active **4/4** (> 56 précédents).
- **CloneChat** : passe 19 fichiers **529/529** (dont `universal-clonechat` = chemin servi OFF inchangé) ; Analytics CloneChat 87/87 inclus.
- **Analytics/QA canonique** **161/161** + route QA **4/4** = **165/165** (les skips observés en co-exécution étaient une contention DB inter-session ; 0 échec ; verts en ré-exécution).
- **Démo + policy navigateur** **509/509**.
- **TypeScript** global : 0 erreur nouvelle (1 pré-existante `embedded-postgres`). **ESLint** : 0 erreur (2 warnings PRÉ-EXISTANTS `no-console` dans la route, non introduits).

## Build & navigateur (build FRAIS, aucun appel payant)
- **Build Next isolé** `.next-hotfix` : **BUILD_EXIT_CODE=0** réel.
- **Playwright /assistant** desktop/iPhone/Android **5/5** : rendu, saisie, **loading OBSERVÉ** (bouton Interrompre avant résultat), résultat via le VRAI protocole event-stream, **interruption** (UI réutilisable), **erreur 503 contrôlée**, a11y clavier, aucune fuite, 0 pageerror / 0 hydration / 0 HTTP 5xx / 0 erreur console inattendue (429 télémétrie facultatifs comptés à part). Backend SSE synthétique.
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
- Le chemin actif se retire (readiness degraded) quand le circuit provider est ouvert : c'est le
  comportement fail-closed voulu (le circuit protège pendant la phase active ; une fois ouvert, la route
  retombe sur le chemin historique existant, lui-même sûr).

## Pourquoi « ready_for_BLOC14 » et NON « Production validée »
`productionReadyClaim` reste **false** par construction : rien n'est déployé, `active` n'est pas activé en
Production, et les preuves finales E2E (BLOC 14) ne sont pas encore faites. Toutes les capacités
structurantes du BLOC 13 (runtime câblé, readiness fail-closed, config validée, file abortable, budget
total, streaming gaté, pipeline testé, loading observé) sont TERMINÉES localement et vertes.
