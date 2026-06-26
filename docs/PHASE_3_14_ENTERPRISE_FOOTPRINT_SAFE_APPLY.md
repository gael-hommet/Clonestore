# PHASE 3.14 — Enterprise Footprint Safe Apply

## Objectif

Créer le Safe Apply de la persistance serveur Empreinte Entreprise. Route API GET/POST,
runtime localStorage-first, intégration `/profile/onboarding` derrière feature flag.
**Aucun SQL appliqué automatiquement. Flag default false. localStorage fallback intact.**

---

## État avant PHASE 3.14

- PHASE 3.13 : SQL draft, 8 modules server, feature flag = false, aucune route API, aucun write UI.
- `/profile/onboarding` : `saveEnterpriseFootprintToLocalStorage` simple, aucune sync serveur.
- Aucune route `/api/profile/enterprise-footprint`.
- Table `clonestore_enterprise_footprints` non encore créée.

---

## SQL draft P3.13 toujours manuel

Le SQL `supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql` doit être
appliqué **manuellement** avant toute activation :

```bash
# Via Supabase dashboard → SQL Editor → Coller le fichier
# Ou via CLI :
supabase db push
```

**Ne jamais appliquer depuis le code applicatif.**

---

## Route API GET/POST

### `GET /api/profile/enterprise-footprint`

- Auth obligatoire (`supabaseServer()` + `getUser()`).
- Select only — jamais de write.
- Compatible table absente (retourne `server_available: false` proprement).
- Retourne : `ok`, `footprint`, `source`, `server_available`, `fallback_reason`, `updated_at`.

### `POST /api/profile/enterprise-footprint`

- Auth obligatoire.
- **Feature flag obligatoire** — retourne 423 si `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED` = false.
- Validation + sanitisation + leak check avant write.
- Health check table/RLS avant write.
- Retourne : `ok`, `row_id`, `server_version`, `persisted`.
- **Jamais de service role** — utilise `supabaseServer()` (anon key + cookies SSR, RLS automatique).

---

## Runtime localStorage-first

`persistEnterpriseFootprintWithFallback(options)` flux obligatoire :

```
1. saveEnterpriseFootprintToLocalStorage(footprint)   ← TOUJOURS en premier
2. Guard flag → local_saved_server_disabled
3. Guard auth → local_saved_auth_required
4. Validate payload → local_saved_validation_failed
5. Health check → local_saved_table_unavailable / rls_failed
6. persistEnterpriseFootprintServerSafely → local_saved_server_failed
7. Succès → local_saved_server_synced
```

**`local_saved: true` invariant** — localStorage sauvegardé même si tout le reste échoue.

---

## Restore safe

`restoreEnterpriseFootprintWithFallback(options)` flux :

```
1. Charger localStorage immédiatement
2. Guard flag → local_restored
3. Guard auth → local_restored / auth_required
4. Health check → local_restored / table_unavailable
5. Charger latest serveur → compare updated_at
6. Si server plus récent → server_restored + re-save localStorage
7. Sinon → local_newer_than_server
```

---

## Feature flag

`NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED` — **default false**.

Conditions pré-activation :
1. SQL PHASE_3_13 appliqué et vérifications SQL OK
2. Health check select passe
3. Build et tests clean
4. Ajouter `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true` dans `.env.local`

---

## Health check

`checkEnterpriseFootprintServerTableReadiness(supabase, userId)` :
- SELECT `.select("id").eq("user_id", userId).limit(1)`
- Détecte : table manquante (42P01), RLS KO (42501)
- Retourne : `table_available`, `rls_select_ok`, `can_attempt_write`, `warnings`

---

## Intégration `/profile/onboarding`

Le `useEffect` de sauvegarde Empreinte est remplacé par :

```tsx
persistEnterpriseFootprintWithFallback({ supabase, userId, footprint: enterpriseFootprint })
  .then((result) => setFootprintSyncStatus(result.ui_status));
```

- `supabase` et `userId` déjà disponibles dans la page (P3.6).
- localStorage sauvegardé en premier (invariant).
- **Aucun direct insert/upsert enterprise-footprint dans la page.**
- `/profile/agents`, `/agents/pierre/setup`, `/agents/pierre/use` ne sont pas modifiés.

