# Template d'Evidence — PHASE 3.15 Enterprise Footprint Manual Activation QA

> **Important** : Ce template doit être rempli manuellement après activation.
> Ne pas auto-remplir. Ne pas modifier go-live-proofs.local.json.
> lancement public externe non validé.

---

## Informations générales

| Champ | Valeur |
|---|---|
| Date de test | *(à remplir)* |
| Environnement | `local` / `staging` / `production` |
| Testé par | *(nom)* |
| Supabase Project Ref | *(optionnel)* |

---

## 1. SQL appliqué manuellement

- [ ] SQL PHASE_3_13 relu
- [ ] SQL copié dans Supabase SQL Editor
- [ ] Run → aucune erreur

**Date/heure d'application** : *(à remplir)*

**Erreurs éventuelles** : *(à remplir ou "aucune")*

---

## 2. Vérifications table

**Requête A — Table existe** :
```sql
select table_name from information_schema.tables
where table_schema = 'public'
and table_name = 'clonestore_enterprise_footprints';
```

Résultat :
- [ ] 1 ligne retournée avec table_name = 'clonestore_enterprise_footprints'
- [ ] Aucune ligne (table absente)

---

## 3. Vérifications RLS

**Requête B — RLS activée** :
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints';
```

Résultat :
- [ ] rowsecurity = true ✅
- [ ] rowsecurity = false ❌

---

## 4. Vérifications policies

**Requête C — Policies** :
```sql
select policyname, cmd from pg_policies
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints'
order by cmd, policyname;
```

Résultat (cocher) :
- [ ] select_own_enterprise_footprint (SELECT)
- [ ] insert_own_enterprise_footprint (INSERT)
- [ ] update_own_enterprise_footprint (UPDATE)
- [ ] Aucune policy DELETE *(attendu — absence intentionnelle)*

Résultat brut :
```
(coller ici le résultat Supabase)
```

---

## 5. Vérifications contraintes

**Requête D — Contraintes** :
```sql
select conname from pg_constraint
where conrelid = 'public.clonestore_enterprise_footprints'::regclass
order by conname;
```

Résultat (cocher celles présentes) :
- [ ] uq_enterprise_footprint_user_company
- [ ] chk_enterprise_footprint_coverage_score
- [ ] chk_enterprise_footprint_readiness_score
- [ ] chk_enterprise_footprint_status_valid
- [ ] chk_enterprise_footprint_source_valid
- [ ] chk_enterprise_footprint_company_id_not_empty

---

## 6. Feature flag

| Étape | Résultat |
|---|---|
| Flag avant test | `false` / non défini |
| Flag activé dans .env.local | *(date/heure)* |
| App redémarrée | [ ] oui |

---

## 7. Résultats scripts

| Script | Résultat |
|---|---|
| `check:enterprise-footprint-server-readiness` | *(PASS / FAIL)* |
| `check:enterprise-footprint-safe-apply` | *(PASS / FAIL)* |
| `check:enterprise-footprint-manual-activation-qa` | *(PASS / FAIL)* |
| `npm run test:phase3-14` | *(XX/48)* |
| `npm run build` | *(clean / erreurs)* |

---

## 8. Test /profile/onboarding

| Vérification | Résultat |
|---|---|
| Formulaire rempli | [ ] oui |
| localStorage snapshot présent | [ ] oui |
| Status UI affiché | *(valeur exacte)* |
| Status = "Empreinte synchronisée serveur" | [ ] oui / [ ] non |
| Status = "Empreinte sauvegardée localement" | [ ] oui |

---

## 9. Vérification row Supabase

**Requête E** :
```sql
select id, user_id, company_id, status, readiness_score, coverage_score, updated_at
from public.clonestore_enterprise_footprints
order by updated_at desc limit 5;
```

Résultat :
- [ ] Ligne créée pour l'utilisateur test
- Row id : *(à remplir)*
- company_id : *(à remplir)*
- updated_at : *(à remplir)*

---

## 10. Refresh / Restore

Après F5 sur /profile/onboarding :

| Vérification | Résultat |
|---|---|
| Données Empreinte intactes | [ ] oui / [ ] non |
| Source utilisée (local/server) | *(à noter)* |
| Status UI après restore | *(à noter)* |

---

## 11. Rollback flag off

| Étape | Résultat |
|---|---|
| Flag retiré de .env.local | [ ] fait |
| App redémarrée | [ ] fait |
| localStorage snapshot toujours présent | [ ] oui / [ ] non |
| Status UI = "Empreinte sauvegardée localement" | [ ] oui |
| Aucun crash ou erreur | [ ] oui |

---

## 12. Vérifications pages agents et Pierre

| Page | Aucun POST enterprise-footprint | Résultat |
|---|---|---|
| /profile/agents | [ ] vérifié | *(PASS/FAIL)* |
| /agents/pierre/setup | [ ] vérifié | *(PASS/FAIL)* |
| /agents/pierre/use | [ ] vérifié | *(PASS/FAIL)* |

---

## 13. Résultat final

- [ ] **PASS** — Toutes les étapes blocking passées
- [ ] **FAIL** — Au moins une étape blocking échouée
- [ ] **NEEDS REVIEW** — Étapes non bloquantes à revoir

---

## 14. Notes

*(Ajouter ici toute observation, problème rencontré, comportement inattendu)*

---

## 15. Captures / Références

*(Ajouter ici les liens vers captures d'écran, logs, ou autres références)*

---

> **Rappel** : Ce template ne valide pas le lancement public externe.
> lancement public externe non validé.
