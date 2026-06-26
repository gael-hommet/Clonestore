# PHASE 3.19 — CloneOS History Manual Activation QA

## Objectif

Procédure de QA manuelle stricte pour l'activation réelle de la persistance
serveur de l'historique CloneOS (`clonestore_cloneos_history`). Chaque étape doit
être vérifiée manuellement par l'opérateur.
**Aucune activation automatique. Aucun SQL appliqué par le code. Aucune exécution CloneOS.**

---

## État avant PHASE 3.19

- localStorage CloneOS History actif : clé `clonestore.cloneos.commandHistory.v1`,
  lu via `loadCloneOSHistoryItemsFromLocalStorage()`.
- SQL draft `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql` : présent, **non appliqué**.
- Table `clonestore_cloneos_history` : non créée.
- RLS/policies (`cloneos_history_select_own`, `cloneos_history_insert_own`) :
  conçues, **non appliquées**. Pas d'UPDATE ni DELETE (audit trail immuable).
- Safe apply runtime : `persistCloneOSHistoryWithFallback` (localStorage-first).
- Feature flag : `NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED` = false.
- P3.17 : `/profile/messages` lit l'historique via le context feed unifié (read-only).

---

## Prérequis

1. Build clean : `npm run build`.
2. Tests passent : `npm run test:phase3-18`.
3. Accès Supabase dashboard (SQL Editor).
4. Compte test disponible dans l'app.
5. `.env.local` accessible pour modification locale.

---

## localStorage CloneOS History

- Clé : `clonestore.cloneos.commandHistory.v1`.
- Loader : `loadCloneOSHistoryItemsFromLocalStorage()`.
- Items `read_only: true`, plan-only.
- localStorage reste le fallback actif même après activation serveur.

---

## SQL / table CloneOS History

- Table cible : `public.clonestore_cloneos_history`.
- SQL draft : `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql` (présent dans le repo).
- RLS : `select_own` + `insert_own`. Pas d'UPDATE/DELETE (audit trail immuable).

---

## Procédure conditionnelle

### CAS A — SQL CloneOS History existe (cas actuel)

1. Ouvrir **Supabase → SQL Editor**.
2. Coller le SQL draft `PHASE_3_2_CLONEOS_HISTORY.sql`.
3. **Run** manuel.
4. Lancer les checks table / RLS / policies / constraints (requêtes A→E).
5. Activer le flag local `NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true`.
6. Tester local + serveur.

### CAS B — SQL CloneOS History absent

1. Ne rien appliquer.
2. Conserver localStorage-only.
3. Marquer l'evidence **NEEDS REVIEW**.
4. Prévoir un futur bloc CloneOS History Server Persistence Design.

---

## Ordre exact d'activation manuelle (CAS A)

### Étape 1 — Vérification initiale

```bash
npm run check:cloneos-history-readiness
npm run check:cloneos-history-manual-activation-qa
```

### Étape 2 — Appliquer le SQL manuellement

1. **Supabase dashboard → SQL Editor**.
2. Copier `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql`.
3. Coller → **Run**.
4. Vérifier : aucune erreur.

**Jamais appliquer via le code applicatif.**

### Étape 3 — Vérifier table / RLS / policies / constraints

**A. Table existe ?**
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'clonestore_cloneos_history';
```

**B. RLS activée ?**
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'clonestore_cloneos_history';
```
Attendu : rowsecurity = true.

**C. Policies ?**
```sql
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'clonestore_cloneos_history'
order by cmd, policyname;
```
Attendu : `cloneos_history_select_own` (SELECT) + `cloneos_history_insert_own` (INSERT).
Aucune UPDATE/DELETE (audit trail immuable).

**D. Contraintes ?**
```sql
select conname from pg_constraint
where conrelid = 'public.clonestore_cloneos_history'::regclass order by conname;
```

### Étape 4 — Activer le flag en local

Ajouter dans `.env.local` :
```
NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true
```
**Uniquement en local/test.**

### Étape 5 — Redémarrer l'app

```bash
npm run dev
```

### Étape 6 — Générer une demande CloneOS locale

Se connecter, lancer une demande depuis le cockpit Pierre / CloneOS command bar
(plan-only, aucune exécution réelle).

### Étape 7 — Vérifier localStorage

DevTools → Application → LocalStorage → vérifier `clonestore.cloneos.commandHistory.v1`.

### Étape 8 — Vérifier la row Supabase (si sync serveur)

```sql
select * from public.clonestore_cloneos_history
order by updated_at desc limit 5;
```

### Étape 9 — Vérifier /profile/messages context feed

Aller sur `/profile/messages` → vérifier la section **Historique CloneOS** dans le
panneau "Contexte système CloneStore" (lecture seule).

### Étape 10 — Vérifier refresh / restore

F5 → vérifier que l'historique est intact.

### Étape 11 — Rollback flag off

1. Retirer `NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true` de `.env.local`.
2. `npm run dev`.
3. Vérifier que l'historique CloneOS est lu depuis localStorage, sans crash.

### Étape 12 — Remplir l'evidence template

Ouvrir `docs/templates/PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_EVIDENCE.md`.

---

## Critères PASS / FAIL

### PASS
- Table créée ✅ · RLS activée ✅ · policies select/insert ✅ · aucune DELETE ✅
- Écriture localStorage fonctionne ✅
- Historique visible dans `/profile/messages` ✅
- Refresh/restore OK ✅ · Rollback propre ✅
- Aucun write depuis pages Pierre / messages ✅
- Aucune exécution CloneOS ✅

### FAIL (bloquant)
- Table absente après SQL appliqué
- RLS désactivée
- Policy SELECT/INSERT manquante
- Write déclenché depuis pages Pierre / messages
- localStorage effacé après rollback
- Exécution CloneOS déclenchée

---

## Rollback

1. Retirer le flag `.env.local`.
2. `npm run dev`.
3. localStorage intact (source de vérité prioritaire).
4. La table Supabase peut rester sans conséquence (RLS protège).

---

## Ce qui est activé maintenant

✅ Module QA manuel CloneOS History (27 étapes).
✅ Script de guidance read-only.
✅ Evidence template.
✅ Documentation d'activation (CAS A / CAS B).
✅ Requêtes SQL de vérification.

---

## Ce qui reste non activé

- Table SQL `clonestore_cloneos_history` non encore créée (manuel requis).
- Feature flag = false.
- Sync serveur non opérationnelle jusqu'à activation manuelle.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 3.19

- Application automatique du SQL.
- Modification de `.env.local`.
- Hardcode du flag.
- Write depuis les scripts.
- Appel POST automatique.
- Exécution d'une commande CloneOS.
- Modification du moteur Pierre.
- Appel OpenAI / Anthropic.
- Modification de `go-live-proofs.local.json`.

**Lancement public externe : toujours non validé.**

---

## Prochain bloc recommandé

**PHASE 3.20 — Global Employee Context Registry Design**

Design (design-only) d'un registre de contexte employés global réutilisable par
les futurs employés IA, alimenté par l'Empreinte Entreprise et l'historique CloneOS.

Alternatives :
- PHASE 3.20 — CloneOS History Server Persistence Design (si SQL à compléter)
- PHASE 3.20 — Phase 3 Final QA Gate (si tout est couvert)
