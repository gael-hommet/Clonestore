# PHASE 3.3 — CloneOS History Safe Apply

> Généré le : 2026-06-04
> Base : PHASE 3.1 → 3.2 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif

Activer la persistence serveur de l'historique CloneOS de façon sûre et contrôlée.

**Si le SQL n'est pas encore appliqué :**
- L'application fonctionne normalement en localStorage uniquement.
- Aucune erreur UI. Aucune donnée perdue.
- Le fallback localStorage est toujours actif.

**Ce document donne les instructions manuelles à Gael pour activer la persistence server.**

---

## 2. Prérequis

Avant d'appliquer la migration :

- [ ] Accès au Supabase Dashboard du projet CloneStore.
- [ ] Environnement de test disponible (recommandé : projet Supabase de staging).
- [ ] TypeScript propre : `npx tsc --noEmit` sans erreur.
- [ ] Tests passants : `npm run test:phase3-3`.

---

## 3. Application du SQL — Instructions manuelles

### Étape 1 : Ouvrir Supabase Dashboard

1. Aller sur [https://app.supabase.com](https://app.supabase.com).
2. Sélectionner le projet CloneStore.
3. Dans le menu latéral : **SQL Editor**.

### Étape 2 : Coller et exécuter le SQL

1. Ouvrir le fichier : `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql`.
2. Copier tout le contenu.
3. Coller dans le SQL Editor.
4. Cliquer **Run**.

### Étape 3 : Vérifier la table

Dans **Table Editor** ou SQL Editor :

```sql
-- Vérifier que la table existe
select count(*) from public.clonestore_cloneos_history;

-- Vérifier RLS enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename = 'clonestore_cloneos_history';
```

Résultat attendu : `rowsecurity = true`.

### Étape 4 : Vérifier les policies RLS

```sql
select policyname, cmd, qual
from pg_policies
where tablename = 'clonestore_cloneos_history';
```

Résultat attendu :

| policyname | cmd |
|-----------|-----|
| cloneos_history_select_own | SELECT |
| cloneos_history_insert_own | INSERT |

**Important :** Pas de policy DELETE. Pas de policy UPDATE. L'audit trail est immuable.

### Étape 5 : Ne pas modifier public launch flags

- Ne pas modifier `go-live-proofs.local.json`.
- Ne pas activer `B48_PUBLIC_LAUNCH_ENABLED`.
- Public launch reste NO-GO externe.

---

## 4. Activation du flag serveur

### Étape 6 : Ajouter la variable d'environnement

Dans `.env.local` (NE PAS committer dans git) :

```env
NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true
```

**Important :**
- Cette variable active l'écriture DB depuis `/profile/agents`.
- Elle n'active pas le public launch.
- Elle ne modifie pas la RLS.
- Elle n'appelle pas OpenAI, Anthropic, Stripe live.

---

## 5. Validation après activation

### Étape 7 : Validation technique

```bash
npx tsc --noEmit
npm run test:phase3-3
npm run test:phase3-2
npm run test:phase3-1
npm run test:pfinal02
npm run build
```

Tous les tests doivent passer. Le build doit être clean.

### Étape 8 : Test fonctionnel

1. Démarrer le dev server : `npm run dev`.
2. Se connecter à `/profile/agents`.
3. Soumettre une commande dans le centre CloneOS.
4. Vérifier dans Supabase Dashboard > Table Editor > `clonestore_cloneos_history` :
   - Une ligne apparaît avec le bon `user_id` et `command_id`.
   - `raw_request_summary` est tronqué (≤ 280 chars).
   - `metadata` est redacté (pas de secret).
5. Vérifier que l'application ne montre aucune erreur.
6. Vérifier que le fallback localStorage fonctionne toujours.

---

## 6. Modes de fonctionnement

| Condition | Mode | Comportement |
|-----------|------|-------------|
| SQL non appliqué | `localstorage_only` | Pas d'erreur — localStorage OK |
| SQL appliqué + flag false | `server_draft` | localStorage uniquement |
| SQL appliqué + flag true | `server_active` | localStorage + DB write best-effort |
| RLS bloque | `localstorage_only` | Fallback localStorage — pas d'erreur UI |
| DB write fail | `localstorage_only` | Fallback localStorage — UI non impactée |

---

## 7. Garanties

- **localStorage est toujours écrit** avant toute tentative DB.
- **Si DB fail → localStorage conservé** et UI non impactée.
- **Aucune erreur bloquante** si table absente ou RLS bloque.
- **Aucune exécution métier** depuis l'historique.
- **Aucun email envoyé**, aucun document généré, aucune mission exécutée.
- **Moteur Pierre intact** — aucune modification.

---

## 8. Rollback

Pour désactiver la persistence serveur :

1. Retirer ou mettre à false : `NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=false`.
2. Relancer `npm run build`.
3. Le système revient en mode `localstorage_only`.

**Les données déjà persistées en DB restent** — elles ne sont pas supprimées (audit trail immuable par design).

---

## 9. Public launch : toujours NO-GO externe

L'activation de la persistence serveur CloneOS History ne constitue pas un public launch.

- `B48_PUBLIC_LAUNCH_ENABLED` reste `false`.
- Les conditions humaines de public launch restent requises (société légale, Stripe live, RLS production complète, validation juriste).
- `go-live-proofs.local.json` n'est pas modifié.

---

*PHASE 3.3 — CloneOS History Safe Apply — Instructions manuelles.*
*Moteur Pierre intact. APIs intactes. Aucune migration automatique.*
*localStorage reste le fallback actif.*
