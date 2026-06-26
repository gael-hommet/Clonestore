# PHASE 4.10 — Controlled Mission Governed Persistence Design

## 1. Objectif

Concevoir (**design-only**) la persistance **gouvernée** des **candidates** de
`ControlledMission` (contrats de promotion P4.8), **sans l'activer**. PHASE 4.10
crée un **SQL draft**, des types de persistence, un feature flag, un record mapper,
un health/readiness design, une stratégie localStorage-first future, un script
read-only, une QA, une doc et une evidence — **aucun write, aucune route POST,
aucun appel Supabase/Pierre/IA, aucun SQL appliqué, aucun flag activé.**

## 2. État P4.9

Panneau d'aperçu de promotion read-only câblé dans `/profile/messages` (75/75).
Le contrat de promotion (P4.8) et la `ControlledMission` candidate existent comme
objets purs design-only.

## 3. Pourquoi persister plus tard les candidates

Pour aller un jour vers une mission contrôlée validée par un humain, il faut
d'abord pouvoir **conserver** le candidate (contrat de promotion) côté serveur,
de façon gouvernée et multi-tenant. P4.10 prépare cette persistance **sans
l'activer**.

## 4. Différence entre design et activation

- **Design (P4.10)** : SQL draft non appliqué, types, flag default false, record
  mapper (jamais écrit), health design, stratégie localStorage future.
- **Activation (futur)** : application manuelle du SQL, flag true, safe apply,
  workflow de validation humaine — **rien de tout cela en P4.10**.

## 5. Candidate vs vraie mission Pierre

Un **candidate** est un **contrat de promotion** (aperçu gouverné). Ce n'est
**jamais** une mission Pierre réelle ni une exécution. Les colonnes booléennes et
le CHECK `safety_flags` de la table empêchent toute représentation d'exécution :
`promotion_applied`, `mission_created`, `controlled_mission_created`,
`execution_enabled`, `execution_started` sont **toujours false**, et
`human_validation_required`, `preview_only`, `read_only` **toujours true**.

## 6. SQL draft

`supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql` — **DRAFT non appliqué
automatiquement**. Idempotent (`create table if not exists`, DO/EXCEPTION blocks,
`create index if not exists`, policies conditionnelles).

## 7. Table clonestore_controlled_mission_candidates

Table cible future `public.clonestore_controlled_mission_candidates` : un row =
un candidate de mission contrôlée (contrat de promotion), jamais une mission réelle.

## 8. Champs principaux

`user_id`, `company_id`, `candidate_id`, `promotion_id`, `controlled_mission_id`,
`draft_id`, `command_id`, `intent_id`, `route_id`, `plan_id`, `employee_key`,
`source`, `status`, `verdict`, `title`, `objective`, `summary`, `domain`,
`risk_level`, `validation_mode`, colonnes booléennes gouvernées, et blobs jsonb
(`candidate_payload`, `promotion_contract`, `controlled_mission_payload`,
`safety_flags`, `guard_snapshot`, `trace_snapshot`, `validation_gates`,
`blockers`, `idempotency_snapshot`, `queue_snapshot`, `cost_snapshot`,
`scale_snapshot`).

## 9. Safety flags

`promotion_applied` false · `execution_enabled` false · `mission_executed` false ·
`autonomous_execution` false · `pierre_engine_called` false · `ai_call_performed`
false · `db_write_performed` false · `email_sent`/`message_sent`/`document_generated`
false · `clonevoice_active` false · `public_launch_external_validated` false ·
`requires_human_validation` true · `controlled` true · `scale_80k_not_proven` true.

## 10. promotion_applied false

`promotion_applied` est **false** au niveau colonne, safety_flags et CHECK. La
table ne peut pas représenter une promotion appliquée.

## 11. human_validation_required true

`human_validation_required` est **true** (colonne + CHECK gouvernance). Aucune
mission contrôlée sans validation humaine.

## 12. preview_only / read_only true

`preview_only` et `read_only` sont **true** (CHECK gouvernance). Le candidate reste
un aperçu en lecture seule.

## 13. RLS / policies

`enable row level security`. Policies own rows : `select` / `insert` / `update`
(`auth.uid() = user_id`). **Aucune policy DELETE** (préservation / audit). Aucun
service role côté client.

## 14. Index / constraints

