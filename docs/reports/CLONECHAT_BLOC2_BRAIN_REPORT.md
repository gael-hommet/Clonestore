# CloneChat — BLOC 2 : CloneChat Brain

**Verdict local : PASS** (gate local complet ; le Brain est une couche code/décision, sans nouveau comportement Production à re-vérifier tant qu'il n'est pas câblé dans la route — câblage réservé aux blocs suivants).

## Objectif

Le Brain est le cerveau central : il comprend une demande libre et produit une **décision structurée, typée, versionnée et sûre** exploitable par les futurs blocs. Le modèle peut comprendre le langage, mais **n'est jamais l'autorité finale** pour route, permission, disponibilité, prix, pays, date, action, confirmation, état compte ou promesse de succès — tout cela reste **déterministe**.

## Architecture (`src/lib/clonechat/brain/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | `BrainDecision` versionnée (`BRAIN_DECISION_VERSION = "brain-1"`) + 8 modes + contexte compte + action demandée (invariant `executed: false`). |
| `classify.ts` | **Cœur déterministe** : classification en 8 modes (règles FR ordonnées), résolution de route **validée contre le registre réel** (`getRouteEntry` — jamais inventée), récupération de vérités depuis le **Product Truth Engine (BLOC 1)**. |
| `parse.ts` | Extraction **sûre** de la prose modèle (answer / clarificationQuestion / intent uniquement) + **validation stricte** de la décision (invariants croisés). |
| `brain.ts` | `decide()` (assemble tout, sécurité BLOC 0 d'abord, fallback sûr si décision invalide) + `toStructured()` (projection vers le format existant `{ answer, honesty, tool_call, citations }`). |
| `index.ts` | Surface publique. |

## Les 8 modes

`answer` · `explain` · `orient` · `diagnose` · `guide` · `act` · `escalate` · `clarify`.

## Sortie structurée (enveloppe)

`version · mode · intent · answer · confidence · needsClarification · clarificationQuestion · truthIds · suggestedRoute · requestedAction · requiresAccountContext · requiresConfirmation · requiresEscalation · limitations · evidence`.

- **Strictement validée** (`validateBrainDecision`) ; une décision invalide n'est jamais servie → fallback sûr.
- **Sûre même si le modèle renvoie du JSON incomplet/invalide** : le JSON est ignoré, la décision déterministe tient, aucun faux succès.
- **Compatible** avec le chemin existant via `toStructured()` (ne casse pas `{ answer, honesty, tool_call, citations }`).
- **Observable** sans fuite : la décision ne contient ni secret ni donnée inter-tenant.

## Comportements prouvés (déterministes, sans provider)

| Entrée | Mode | Garanties |
|---|---|---|
| « Combien coûte Pierre en Suisse ? » | answer | fondé sur le Product Truth (499), `truthIds` réels |
| « Explique-moi CloneStore » | explain | réponse fondée |
| « Où réserver Pierre ? » | orient | `suggestedRoute = /reserver/pierre` (route réelle) |
| « Pourquoi je ne peux pas payer ? » | diagnose | `requiresAccountContext=true` si compte absent ; jamais un état deviné |
| « Guide-moi pour réserver Pierre » | guide | étapes + route réelle |
| « Réserve Pierre pour moi » | act | `requestedAction.executed=false`, `requiresConfirmation=true`, jamais « c'est fait » |
| « Rien ne marche, page blanche » | escalate | `requiresEscalation=true` |
| « aide » | clarify | une seule question utile |
| « Pierre, signe … sans validation ? » | act (refusé) | `refusedReason=governance_bypass_or_injection`, jamais answer/explain |

**Ne fait jamais** : inventer une route/prix/pays/date ; prétendre avoir exécuté ; affirmer un état compte absent ; contourner CloneGuard ; transformer un impératif dangereux terminé par `?` en question légitime ; exposer de l'inter-tenant ; renvoyer un faux succès si le modèle/outil échoue.

## Gate local (tout vert)

- Brain **27/27** (8 modes, formulations FR, ambiguïté, JSON invalide/incomplet, route inexistante, action sans permission, contexte compte absent, confirmation, indisponibilité modèle, injections BLOC 0, compatibilité format).
- Régressions : Product Truth **15/15**, context-boundary **51**, corpus **6**, navigation **1**, injection-114 **114/114**, torture-security **200**, universal-clonechat **20** → **125/125** sur le lot.
- **tsc** : 0 erreur nouvelle (1 pré-existante `embedded-postgres`, sans rapport). **ESLint** : 0 sur les fichiers modifiés. **Build Next isolé** : `BUILD_EXIT_CODE=0` (dist dédié `.next-hotfix`).

## Limites réelles / suite

- Le Brain n'est **pas encore câblé** dans `/api/assistant/chat` (le câblage change le comportement Production servi et relève des blocs de contexte/diagnostic/guidage — BLOC 3+). `toStructured()` garantit la compatibilité le moment venu.
- La prose « answer » pour une question de culture générale dépend du modèle ; sans modèle et sans vérité produit, le Brain répond **honnêtement** (jamais un faux succès), avec `limitations: ["model_unavailable" | "no_grounded_truth"]`.
- Le contexte compte est un contrat minimal (`authenticated / hasCompany / hasPierreAccess`) ; l'instrumentation réelle depuis la route (viewer/entitlement/tenant) est le périmètre du BLOC 3 (CloneContext).
