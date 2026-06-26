# PHASE 4.4 — Runtime Mission Draft Safe Persistence Design

## Objectif

Concevoir la persistance **gouvernée** des brouillons de mission runtime
(`RuntimeMissionDraft`), **sans l'activer**. Préparer une future table serveur,
un design RLS strict, un contrat de persistance, un feature flag, un design
localStorage-first, un health/readiness check et un plan d'activation manuelle —
le tout **design-only**, aucun write, aucune route POST.

PHASE 4.4 = **SQL draft + persistence design + QA**, aucun runtime write.

---

## État P4.3

Phase 4.3 a créé le contrat de brouillon de mission : `RuntimeIntegrationReadResult`
→ `RuntimeMissionDraft` local/in-memory, avec snapshots CloneGuard/CloneTrace/
idempotency/queue/cost et 10 safety flags **littéralement false**. Validée 100/100.

---

## Pourquoi persister plus tard les brouillons

Pour offrir cross-device, audit et reprise, les brouillons devront être persistés
côté serveur — mais **uniquement** de façon gouvernée (flag, RLS, safe apply,
manual activation QA), sur le modèle éprouvé des phases serveur P3 (P3.13–P3.15).

---

## Différence entre design et activation

| | Design (P4.4) | Activation (P4.5+) |
|---|---|---|
| SQL | draft, **non appliqué** | appliqué manuellement |
| Flag | default **false** | activé manuellement en test |
| Write | **aucun** | safe apply localStorage-first |
| Route POST | **aucune** | safe apply gouverné (futur) |

---

## SQL draft

`supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql` — **DRAFT non appliqué
automatiquement**. Table `public.clonestore_runtime_mission_drafts`.

### Champs principaux

`id`, `user_id`, `company_id`, `draft_id`, `command_id`, `intent_id`, `route_id`,
`plan_id`, `employee_key`, `kind`, `status`, `source`, `title`, `objective`,
`summary`, `domain`, `risk_level`, `validation_mode`, `draft_payload` (jsonb),
`safety_flags` (jsonb), `guard_snapshot`, `trace_snapshot`, `idempotency_snapshot`,
`queue_snapshot`, `cost_snapshot`, `scale_snapshot`, `created_at`, `updated_at`.

### Safety flags

Une contrainte CHECK garantit qu'un enregistrement ne peut **jamais** représenter
une exécution : `execution_enabled`, `db_write_enabled`, `api_execution_enabled`,
`pierre_engine_called`, `ai_call_performed`, `email_sent`, `message_sent`,
`document_generated`, `clonevoice_active`, `public_launch_external_validated`
doivent tous valoir `'false'`.

### RLS / policies

`enable row level security` + policies `select_own` / `insert_own` / `update_own`
(`auth.uid() = user_id`). **Aucune policy DELETE** (préservation/audit).

### Indexes / constraints

Index : user_id, company_id, draft_id, command_id, plan_id, status, employee_key,
updated_at desc. Contraintes : unique (user_id, command_id, plan_id), index unique
partiel (user_id, company_id, draft_id), status/kind valides, ids non vides,
safety_flags no-execution.

---

## Feature flag

`NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED` — **default false**.
`isRuntimeMissionDraftServerPersistenceEnabled()` lit `process.env`. Jamais
hardcodé true, jamais activé, `.env.local` jamais modifié.

---

## Persistence design

`runtime-mission-draft-persistence-design.ts` :
`buildRuntimeMissionDraftPersistenceRecord` (forme future DB, jamais écrite),
`buildRuntimeMissionDraftPersistenceWritePlan` (status awaiting_flag /
awaiting_sql / awaiting_safe_apply / blocked si pas d'user_id),
`buildRuntimeMissionDraftPersistenceReadPlan`, validate/sanitize.
**`db_write_performed` toujours false en P4.4.** Ne mute jamais le draft original.

---

## localStorage-first future flow

`runtime-mission-draft-localstorage-design.ts` — clés déclarées
(`clonestore.runtimeMissionDrafts.local.v1`), **jamais écrites en P4.4**. Flow
futur : créer local → save localStorage first → safe apply serveur si flag/auth →
fallback local → restaurer le plus récent. `writes_in_p4_4: false`.

---

## Health / readiness checks

`runtime-mission-draft-persistence-health.ts` : readiness, health checklist, et
les 5 requêtes SQL attendues (A table / B RLS / C policies / D constraints /
E indexes) + étapes d'activation manuelle. Module pur, n'exécute aucun SQL.

---

## Script read-only

`npm run check:runtime-mission-draft-persistence-design` — vérifie fichiers, SQL
draft, flag, invariants modules/pages, affiche les requêtes SQL. **0 write · 0
SQL exécuté · 0 POST · 0 Supabase.**

---

## Manual activation future

L'activation (PHASE 4.5) : appliquer le SQL manuellement → vérifier
table/RLS/policies/constraints/indexes → activer le flag en `.env.local` (test) →
implémenter le safe apply runtime localStorage-first → remplir l'evidence template.

---

## No-execution invariant

Tous les flags d'exécution sont false. **Aucun write DB. Aucun moteur Pierre.
Aucun appel IA. Aucune exécution CloneOS. Aucune mission créée en base.**

---

## Scale 80k non prouvé

`scale_80k_not_proven` conservé dans le readiness. Préparation scale
(`scale-ready foundation`), **non prouvé**.

---

## Ce qui est activé maintenant

✅ SQL draft (non appliqué) · persistence types/flags/design/health/localstorage-design.
✅ Feature flag (default false) · QA module (25 étapes).
✅ Script read-only · evidence template · doc · exports.

---

## Ce qui reste non activé

- SQL non appliqué · flag default false · aucun safe apply.
- Persistance serveur · route POST de sauvegarde.
- Exécution / mission réelle / worker / queue prod · appel IA · moteur Pierre · CloneVoice.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 4.4

- Aucun SQL appliqué automatiquement · aucun `.env.local` modifié · aucun flag activé.
- Aucune route POST de persistance créée · aucun write DB · aucune mission créée en base.
- Aucun appel Pierre moteur / API Pierre · aucune exécution CloneOS.
- Aucun appel Supabase / OpenAI / Anthropic / Stripe.
- Aucun email/message/document envoyé · aucune génération PDF.
- Aucune activation CloneVoice · aucune écriture localStorage depuis l'UI.
- Aucune modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 4.5 — Runtime Mission Draft Safe Apply / LocalStorage First**

Implémenter le safe apply localStorage-first du brouillon (sur le modèle P3.14) :
save local d'abord, write serveur best-effort si flag + table + auth, fallback
local, restore — toujours sans exécution réelle, rollbackable.

Alternative :
- PHASE 4.5 — Runtime Mission Draft Manual Activation QA.
