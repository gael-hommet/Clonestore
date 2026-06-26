# PHASE 5.6 — Controlled Mission Server Restore UI Polish / Still No Execution

## 1. Objectif

Créer un **polish UI** de « restauration / lecture serveur future » dans
`/profile/messages`, **toujours sans serveur actif**. Cette phase prépare visuellement
et contractuellement la future restauration/lecture serveur des Controlled Missions,
**sans aucun GET serveur réel, sans route, sans DB, sans SQL appliqué**.

```
P5.4 = design serveur.
P5.5 = QA d'activation manuelle.
P5.6 = UI/UX de restauration future + état « serveur non actif » clair.
```

**P5.6 ne restaure rien réellement depuis le serveur.**

## 2. État P5.5 (verrouillé)

Design serveur prêt · QA d'activation manuelle prête · SQL non appliqué · route non
créée · flag serveur **default false** · aucune mission serveur réelle · aucun write ·
aucune exécution · localStorage source active.

## 3. Modèle de restauration (design-only)

`ControlledMissionServerRestoreDesignState` : `phase: "5.6"`, `restore_status`
(`design_only` / `server_disabled` / `flag_disabled` / `sql_not_applied` /
`route_missing_by_design` / `ready_for_future_restore_ui`), `source: "local_only"`,
`target_table`, `future_endpoint`, `flag_key`, `flag_default: false`,
`restored_count: 0`, `server_rows_loaded: 0`, `local_rows_available`,
`eligible_local_rows`, et les invariants littéraux **false** :
`server_restore_available`, `server_get_performed`, `db_read_performed`,
`server_write_performed`, `runtime_execution_performed`, `real_mission_created`,
`pierre_engine_called`, `ai_call_performed`, `email_sent`, `document_generated`,
`clonevoice_active`. Plus `warnings`, `required_next_steps`, `display_cards`,
`restore_timeline_preview`.

Display card : `id`, `title`, `status`, `description`, `badge`, `severity`,
`action_label`, `action_enabled: false`, `local_only: true`.
Timeline preview item : `id`, `label`, `description`, `status`, `local_only: true`,
`server_action_performed: false`.

## 4. Modules

`src/lib/clonestore/runtime-integration/` :
- `controlled-mission-server-restore-types.ts`
- `controlled-mission-server-restore-design.ts` —
  `buildControlledMissionServerRestoreDesignState(localMissions)`,
  `buildControlledMissionServerRestoreDisplayCards`,
  `buildControlledMissionServerRestoreTimelinePreview`,
  `buildControlledMissionServerRestoreWarnings`,
  `buildControlledMissionServerRestoreRequiredNextSteps`,
  `summarizeControlledMissionServerRestoreDesignState`.
- `controlled-mission-server-restore-ui-copy.ts`
- `controlled-mission-server-restore-qa.ts`

Modules **purs** : aucun appel réseau, aucun import base de données / Pierre, aucune
route, aucun write localStorage requis. `eligible_local_rows` est calculé en réutilisant
la readiness P5.4 (`buildControlledMissionServerPersistenceReadiness`). `server_get_performed`
et `db_read_performed` **toujours false**.

## 5. UI

`/profile/messages` : panneau **« Restauration serveur — non active »**. Affiche :
« Source active : localStorage », « Serveur : désactivé », « SQL : non appliqué »,
« Route serveur : non créée », « Flag : false », « Aucun GET serveur », « Aucune donnée
chargée depuis le serveur », « Aucune exécution ». Plus : nombre de missions locales,
nombre de candidates à une future persistance/restauration, état « prêt pour UI restore
future », et la **timeline future** : 1) SQL manual review, 2) Flag activation future,
3) Route GET future, 4) Restore server rows, 5) Still no execution.

Actions autorisées : **Voir état restore** · **Voir parcours futur** (lecture seule).
Actions interdites : Restaurer depuis serveur · Charger serveur · Synchroniser serveur ·
Activer serveur · Appliquer SQL · Créer route · Exécuter · Lancer · Envoyer.

Microcopy : « Restauration serveur non active · Local uniquement » · « Cette interface
prépare la lecture serveur future, mais ne charge aucune donnée serveur. » · « Aucun GET
serveur n'est effectué. » · « La source active reste localStorage. » · « Aucune mission
n'est exécutée. »

## 6. Invariants confirmés

- UI de restauration serveur **prête (design)** · restauration serveur **toujours inactive**.
- **Aucun** GET serveur · **aucune** lecture base de données · **aucune** route restore.
- localStorage **source active** · `server_rows_loaded` 0 · `restored_count` 0.
- **Aucun** write serveur · **aucune** mission serveur réelle · **aucune** exécution.
- Runtime execution inactive · Pierre autonomous runtime inactive.
- Aucun email/document/PDF/IA · CloneVoice non actif.
- SQL P5.4 toujours non appliqué · flag serveur default false · `.env.local` non modifié.
- scale 80k non prouvé · lancement public externe non validé.

## 7. Limites restantes

- Stockage **navigateur uniquement** (localStorage reste la source active).
- L'UI prépare une lecture serveur **future** ; elle ne charge **rien**.
- SQL non appliqué · flag off · route non créée.

## 8. Prochaine phase recommandée

**PHASE 5.7 — Controlled Mission Server Persistence Readiness Final Gate / Still No
Execution.**

---

**Restauration serveur UI design-only. Aucune lecture serveur. Aucun GET serveur.
Aucune route. Aucun SQL appliqué. Flag serveur default false. localStorage source
active. Aucune mission serveur réelle. Aucune exécution. Aucun appel Pierre / IA.
Aucun email/document/PDF. CloneVoice non actif. scale 80k non prouvé. lancement public
externe non validé.**
