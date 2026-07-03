# P9.4.1 — Durable atomic budget governance

**Avant (P9.4)** : Array in-memory par processus ; `check → (await) → record` NON
atomique (deux requêtes concurrentes pouvaient dépasser ensemble un plafond) ; perdu au
restart ; non multi-instance. **Après (P9.4.1)** : ledger Postgres ATOMIQUE, multi-
instance, survivant au restart.

## Schéma + fonctions (`supabase/migrations-p941/*.sql`)
- `clonechat_budget_counters (scope_key pk, window_kind, committed_tokens, reserved_tokens)`.
- `clonechat_usage_events` — comptabilité par requête.
- `clonechat_budget_try_reserve(scopes[], kinds[], caps[], tokens)` — insère+**verrouille
  toutes les lignes FOR UPDATE**, **re-vérifie chaque plafond sous verrou**, réserve si et
  seulement si TOUS passent → deux transactions concurrentes (même sur deux instances) ne
  peuvent JAMAIS dépasser ensemble un plafond.
- `clonechat_budget_commit(scopes, reserved, actual)` / `clonechat_budget_release(scopes, reserved)`.

## Cycle (route `chat`)
`RESERVE(worst-case = est + maxOutput)` AVANT tout appel → OpenAI → `COMMIT(réel)` +
release du surplus | `RELEASE` si panne/abort. Dimensions : user/day, company/day,
global/day, global/month. Refus honnête (`request_too_large` / `user_daily` / …) sans
exposer de montant interne.

## Repli in-memory (`budget-memory.ts`)
Implémente la même interface `DurableBudget` ; la réservation est SYNCHRONE (avant tout
`await`) → corrige le défaut atomique de P9.4 même sans DB (mais reste non
durable/non multi-instance — la vraie DB est requise pour ces garanties).

## Discipline de coût (§15) — inchangée
Aucun appel au chargement/polling ; retrieval avant modèle ; top-k réduit ; output court ;
vision `detail:low` ; une seule réparation ; pas d'agent-loop. `gpt-4o-mini` par défaut.

## Preuves
- SQL : `budget-concurrency.json` — cap 1000, 20 réservations concurrentes de 300 → **exactement 3 accordées** (900 ≤ 1000), jamais dépassé.
- Repo : `clonechat-durable.itest.ts` — reserve/commit/release + refus honnête `user_daily`.
- In-memory : `tool-executor-p941.test.ts` — atomicité intra-process + release.
- Restart : `restart-proof.json` — compteurs réservés intacts après restart PG.
