# P0.1 — Matrice des appelants et des surfaces réelles

Sweep exhaustif exécuté le 2026-07-24 sur `src/` (grep multi-motifs
`/api/pierre/execute|/api/pierre/action|/api/pierre/run|/api/router`, hors `.next-*`/exports
archivés qui ne sont que des bundles compilés de builds isolés précédents, pas du code source
vivant). L'avertissement du prompt maître est respecté : **l'absence d'appelant frontend n'est
jamais utilisée seule comme preuve de sécurité** — la conclusion de ce document porte
uniquement sur la cartographie des surfaces réellement exposées et de leurs appelants réels.

## Surfaces et appelants réels trouvés

| Surface | Auth | Appelant interne réel trouvé | Appelant externe documenté | Gouvernance au HEAD avant ce bloc |
|---|---|---|---|---|
| `POST /api/pierre/execute` | HMAC signé (`x-client-id`/`x-timestamp`/`x-signature`) | **`GET /api/pierre/tick`** (voir ci-dessous) — appelle `execute` en HMAC auto-signé pour chaque tâche `pierre_queue` verrouillée | `docs/OPS_AUTONOMIE_PIERRE.md` documente `enqueue → tick → execute` comme le pipeline officiel des tâches asynchrones Pierre (email/doc/hris) | **AUCUNE** — confirmé par lecture directe du fichier (ce bloc) |
| `GET /api/pierre/tick` | `?secret=` comparé à `CRON_SECRET` (pas de HMAC, secret partagé en query string — hors périmètre de ce bloc, noté en risque) | Vercel Cron (implicite, non vérifié dans ce bloc — `CRON_SECRET` existe dans `.env.local`) | — | N/A (tick ne fait qu'orchestrer, l'exécution/gouvernance se fait dans `execute`) |
| `POST /api/pierre/action` (P0.2) | HMAC signé, gouvernance via `evaluateLegacyExecuteGovernance` | Aucun appelant interne trouvé dans `src/` | Rapport historique P0.2 : route legacy alternative, même contrat que `execute` | Gouvernée (P0.2, confirmée `*modified`, intacte) |
| `POST /api/router` (P0.2) | — | Aucun appelant interne trouvé dans `src/` | Ancienne route legacy | Neutralisée 410 Gone (P0.2, confirmée `*modified`, intacte) |
| `POST /api/pierre/run` (commit externe) | à vérifier séparément — hors périmètre gouvernance P0.1 (ne fait pas partie des 4 fichiers cœur du prompt), touché uniquement par le refactor lazy-init externe | — | — | Non gouvernée par `legacy-execute-governance` — **non dans le périmètre "ne pas toucher" ni dans le périmètre "à corriger" de ce bloc**, signalé en risque résiduel |

## Détail — `/api/pierre/tick` → `/api/pierre/execute`

`src/app/api/pierre/tick/route.ts` (`GET`, lu en entier ce bloc) :
1. Vérifie `?secret=` contre `CRON_SECRET` (fail-closed si absent/incorrect → 401).
2. Sélectionne jusqu'à `limit` (≤25) tâches `pierre_queue` en statut `queued` et échues, les verrouille (`lock_token`).
3. Pour chaque tâche verrouillée : construit `{client_id, action, payload}` depuis la ligne de queue, **signe lui-même** la requête avec `ROUTER_HMAC_SECRET` (même secret que celui vérifié par `execute`), puis `fetch(`${origin}/api/pierre/execute`, ...)`.
4. Sur échec (`!res.ok || !json?.ok`), la tâche repart en `queued` avec backoff exponentiel (jusqu'à 6 tentatives puis `dead`) ; sur succès, elle passe `done`.

**Conséquence directe pour ce bloc** : `/api/pierre/execute` n'est pas une surface uniquement
théorique réservée à un futur appelant Make/n8n externe — c'est la voie d'exécution réelle et
actuellement câblée de **toutes les tâches asynchrones Pierre** (`email.send`, `doc.generate`,
`hris.sync`) une fois mises en file par le moteur v1/hr. Correction par rapport à un brouillon
antérieur de ce document : le rapport historique `P0_GOVERNANCE_CLOSURE_REPORT.md` (résumé
exécutif, ligne 7 post-supersession) **mentionne effectivement `/api/pierre/tick` comme seul
appelant interne** — cette cartographie n'était donc pas absente, elle est confirmée et
reconduite ici à l'identique après vérification directe du code de `tick/route.ts`. Ce qui
n'était en revanche PAS mappé par le rapport historique, et qui est ajouté ici comme fait
nouveau : `src/app/api/pierre/run/route.ts` boucle également sur `/api/pierre/execute` pour
chaque action produite par `/api/pierre/generate` (pipeline `run → generate → execute`,
potentiellement des actions générées par un modèle) — un second appelant interne réel, distinct
de `tick`, non cité dans le rapport de 2026-07-23.

## Surfaces hors périmètre de ce bloc (rappel, non modifiées)

- `/api/pierre/use/**` (mission/tâche canonique, `execute-task.ts`) — a son propre pipeline de
  gouvernance déjà vérifié dans des blocs antérieurs, non touché ici.
- `/api/cron/pierre*` — politique `service_role`/`allows_service_role`, distincte de `tick`,
  non touchée ici.
- `pierre-route-policy.ts` classe `pierre.execute` en `service_role`/`data_sensitivity:
  "internal"` — cette politique déclarative existe mais **n'est pas elle-même un mécanisme de
  gouvernance CloneGuard/Governance** ; elle documente qui a le droit d'appeler la route, pas ce
  que la route a le droit de faire une fois appelée. Ne pas confondre les deux (le prompt maître
  interdit explicitement de confondre politique d'accès et décision de gouvernance).

## Conclusion de ce phase

Aucune 4ᵉ surface active oubliée n'a été trouvée au-delà des 4 mentionnées par le prompt maître
(`execute`, `action`, `run`, `router`) plus l'appelant interne réel `tick` (qui n'est pas une
5ᵉ surface d'exécution mais un déclencheur de `execute`). `run/route.ts` reste hors du périmètre
de correction gouvernance de ce bloc (il n'est ni l'une des 4 surfaces nommées comme cœur du
correctif, ni référencé par `legacy-execute-governance.ts`) — il est noté dans
`P0_1_REMAINING_RISKS.md` comme risque résiduel à auditer séparément, pas mélangé à la clôture
de `execute`.
