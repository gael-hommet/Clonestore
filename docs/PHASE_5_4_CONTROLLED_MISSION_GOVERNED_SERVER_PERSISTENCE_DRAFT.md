# PHASE 5.4 — Controlled Mission Governed Server Persistence Draft / Still No Execution

## 1. Objectif

Concevoir le **design complet** de la persistance **serveur gouvernée** des Controlled
Missions (origine localStorage), **sans l'activer**. Cette phase prépare le futur
passage :

```
Controlled Mission locale + review approved + preflight ready
  → draft de persistance serveur gouvernée
  → contrat SQL / RLS / API / flag / QA
  → mais AUCUN write serveur actif.
```

**PHASE 5.4 est une phase de design / proof / contract.** Elle ne crée pas de mission
serveur réelle, ne fait aucun POST, n'applique aucun SQL, ne change aucun flag, ne
déclenche aucune exécution.

## 2. État P5.3 (verrouillé)

Safe apply local VALIDATED · review locale VALIDATED · approbation locale active ·
preflight local actif · candidate future execution readiness actif · missions en
localStorage · runtime/server/Pierre inactifs · `ready` (preflight) = candidate future,
jamais exécution.

## 3. Modèle de draft serveur

`GovernedControlledMissionServerDraft` — forme **future** de la ligne (jamais écrite) :
`id` (`srvdraft_${local_id}`), `local_controlled_mission_id`, `source_draft_id`,
`source_promotion_id`, `company_id`, `user_id`, `tenant_id`, `employee_id`, `title`,
`summary`, `intent`, `category`, `priority`, `risk_level`, `local_review_status`,
`preflight_status`, `readiness_score`, `readiness_level`, `server_persistence_status`,
`execution_status`, `runtime_status`, `governance_status`, 6 snapshots
(guard/review/preflight/runtime_requirements/human_validation/trace), `created_at`,
`updated_at`, `created_by`, `local_origin: true`, et les invariants littéraux **false** :
`execution_enabled`, `runtime_execution_enabled`, `pierre_engine_enabled`,
`ai_execution_enabled`, `email_sending_enabled`, `document_generation_enabled`,
`clonevoice_enabled`.

Statuts :
- `server_persistence_status` : `design_only` / `blocked_flag_disabled` /
  `ready_for_manual_sql_review` / `ready_for_future_server_persistence` /
  `blocked_missing_preflight` / `blocked_missing_review` / `blocked_by_guard` /
  `blocked_by_manual_decision`.
- `execution_status` : `not_executable` / `server_draft_only` /
  `waiting_future_governed_execution_phase`.
- `runtime_status` : `disabled`.
- `governance_status` : `requires_human_governance` / `preflight_ready` / `blocked`.

## 4. Modules design-only

`src/lib/clonestore/runtime-integration/` :
- `controlled-mission-server-persistence-types.ts`
- `controlled-mission-server-persistence-contract.ts` —
  `buildGovernedControlledMissionServerDraft`,
  `validateGovernedControlledMissionServerDraftEligibility`,
  `buildControlledMissionServerPersistenceReadiness`,
  `buildControlledMissionServerPersistenceTraceSnapshot`,
  `summarizeControlledMissionServerPersistenceDraft`.
- `controlled-mission-server-persistence-sql-draft.ts` —
  `buildControlledMissionServerPersistenceSqlDraft`,
  `buildControlledMissionServerPersistenceRlsPolicyDraft`, table
  `clonestore_controlled_missions`.
- `controlled-mission-server-persistence-policy.ts` —
  `buildControlledMissionServerPersistencePolicySnapshot`,
  `buildControlledMissionServerPersistenceFeatureFlagContract`,
  `buildControlledMissionServerPersistenceFlagSnapshot`,
  `isControlledMissionServerPersistenceEnabledFromEnv`,
  `getControlledMissionServerPersistenceFlagDefault`.
