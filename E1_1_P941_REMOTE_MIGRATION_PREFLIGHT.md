# E1.1 — Prévol de migration distante P9.4.1 (`clonechat_app`)

**Statut : NON APPLIQUÉE PAR CETTE SESSION. Aucune base distante n'a été modifiée.**
Ce document prépare une action **opérateur autorisé**. Il ne l'exécute pas.

> **Aucune valeur secrète ici.** Pas de DSN, pas de mot de passe, pas de clé.
> La cible est désignée par le **nom** de sa variable d'environnement, jamais par sa valeur.

---

## 1. Fichier de migration exact

```
supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql
```

**C'est la seule source de vérité.** Ne recopiez aucun SQL à la main : le rôle, la RLS et les
droits doivent rester cohérents avec le runtime.

### Audit du contenu (vérifié en E1.1, lecture seule)

| Contrôle | Résultat | Preuve |
|---|---|---|
| Création de rôle **idempotente** | ✅ `if not exists (select 1 from pg_roles where rolname='clonechat_app') then create role clonechat_app nologin;` | ligne 21–22 |
| Nom du rôle | ✅ `clonechat_app` | ligne 22 |
| `NOLOGIN` | ✅ explicite | ligne 22 |
| `NOSUPERUSER` / `NOCREATEDB` / `NOCREATEROLE` / `NOBYPASSRLS` / `NOREPLICATION` | ✅ **par défaut PostgreSQL** (`create role` sans ces options ne les accorde jamais) — **et vérifié empiriquement** sur base locale en C1.4 | `database-role-privileges.json` |
| Droits **limités au périmètre** | ✅ `grant select, insert, update, delete` **uniquement** sur les tables `clonechat_*` | lignes 273, 291, 297, 303, 310 |
| Fonctions | ✅ `execute` sur exactement 3 fonctions de budget (`try_reserve`, `commit`, `release`) | lignes 312–314 |
| Aucun droit large (`all tables in schema`, `public`) | ✅ aucun | — |
| RLS activée **et forcée** | ✅ `enable` + **`force`** row level security sur toutes les tables | lignes 269–270, 279–307 |
| Politique tenant à portée **serveur** | ✅ `company_id::text = current_setting('app.current_company', true)` — la portée est posée par le serveur dans la transaction, jamais par le client | ligne 272 |
| DDL hors périmètre `clonechat_*` | ✅ **aucun** | — |

### Observation résiduelle — à connaître, assumée par conception

Trois tables ont la RLS **activée et forcée**, mais une politique **permissive** (`using (true)`) :

- `clonechat_budget_counters`
- `clonechat_usage_events`
- `clonechat_action_executions`

