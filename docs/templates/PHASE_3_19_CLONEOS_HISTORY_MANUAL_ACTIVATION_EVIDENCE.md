# Template d'Evidence — PHASE 3.19 CloneOS History Manual Activation QA

> **Important** : Ce template doit être rempli manuellement après activation.
> Ne pas auto-remplir. Ne pas modifier go-live-proofs.local.json.
> Aucune exécution CloneOS automatique. lancement public externe non validé.

---

## Informations générales

| Champ | Valeur |
|---|---|
| Date de test | *(à remplir)* |
| Environnement | `local` / `staging` / `production` |
| Testé par | *(nom)* |
| Supabase Project Ref | *(optionnel)* |

---

## 1. SQL CloneOS History appliqué manuellement

- [ ] SQL `PHASE_3_2_CLONEOS_HISTORY.sql` relu
- [ ] SQL copié dans Supabase SQL Editor
- [ ] Run → aucune erreur

**SQL CloneOS History appliqué manuellement** : oui / non

**Nom de table CloneOS History** : `clonestore_cloneos_history`

**Date/heure d'application** : *(à remplir)*

**Erreurs éventuelles** : *(à remplir ou "aucune")*

---

## 2. Résultat localStorage key

**Clé** : `clonestore.cloneos.commandHistory.v1`

- [ ] Clé présente après demande CloneOS locale
- [ ] Clé absente

---

## 3. Résultat table exists

**Requête A** :
```sql
select table_name from information_schema.tables
where table_schema = 'public'
and table_name = 'clonestore_cloneos_history';
```

- [ ] 1 ligne retournée
- [ ] Aucune ligne (table absente)

---

## 4. Résultat RLS

**Requête B** :
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
and tablename = 'clonestore_cloneos_history';
```

- [ ] rowsecurity = true ✅
- [ ] rowsecurity = false ❌

---

## 5. Résultat policies

**Requête C** :
```sql
select policyname, cmd from pg_policies
where schemaname = 'public'
and tablename = 'clonestore_cloneos_history'
order by cmd, policyname;
```

- [ ] cloneos_history_select_own (SELECT)
- [ ] cloneos_history_insert_own (INSERT)
- [ ] Aucune policy UPDATE *(attendu — audit trail immuable en v1)*
- [ ] Aucune policy DELETE *(attendu — audit trail immuable)*

Résultat brut :
```
(coller ici le résultat Supabase)
```

---

## 6. Résultat constraints

**Requête D** :
```sql
select conname from pg_constraint
where conrelid = 'public.clonestore_cloneos_history'::regclass
order by conname;
```

- [ ] clonestore_cloneos_history_unique_command
- [ ] clonestore_cloneos_history_summary_length
- [ ] clonestore_cloneos_history_status_valid
- [ ] clonestore_cloneos_history_risk_valid
- [ ] clonestore_cloneos_history_company_not_empty
- [ ] clonestore_cloneos_history_command_not_empty

---

## 7. Feature flag

| Étape | Résultat |
|---|---|
| Flag avant test | `false` / non défini |
| Flag activé dans .env.local | *(date/heure)* |
| App redémarrée | [ ] oui |

---

## 8. Résultats scripts

| Script | Résultat |
|---|---|
| `check:cloneos-history-readiness` | *(PASS / FAIL)* |
| `check:cloneos-history-manual-activation-qa` | *(PASS / FAIL)* |
| `npm run test:phase3-19` | *(XX/XX)* |
| `npm run build` | *(clean / erreurs)* |

---

## 9. Test génération historique local

| Vérification | Résultat |
|---|---|
| Demande CloneOS locale créée | [ ] oui / [ ] non |
| localStorage contient l'item | [ ] oui / [ ] non |

---

## 10. Test sync serveur

| Vérification | Résultat |
|---|---|
| Server sync OK | [ ] oui / [ ] non / [ ] non applicable |

---

## 11. Row Supabase créée

**Requête E** :
```sql
select * from public.clonestore_cloneos_history
order by updated_at desc limit 5;
```

- Row id : *(à remplir)*
- command_id : *(à remplir)*
- updated_at : *(à remplir)*

---

## 12. Refresh / Restore

| Vérification | Attendu | Obtenu |
|---|---|---|
| Historique intact après F5 | préservé | *(à noter)* |
| Source utilisée (local/server) | la plus récente | *(à noter)* |

---

## 13. Test /profile/messages

| Vérification | Résultat |
|---|---|
| Feed contexte visible | [ ] oui / [ ] non |
| Historique CloneOS visible | [ ] oui / [ ] non |
| Aucun message envoyé | [ ] confirmé |

---

## 14. Rollback flag off

| Étape | Résultat |
|---|---|
| Flag retiré de .env.local | [ ] fait |
| App redémarrée | [ ] fait |
| localStorage toujours OK | [ ] oui / [ ] non |
| Aucun crash | [ ] oui |

---

## 15. Confirmation

- [ ] Aucune exécution CloneOS automatique
- [ ] Aucun message/email envoyé

---

## 16. Résultat final

- [ ] **PASS** — Toutes les étapes blocking passées
- [ ] **FAIL** — Au moins une étape blocking échouée
- [ ] **NEEDS REVIEW** — Étapes non bloquantes à revoir / CAS B (SQL absent)

---

## 17. Notes

*(Ajouter ici toute observation, problème rencontré, comportement inattendu)*

---

## 18. Captures / Références

*(Ajouter ici les liens vers captures d'écran, logs, ou autres références)*

---

> **Rappel** : Ce template ne valide pas le lancement public externe.
> Aucune exécution CloneOS automatique. lancement public externe non validé.