---

## Status UI

Status discret dans le panneau Empreinte :

| `ui_status` | Message affiché |
|---|---|
| `saving` | "Sauvegarde en cours…" |
| `server_synced` | "Empreinte sauvegardée localement et serveur" |
| `server_disabled` | "Empreinte sauvegardée localement" |
| `server_unavailable` | "Serveur indisponible — fallback local" |
| `local_saved` | "Empreinte sauvegardée localement" |
| `auth_required` | "Empreinte sauvegardée localement" |
| `idle` | "Aperçu local · Non persisté" |

---

## Rollback

Si le serveur échoue, localStorage reste intact. Le runtime retourne toujours
`local_saved: true`. Supprimer le flag dans `.env.local` désactive immédiatement
la sync serveur sans effet sur localStorage.

---

## Script safe apply

```bash
npm run check:enterprise-footprint-safe-apply
```

Affiche :
- état du SQL draft
- état de la route API
- état du feature flag
- requêtes SQL manuelles de vérification (table, RLS, policies, contraintes)
- instructions d'activation

---

## Requêtes SQL manuelles

```sql
-- Table existe ?
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'clonestore_enterprise_footprints';

-- RLS activée ?
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'clonestore_enterprise_footprints';

-- Policies RLS ?
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'clonestore_enterprise_footprints'
order by cmd, policyname;

-- Contraintes ?
select conname from pg_constraint
where conrelid = 'public.clonestore_enterprise_footprints'::regclass
order by conname;
```

---

## QA Module

`buildEnterpriseFootprintSafeApplyQaChecklist()` — 20 étapes incluant :
`sql_draft_exists`, `feature_flag_default_false`, `route_post_feature_flagged`,
`runtime_localstorage_first`, `runtime_health_check_before_write`, `no_service_role`,
`rollback_supported`, `public_launch_external_not_validated`.

---

## Ce qui est activé maintenant

✅ Route API GET/POST (POST feature-flaggée, GET read-only).  
✅ Runtime localStorage-first.  
✅ Persist avec fallback complet.  
✅ Restore avec merge local/server.  
✅ Intégration `/profile/onboarding` (useEffect remplacé).  
✅ Status UI discret (local/server/fallback).  
✅ Script check safe apply.  
✅ QA module 20 étapes.  
✅ API client wrapper.  
✅ Exports index.ts.

---

## Ce qui reste non activé

- Table SQL `clonestore_enterprise_footprints` non encore créée (SQL draft manuel).
- Feature flag = false (activation manuelle requise).
- Sync serveur ne se déclenche pas (flag = false).
- `/profile/agents`, `/agents/pierre/setup`, `/agents/pierre/use` : pas de write serveur.

---

## Ce qui n'a PAS été fait en PHASE 3.14

- Application automatique du SQL.
- Modification de `.env.local`.
- Hardcode du flag à true.
- Write depuis les pages Pierre.
- Modification du moteur Pierre.
- Appel OpenAI / Anthropic.
- Envoi d'email.

**Lancement public externe : toujours non validé.**

---

## Instructions manuelles pour activation

1. `node scripts/check-enterprise-footprint-safe-apply.mjs` → vérifier l'état actuel.
2. Ouvrir Supabase dashboard → SQL Editor.
3. Coller et exécuter `supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql`.
4. Lancer les 4 requêtes SQL de vérification.
5. Si tous les checks sont verts → ajouter dans `.env.local` :
   `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true`
6. `npm run build` → vérifier que build est clean.
7. `npm run test:phase3-14` → vérifier que tests passent.
8. Ouvrir `/profile/onboarding` → vérifier statut "Empreinte synchronisée serveur".

---

## Prochain bloc recommandé

**PHASE 3.15 — Enterprise Footprint Manual Activation QA**

- QA manuelle complète du safe apply activé.
- Tests E2E sur données réelles.
- Validation health check avec table créée.
- Vérification statut UI serveur dans `/profile/onboarding`.

Alternatives :
- PHASE 3.15 — CloneOS History Manual Activation QA
- PHASE 3.15 — Profile Messages Enterprise Footprint Feed
