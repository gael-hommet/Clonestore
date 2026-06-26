# Template d'Evidence — PHASE 4.6 Runtime Mission Draft Manual Activation QA

> **Important** : Ce template doit être rempli manuellement après activation.
> Ne pas auto-remplir. Ne pas modifier go-live-proofs.local.json.
> lancement public externe non validé. scale 80k non prouvé.

---

## 1. Informations générales

| Champ | Valeur |
|---|---|
| Date de test | *(à remplir)* |
| Environnement | `local` / `staging` / `production` |
| Branch / commit | *(à remplir)* |
| Supabase Project Ref | *(optionnel)* |

---

## 2. SQL & schéma

| Vérification | Résultat |
|---|---|
| SQL P4.4 appliqué manuellement | oui / non |
| Table cible | `clonestore_runtime_mission_drafts` |
| Table exists | [ ] oui / [ ] non |
| RLS enabled | [ ] oui / [ ] non |
| Policy select_own | [ ] oui |
| Policy insert_own | [ ] oui |
| Policy update_own | [ ] oui |
| Aucune policy DELETE | [ ] confirmé |
| Constraints (unique + safety_flags) | [ ] oui |
| Indexes | [ ] oui |

---

## 3. Avant activation

| Vérification | Résultat |
|---|---|
| Feature flag avant test : false | [ ] oui |
| POST avant activation : **423** | [ ] oui |
| Sauvegarde localStorage OK | [ ] oui |
| Restore local OK | [ ] oui |

---

## 4. Après activation locale

| Vérification | Résultat |
|---|---|
| Feature flag activé localement | [ ] oui |
| App redémarrée après flag | [ ] oui |
| User authentifié | [ ] oui |
| POST après activation : **200** | [ ] oui / autre |
| Row Supabase créée | [ ] oui |
| Row id | *(à remplir)* |
| draft_id | *(à remplir)* |
| command_id | *(à remplir)* |
| plan_id | *(à remplir)* |
| safety_flags tous false | [ ] oui |

---

## 5. Garanties no-execution

| Question | Réponse |
|---|---|
| Mission réelle créée ? | **non** |
| Execution started ? | **non** |
| Pierre engine appelé ? | **non** |
| IA appelée ? | **non** |
| Email/message/document envoyé ? | **non** |
| /profile/messages status visible | [ ] oui |

---

## 6. Rollback

| Vérification | Résultat |
|---|---|
| Rollback flag false | [ ] oui |
| POST après rollback : **423** | [ ] oui |
| localStorage restore après rollback | [ ] oui |

---

## 7. Résultats validation

| Commande | Résultat |
|---|---|
| `npm run check:runtime-mission-draft-manual-activation-qa` | *(PASS / NEEDS REVIEW)* |
| `npm run test:phase4-6` | *(XX/XX)* |
| `npm run build` | *(clean / erreurs)* |

---

## 8. Décision finale

- [ ] **PASS** — Toutes les étapes blocking passées
- [ ] **FAIL** — Au moins une étape blocking échouée
- [ ] **NEEDS REVIEW** — CAS B (SQL absent) ou étapes non bloquantes à revoir

---

## 9. Notes

*(Observations, problèmes rencontrés)*

---

## 10. Captures / Références

*(Liens vers captures d'écran, logs)*

---

> **Rappel** : POST 423 tant que flag false. Aucune mission réelle créée.
> Aucune exécution. scale 80k non prouvé. lancement public externe non validé.
