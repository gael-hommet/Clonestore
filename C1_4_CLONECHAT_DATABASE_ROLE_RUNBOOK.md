# C1.4 — Runbook : rôle base de données `clonechat_app`

**Objet.** CloneChat ouvre chaque transaction durable (budget, conversations, propositions) avec
`set local role clonechat_app`. Si le rôle n'existe pas, **toute réservation de budget échoue**.
En C1.3 cela produisait une **erreur 500** sur `/api/assistant/chat` ; en C1.4 le chemin public
dégrade proprement (repli déterministe), mais **le budget durable et l'appel OpenAI restent
indisponibles** tant que le rôle est absent.

> **Aucune valeur secrète dans ce document.** Aucun DSN, mot de passe, clé ou jeton.
> Les commandes prennent la connexion depuis l'environnement de l'opérateur.

---

## 1. Diagnostic (le symptôme exact)

```
error: role "clonechat_app" does not exist
```

Observable dans les logs serveur au premier message CloneChat, ou par la requête de
préparation ci-dessous (§4).

**Cause racine — établie, et ce n'est pas un défaut du dépôt :**
la migration canonique **crée déjà le rôle, de façon idempotente**. Elle n'avait simplement
**jamais été appliquée** à la base ciblée. C'est un **défaut de provisioning**, pas un code manquant.

| | |
|---|---|
| Rôle référencé par | `src/lib/clonechat/durable/pg.ts` (`assumeRole` par défaut = `clonechat_app`) |
| Migration canonique | `supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql` (bloc P9.4.1) |
| Le rôle y est créé ? | **Oui**, idempotent : `if not exists (select 1 from pg_roles where rolname='clonechat_app') then create role clonechat_app nologin;` |
| Action requise | **Appliquer la migration** à la base de déploiement. Rien à écrire. |

---

## 2. Préconditions

1. Connexion **superutilisateur** (ou propriétaire de base) — `create role` l'exige.
2. Vous appliquez à la **bonne base**. La résolution runtime est `CLONECHAT_DB_URL || DATABASE_URL`.
3. **Fenêtre de maintenance non requise** : la migration est additive et idempotente.
4. Sauvegarde/point de restauration selon la politique de l'environnement.

> ⚠️ **Contrôle de sécurité obligatoire avant toute application distante.**
> `node scripts/c1-4-db-safety-check.mjs` classe la cible **par catégorie** (jamais par URL affichée).
> **En C1.4, la cible par défaut (`DATABASE_URL`) est classée `managed_supabase_remote` :
> la production ne pouvant pas être exclue, AUCUNE migration ne lui a été appliquée par cette session.**
> Le provisioning a été prouvé sur une **base locale jetable** (embedded-postgres).

---

## 3. Commande d'application

**La migration canonique est la seule source de vérité. Ne recopiez pas de SQL à la main.**

```bash
# 1) Classer la cible (n'imprime jamais l'URL)
node scripts/c1-4-db-safety-check.mjs

# 2) Appliquer la migration canonique P9.4.1 (idempotente)
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql
```

`MIGRATION_DATABASE_URL` est fourni par l'opérateur depuis son coffre — **jamais** commité,
jamais journalisé, jamais affiché.

**Vérification locale reproductible (aucune base distante touchée) :**

```bash
node scripts/c1-4-local-budget-db.mjs      # postgres jetable → applique → prouve rôle + RLS + budget réel
```

---

## 4. Requête de préparation (« readiness »)

À exécuter **après** la migration. Les quatre lignes doivent être vraies.

```sql
select
  exists (select 1 from pg_roles where rolname = 'clonechat_app')                     as role_exists,
  (select not (rolsuper or rolcreatedb or rolcreaterole or rolcanlogin or rolreplication)
     from pg_roles where rolname = 'clonechat_app')                                    as least_privilege,
  (select not rolbypassrls from pg_roles where rolname = 'clonechat_app')              as rls_enforced,
  (select bool_and(relrowsecurity) from pg_class
    where relname like 'clonechat\_%' and relkind = 'r')                               as rls_on_all_tables;
```

| Colonne | Attendu | Signification |
|---|---|---|
| `role_exists` | `true` | Le rôle existe : les transactions durables peuvent l'assumer. |
| `least_privilege` | `true` | Ni superutilisateur, ni `createdb`, ni `createrole`, ni **login**, ni réplication. |
| `rls_enforced` | `true` | **`NOBYPASSRLS`** — le rôle ne peut pas contourner l'isolation tenant. |
| `rls_on_all_tables` | `true` | RLS activée sur toutes les tables `clonechat_*`. |

Contrôle complémentaire — **le rôle ne doit avoir de droits que sur le périmètre CloneChat** :

```sql
select table_name, string_agg(distinct privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
 where grantee = 'clonechat_app'
 group by table_name order by table_name;
```

Attendu : **uniquement** des tables `clonechat_*`. Toute table hors `clonechat_*` dans ce
résultat est un **échec de contrôle** — arrêtez et corrigez avant de déployer.

---

## 5. Moindre privilège accordé (ce que le rôle peut, et rien de plus)

- `nologin` — **aucune connexion directe possible** ; le rôle n'est assumé que par `set local role`
  à l'intérieur d'une transaction de l'application.
- **`NOBYPASSRLS`** — soumis à la RLS comme tout le monde ; l'isolation par entreprise tient.
- Pas de `superuser`, pas de `createdb`, pas de `createrole`, pas de `replication`.
- `select/insert/update` **uniquement sur les tables `clonechat_*`**, plus l'exécution des
  trois fonctions de budget. Aucun droit sur les tables Pierre, entreprises, commandes, ou Stripe.

---

## 6. Rollback

La migration est **additive** : le rollback normal est de **ne rien faire** (aucune donnée
détruite, aucune colonne modifiée). Si le rôle doit être retiré d'un environnement **non
productif** :

```sql
-- Environnements NON PRODUCTIFS uniquement.
reassign owned by clonechat_app to current_user;   -- ne s'applique que s'il possède des objets
drop owned by clonechat_app;                       -- retire les droits accordés
drop role clonechat_app;
```

**Effet :** CloneChat perd le budget durable et retombe sur le repli **déterministe** (C1.4) —
les questions publiques répondent encore ; aucun appel OpenAI n'est émis ; aucune donnée n'est perdue.
**Ne jamais exécuter ceci en production.**

---

## 7. Action de l'opérateur avant déploiement contrôlé

1. Lancer `node scripts/c1-4-db-safety-check.mjs` et **confirmer la cible**.
2. Appliquer la migration canonique (§3) avec une connexion privilégiée issue du coffre.
3. Exécuter la requête de préparation (§4) — **les quatre colonnes doivent être `true`**.
4. Exécuter le contrôle de périmètre des droits (§4) — **aucune table hors `clonechat_*`**.
5. Redémarrer/redéployer l'application ; envoyer **une** question publique dans CloneChat.
6. Confirmer en base : `select count(*) from clonechat_usage_events;` > 0 et
   `select sum(reserved_tokens) from clonechat_budget_counters;` = 0 (aucune réservation fuitée).

**Rappel de périmètre.** Ce runbook rend CloneChat opérationnel. Il **n'autorise pas la
production** : `PRODUCTION_AUTHORIZED` reste `false`, le paiement reste `disabled`, et les
providers live (voix, téléphonie, signature, e-mail) restent bloqués.
