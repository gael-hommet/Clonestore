# Template d'Evidence — PHASE 5.6 Controlled Mission Server Restore UI Polish

> **Important** : Ce template doit être rempli manuellement.
> Ne pas auto-remplir. Ne pas modifier go-live-proofs.local.json.
> **Restauration serveur non active · Local uniquement.** Aucun GET serveur.
> La source active reste localStorage. Aucune exécution.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Panneau « Restauration serveur — non active »

- [ ] Microcopy « Restauration serveur non active · Local uniquement »
- [ ] « Aucun GET serveur n'est effectué »
- [ ] « La source active reste localStorage »
- [ ] Faits : serveur désactivé, SQL non appliqué, route non créée, flag false

## 4. État restore

- [ ] `restored_count` 0
- [ ] `server_rows_loaded` 0
- [ ] `server_restore_available` false
- [ ] `server_get_performed` false
- [ ] `db_read_performed` false
- [ ] Nombre de missions locales affiché
- [ ] Nombre de candidates future restauration affiché

## 5. Timeline future

- [ ] 1. SQL manual review
- [ ] 2. Flag activation future
- [ ] 3. Route GET future
- [ ] 4. Restore server rows
- [ ] 5. Still no execution

## 6. No-execution invariants

- [ ] `server_write_performed` false
- [ ] `runtime_execution_performed` false
- [ ] `real_mission_created` false
- [ ] `pierre_engine_called` false
- [ ] `ai_call_performed` false
- [ ] `email_sent` / `document_generated` / `clonevoice_active` false

## 7. Routes / SQL / flag

- [ ] Aucune route controlled-missions active
- [ ] Aucune route restore GET
- [ ] Aucune route execute
- [ ] SQL P5.4 `DO NOT APPLY` (non appliqué)
- [ ] Flag serveur default false · `.env.local` non modifié

## 8. Actions interdites absentes

- [ ] Pas de bouton « Restaurer depuis serveur »
- [ ] Pas de bouton « Charger serveur » / « Synchroniser serveur » / « Activer serveur »

## 9. Résultats commandes

- [ ] `npm run check:controlled-mission-server-restore-ui` → *(PASS)*
- [ ] `npm run test:phase5-6` → *(XX/XX)*
- [ ] `npx tsc --noEmit` → *(clean)*
- [ ] `npm run test:phase5-5` → *(60/60)*
- [ ] `npm run test:phase5-4` → *(66/66)*
- [ ] `npm run test:phase5-3` → *(58/58)*
- [ ] `npm run test:pfinal02` → *(2525/2525)*
- [ ] `npm test` → *(green)*
- [ ] `npm run build` → *(clean)*

## 10. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — UI restore design-only, source active localStorage, aucun GET/route/SQL/exécution.
- [ ] **FAIL** — GET serveur, route restore, donnée serveur chargée, write serveur, ou exécution détectée.
- [ ] **NEEDS REVIEW** — points non bloquants à revoir.

## 11. Notes

*(Observations)*

---

> **Rappel** : P5.6 = UI restore design-only. Aucune lecture serveur. Aucun GET.
> Aucune route. Aucun SQL appliqué. Flag off. localStorage source active.
> Aucune exécution. scale 80k non prouvé. lancement public externe non validé.
