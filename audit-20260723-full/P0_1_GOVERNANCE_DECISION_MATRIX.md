# P0.1 — Matrice des décisions de gouvernance (`/api/pierre/execute`)

Toutes les décisions passent par `evaluateLegacyExecuteGovernance` (`src/lib/pierre/legacy-execute-governance.ts`),
qui enchaîne `evaluatePierreCloneGuard` puis `evaluateGovernance` — exactement le même chemin
que `src/lib/pierre/tasks/execute-task.ts` (pipeline mission/tâche canonique). Aucun second
évaluateur n'a été créé pour ce bloc.

| Action | Règle CloneGuard qui matche | Décision CloneGuard | `allowed_to_auto_execute` (Guard∧Policy∧Trust) | Décision finale route | HTTP | `error.code` | Dispatch possible ? |
|---|---|---|---|---|---|---|---|
| `email.send` | `email_send_block` (`decision: "block"`) — non-contournable (`can_override:false`) | `block` | n/a (bloqué avant) | **DENY** | 403 | `GOVERNANCE_BLOCKED` | Non — aucun chemin de code restant (callMake supprimé) |
| `doc.generate` | Aucune règle "block/refuse" ne matche un contenu bénin ; CloneTrust retombe sur le niveau par défaut "supervised" (aucun score de confiance/historique réel fourni par cette route legacy), ce qui prime sur un éventuel `allow_with_warning` de CloneGuard | selon contenu (souvent `allow`/`allow_with_warning`) | `false` (CloneTrust bloque) | **REQUIRE_APPROVAL** | 202 | `HUMAN_APPROVAL_REQUIRED` | Non — aucune écriture `documents`, aucun appel réseau |
| `hris.sync` | `integration_sync_require` (`decision: "require_approval"`, `can_override:false`) | `require_approval` | `false` | **REQUIRE_APPROVAL** (ou `DENY` si un motif de refus texte matche également, ex. licenciement/harcèlement dans le payload) | 202 (ou 403) | `HUMAN_APPROVAL_REQUIRED` (ou `GOVERNANCE_BLOCKED`) | Non — **plancher route supplémentaire** : même si le moteur retournait `ALLOW` par erreur, la route force `REQUIRE_APPROVAL` avant tout dispatch |
| Contexte texte contenant "licenci", "harcèlement", "discrimination", "prud'hommes", "violence"/"agression", "judiciaire" (dans le payload de n'importe laquelle des 3 actions) | Règles `require_approval`/`refuse`/`block` correspondantes (ex. `licenciement_text_require`, `harcelement_refuse`, `discrimination_refuse`, `prudhommes_refuse`, `violence_refuse`, `judiciaire_block`) | `refuse`/`block`/`require_approval` selon le motif | `false` | **DENY** ou **REQUIRE_APPROVAL** selon le motif | 403 ou 202 | `GOVERNANCE_BLOCKED` ou `HUMAN_APPROVAL_REQUIRED` | Non |
| Action inconnue (ex. `employee.create`) | N/A — n'entre jamais dans l'évaluation de gouvernance sur cette route (comportement fail-closed préexistant, inchangé) | — | — | **UNKNOWN_ACTION** | 400 | `UNKNOWN_ACTION` | Non |

## Confirmation empirique (tests, ce bloc)

- 8 tests unitaires (`legacy-execute-governance.test.ts`) confirment chacune des lignes
  ci-dessus directement sur la fonction pure, y compris le déterminisme (deux appels
  identiques → même résultat) et la présence d'un événement d'audit CloneGuard + gouvernance
  exploitable.
- 10 tests d'intégration (`p0-governance-closure.test.ts`) confirment le même comportement
  bout-en-bout via `POST /api/pierre/execute`, y compris `fetch` jamais appelé (mock global qui
  lève une exception si utilisé) pour les 3 actions et pour l'action inconnue.
- 3 tests transversaux (`p0-transversal-consistency.test.ts`) confirment que `/api/pierre/execute`
  et `/api/pierre/action` (P0.2) produisent la **même** décision pour `email.send` et
  `hris.sync` puisqu'ils appellent le même module de gouvernance partagé — et que `/api/router`
  ne peut plus, par construction, traiter une action Pierre (410 inconditionnel).

## Ce qui rendrait `ALLOW` atteignable (hors périmètre de ce bloc)

`allowed_to_auto_execute` exige que CloneGuard **ET** ClonePolicy **ET** CloneTrust disent tous
les trois "oui". CloneTrust retombe sur un niveau de confiance par défaut bas en l'absence d'un
contexte de confiance réel (score, historique, contexte d'approbation) — ce que cette route
legacy (auth HMAC externe, pas de session utilisateur) ne fournit pas aujourd'hui. Câbler un
véritable contexte CloneTrust pour cette route serait un changement d'architecture plus large,
explicitement hors périmètre de ce bloc (qui doit se limiter à restaurer la gouvernance
existante, pas à en concevoir une nouvelle) — noté dans `P0_1_REMAINING_RISKS.md`.