- `controlled-mission-server-persistence-api-contract.ts` —
  `buildControlledMissionServerPersistenceApiContract` (route **future**, jamais créée).
- `controlled-mission-server-persistence-ui-copy.ts` · `…-qa.ts`.

Comportement (gating) :
- revue `changes_requested` / `blocked_local` → `blocked_by_manual_decision`.
- revue non `approved_local` → `blocked_missing_review`.
- mission `blocked_by_guard` → `blocked_by_guard`.
- pas de preflight → `blocked_missing_preflight`.
- preflight `ready_for_future_governed_execution` → `ready_for_future_server_persistence`.
- aucun write, aucun appel réseau, aucun import base de données / Pierre.

## 5. SQL draft (non appliqué)

`supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql` —
table `public.clonestore_controlled_missions`. Marqueurs : **DESIGN DRAFT ONLY**,
**DO NOT APPLY**, **STILL NO EXECUTION**, **SERVER PERSISTENCE FLAG MUST REMAIN OFF**.
RLS `enable` + policies `select/insert/update` own (pas de DELETE). CHECK gouvernance :
tous les `*_enabled = false`, `runtime_status = 'disabled'`, `local_origin = true`.
Aligné sur la convention `supabase/sql/` (comme P4.10).

## 6. Feature flag (contract design-only)

`NEXT_PUBLIC_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED` — **default false**.
En P5.4 le flag est **design-only** : aucune lecture env n'active de route ni
d'exécution. Même `=true`, aucune route n'existe et aucun draft n'est exécutable.

## 7. Route serveur future (contrat, jamais créée)

API contract : `future_endpoint = /api/clonestore/runtime/controlled-missions`,
`future_method = POST`, `current_phase_status = disabled_design_only`,
`route_file_created = false`. **Aucun fichier `route.ts` n'est créé en P5.4.**

## 8. UI

`/profile/messages` : panneau **« Persistance serveur gouvernée — design non actif »**
par mission ayant un preflight. Affiche : « Candidate pour future persistance serveur »,
« Serveur toujours désactivé », « Aucune donnée envoyée », « SQL à revue manuelle »,
« Phase future requise ». Actions autorisées : **Voir le draft serveur** · **Voir
prérequis serveur** (lecture seule). Actions interdites : Sauvegarder serveur · Publier
serveur · Persister · Créer mission serveur · Exécuter · Lancer · Envoyer · Automatiser.

Microcopy : « Design serveur uniquement · Aucune persistance » · « Ce panneau prépare
une future persistance gouvernée, mais ne l'active pas. » · « Aucune donnée n'est
envoyée au serveur dans cette phase. » · « La mission reste locale et non exécutée. »

## 9. Invariants confirmés

- Design de persistance serveur prêt · persistance serveur **toujours inactive**.
- `ready` = candidate future persistance serveur — **n'active rien**.
- Aucune mission serveur réelle · aucun write · aucun POST · aucun SQL appliqué.
- Runtime execution inactive · Pierre autonomous runtime inactive.
- Aucun email/document/PDF/IA · CloneVoice non actif.
- Aucune route controlled-missions/execute · flag serveur default false.
- scale 80k non prouvé · lancement public externe non validé.

## 10. Limites restantes

- Stockage **navigateur uniquement** (localStorage reste la source active).
- `ready` n'active **rien** : prépare une future persistance gouvernée.
- SQL **non appliqué** · flag **off** · route **non créée**.

## 11. Prochaine phase recommandée

**PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA / Still No
Execution** — concevoir la QA d'activation manuelle de la persistance serveur,
**toujours sans exécution**.

---

**Design serveur uniquement. « ready » = candidate pour future persistance serveur,
jamais active. Aucune persistance. Aucune donnée envoyée. Aucune mission serveur réelle.
Aucune exécution. Aucun appel Pierre / IA. Aucun email/document/PDF. CloneVoice non
actif. SQL non appliqué. Flag serveur default false. scale 80k non prouvé. lancement
public externe non validé.**
