# GO-LIVE 01D — Targeted Real Schema RLS

**Statut:** Basé sur l'introspection réelle de Gael (2026-05-30)

---

## 1. Résultat de l'introspection Gael

L'introspection `GO_LIVE_01C_SCHEMA_INTROSPECTION.sql` a confirmé :

- **Pas de table `public.companies`** — comme suspecté
- **Pas de colonne `company_id`** dans les tables du schéma
- **Modèle mixte** : certaines tables utilisent `user_id uuid`, d'autres `client_id uuid`, d'autres `client_id text`

Tables identifiées par type de tenancy :

| Type | Tables |
|---|---|
| `user_id uuid` | `agent_onboarding_pierre`, `agent_runs`, `orders`, `pierre_company_memory`, `pierre_documents`, `pierre_missions`, `pierre_outbound_emails`, `pierre_task_logs`, `pierre_tasks` |
| `client_id uuid` | `agents_owned`, `api_tokens`, `router_logs` |
| `client_id text` | `agent_configs`, `audit_log`, `deadlines`, `documents`, `employees`, `hr_events`, `pierre_jobs`, `pierre_queue` |
| `id seulement` | `clients`, `profiles` |
| VIEW (pas de policy) | `pierre_queue_view` |

---

## 2. Tables user_id uuid

Ces tables stockent `user_id` comme UUID Supabase auth (`auth.uid()`).

**Policy appliquée :**
```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

Confirmé par le code source : `pierre/use/employees/route.ts` utilise `user_id = userId` (obtenu via `supabaseAdmin.auth.getUser(token)`) pour toutes les requêtes `pierre_company_memory`.

---

## 3. Tables client_id uuid

Ces tables stockent `client_id` comme UUID.

**Policy appliquée :**
```sql
USING (client_id = auth.uid())
```

`api_tokens` est un cas spécial : ces tokens sont des credentials sensibles. Pas de SELECT policy client. Service_role only.

---

## 4. Tables client_id text

**Risque critique :** `client_id text` peut stocker :
- Un UUID Supabase au format texte → `client_id = auth.uid()::text` fonctionne
- Une clé API, un email, un nom de client → `client_id = auth.uid()::text` ne match jamais (silent deny) ou pire : collision

**Avant d'appliquer une policy sur ces tables, exécuter :**
```
docs/sql/GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql
```

Interpréter les résultats de Query 5 :
- `uuid_like = total_rows` ET `matched_auth_users = total_rows` → safe, appliquer targeted pack
- Sinon → appliquer minimal safe pack (service_role only)

---

## 5. Tables sans owner direct

**`clients`** : uniquement `id uuid`. Pas de référence utilisateur. Service_role only.

**`profiles`** : uniquement `id uuid`. La convention Supabase est `profiles.id = auth.uid()`. Policy : `id = auth.uid()`.

**`pierre_queue_view`** : c'est une **VIEW**, pas une table. Ne jamais faire `ALTER TABLE` ou `CREATE POLICY` sur une view. La view hérite de la sécurité de la table de base `pierre_queue`.

---

## 6. Pourquoi le modèle company est faux pour ce schéma

Le pack PFINAL01 original supposait :
```sql
(SELECT company_id FROM public.profiles WHERE id = auth.uid())
```

Mais ce schéma n'a **ni** `public.companies`, **ni** `company_id` dans `profiles`, **ni** de table de membres d'une company.

Le modèle réel est **user-centric** : chaque utilisateur Supabase est son propre tenant. `user_id = auth.uid()` est la seule isolation nécessaire pour les tables Pierre.

---

## 7. Choix A — Pack ciblé (si client_id text confirmé)

**Condition :** `GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql` confirme que `client_id text` = `auth.uid()::text` pour toutes les tables concernées.

**Fichier :** `docs/sql/GO_LIVE_01D_TARGETED_RLS_PACK.sql`

Ce pack applique :
- `user_id = auth.uid()` sur les tables Pierre
- `client_id = auth.uid()` sur les tables uuid
- `client_id = auth.uid()::text` sur les tables text confirmées
- `id = auth.uid()` sur profiles
- Service_role only sur `api_tokens`, `clients`, `pierre_queue`, `agent_configs`
- Aucune policy sur `pierre_queue_view` (VIEW)

---

## 8. Choix B — Pack minimal safe (si client_id text non confirmé)

**Condition :** `client_id text` inconnu ou non-UUID.

**Fichier :** `docs/sql/GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql`

Ce pack applique :
- Uniquement les tables `user_id uuid` + `profiles`
- RLS enabled sur les tables `client_id text` MAIS aucune policy permissive → service_role only
- `audit_log` INSERT/DELETE toujours bloqué

**Recommandation :** commencer par le minimal safe pack pour sécuriser immédiatement les tables Pierre, puis upgrader vers le targeted pack après confirmation.

---

## 9. Tests après application

**Test 1 — Accès anon bloqué :**
```sql
-- Dans SQL Editor avec Role: anon
SELECT * FROM pierre_missions LIMIT 5;
-- Attendu: 0 rows
SELECT * FROM orders LIMIT 5;
-- Attendu: 0 rows
```

**Test 2 — Accès utilisateur authentifié :**
```sql
-- Connecté avec un vrai compte utilisateur (JWT Supabase)
SELECT * FROM pierre_missions;
-- Attendu: uniquement les missions de cet utilisateur
```

**Test 3 — Isolation cross-user :**
- User A : `SELECT * FROM pierre_missions` → 0 missions de User B
- User B : `SELECT * FROM pierre_missions` → 0 missions de User A

**Test 4 — audit_log immuable :**
```sql
INSERT INTO audit_log (id, client_id) VALUES (gen_random_uuid(), 'test');
-- Attendu: erreur RLS (policy WITH CHECK (false))
```

---

## 10. Proof IDs à remplir après vérification

Ces proof IDs passent à `"verified"` **uniquement après vérification manuelle complète** :

| Proof ID | Condition |
|---|---|
| `SUPABASE_RLS_STAGING_APPLIED` | Pack appliqué + NOTICE [OK] confirmés + pg_policies vérifié |
| `SUPABASE_RLS_STAGING_VERIFIED` | Test anon = 0 rows + isolation user confirmée |
| `SUPABASE_RLS_PRODUCTION_APPLIED` | Idem sur production |
| `SUPABASE_RLS_PRODUCTION_VERIFIED` | Test anon production |
| `SUPABASE_USER_A_CANNOT_READ_USER_B` | Isolation cross-user confirmée |
| `SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED` | Routes serveur validées |

---

## 11. Public launch reste NO-GO

`B48_PUBLIC_LAUNCH_ENABLED` reste `false`. `CLONESTORE_PUBLIC_LAUNCH_APPROVED` reste `false`.

Aucun des 6 proof IDs Supabase n'est verified. Public launch bloqué par `security_blocked`.

---

## Fichiers GO-LIVE 01D

| Fichier | Rôle |
|---|---|
| `docs/sql/GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql` | Vérification read-only des valeurs client_id |
| `docs/sql/GO_LIVE_01D_TARGETED_RLS_PACK.sql` | Pack complet si client_id text confirmé UUID auth |
| `docs/sql/GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql` | Pack minimal si client_id text non confirmé |
| `docs/GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md` | Ce document |

---

*GO-LIVE 01D — Targeted Real Schema RLS — 2026-05-30*
