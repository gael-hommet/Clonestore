# PHASE 3.13 — Enterprise Footprint Server Persistence Design

## Objectif

Créer la couche de persistance serveur **design** de l'Empreinte Entreprise, sans
activation dangereuse. localStorage reste le fallback actif. Aucune migration SQL
appliquée automatiquement. Aucune page UI ne fait de write serveur en PHASE 3.13.

---

## État avant PHASE 3.13

- PHASE 3.8 : localStorage snapshot. Couche flags + storage design existants (P3.8).
- PHASE 3.9–3.12 : lecture read-only localStorage dans toutes les pages concernées.
- `ENTERPRISE_FOOTPRINT_TABLE_NAME = "clonestore_enterprise_footprints"` défini dans les types.
- Aucune table SQL dédiée n'existait. Aucune route API enterprise-footprint.

---

## Pourquoi la persistance serveur maintenant

L'Empreinte Entreprise est désormais lue dans 4 zones de l'app. Pour préparer la
synchronisation cross-device et la résilience, une couche serveur doit être
conçue avant d'être activée. La PHASE 3.13 construit le design sans l'activer.

---

## Table `clonestore_enterprise_footprints`

Définie dans `supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql`.

**SQL draft — à appliquer manuellement. Jamais automatique.**

---

## Colonnes

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid pk | Identifiant unique |
| `user_id` | uuid ref auth.users | Propriétaire (RLS) |
| `company_id` | text | Identifiant entreprise |
| `status` | text | draft/ready/incomplete/needs_review/archived |
| `source` | text | local_snapshot/onboarding_draft/server/cloneadn/demo |
| `company_json` | jsonb | Identité entreprise |
| `humans_json` | jsonb | Approbateurs et rôles RH |
| `approval_rules_json` | jsonb | Règles de validation |
| `documents_json` | jsonb | Documents référencés |
| `technologies_json` | jsonb | Technologies actives |
| `cloneadn_summary_json` | jsonb | Résumé CloneADN |
| `coverage_score` | integer 0–100 | Score de couverture |
| `readiness_score` | integer 0–100 | Score de readiness |
| `missing_items_json` | jsonb | Éléments manquants |
| `warnings_json` | jsonb | Warnings |
| `metadata` | jsonb | Métadonnées redactées |
| `last_local_updated_at` | timestamptz | Horodatage dernière modif locale |
| `server_version` | integer | Version serveur (défaut 1) |
| `created_at` | timestamptz | Création |
| `updated_at` | timestamptz | Dernière mise à jour |

---

## RLS

Row Level Security activée. Jamais de delete policy (préservation des empreintes).

---

## Policies

| Policy | Opération | Condition |
|---|---|---|
| `select_own_enterprise_footprint` | SELECT | `auth.uid() = user_id` |
| `insert_own_enterprise_footprint` | INSERT | `auth.uid() = user_id` |
| `update_own_enterprise_footprint` | UPDATE | `auth.uid() = user_id` |
| *(pas de DELETE)* | — | Préservation intentionnelle |

---

## Feature flag

Clé : `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED`

**Default : false. Jamais hardcoder true dans le code.**

Conditions pré-activation :
1. SQL PHASE_3_13 appliqué manuellement
2. RLS validée en environnement test
3. Health check select passe (`checkEnterpriseFootprintServerTableReadiness`)
4. Build et tests clean
5. Ajouter `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true` dans `.env.local`

---

## Mappers

| Fonction | Description |
|---|---|
| `mapEnterpriseFootprintToServerPayload(fp, userId)` | EnterpriseFootprint → ServerPayload |
| `mapEnterpriseFootprintToServerRowInsert(payload)` | Payload → Row insert |
| `mapEnterpriseFootprintServerRowToFootprint(row)` | Row → EnterpriseFootprint |
| `mergeEnterpriseFootprintLocalAndServer(local, server)` | Merge avec priorité au plus récent |
| `chooseLatestEnterpriseFootprint(local, server)` | Choix winner par timestamp |
| `buildEnterpriseFootprintServerSyncPlan(local, server)` | Plan de synchronisation |
| `redactEnterpriseFootprintServerMetadata(metadata)` | Redaction des clés sensibles |