Ce sont des tables de **comptabilité transverse** (budget global, jetons consommés, registre
d'exécution) : elles ne sont **pas isolées par tenant au niveau RLS**, l'isolation est appliquée
par l'application (portée serveur + clés opaques).

**Ce qu'elles contiennent** : des **métadonnées de comptage** — `company_id`, `user_id`, modèle,
jetons, empreinte d'idempotence. **Aucun contenu RH, aucun message, aucun document.**
**Ce qu'elles impliquent** : un porteur du rôle `clonechat_app` peut lire la comptabilité de tous
les tenants. Le rôle étant **`NOLOGIN`** (assumable uniquement par le serveur, via `set local role`,
à l'intérieur d'une transaction applicative), la surface reste **interne**.

Ce point est **documenté, pas corrigé** : modifier P9.4.1 sortirait du périmètre E1.1 et
toucherait une couche déjà vérifiée. À traiter comme durcissement défense-en-profondeur ultérieur.

---

## 2. Autorisation requise

L'application de la migration exige :

1. une décision explicite du **propriétaire** ;
2. une connexion **superutilisateur / propriétaire de base** (`create role` l'exige) ;
3. la **confirmation de la cible** (voir §3) ;
4. une **sauvegarde / point de restauration** conforme à la politique de l'environnement.

**La cible par défaut est classée `managed_supabase_remote` : la production ne peut pas être
exclue.** C'est précisément pourquoi **aucune session automatisée n'y a touché**.

---

## 3. Prévol en LECTURE SEULE (à lancer avant toute mutation)

```bash
# (a) classer la cible — n'ouvre AUCUNE connexion, n'imprime JAMAIS l'URL
node scripts/e1-1-clonechat-remote-preflight.mjs

# (b) sonder l'état réel — LECTURE SEULE, opérateur autorisé uniquement
node scripts/e1-1-clonechat-remote-preflight.mjs --connect
```

Le script **n'exécute aucun** `CREATE` / `ALTER` / `GRANT` / `DROP` / `INSERT` / `UPDATE` / `DELETE` :
il ouvre une transaction `read only` et n'interroge que le **catalogue** (`pg_roles`, `pg_class`,
`information_schema`). Il refuse de s'exécuter si l'URL apparaissait dans sa sortie.

Il rend un `migrationState` :

| État | Signification | Action |
|---|---|---|
| `UNAPPLIED` | ni rôle ni tables `clonechat_*` | appliquer la migration (§5) |
| `PARTIAL` | rôle **ou** tables présents, mais un contrôle échoue | **ne pas déployer** — diagnostiquer d'abord |
| `COMPLETE` | rôle + tables + 3 fonctions + RLS + droits au périmètre + `rolbypassrls = false` | rien à faire |
| `UNKNOWN` | lancé sans `--connect` | l'état distant **n'est pas connu** |

> **Règle dure : la présence du fichier de migration NE PROUVE PAS son application.**
> Sans `--connect` exécuté par un opérateur autorisé, l'état distant reste **`UNKNOWN`** —
> et E1.1 le déclare ainsi, sans supposer le vert.

---

## 4. Prérequis de sauvegarde

- Sauvegarde/PITR vérifiée **avant** l'exécution.
- La migration est **additive et idempotente** : elle ne détruit ni ne modifie de données
  existantes. Une fenêtre de maintenance n'est **pas** requise.
- La relancer sur une base déjà migrée est **sans effet** (garde `if not exists` + `create ... if not exists`).

---

## 5. Commande d'exécution (opérateur autorisé)

```bash
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql
```

`MIGRATION_DATABASE_URL` provient du coffre de l'opérateur : **jamais** commitée, **jamais**
journalisée, **jamais** affichée.

**Cette commande n'a PAS été exécutée par E1.1.**

---

## 6. Vérification post-migration

```bash
node scripts/e1-1-clonechat-remote-preflight.mjs --connect   # doit rendre migrationState = COMPLETE
```

Doivent être vrais : `roleExists` · `roleLeastPrivilege` · **`roleBypassesRls = false`** ·
`rlsEnabledOnAllTables` · `budgetFunctionsPresent` · **`grantsOutsideClonechatPerimeter = []`**.

Puis, applicatif : envoyer **une** question publique dans CloneChat et confirmer

```sql
select count(*) from clonechat_usage_events;                 -- > 0
select coalesce(sum(reserved_tokens),0) from clonechat_budget_counters;  -- = 0 (aucune réservation fuitée)
```

---

## 7. Retour arrière (rollback)

La migration étant **additive**, le retour arrière normal est de **ne rien faire**.

Sur un environnement **non productif** uniquement :

```sql
reassign owned by clonechat_app to current_user;
drop owned by clonechat_app;
drop role clonechat_app;
```

**Effet fonctionnel du retrait :** CloneChat **ne plante pas** — il perd le budget durable et
retombe sur le **repli déterministe** (correction C1.4) : les questions publiques répondent
encore, **aucun appel OpenAI** n'est émis, aucune donnée n'est perdue.
**À ne jamais exécuter en production.**

---

## 8. Avertissement de périmètre

Appliquer cette migration rend CloneChat **opérationnel**. Cela **n'autorise pas la production** :

| Verrou | État après migration |
|---|---|
| `PRODUCTION_AUTHORIZED` | **reste `false`** |
| Mode de paiement | **reste `disabled`** |
| Providers live (voix, téléphonie, signature, e-mail) | **restent bloqués** |
| Déploiement | **exige une décision distincte du propriétaire** |

L'autorisation de migration et l'autorisation de production sont **deux décisions séparées**.
