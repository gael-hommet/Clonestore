# P9.4.1 — Governed tool coverage

**Avant (P9.4)** : 1/16 outil réellement branché (`create_mission`) ; `decide_validation`
/`cancel_mission` déclarés mais tombaient en `unsupported_kind`. **Après (P9.4.1)** :
registre avec champ `availability` (`wired`/`advisory`/`unavailable`) + **honnêteté
appliquée** (un outil non branché n'est JAMAIS proposé exécutable).

## Registre (`openai/tool-registry.ts`, `tool-coverage.json`)
- **Effectful WIRED (4)** : `create_mission` (submitPierreMission), `cancel_mission`
  (cancelPierreMission), `decide_validation` (approve/reject/requestChanges + version),
  `create_support_case` (durable support). Plus `prepare_mission` (wired, propose la création).
- **Advisory (lecture / signalement serveur)** : company_summary, list/open missions,
  list/open validations, list/open employees, find/open document, find_known_issue,
  `report_issue` (le signalement est consigné SERVEUR sur BUG_HINT ; il n'a pas d'effet
  d'écriture propre — il peut ESCALADER vers create_support_case), retrieve_*, navigate.
- **Unavailable** : **0**. Le test `p941-proofs.itest.ts` échoue si un outil `effect:true`
  n'est pas `wired` (jamais d'effet sans backend réel).

## Idempotence (honnête, en couches)
- **Session client** (`createIdempotencyLedger`, Set par `action.id`) : empêche le
  double-clic de confirmation dans une session. **Portée : session** — perdu au reload
  (limite assumée ; pour rejouer, l'humain doit RE-proposer + RE-confirmer).
- **Runtime V1** : la création de mission est idempotente côté serveur (runtime P8) ;
  la clé de session est transmise dans `source` pour l'observabilité.
- Décision/annulation : la garde de session + la relecture serveur (statut déjà décidé /
  version optimiste) empêchent l'effet en double.

## Garde d'honnêteté (`governed-turn.ts assembleFromStructured`)
`isToolAllowedInMode` → `isToolAvailable` → `validateToolArgs` → `applyTool`. Un outil
`unavailable` produit « Cette action n'est pas encore disponible » (jamais d'action
exécutable). Le message de l'utilisateur backfill l'instruction manquante (mission).

## Exécution gouvernée (`tool-executor.ts`)
`executeGovernedAction(action, deps, confirmed)` : refuse le sensible sans confirmation
explicite ; **idempotence** par `action.id` pour CHAQUE écriture (create/cancel/decide/
support) ; ne marque le succès qu'après confirmation serveur ; échec ⇒ pas d'idempotence
(réessai possible). GAP-1 respecté : `decide_validation` ne fabrique AUCUN motif (le
contrat V1 n'en porte pas).

## Client (`useCloneChat.ts executeAction`)
Injecte les contrats V1 réels : submitPierreMission / cancelPierreMission /
approve|reject|requestChanges Validation / POST `/api/assistant/support`.

## Preuves
`tool-coverage.json` (6 wired, 0 unavailable, 5 effectful tous wired) ;
`tool-executor.test.ts` + `tool-executor-p941.test.ts` (decide/cancel/support :
succès, contrat manquant refusé, sans confirmation refusé, idempotence).

## Limites honnêtes héritées (P9.3)
GAP-1 (pas de motif de décision) et GAP-2 (documents dérivés des tâches, pas d'endpoint
dédié ni d'upload) : CloneChat ne fabrique ni motif ni URL ; il n'expose que le réel.
