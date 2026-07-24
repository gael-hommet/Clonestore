# P0.2 — Matrice de tests

24 tests réels ajoutés (9 intégration `/api/pierre/action` + 3 intégration `/api/router` + 3 transversaux `/api/pierre/**` + 8 unitaires P0.1 réutilisés tels quels par la gouvernance partagée + 1 lecture de source), tous verts. `fetch` global mocké pour lever une exception s'il est appelé — jamais invoqué dans aucun scénario.

## `/api/pierre/action` — `src/app/api/pierre/action/__tests__/p0-2-governance-closure.test.ts`

| ID | Entrée | Résultat attendu | Résultat obtenu | Appel externe | Verdict |
|---|---|---|---|---|---|
| A1 | Sans token | 401 | **401** | 0 | ✅ |
| A2 | Token invalide | 401 | **401** | 0 | ✅ |
| A3 | Utilisateur sans Pierre actif (`orders` vide) | 403 | **403** | 0 | ✅ |
| A4 | `email.send`, payload valide | DENY (403), jamais envoyé | **403, decision="DENY"** | **0** | ✅ |
| A5 | `doc.generate`, contenu bénin `P0_2_GOVERNANCE_TEST` | REQUIRE_APPROVAL (202), aucune publication | **202, decision="REQUIRE_APPROVAL"** | **0** | ✅ |
| A6 | `action_type` invalide (`hris.sync`, non supporté par cette route) | 400, fail-closed (comportement pré-existant) | **400** | 0 | ✅ |
| A7 | Replay `request_id` déjà journalisé `ok:true` | résultat en cache, pas de ré-exécution | **200, idempotent:true, pdf_url du cache** | 0 | ✅ |
| A8 | Double requête simultanée, même `request_id`, pas encore en cache | aucune exécution externe dans les deux cas | les deux réponses ≠200, **0 appel** | 0 | ✅ |
| A9 | `GET` (endpoint de statut, config webhook) | reste fonctionnel, n'appelle jamais Make | **200/500 selon fixture, 0 appel fetch** | 0 | ✅ |

## `/api/router` — `src/app/api/router/__tests__/p0-2-router-neutralized.test.ts`

| ID | Entrée | Résultat attendu | Résultat obtenu | Appel externe | Verdict |
|---|---|---|---|---|---|
| R1 | `POST` (tout corps) | 410 Gone | **410** | 0 | ✅ |
| R2 | `GET` | 410 Gone | **410** | 0 | ✅ |
| R3 | Lecture du code source | ni URL Make, ni `.from("api_tokens")`, ni `.from("agents_owned")`, ni `createClient` | **confirmé absent** | — | ✅ |

## Tests transversaux — `src/lib/pierre/__tests__/p0-transversal-consistency.test.ts`

| ID | Scénario | Résultat attendu | Résultat obtenu | Verdict |
|---|---|---|---|---|
| T1 | `email.send` évalué via le même module de gouvernance, comme le ferait `/api/pierre/execute` et `/api/pierre/action` | décision identique (DENY) sur les deux chemins | **DENY == DENY** | ✅ |
| T2 | `hris.sync` évalué de façon identique | jamais ALLOW sur aucun chemin | **confirmé** | ✅ |
| T3 | `/api/router` reçoit une requête | 410 inconditionnel, aucune branche d'exécution d'action Pierre n'existe même en théorie | **410** | ✅ |

## Non-régression (suites existantes, exécutées en direct)

| Suite | Fichiers | Tests | Résultat |
|---|---|---|---|
| `src/lib/pierre/**` (moteur v1/hr complet + P0.1 + P0.2 unitaires/transversaux) | 121 (+1 skip pré-existant) | 5392 | ✅ tous verts |
| `src/app/api/pierre/**` (toutes routes API Pierre, dont `/execute` P0.1 et `/action` P0.2) | 13 | 220 | ✅ tous verts |
| `src/app/api/router/**` | 1 | 3 | ✅ tous verts |
| **Total du sweep combiné** (`src/lib/pierre` + `src/app/api/pierre` + `src/app/api/router`) | 135 | 5615 (+1 skip) | ✅ **0 échec** |

## Ce qui n'a pas été testé (limites explicites)

- Un appelant externe réel historique de `/api/router` (impossible à vérifier depuis le code seul — voir P0_2_REMAINING_EXECUTION_RISKS.md).
- Le comportement réel si `/api/pierre/action` est un jour appelée par un vrai composant frontend retrouvé ultérieurement — la fermeture actuelle bloque déjà toute action, donc aucune régression de sécurité possible, mais l'expérience utilisateur (si un appelant existe) n'a pas pu être testée en conditions de navigateur réel dans ce bloc (backend/tests uniquement, conformément au périmètre demandé).
