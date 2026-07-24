# P0.2 — Inventaire des appelants

Méthode : grep exhaustif du chemin littéral (`/api/pierre/action`, `/api/router`) sur `src/`, `scripts/`, `docs/` (hors `.next-*`, `node_modules`, dossiers de preuves). Le hook projet impose graphify avant tout grep massif ; le graphe de symboles de graphify n'indexe pas les chemins de route HTTP eux-mêmes (confirmé lors de P0.1 et re-confirmé ici), donc l'inventaire des appelants de routes repose sur `grep`/lecture directe, comme en P0.1.

## `/api/pierre/action`

| Appelant | Route appelée | Action | Utilisation réelle | Tenant | Auth | Statut |
|---|---|---|---|---|---|---|
| `docs/PIERRE_BACKEND_STATUS_2026-05-09.md` | `/api/pierre/action` (GET/POST) | email/doc | Documentation interne uniquement — décrit la route comme "Make webhook bridge", `Bearer(user)+hasPierreAccess`, "✓ Protégé" | — | — | Documentaire, pas un appelant exécutable |
| `docs/PIERRE_HR_ENGINE_FOUNDATION.md` | mention du concept | — | Documentation de fondation | — | — | Documentaire |
| **Aucun composant React, hook, ou script** | — | — | **0 résultat** pour le chemin littéral dans tout `src/` et `scripts/` | — | — | **Aucun appelant produit actuel identifié** |

**Nuance importante (conforme à la consigne "ne conclus pas qu'une route est morte uniquement parce qu'aucun appelant frontend n'est trouvé")** : cette route utilise un modèle d'authentification MODERNE et cohérent avec le reste du produit (Bearer Supabase réel, `hasPierreAccess` sur la table `orders` — la même table d'entitlement canonique utilisée ailleurs dans le produit, pas une table legacy), avec support d'identité d'expéditeur, de pièces jointes, et de journalisation détaillée (`agent_history`). Ce degré de soin ne correspond pas au profil d'un code mort oublié — il est plus probable qu'un appelant existe ou ait existé côté client via un mécanisme non capturé par un grep littéral (ex. une future intégration, un appel construit dynamiquement, ou un appelant retiré du frontend sans que la route backend soit nettoyée). **Traité par précaution comme "appelant non vérifiable" plutôt que "mort"** — d'où le choix de l'Option B (adaptateur fin) et non la suppression.

## `/api/router`

| Appelant | Route appelée | Action | Utilisation réelle | Tenant | Auth | Statut |
|---|---|---|---|---|---|---|
| **Aucun** | — | — | `grep -r "/api/router" src/ scripts/ docs/` → **1 seul résultat : le fichier lui-même** | — | — | **Aucun appelant interne, aucun script, aucun test, aucune documentation** |

**Éléments supplémentaires soutenant la conclusion "code mort en pratique"** (au-delà de l'absence de grep, conformément à la consigne de ne pas s'arrêter à ce seul critère) :
- Son mécanisme d'auth repose sur une table `api_tokens` **absente de toutes les migrations suivies** (`grep -r "api_tokens" supabase/migrations/` → 0 résultat) — dans un environnement provisionné uniquement via les migrations versionnées, cette table n'existe pas, donc **tout appel échouerait systématiquement à l'étape d'authentification**, qu'un appelant existe ou non.
- Son URL de webhook Make est **codée en dur** dans le fichier (pas une variable d'env) — signe d'un prototype ancien jamais industrialisé, cohérent avec son absence de la liste des endpoints connus dans `src/app/api/pierre/route.ts` (qui ne mentionne que `/execute`, `/run`, `/tick`, `/enqueue`, `/generate`).
- Son modèle d'entitlement (`agents_owned`, clé `client_id`+`agent_name`) diverge du modèle utilisé partout ailleurs dans le produit actuel (`orders`, clé `user_id`+`agent_slug`) — signe d'une génération de code antérieure à la tenue actuelle du produit.

## Scripts et tests

`grep -r "api/router\|api/pierre/action" scripts/` → 0 résultat (contrairement à P0.1 où `scripts/pierre-send.mjs` et `scripts/pierre_test_hmac.mjs` appelaient réellement `/api/pierre/execute`). Aucun script de développement ne cible ces deux routes.

## Conclusion de cartographie

- `/api/pierre/action` : appelant produit non confirmé mais non exclu → **Option B** (préserver le contrat, gouverner l'exécution).
- `/api/router` : aucun appelant interne, backend d'authentification probablement non provisionné → **Option A** (neutralisation 410, sans suppression du fichier pour rester réversible et donner un signal HTTP explicite à un éventuel appelant externe historique).
