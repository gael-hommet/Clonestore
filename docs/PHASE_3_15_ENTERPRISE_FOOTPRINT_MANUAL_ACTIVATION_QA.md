# PHASE 3.15 — Enterprise Footprint Manual Activation QA

## Objectif

Procédure de QA manuelle stricte pour l'activation réelle de la persistence
serveur de l'Empreinte Entreprise. Chaque étape doit être vérifiée manuellement
par l'opérateur. **Aucune activation automatique. Aucun SQL appliqué par le code.**

---

## État avant PHASE 3.15

- PHASE 3.13 : SQL draft + modules server design. Table non créée. Flag false.
- PHASE 3.14 : Route API GET/POST feature-flaggée. Runtime localStorage-first.
  `/profile/onboarding` utilise `persistEnterpriseFootprintWithFallback`.
  Aucun write serveur depuis les pages Pierre.
- SQL `PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql` : non appliqué.
- Table `clonestore_enterprise_footprints` : non créée.
- Feature flag : false.

---

## Prérequis

Avant de commencer :

1. Build clean : `npm run build` → aucune erreur TypeScript
2. Tests passent : `npm run test:phase3-14` → 48/48
3. Accès Supabase dashboard disponible (SQL Editor)
4. Compte test disponible dans l'app
5. `.env.local` accessible pour modification locale

---

## Ordre exact d'activation manuelle

### Étape 1 — Vérification initiale

```bash
npm run check:enterprise-footprint-server-readiness
npm run check:enterprise-footprint-safe-apply
npm run check:enterprise-footprint-manual-activation-qa
```

Vérifier : SQL draft présent, route API présente, flag = false.

---

### Étape 2 — Appliquer le SQL manuellement

1. Ouvrir **Supabase dashboard** → **SQL Editor**
2. Copier le contenu de `supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql`
3. Coller dans le SQL Editor
4. Cliquer **Run**
5. Vérifier : aucune erreur, message de succès

**Jamais appliquer via le code applicatif.**

---

### Étape 3 — Vérifier table / RLS / policies / constraints

Lancer les requêtes suivantes dans Supabase SQL Editor :

**A. Table existe ?**
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
and table_name = 'clonestore_enterprise_footprints';
```
Attendu : 1 ligne.

**B. RLS activée ?**
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints';
```
Attendu : rowsecurity = true.

**C. Policies RLS ?**
```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints'
order by cmd, policyname;
```
Attendu : 3 policies (INSERT, SELECT, UPDATE). Aucun DELETE.

**D. Contraintes ?**
```sql
select conname
from pg_constraint
where conrelid = 'public.clonestore_enterprise_footprints'::regclass
order by conname;
```
Attendu : 6 contraintes (unique + check scores + check status + check source + check company_id).

---

### Étape 4 — Activer le flag en local

Ajouter dans `.env.local` :
```
NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true
```

**Uniquement en local/test. Ne pas pousser en production sans validation complète.**

---

### Étape 5 — Redémarrer l'app

```bash
npm run dev
```

Vérifier : démarrage sans erreur.

---

### Étape 6 — Tester /profile/onboarding

1. Se connecter avec un compte test
2. Aller sur `/profile/onboarding`
3. Remplir le formulaire (identité, personnes, documents)
4. Observer le status dans le panneau Empreinte Entreprise

Attendu si activation OK :
- "Empreinte synchronisée serveur"

Attendu si table KO ou RLS KO :
- "Serveur indisponible — fallback local" + localStorage intact

---

### Étape 7 — Vérifier la row Supabase

Dans Supabase SQL Editor :
```sql
select id, user_id, company_id, status, readiness_score, coverage_score, updated_at
from public.clonestore_enterprise_footprints
order by updated_at desc
limit 5;
```
Attendu : 1 ligne créée pour l'utilisateur de test.

---

### Étape 8 — Vérifier GET /api/profile/enterprise-footprint

DevTools → Network → chercher `enterprise-footprint` → GET.

Attendu : `{ ok: true, footprint: {...}, source: "server", server_available: true }`.

---

### Étape 9 — Vérifier refresh / restore

1. Appuyer sur F5
2. Vérifier que les données Empreinte sont intactes
3. Observer le status UI

Attendu : données préservées, status cohérent.

---

### Étape 10 — Vérifier les pages agents et Pierre

Dans DevTools → Network, aller sur :
- `/profile/agents`
- `/agents/pierre/setup`
- `/agents/pierre/use`

Vérifier : **aucun POST `/api/profile/enterprise-footprint`** depuis ces pages.

---

### Étape 11 — Rollback flag off

1. Retirer `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true` de `.env.local`
2. Relancer `npm run dev`
3. Aller sur `/profile/onboarding`

Attendu :
- Status = "Empreinte sauvegardée localement"
- localStorage intact (vérifier DevTools → LocalStorage)
- Aucun crash

---

### Étape 12 — Remplir l'evidence template

Ouvrir `docs/templates/PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_EVIDENCE.md` et le remplir.

---

## Critères PASS / FAIL

### PASS

- Table créée dans Supabase ✅
- RLS activée ✅
- 3 policies SELECT/INSERT/UPDATE ✅
- Aucune policy DELETE ✅
- Save localStorage fonctionne ✅
- Sync serveur fonctionne (status "synchronisée serveur") ✅
- Row créée dans Supabase ✅
- Refresh restore OK ✅
- Rollback propre ✅
- Aucun write depuis pages agents/Pierre ✅

### FAIL (critères bloquants)

- Table absente après SQL appliqué
- RLS désactivée
- Policy SELECT/INSERT/UPDATE manquante
- Write déclenché depuis pages Pierre
- localStorage effacé après rollback
- App crash sur rollback

---

## Health check

`checkEnterpriseFootprintServerTableReadiness(supabase, userId)` disponible via :

```ts
import { checkEnterpriseFootprintServerTableReadiness } from "@/lib/clonestore/enterprise-footprint";
```

Retourne : `{ table_available, rls_select_ok, can_attempt_write, warnings }`.

---

## Rollback complet

Si problème grave :

1. Retirer le flag `.env.local`
2. Relancer `npm run dev`
3. localStorage est intact (source de vérité prioritaire)
4. La table Supabase peut rester sans conséquence (RLS protège)
5. Les données clientes sont préservées en localStorage

---

## Ce qui est activé maintenant

✅ Module QA manuel (24 étapes).  
✅ Script de guidance read-only.  
✅ Evidence template.  
✅ Documentation d'activation complète.  
✅ SQL queries de vérification.  
✅ Critères PASS/FAIL documentés.

---

## Ce qui reste non activé

- Table SQL `clonestore_enterprise_footprints` non encore créée (manuel requis).
- Feature flag = false (activation manuelle requise).
- Sync serveur non opérationnelle jusqu'à activation manuelle.

---

## Ce qui n'a PAS été fait en PHASE 3.15

- Application automatique du SQL.
- Modification de `.env.local`.
- Hardcode du flag.
- Write depuis les pages Pierre.
- Modification du moteur Pierre.
- Appel OpenAI / Anthropic.

**Lancement public externe : toujours non validé.**

---

## Prochain bloc recommandé

**PHASE 3.16 — Profile Messages Enterprise Footprint Feed**

Intégrer l'Empreinte Entreprise dans le feed de messages `/profile/messages` :
- Affichage read-only des données Empreinte dans le contexte des messages.
- Pas de write serveur depuis Messages.

Alternatives :
- PHASE 3.16 — Enterprise Footprint Server Restore UI Polish
- PHASE 3.16 — CloneOS History Manual Activation QA
