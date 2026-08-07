# CloneChat — BLOC 13 : Production Hardening & Runtime Readiness

**Verdict local : BLOC 13 PASS — READY FOR BLOC 14 FINAL PROOF/E2E.** Ce bloc transforme l'ensemble
BLOC 0→12 en un runtime CloneChat *production-hardened*, fail-closed, borné et observable — **sans
prétendre qu'il est déjà déployé ou validé Production**. Il n'active RIEN de nouveau en Production : le
mode par défaut est `off` (comportement historique strictement inchangé) et le verdict honnête est
uniquement « prêt pour les preuves finales du BLOC 14 », jamais « Production validée ».

- **Parent** : `743dc9783f3575bb64a70b037eda5d87622f559d` (docs du merge Analytics/QA — gate final de
  synchronisation). *Note : `origin/main` distant est encore à `df8b404f` au moment de ce bloc (le push
  de 743dc978 n'a pas encore atterri côté remote) ; BLOC 13 est construit sur le HEAD local correct.*
- **Nouveau module** : `src/lib/clonechat/hardening/` + adaptateur ADDITIF dans `/api/assistant/chat`.

## Fichiers
| Fichier | Rôle |
|---|---|
| `src/lib/clonechat/hardening/types.ts` | Contrat TYPÉ/VERSIONNÉ (`hardening-1`) : modes, taxonomie d'erreurs, limites, budgets, concurrence, retry, circuit, actions, readiness. |
| `src/lib/clonechat/hardening/config.ts` | Constantes canoniques + parseur SERVEUR strict (entiers bornés). Mode `off` par défaut ; kill switch prioritaire ; effet de mode. Aucun input utilisateur ne modifie la politique. |
| `src/lib/clonechat/hardening/errors.ts` | Taxonomie d'erreurs SÛRE + mapping HTTP + `toSafeError` (ne divulgue jamais stack/secret/SQL/chemin/tenant). |
| `src/lib/clonechat/hardening/limits.ts` | Enforcement déterministe des limites d'entrée + bornage de sortie (troncature honnête). |
| `src/lib/clonechat/hardening/timeout.ts` | `withTimeout` (timeout DUR + AbortSignal chaîné) + `withBoundedRetry` (borné, jamais infini, aucune duplication d'effet non idempotent). |
| `src/lib/clonechat/hardening/circuit-breaker.ts` | Circuit breaker déterministe (temps injecté) closed/open/half_open + registre isolé PAR provider. |
| `src/lib/clonechat/hardening/concurrency.ts` | Concurrence + backpressure bornées, plafond PAR TENANT, file bornée, nettoyage systématique. |
| `src/lib/clonechat/hardening/readiness.ts` | Readiness Gate déterministe → `ready_for_b14` / `degraded` / `blocked` (raisons exactes) ; `productionReadyClaim` TOUJOURS false ; `active` autorisé seulement si vert. |
| `src/lib/clonechat/hardening/runtime.ts` | Orchestrateur `guard()` : off passthrough / shadow observe-only / active enforce (limites → concurrence → timeout) ; ne lève jamais ; erreurs → SafeError. |
| `src/lib/clonechat/hardening/observe.ts` | Corrélation OPAQUE/pseudonymisée + champs de log SÛRS (aucune donnée sensible). |
| `src/lib/clonechat/hardening/chat-precheck.ts` | Adaptateur ADDITIF `/api/assistant/chat`, `off` par défaut (jamais bloquant en off/shadow). |
| `src/lib/clonechat/hardening/index.ts` | Surface publique. |
| `src/lib/clonechat/hardening/__tests__/hardening.test.ts` | Suite BLOC 13 (56 tests déterministes). |
| `src/app/api/assistant/chat/route.ts` | **Intégration ADDITIVE minimale** : import + une garde `hardeningChatPrecheck` après le parse du corps (retour immédiat non bloquant en off/shadow). |
| `e2e/clonechat-assistant-hardening.spec.ts` | Preuve navigateur /assistant (desktop/iPhone/Android), backend synthétique (aucun appel payant). |

## Modes de runtime
`off` (défaut, y compris Production) → **passthrough** : aucun comportement BLOC 13 ne change la réponse
servie. `shadow` → **observation read-only** : le pipeline stable s'exécute inchangé ; les vérifications
tournent en observe (jamais bloquantes) ; **aucun effet externe, aucune mutation, aucune création de
mission, aucune confirmation implicite, aucun résultat shadow substitué** à la réponse utilisateur.
`active` → **enforcement**, accepté **uniquement** si le readiness gate est vert ; **jamais activé en
Production dans ce bloc**. **Kill switch serveur PRIORITAIRE** (`CLONECHAT_HARDENING_KILL_SWITCH`) : force
le passthrough instantanément, même en `active`. Valeurs par défaut : `CLONECHAT_HARDENING_MODE` absent →
`off` (fail-closed sur toute valeur inconnue).

## Limites (valeurs par défaut canoniques)
message ≤ 8 000 car · historique ≤ 40 messages / 60 000 car · pièces jointes ≤ 4, ≤ 6 Mo chacune / 6 Mo
cumulés (aligné sur la route) · corps ≤ 10 Mo · sortie ≤ 24 000 car (tronquée honnêtement). Overrides
SERVEUR bornés uniquement ; toute limite dépassée → **erreur structurée sûre** (jamais un crash/attente
infinie). Aucune limite inventée pour une capacité inexistante.

## Timeouts / annulation / retry
Budgets : total 60 s, provider 45 s, transcription 30 s, TTS 20 s, Inspector 15 s. `withTimeout` avorte
via AbortSignal (chaîné au signal parent, ex. déconnexion client) → `timeout` ; parent avorté →
`cancelled`. `withBoundedRetry` : borne DURE (`maxRetries+1` tentatives), **aucune relance d'une
opération non idempotente** (fail-closed contre la duplication d'effet), fallback documenté.

## Circuit breakers
Par provider (isolés) : `failureThreshold` 5, `cooldownMs` 30 s, `halfOpenMaxProbes` 1. Un circuit OUVERT
**refuse vite** (`circuit_open`) et ne devient JAMAIS une permission d'inventer une réponse — l'appelant
doit renvoyer un fallback sûr. Cycle testé : sain → échecs → open → refus rapide → cooldown → half_open →
récupération → closed (et échec en half_open → ré-ouverture), isolation inter-providers.

## Backpressure & concurrence
Global `maxConcurrent` 24, `maxQueue` 48, `perTenantMaxConcurrent` 6. File pleine ou plafond tenant
dépassé → `concurrency_limited` (jamais d'attente infinie) ; **aucune fuite/famine entre tenants** ; slot
TOUJOURS rendu (résolution, rejet, timeout ou abort). Testé avec dépendances synthétiques (aucune charge réelle).

## Taxonomie d'erreurs
`invalid_request` 400 · `unauthorized` 401 · `tenant_required`/`forbidden` 403 · `payload_too_large`/
`message_too_long`/`history_too_long`/`too_many_attachments`/`attachment_too_large` 413 · `rate_limited`/
`concurrency_limited` 429 · `timeout` 504 · `provider_unavailable`/`circuit_open`/`runtime_disabled` 503 ·
`cancelled` 499 · `dependency_failure` 502 · `config_invalid`/`output_too_large`/`internal_safe_error` 500.
Le client ne reçoit JAMAIS : stack, secret, token, cookie, clé, SQL, chemin interne, prompt système,
payload provider brut, donnée d'un autre tenant (`toSafeError` + messages génériques + redaction).

## Comportement /api/assistant/chat
Intégration **ADDITIVE, feature-gated, `off` par défaut** : après le parse du corps, une garde
`hardeningChatPrecheck` est appelée. En `off`/`shadow`/kill switch (défaut, y compris Production) elle
retourne immédiatement **non bloquant** — le comportement historique de la route (auth fail-closed,
budget atomique, injection, rate limit anonyme, streaming, fallback déterministe, no-store) est
**strictement inchangé**. En `active` UNIQUEMENT (jamais activé en Production dans ce bloc) elle applique
les limites d'entrée canoniques et renvoie une erreur structurée sûre. Aucun provider ajouté, aucune
mission Pierre réelle, aucune mutation RH, aucun flag activé en Production, aucune modification Vercel.

## Protections tenant/auth, privacy
Tenant/auth : le runtime durci ne relâche AUCUNE garde existante ; le viewer ne choisit jamais son
tenant (résolu serveur), le contexte privé et l'action restent des privilèges, la confirmation reste
requise, une mission préparée ne devient jamais exécutée. Privacy : corrélation **opaque/pseudonymisée**
uniquement (`hz_…`), champs de log restreints à des statuts/compteurs ; aucun message/réponse/transcript/
audio/binaire/token/cookie/Authorization/clé/e-mail/id brut/stack.

## Analytics (garanties BLOC 12 + bloc distant préservées)
Une panne Analytics ne casse jamais CloneChat (fail-open ; readiness le vérifie). Aucune fausse
livraison, `partial` honnête, comptes cohérents, produit opt-in. Les DEUX couches distinctes sont
intactes : `src/lib/clonechat/analytics/**` (BLOC 12) et `src/lib/analytics/**` (canonique/QA distant) —
aucune n'est modifiée par ce bloc. Bloc QA distant préservé : toggle propriétaire OFF par défaut,
`test` seulement si demandé, bot/automated toujours exclus, réservation QA server-secret-only, aucun email QA.

## Tests exacts
- **Suite BLOC 13** : `src/lib/clonechat/hardening/__tests__/hardening.test.ts` = **56/56** (config
  valide/invalide, mode absent→off, kill switch, shadow read-only, active refusé si readiness rouge,
  active local si vert, body/message/historique/pièces jointes oversized, timeout total/provider, abort,
  retry borné (idempotent vs non), circuit breaker (cycle complet + isolation), backpressure/concurrence/
  tenant, provider unavailable, analytics fail-open (readiness), erreurs HTTP sûres, redaction de secret,
  déterminisme, l'input ne reconfigure jamais le runtime, comportement `off` inchangé).
- **Régressions séquentielles** (`--no-file-parallelism --maxWorkers=1`) : CloneChat Analytics **87/87** ;
  passe CloneChat **529/529** (19 fichiers, dont `universal-clonechat` qui exerce la route servie —
  inchangée en `off`) ; Analytics/QA canonique **161/161** + route QA synthétique **4/4** ; démo + policy
  navigateur **509/509**. Aucun test existant supprimé.
- **TypeScript** global : 0 erreur nouvelle (1 pré-existante `embedded-postgres`). **ESLint** : 0 erreur
  (hardening + route ; 2 warnings PRÉ-EXISTANTS `no-console` dans la route, non introduits par ce bloc).

## Build & navigateur
- **Build Next isolé** `.next-hotfix` : **BUILD_EXIT_CODE=0** réel (194 pages).
- **Playwright /assistant** (desktop/iPhone/Android), backend **synthétique** (POST chat intercepté →
  réponse JSON, aucun appel payant, aucun effet réel) : rendu, saisie, envoi, résultat sûr, erreur
  provider 503 CONTRÔLÉE (aucun crash, UI réutilisable), accessibilité clavier, aucune fuite, **0
  pageerror / 0 HTTP 5xx / 0 erreur console inattendue** (les 429 télémétrie facultatifs restent comptés
  à part). CloneChat onboarding **15/15** (rend /assistant + 4 autres sur 3 viewports). Les **4 scripts
  démo officiels** (`demo-first-scene`, `demo-nav-check`, `demo-visual-matrix` → `MATRIX_112_112_CLEAN`,
  `demo-ch3-interactive`) finissent **EXIT 0** (le hardening n'a rien cassé). Tous ces résultats sont
  RÉELS et confirmés sur build frais, serveur arrêté proprement, `.next-hotfix` supprimé, artefacts
  Playwright (`test-results/`) supprimés, `tsconfig.json` rétabli byte-exact (`8a88b0410a539280`).

## Limites restantes (honnêtes, pour le BLOC 14)
- Le mode `active` n'est **jamais** activé en Production ici ; il est prouvé LOCALEMENT (mocks/injections).
  Son intégration profonde dans le flux streaming réel de la route (au-delà de la garde d'entrée
  additive) et les preuves E2E de bout en bout restent au **BLOC 14**.
- Le circuit breaker / la concurrence / le retry sont fournis comme bibliothèque déterministe prête ;
  leur câblage autour des appels provider RÉELS de la route (streaming) est déféré au BLOC 14 pour éviter
  un changement Production risqué (adaptateurs prêts + readiness gate en place).
- Aucune preuve de charge réelle (interdit : dépendances synthétiques uniquement en local).

## Pourquoi « ready_for_BLOC14 » et NON « Production validée »
Le readiness gate est vert (garanties de config + architecture), mais `productionReadyClaim` reste
**false** par construction : rien n'est déployé, `active` n'est pas activé en Production, et les preuves
finales E2E (BLOC 14) ne sont pas encore faites. Le verdict honnête de ce bloc est donc uniquement :
**prêt pour les preuves finales / E2E du BLOC 14**.
