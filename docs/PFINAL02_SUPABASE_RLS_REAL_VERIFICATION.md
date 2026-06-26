# P-FINAL 02 — Vérification réelle du RLS Supabase

**Lire aussi:** `docs/PFINAL01_RLS_DEPLOYMENT_GUIDE.md` pour le guide de déploiement complet.

---

## Checklist de vérification RLS

### Staging (obligatoire en premier)

- [ ] Script `PFINAL01_RLS_PRODUCTION_PACK.sql` exécuté sur staging
- [ ] `SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'` → 23+
- [ ] Screenshot de `pg_policies` enregistré dans `go-live-evidence/supabase/`
- [ ] User A ne peut pas lire les données de User B
- [ ] Clé anon → 0 rows sur `employees`, `documents`, `tasks`
- [ ] Proof IDs: `SUPABASE_RLS_STAGING_APPLIED`, `SUPABASE_RLS_STAGING_VERIFIED`

### Production (après staging validé)

- [ ] Backup production créé et vérifié
- [ ] Script exécuté dans une transaction (`BEGIN;` ... `COMMIT;`)
- [ ] `pg_policies` vérifié post-application
- [ ] Test anon → 0 rows sur tables sensibles
- [ ] Test cross-company → 0 rows cross-company
- [ ] Proof IDs: `SUPABASE_RLS_PRODUCTION_APPLIED`, `SUPABASE_RLS_PRODUCTION_VERIFIED`, `SUPABASE_USER_A_CANNOT_READ_USER_B`

### Service role

- [ ] `INSERT audit_logs` avec clé anon → erreur RLS
- [ ] `SUPABASE_SERVICE_ROLE_KEY` n'est pas exposée en client
- [ ] Proof ID: `SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED`

---

## SQL de vérification post-application

```sql
-- Vérifier le nombre de politiques
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Attendu: 23+

-- Lister toutes les politiques
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Vérifier RLS activé sur les tables critiques
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'profiles', 'employees', 'tasks', 'documents', 'emails',
                    'pierre_task_artifacts', 'absences', 'audit_logs', 'ai_cost_events');
-- Attendu: rowsecurity = true pour toutes
```

---

## Test d'isolation cross-company

```sql
-- Connecté en tant que User A (company_id = 'uuid-company-a')
-- Via token JWT de User A (pas la clé service_role)

SELECT count(*) FROM employees;
-- Attendu: uniquement les employés de company_a

SELECT count(*) FROM employees
WHERE company_id != auth.uid()::text;
-- Attendu: 0 (aucun employé d'une autre company visible)
```

---

## Rollback d'urgence

En cas de problème post-application :

```sql
-- Si la transaction est encore ouverte:
ROLLBACK;

-- Si déjà committé et problème critique:
-- Utiliser Supabase Dashboard → Settings → Database → Restore from backup
```

---

*P-FINAL 02 — Guide de vérification RLS réelle*
