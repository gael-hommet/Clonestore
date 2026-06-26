# PHASE 4.6 — Runtime Mission Draft Manual Activation QA

## Objectif

Procédure de **QA manuelle stricte** pour l'activation serveur réelle de la
persistance des `RuntimeMissionDraft`. Chaque étape est vérifiée manuellement par
l'opérateur. **Aucune activation automatique. Aucun SQL appliqué par le code.
Aucun write depuis les scripts.**

PHASE 4.6 = **Manual Activation QA uniquement** — ne crée pas de nouvelle feature
runtime ; permet de tester proprement, manuellement et réversiblement la
persistance serveur préparée en P4.4/P4.5.

---

## État P4.5

- Sauvegarde localStorage active (au clic) + restore local.
- Route `/api/clonestore/runtime/mission-drafts` GET/POST feature-flaggée.
- POST retourne **423** si flag false.
- Safe apply localStorage-first. Validée 101/101.

---

## Différence entre localStorage save et server persistence

- **localStorage save** (P4.5) : actif, au clic, brouillon côté navigateur,
  enveloppe versionnée, restaurable. Aucune dépendance serveur.
- **Server persistence** (P4.6 à activer) : optionnelle, feature-flaggée. Le row
  serveur reste un **brouillon** (safety_flags tous false), jamais une mission réelle.

---

## Prérequis

1. Build clean : `npm run build`.
2. Tests passent : `npm run test:phase4-5`.
3. Accès Supabase dashboard (SQL Editor).
4. Compte test disponible.
5. `.env.local` accessible pour modification locale.

---

## SQL P4.4 / table / flag / route

- SQL : `supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql` (non appliqué).
- Table : `public.clonestore_runtime_mission_drafts`.
- Flag : `NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED` (default false).
- Route : `/api/clonestore/runtime/mission-drafts` — GET capabilities, **POST 423**
  si flag false, POST 200 si flag true + SQL + auth.

---

## Ordre exact d'activation manuelle

### Étape 1 — Avant activation
1. Garder le flag false.
2. `npm run dev`.
3. Vérifier que **POST mission-drafts → 423** (avant activation).
4. Vérifier la sauvegarde localStorage + le restore local.

### Étape 2 — Appliquer le SQL manuellement
1. **Supabase → SQL Editor**.
2. Coller `PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql` → **Run**.

**Jamais appliquer via le code applicatif.**

### Étape 3 — Vérifier table / RLS / policies / constraints / indexes

**A. Table existe ?**
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'clonestore_runtime_mission_drafts';
```

**B. RLS activée ?**
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'clonestore_runtime_mission_drafts';
```
Attendu : rowsecurity = true.

**C. Policies ?**
```sql
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'clonestore_runtime_mission_drafts'
order by cmd, policyname;
```
Attendu : select_own / insert_own / update_own. **Aucune DELETE.**

**D. Contraintes ?**
```sql
select conname from pg_constraint
where conrelid = 'public.clonestore_runtime_mission_drafts'::regclass order by conname;
```
Attendu : unique + status/kind + `chk_runtime_mission_draft_no_execution`.

**E. Index ?**
```sql
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'clonestore_runtime_mission_drafts' order by indexname;
```

### Étape 4 — Activer le flag en local
Ajouter dans `.env.local` :
```
NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED=true
```
**Uniquement en local/test.**

### Étape 5 — Redémarrer l'app
```bash
npm run dev
```

### Étape 6 — Créer simulation + brouillon + save
1. Se connecter.
2. `/profile/messages` → Command Center Preview → Simuler → Préparer un brouillon local.
3. Cliquer **Sauvegarder le brouillon localement**.

### Étape 7 — Vérifier POST 200
DevTools → Network → POST `mission-drafts`. Attendu : **200** · `db_write_performed: true`.

### Étape 8 — Vérifier la row Supabase
```sql
select id, user_id, draft_id, command_id, plan_id, kind, status, safety_flags, updated_at
from public.clonestore_runtime_mission_drafts order by updated_at desc limit 5;
```

### Étape 9 — Vérifier safety_flags false
```sql
select draft_id,
  safety_flags->>'execution_enabled' as execution_enabled,
  safety_flags->>'pierre_engine_called' as pierre_engine_called
from public.clonestore_runtime_mission_drafts order by updated_at desc limit 5;
```
Attendu : tous `'false'`.

### Étape 10 — Vérifier qu'aucune mission réelle n'est créée
Le row est un **brouillon**. Aucune table mission Pierre ne reçoit de ligne.

### Étape 11 — Rollback
1. Retirer le flag de `.env.local`.
2. `npm run dev`.
3. Vérifier **POST → 423** après rollback.
4. Vérifier que le **restore localStorage** fonctionne toujours.

### Étape 12 — Remplir l'evidence template
`docs/templates/PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_EVIDENCE.md`.

---

## Procédure conditionnelle

### CAS A — SQL appliqué avec succès
Table existe · RLS enabled · policies own rows · constraints safety · flag
activable localement · **POST 200** possible · row créée (brouillon, safety_flags false).

### CAS B — SQL non appliqué / table manquante
Serveur non activable. Conserver localStorage-first. **POST reste 423** si flag
false (ou erreur table_missing si flag true). Evidence **NEEDS REVIEW**. Ne pas
forcer le serveur.

### CAS C — RLS/auth bloque
Vérifier l'utilisateur connecté et les policies. Conserver le fallback local.
Rollback flag false.

### CAS D — rollback
Remettre le flag false → redémarrer → **POST 423** → localStorage restore OK.

---

## Critères PASS / FAIL / NEEDS REVIEW

### PASS
- Table créée · RLS enabled · policies select/insert/update · aucune DELETE.
- Constraints safety_flags · POST 423 avant · POST 200 après · row créée.
- safety_flags tous false · aucune mission réelle · aucune exécution.
- Rollback propre · POST 423 après rollback · localStorage intact.

### FAIL (bloquant)
- Table absente après SQL · RLS off · policy manquante · POST n'écrit pas un brouillon.
- safety_flags non-false · mission réelle créée · exécution déclenchée.
- localStorage effacé après rollback.

### NEEDS REVIEW
- CAS B (SQL absent) · étapes non bloquantes à revoir.

---

## Rollback

Retirer le flag `.env.local` → `npm run dev` → POST 423 → localStorage restore OK.
La table Supabase peut rester (RLS protège, audit trail). localStorage reste le
fallback actif.

---

## Ce qui est activé maintenant

✅ Module QA manuel (32 étapes) · script de guidance read-only.
✅ Evidence template · doc d'activation (CAS A/B/C/D) · requêtes SQL.
✅ Exports index.

---

## Ce qui reste non activé

- Table SQL non encore créée (manuel requis).
- Feature flag = false.
- Persistance serveur non opérationnelle jusqu'à activation manuelle.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 4.6

- Aucune application automatique du SQL · aucun `.env.local` modifié · aucun flag activé.
- Aucun write depuis les scripts · aucun POST automatique.
- Aucune mission réelle créée · aucune exécution CloneOS.
- Aucun appel Pierre moteur · aucun appel IA · aucun email/message/document/PDF.
- Aucune activation CloneVoice · aucune modification de `go-live-proofs.local.json`.

**scale 80k non prouvé. lancement public externe non validé.**

---

## Prochain bloc recommandé

**PHASE 4.7 — Runtime Mission Draft Server Restore UI Polish**

Afficher le statut local/serveur du brouillon dans `/profile/messages` (source
effective, dernière sync, restore serveur quand flag true), read-only.

Alternative :
- PHASE 4.7 — Runtime Mission Promotion Contract / Draft → Controlled Mission.