Index sur `user_id`, `company_id`, `candidate_id`, `promotion_id`,
`controlled_mission_id`, `draft_id`, `command_id`, `plan_id`, `employee_key`,
`status`, `verdict`, `updated_at`, + GIN sur `candidate_payload`/`promotion_contract`.
Contraintes : unicité (user/company/candidate, user/promotion), status/verdict
valides, `chk_..._governed`, `chk_..._no_execution`.

## 15. Feature flag

`NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED` — **default
false**, jamais activé, `.env.local` non modifié.

## 16. Persistence design

`runtime-controlled-mission-persistence-design.ts` mappe un
`RuntimeMissionPromotionContract` vers une forme de record DB future (jamais
écrite). `db_write_performed` **toujours false**. Write plan : statuts
`blocked` (user_id manquant) → `awaiting_flag` → `awaiting_sql` →
`awaiting_human_validation_design` → `awaiting_safe_apply` →
`ready_for_manual_activation`.

## 17. localStorage-first future flow

`runtime-controlled-mission-localstorage-design.ts` : clé
`clonestore.runtimeControlledMissions.local.v1`, flow futur (créer l'aperçu →
sauvegarde locale → serveur best-effort si flag → fallback local → restore →
validation humaine requise). **Aucune écriture navigateur en P4.10.**

## 18. Health / readiness checks

`runtime-controlled-mission-persistence-health.ts` : readiness + checklist +
requêtes SQL attendues A→F (table / RLS / policies / constraints / indexes /
safety flags). Module pur — aucun SQL exécuté.

## 19. Script read-only

`scripts/check-runtime-controlled-mission-persistence-design.mjs` — vérifie les
fichiers, le SQL, le flag, l'absence de write/POST/route, et affiche les requêtes
SQL. **Aucune écriture, aucun SQL exécuté.**

## 20. Manual activation future

L'activation se fera **manuellement** plus tard : appliquer le SQL, vérifier
table/RLS/policies, concevoir la validation humaine (PHASE 4.11), implémenter le
safe apply, puis passer le flag à true. Rien de cela en P4.10.

## 21. Invariant no-execution

Aucune exécution. `execution_enabled`/`execution_started` false. Le candidate ne
déclenche jamais de mission réelle.

## 22. Aucun write DB en P4.10

Aucun write base de données. `db_write_performed` toujours false. Modules **purs**.

## 23. Aucun moteur Pierre

Aucun import `src/lib/pierre`, aucune route `/api/pierre`, aucun appel moteur Pierre.

## 24. Aucun appel IA

Aucun appel OpenAI/Anthropic/Stripe. `ai_call_performed` false.

## 25. Aucun email/message/document

Aucun email, message, document ou PDF généré ou envoyé.

## 26. CloneVoice non actif

CloneVoice n'est pas activé.

## 27. Scale 80k non prouvé

Préparation scale uniquement — **scale 80k non prouvé**.

## 28. Ce qui est activé maintenant

- SQL draft + types + flag (default false) + record mapper + health design +
  localStorage design + QA + script read-only + doc + evidence + tests.

## 29. Ce qui reste non activé

- SQL non appliqué · flag false · persistance serveur non opérationnelle.
- Aucune route POST · aucun safe apply · aucun workflow de validation humaine implémenté.
- **Lancement public externe : toujours non validé.**

## 30. Ce qui n'a PAS été fait en PHASE 4.10

- Aucune application automatique du SQL · aucun `.env.local` modifié · aucun flag activé.
- Aucune route POST de persistance · aucun write DB · aucune mission réelle créée en base.
- Aucune promotion appliquée · aucune exécution CloneOS.
- Aucun appel moteur Pierre · aucun appel IA · aucun email/message/document/PDF.
- Aucune écriture localStorage depuis l'UI · aucune activation CloneVoice.
- Aucune modification de `go-live-proofs.local.json`.

**SQL draft non appliqué automatiquement. .env.local non modifié. flag default
false. aucun POST de persistance créé. aucune mission réelle créée en base.
promotion_applied false. human_validation_required true. aucune exécution. aucun
appel Pierre. aucun email/message/document. CloneVoice non actif. scale 80k non
prouvé. lancement public externe non validé.**

## 31. Prochain bloc recommandé

**PHASE 4.11 — Controlled Mission Human Validation Workflow Design** — concevoir
(design-only) le workflow de validation humaine (approbateurs, double contrôle,
gates de validation) avant toute mission réelle.

Alternative :
- **PHASE 4.11 — Controlled Mission Safe Apply / LocalStorage First** — implémenter
  la sauvegarde localStorage-first + route feature-flaggée (modèle P4.5), sans
  activer le flag.
