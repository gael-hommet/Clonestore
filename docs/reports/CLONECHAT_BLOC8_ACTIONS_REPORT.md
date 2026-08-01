# CloneChat — BLOC 8 : CloneActions (exécution contrôlée)

**Verdict local : PASS.** CloneActions est la couche d'**exécution contrôlée** au-dessus de
**Brain → CloneContext → Diagnosis → CloneGuide → CloneVoice → CloneCare**. CloneChat ne peut réaliser QUE des actions **simples, réelles, autorisées et explicitement contrôlées** : registre canonique, validation stricte, permissions & tenant réels, confirmation liée, **CloneGuard avant toute exécution**, idempotence, annulation, échecs honnêtes, **CloneTrace sûr**. Aucun faux succès, aucune exécution inventée par le modèle, **aucune mutation métier**.

## Réutilisation de l'existant (pas de couche parallèle)
- **`durable/idempotency-store.ts`** : contrat `IdempotencyStore` (`claim`/`commit`/`fail`) + `createInMemoryIdempotency` — **réutilisé**.
- **CloneCare BLOC 7** : `redactText` (redaction déterministe), `buildTicketDraft`/`submitTicket`/`SupportTicketProvider`/`createTicketDeduper` — **réutilisés**.
- Le chemin **P9.4 legacy** (`action-policy.ts`, `tool-executor.ts` — actions métier `create_mission`… déjà marquées supersédées) **n'est pas touché** : CloneActions a son propre namespace `actions/` et n'entre pas en collision.

## Architecture (`src/lib/clonechat/actions/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | Cycle de vie versionné (`actions-1`, `guard-1`, `confirm-1`, `trace-1`) : requête, définition, args validés, autorisation, résultat Guard, confirmation liée, clé d'idempotence, plan immuable, résultat, CloneTrace. États : requested/planned/blocked/awaiting_confirmation/confirmed/executing/succeeded/failed/cancelled/duplicate. |
| `registry.ts` | **Registre canonique** : 7 entrées, chacune prouvée par une capacité réelle (provenance) ; validateurs d'arguments stricts. |
| `keys.ts` | Clés déterministes (hash FNV) : normalisation d'args, clés viewer/tenant sûres, planHash, clé d'idempotence. |
| `confirmation.ts` | Confirmation **liée exactement** (action/args/viewer/tenant/planHash), **limitée dans le temps**, **usage unique**, invalidée si le plan change. |
| `guard.ts` | **CloneGuard** déterministe (phase plan + phase exécution). |
| `adapters.ts` | Adaptateurs d'exécution **sûrs et non destructifs** ; disponibilité runtime ; jamais de faux succès. |
| `trace.ts` | **CloneTrace** immutable & redigé (via CloneCare). |
| `plan.ts` | `planAction` (phase 1, n'exécute rien) + `executeAction` (phase 2, contrôlée). |
| `actions-with-context.ts` | `decideDiagnoseGuideCareAndPlanAction` + `executeControlledAction` + `planActionFromVoiceResult`. |

## Registre (périmètre initial SÛR)
`navigate` · `recommend_route` · `prepare_ticket` · `submit_ticket` (write, confirmation + idempotence, provider abstrait) · `prepare_retry` · `prepare_governed_request` (prépare pour **validation humaine future**, aucun effet) · `prepare_pierre_mission` **déclarée NON DISPONIBLE** (mutation métier → refus explicite, jamais exécutée).
Les mutations métier (mission Pierre, RH, signature, licenciement, recrutement, paiement, commande, modification user/tenant, migration, banque) sont **absentes du registre** (→ inconnues) ou **déclarées non disponibles** — jamais exécutées.

## CloneGuard (avant toute exécution, déterministe)
sécurité (refus jamais exécuté) · action connue · disponible · arguments valides · route réelle · viewer réel · tenant réel + isolation (absent vs invalide) · entitlement réel · permission (rôle) · adaptateur connu (statique) + **disponible (runtime)** · confirmation **liée exactement**, non expirée, non réutilisée. Le modèle ne peut **jamais** ajouter une permission, diminuer le risque, désactiver une confirmation, changer le tenant, choisir le succès, inventer un adaptateur, contourner Guard, ni transformer un refus en action.

## Confirmation
Explicite, limitée dans le temps (TTL injecté), **non réutilisable** (registry d'usage), liée au viewer + tenant + id d'action + arguments normalisés (via `planHash`). Invalidée si le plan change. Refusée si absente / expirée / réutilisée / non liée → codes `CONFIRMATION_MISSING|EXPIRED|REUSED|MISMATCH`. Aucun « oui » ambigu ne confirme une autre action ou des arguments modifiés.

## Idempotence
Toute action à effet (`submit_ticket`) a une **clé déterministe** scopée par action + args normalisés + viewer + tenant + version. Deux exécutions identiques ne produisent jamais deux effets : la seconde renvoie `duplicate` **sans rejouer l'adaptateur** (réutilise `IdempotencyStore.claim`). Prouvé : provider appelé **une seule fois**.

## CloneTrace (immutable, sûr)
traceId · actionId+version · horodatage **injecté** (testable) · viewer (clé sûre) · tenant (clé scopée) · décision Guard · confirmation (id/hash, jamais un secret) · clé d'idempotence · transitions d'état · adaptateur · résultat observable · erreur sûre · statut final. Interdits appliqués (via redaction CloneCare) : token, cookie, clé API, secret, header d'auth, autre tenant, **audio brut, transcript vocal complet**, stack trace brute, PII inutile.

## Intégration
`decideDiagnoseGuideCareAndPlanAction(input, ctx, {actionRequest?})` (phase 1) : comprend → contexte → diagnostic → guide → Care → résout une action réelle → CloneGuard → **plan ou demande de confirmation, sans rien exécuter**. `executeControlledAction(plan, exec)` (phase 2) : revérifie contexte + confirmation + idempotence → **appelle uniquement l'adaptateur enregistré** → CloneTrace → résultat honnête. Sortie additive : décision Brain, CloneContext, diagnostic, guide, Care, ticket, **plan d'action, résultat Guard, résultat d'exécution, CloneTrace**, `structured` **inchangé**. `planActionFromVoiceResult(voiceResult, request)` consomme un résultat vocal sécurisé **sans recopier audio ni transcript**. **Aucun effet externe Production réel câblé** (providers mockés).

## Gate local (tout vert)
- CloneActions **40/40** ; régressions **297/297** (care 30, voice 32, transcribe 6, guide 25, diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, injection-114 114/114, universal-clonechat 20).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 sur `src/lib/clonechat/actions/` · **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.
- Correction pendant le gate : import de `ConfirmationToken` depuis `./types` (et non `./confirmation`).

## Limites honnêtes / suite
- `decideDiagnoseGuideCareAndPlanAction` + `executeControlledAction` **non câblés** comme comportement Production servi ; **aucun effet externe réel** (support provider abstrait + mock). Les mutations métier restent hors périmètre (déclarées non disponibles / absentes).
