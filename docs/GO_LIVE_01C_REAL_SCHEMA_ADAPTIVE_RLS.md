# GO-LIVE 01C — Real Schema Adaptive RLS

**Statut:** Correctif suite à l'erreur `public.companies does not exist`

---

## 1. Erreur rencontrée

```
ERROR: 42P01: relation "public.companies" does not exist
```

**Code erreur PostgreSQL 42P01** : la relation (table) référencée n'existe pas dans le schéma `public`.

L'erreur s'est produite à la première ligne du fichier `PFINAL01_RLS_PRODUCTION_PACK.sql` :

```sql
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
```

---

## 2. Cause : pack RLS générique pas aligné avec le schéma réel

Le fichier `PFINAL01_RLS_PRODUCTION_PACK.sql` a été écrit avec un modèle de données générique qui suppose :
- Une table `companies` (avec colonne `id`)
- Une table `profiles` avec une colonne `company_id` référençant `companies`
- Un modèle de tenancy basé sur `company_id`

Or, l'audit du code source révèle que le schéma réel utilise :
- Pas de table `companies`
- Un modèle de tenancy basé sur **`user_id = auth.uid()`**
- Des tables Pierre : `pierre_missions`, `pierre_tasks`, `pierre_documents`, `pierre_task_logs`, `pierre_task_artifacts`, `pierre_company_memory`, `pierre_outbound_emails`
- Des tables de facturation : `orders`
- Des tables de profil : `profiles`, `agent_onboarding_pierre`

---

## 3. Pourquoi ne pas créer `companies` au hasard

Créer `public.companies` sans modèle validé est **interdit** pour ces raisons :

1. **L'app n'en a pas besoin** : le code utilise `user_id` pour toutes les requêtes Supabase. Aucune jointure `companies` n'existe dans le code source.

2. **Casser les FK** : créer une table `companies` vide puis y référencer des lignes depuis `profiles` via une colonne `company_id` inexistante crée une incohérence de modèle.

3. **Faux modèle de tenancy** : le RLS basé sur `(SELECT company_id FROM public.profiles WHERE id = auth.uid())` est fonctionnellement différent du RLS basé sur `user_id = auth.uid()`. Utiliser le mauvais modèle expose des données cross-user.

4. **Pas de rollback simple** : ajouter une table nécessite une migration. En l'absence de migration tool, c'est du DDL manuel qui doit être rollback-able et documenté.

---

## 4. Étape 1 : Exécuter l'introspection read-only

Ouvrir Supabase SQL Editor et exécuter les 6 requêtes de :

```
docs/sql/GO_LIVE_01C_SCHEMA_INTROSPECTION.sql
```

Ces requêtes sont **read-only** (SELECT uniquement). Elles ne modifient rien.

Copier les résultats dans un fichier texte et partager avec Claude pour ajuster le pack adaptatif si nécessaire.

**Résultats attendus à transmettre :**
- Liste complète des tables existantes
- Colonnes de chaque table (notamment `user_id`, `company_id`, `id`)
- État RLS actuel (rowsecurity true/false)
- Policies déjà existantes

---

## 5. Étape 2 : Identifier les colonnes tenant

À partir des résultats de l'introspection (Query 6), vérifier :

| Table | Colonne tenant attendue | Fallback si absente |
|---|---|---|
| `profiles` | `user_id` | vérifier `id = auth.uid()` |
| `orders` | `user_id` | vérifier `client_id` |
| `pierre_missions` | `user_id` | service_role only |
| `pierre_tasks` | `user_id` | service_role only |
| `pierre_documents` | `user_id` | service_role only |
| `pierre_task_logs` | `user_id` | service_role only |
| `pierre_task_artifacts` | `user_id` | service_role only |
| `pierre_company_memory` | `user_id` | service_role only |
| `pierre_outbound_emails` | `user_id` | service_role only |
| `audit_log` | `user_id` ou `client_id` | service_role only |

---

## 6. Étape 3 : Appliquer le pack adaptatif

Exécuter dans une transaction :

```sql
BEGIN;
-- Coller le contenu de docs/sql/GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql
COMMIT;
-- En cas d'erreur : ROLLBACK;
```

Le pack est conçu pour :
- **Skiper** les tables absentes (`to_regclass() IS NULL → NOTICE`)
- **Détecter** automatiquement si la colonne `user_id` existe
- **Appliquer** `user_id = auth.uid()` si la colonne est présente
- **Désactiver le client** si aucune colonne tenant n'est trouvée (RLS enabled, pas de policy permissive = service_role only)

---

## 7. Étape 4 : Vérifier les policies appliquées

```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Attendu : policies `rls_*` visibles pour les tables qui existent.

Également vérifier :

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Attendu : `rowsecurity = true` pour toutes les tables sensibles.

---

## 8. Étape 5 : Tester anon / user isolation

**Test anon (clé anon uniquement) :**
```sql
-- Dans SQL Editor avec Role: anon
SELECT * FROM pierre_missions LIMIT 5;
-- Attendu: 0 rows (RLS bloque accès anon)
```

**Test isolation user :**
- Si un seul utilisateur sur staging, créer un second compte de test
- User A : `SELECT * FROM pierre_missions` → uniquement ses propres missions
- User B : `SELECT * FROM pierre_missions` → 0 missions de User A

**Test service_role bypass :**
- Via `SUPABASE_SERVICE_ROLE_KEY` côté serveur (route API) : accès complet (comportement attendu)
- Via clé anon : 0 rows (RLS actif)

---

## 9. Proof IDs — restent pending jusqu'à vérification réelle

Les proof IDs suivants ne peuvent être passés à `"verified"` que **APRÈS** vérification manuelle complète :

| Proof ID | Condition |
|---|---|
| `SUPABASE_RLS_STAGING_APPLIED` | Pack adaptatif appliqué + NOTICE confirm OK |
| `SUPABASE_RLS_STAGING_VERIFIED` | Test anon = 0 rows + isolation user confirmée |
| `SUPABASE_RLS_PRODUCTION_APPLIED` | Idem sur production (après staging OK) |
| `SUPABASE_RLS_PRODUCTION_VERIFIED` | Test anon production = 0 rows |
| `SUPABASE_USER_A_CANNOT_READ_USER_B` | Isolation cross-user confirmée en production |
| `SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED` | Routes serveur OK, service_role jamais en client |

**Public launch reste NO-GO tant que ces 6 preuves ne sont pas verified.**

---

## Fichiers de cette correction

| Fichier | Rôle |
|---|---|
| `docs/sql/GO_LIVE_01C_SCHEMA_INTROSPECTION.sql` | 6 requêtes read-only pour découvrir le schéma réel |
| `docs/sql/GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql` | Pack RLS adaptatif avec `to_regclass()` guards |
| `docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql` | Pack original (conservé, à ne pas utiliser sans adaptation) |
| `docs/PFINAL02_SUPABASE_RLS_REAL_VERIFICATION.md` | Checklist de vérification staging/prod |
| `scripts/pfinal02-supabase-rls-verify.ps1` | Guide PowerShell mis à jour avec GO-LIVE 01C |

---

*GO-LIVE 01C — Correctif Real Schema Adaptive RLS — 2026-05-30*
