# P-FINAL 01 — Guide de déploiement RLS production

**Phase: 9 — Public Launch Closure**
**Audience: Développeur responsable infrastructure**
**CRITIQUE: Ne jamais appliquer directement en production sans avoir testé sur staging**

---

## Vue d'ensemble

Le fichier `docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql` contient les politiques RLS pour **10 tables critiques** avec **23 politiques** au total. Ce guide décrit comment l'appliquer en sécurité.

### Tables couvertes

| Table | Politiques | Isolation |
|-------|-----------|-----------|
| `companies` | SELECT, UPDATE | `id = company_id (profil)` |
| `profiles` | SELECT, INSERT, UPDATE | `user_id` + `company_id` |
| `employees` | SELECT, INSERT, UPDATE, DELETE | `company_id` |
| `tasks` | SELECT, INSERT, UPDATE, DELETE | `company_id` |
| `documents` | SELECT, INSERT, UPDATE, DELETE | `company_id` |
| `emails` | SELECT, INSERT, UPDATE, DELETE | `company_id` |
| `pierre_task_artifacts` | SELECT, INSERT | `company_id` |
| `absences` | SELECT, INSERT, UPDATE, DELETE | `company_id` |
| `audit_logs` | SELECT, INSERT | INSERT service_role only |
| `ai_cost_events` | SELECT | INSERT service_role only |

---

## Prérequis ABSOLUS avant déploiement

1. ✅ Backup complet de la base production effectué et vérifié
2. ✅ Script testé intégralement sur un environnement staging/clone
3. ✅ Test d'isolation cross-company validé sur staging (0 rows cross-company)
4. ✅ Accès au Dashboard Supabase production confirmé
5. ✅ Procédure de rollback préparée et testée

---

## Étape 1 — Test sur staging

```bash
# 1. Ouvrir le SQL Editor dans Supabase Dashboard STAGING
# 2. Coller le contenu de docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql
# 3. Exécuter

# Vérification post-staging:
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Vérifier que la requête retourne exactement 23 politiques pour les 10 tables listées.

---

## Étape 2 — Test d'isolation cross-company sur staging

```sql
-- Test avec 2 comptes appartenant à 2 companies distinctes
-- Connecté en tant que user A (company_id = 'company_a')
SELECT * FROM employees; -- doit retourner UNIQUEMENT les employees de company_a

-- Connecté en tant que user B (company_id = 'company_b')  
SELECT * FROM employees; -- doit retourner UNIQUEMENT les employees de company_b

-- Résultat attendu: 0 rows cross-company en toutes circonstances
```

---

## Étape 3 — Backup production

```bash
# Via Supabase Dashboard → Settings → Database → Backups
# OU via pg_dump si accès direct:
pg_dump --host=[HOST] --port=5432 --username=postgres \
  --dbname=postgres --file=backup_pre_rls_$(date +%Y%m%d_%H%M%S).sql

# Vérifier que le backup est lisible avant de continuer
```

---

## Étape 4 — Application en production (dans une transaction)

```sql
-- IMPORTANT: Exécuter DANS UNE TRANSACTION pour pouvoir rollback
BEGIN;

-- Coller ici le contenu de docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql
-- ...

-- Vérification immédiate avant COMMIT
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Doit retourner 23 (ou plus si d'autres politiques existaient)

COMMIT;
-- En cas de problème: ROLLBACK; au lieu de COMMIT;
```

---

## Étape 5 — Vérification post-déploiement

### 5a — Vérifier les politiques via SQL

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 5b — Vérifier via le Dashboard Supabase

1. Aller dans `Authentication → Policies`
2. Vérifier que RLS est activé (bouton vert) sur chaque table critique
3. Vérifier que les politiques apparaissent correctement

### 5c — Test fonctionnel post-déploiement

```sql
-- Vérifier que anon ne peut pas accéder aux tables sensibles
-- Connecté avec la clé anon:
SELECT * FROM employees; -- doit retourner 0 rows (RLS bloque tout pour anon)
SELECT * FROM documents; -- idem
```

### 5d — Vérification programmatique

```typescript
import { verifyRlsPolicyCoverage } from "@/lib/production-readiness/supabase/rls-verification";
import { RLS_POLICY_REGISTRY } from "@/lib/production-readiness/supabase/rls-policy-registry";

const knownIds = RLS_POLICY_REGISTRY.map(p => p.id);
const result = verifyRlsPolicyCoverage(knownIds);

console.log("Is production ready:", result.is_production_ready);
console.log("Coverage score:", getRlsCoverageScore(knownIds)); // doit être 100
```

---

## Alertes à configurer après déploiement

Ces alertes sont définies dans `src/lib/production-readiness/supabase/rls-alerts.ts` :

| Alerte | Seuil | Priorité |
|--------|-------|----------|
| `rls_403_spike` | > 10 erreurs 403/min | CRITIQUE |
| `rls_policy_missing` | Policy manquante | CRITIQUE |
| `rls_cross_company_access` | Accès cross-company | CRITIQUE |
| `rls_anon_data_access` | Accès anon avec données | HIGH |
| `rls_high_403_rate` | > 100 erreurs 403/heure | MEDIUM |

---

## Rollback d'urgence

Si une régression est détectée après déploiement :

```sql
-- Option 1: Désactiver RLS temporairement sur une table (DANGEREUX — accès public)
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- Option 2: Restaurer depuis le backup
-- Via Supabase Dashboard → Settings → Database → Restore

-- Option 3: ROLLBACK si la transaction est encore ouverte
ROLLBACK;
```

**Après rollback:** Investiguer la cause avant tout nouveau déploiement.

---

## Preuve de déploiement

Après déploiement réussi, documenter :
- Date et heure d'application
- Screenshot de `pg_policies` montrant les 23 politiques
- Résultat du test cross-company (0 rows)
- Nom de la personne ayant appliqué

Ces informations débloquent les proof IDs :
- `proof_rls_applied_production`
- `proof_rls_isolation_tested`

Et le flag B48: `B48_SUPABASE_RLS_VERIFIED=true`

---

*P-FINAL 01 — Phase 9 — Guide de déploiement RLS production*