---

## Validation / sanitisation

`detectUnsafeEnterpriseFootprintServerText` bloque les patterns :
- Clés Stripe live (`sk_live_*`, `whsec_*`)
- Clés API OpenAI/Anthropic
- Formulations de lancement public non validé
- Formulations absolues d'absence d'erreur ou de garantie totale
- Formulations produit interdites (ex. CloneVoice production)

Voir `UNSAFE_SERVER_PATTERNS` dans `enterprise-footprint-server-validation.ts` pour la liste complète.

Fonctions : `validateEnterpriseFootprintServerPayload`, `validateEnterpriseFootprintServerRow`,
`sanitizeEnterpriseFootprintServerPayload`, `assertEnterpriseFootprintServerNoSensitiveLeak`.

---

## Read-only client

`loadEnterpriseFootprintServerReadOnly(supabase, userId, companyId?)` — SELECT only.
`loadLatestEnterpriseFootprintServerReadOnly(supabase, userId)` — dernière version.

Compatible table absente (retourne empty result propre).
Jamais de insert/update/delete/upsert.

---

## Storage design

`persistEnterpriseFootprintServerSafely(supabase, userId, footprint)` — design-only en PHASE 3.13.

Flux : guard feature flag → sanitize → validate → leak check → upsert.

**Non appelé depuis UI en PHASE 3.13.**
Activation en PHASE 3.14 après SQL + RLS validés.

---

## Health check

`checkEnterpriseFootprintServerTableReadiness(supabase, userId)` — SELECT read-only limité.

Retourne : `table_available`, `rls_select_ok`, `can_attempt_write`, `error_code`, `warnings`.

---

## Script readiness

```bash
npm run check:enterprise-footprint-server-readiness
```

Vérifie : SQL draft présent, env Supabase, modules TypeScript, feature flag.
Lecture seule uniquement. Jamais d'écriture.

---

## API route

La route `GET/POST /api/profile/enterprise-footprint` est différée à **PHASE 3.14**.
Raison : le SQL n'est pas encore appliqué, et aucun test E2E n'a validé la table.
En PHASE 3.14, la route sera créée feature-flaggée, GET read-only + POST flaggué.

---

## Ce qui est activé maintenant

✅ SQL draft (non appliqué).  
✅ Types serveur complets.  
✅ Schema helpers.  
✅ Feature flag (default false).  
✅ Mappers locaux ↔ serveur.  
✅ Validation + sanitisation + patterns interdits.  
✅ Client read-only (compatible table absente).  
✅ Storage design feature-flaggué (non appelé UI).  
✅ Health check read-only.  
✅ Script readiness.  
✅ Exports index.ts.

---

## Ce qui reste non activé

- Table SQL `clonestore_enterprise_footprints` non encore créée (SQL draft à appliquer).
- Persistance serveur désactivée (feature flag = false).
- Aucune page UI ne fait de write serveur.
- API route différée à PHASE 3.14.
- Synchronisation localStorage ↔ serveur non activée.

---

## Ce qui n'a PAS été fait en PHASE 3.13

- Application automatique de la migration SQL.
- Modification de `.env.local`.
- Hardcode du flag à true.
- Write serveur depuis l'UI.
- Modification du moteur Pierre.
- Modification des APIs Pierre.
- Appel OpenAI / Anthropic.
- Envoi d'email.
- Exécution de mission.

**Lancement public externe : toujours non validé.**

---

## Prochain bloc recommandé

**PHASE 3.14 — Enterprise Footprint Safe Apply**

Activation contrôlée de la persistence serveur :
- Appliquer le SQL draft manuellement + vérifier RLS.
- Activer le feature flag en `.env.local` test.
- Déclencher le health check.
- Créer la route API `GET/POST /api/profile/enterprise-footprint`.
- Brancher la synchronisation localStorage ↔ serveur dans `/profile/onboarding`.
- Tests E2E sur données réelles.

Alternatives :
- PHASE 3.14 — Enterprise Footprint Manual Activation QA
- PHASE 3.14 — CloneOS History Manual Activation QA
