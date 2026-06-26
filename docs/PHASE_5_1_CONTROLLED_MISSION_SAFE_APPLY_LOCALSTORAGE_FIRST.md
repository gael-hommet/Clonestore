# PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First

## 1. Objectif

Première vraie étape « Safe Apply » de la Phase 5 : permettre à l'utilisateur de
transformer une **promotion preview validée** (P4.8/4.9) en **Controlled Mission
locale**, stockée **uniquement dans localStorage**. Cette mission est visible,
relisible, restaurable et archivable côté UI, mais elle n'est **jamais exécutée,
envoyée, persistée serveur, ni connectée à Pierre runtime**.

Flux : Draft / Preview → bouton safe apply → **Controlled Mission locale** → visible
dans le cockpit → **aucune exécution**.

## 2. État P4.12 (verrouillé)

PHASE 4 CLOSED / GO côté repo · ready_for_phase5 true · runtime execution inactive ·
real mission creation inactive · Pierre autonomous runtime inactive · SQL drafts non
appliqués · feature flags serveur default false · lancement public externe non validé
· scale 80k non prouvé.

## 3. Modèle local de Controlled Mission

`LocalControlledMission` : `id` stable (idempotence), `source_draft_id`,
`source_promotion_id`, `tenant_id` (fallback `local_demo_tenant`), `employee_id`,
`title`, `summary`, `intent`/`category`, `priority`, `risk_level`, `status`, `steps`,
`validation_requirements`, `guard_summary`, `created_at`/`updated_at`,
`source = local_safe_apply`, `warnings`, `blocked_reasons`,
`human_readable_timeline`. Invariants littéraux : `execution_status` non-exécutable,
`server_persistence = disabled`, `runtime_execution = disabled`,
`real_mission_created false`, `pierre_engine_called false`, `ai_call_performed false`,
`email_sent false`, `document_generated false`, `clonevoice_active false`,
`read_only true`.

Statuts : `local_controlled_created`, `waiting_manual_review`, `blocked_by_guard`,
`blocked_by_missing_information`, `archived_local`. Aucun statut ne laisse croire que
la mission est exécutée.

## 4. Module safe apply

`controlled-mission-safe-apply.ts` (pur sauf write localStorage via le module dédié) :
`buildControlledMissionFromPromotionPreview`, `validateControlledMissionSafeApplyInput`,
`sanitizeControlledMissionPayload`, `createLocalControlledMission`,
`buildControlledMissionSafeApplyResult`, `buildControlledMissionUserFacingWarnings`,
`sanitizeControlledMissionText`.

Comportement :
- **Idempotence** : `id` stable (`localcm_${promotion_id}`) ; double clic → pas de doublon.
- **localStorage corrompu** : fallback tableau vide, aucun crash.
- **localStorage indisponible / quota** : échec propre, aucune exécution.
- **payload bloqué** : aucune mission créée (verdict blocked / not_eligible).
- **sanitization** : suppression HTML/`<script>`/schémas dangereux + redaction de motifs sensibles.
- aucune fonction ne `fetch`, n'importe une base de données, ni n'appelle une route API.

## 5. Module localStorage

`controlled-mission-local-storage.ts` réutilise la clé de design P4.10
`clonestore.runtimeControlledMissions.local.v1`. Helpers :
`loadLocalControlledMissions`, `getLocalControlledMissionById`,
`upsertLocalControlledMission` (idempotent), `archiveLocalControlledMission`,
`clearLocalControlledMissionsForQA`. Client-only. Aucun fetch, aucune base de données.

## 6. UI Safe Apply

Dans l'aperçu de promotion (`/profile/messages`), bouton
**« Créer une mission contrôlée locale »** avec microcopy
**« Local uniquement · Aucune exécution · Aucun envoi · Non persisté serveur »**.
Après succès : **« Mission contrôlée créée localement. Elle n'a pas été exécutée. »**
+ lien vers la section. Si déjà créée : **« Déjà créée localement »** (bouton désactivé).
Si preview bloquée : bouton désactivé + raison visible.

## 7. Section « Missions contrôlées locales »

Section dédiée (cockpit `/profile/messages`) : nombre de missions, badges (Local ·
Non exécuté · Serveur désactivé · Validation humaine), liste (titre, statut, employé,
priorité, risque, dernière mise à jour, résumé, étapes prévues, avertissements),
actions **« Relire »** et **« Archiver localement »**. **Aucune action Exécuter /
Envoyer / Lancer / Automatiser.**

## 8. Guardrails UI

« Cette mission est préparée, pas exécutée. » · « Pierre ne travaille pas encore en
autonomie sur cette mission. » · « Aucune donnée n'est envoyée au serveur dans cette
phase. » · « La persistance serveur et l'exécution gouvernée seront traitées dans une
phase ultérieure. »

## 9. Invariants confirmés

- Controlled Mission local safe apply actif (localStorage-first).
- Runtime execution toujours inactive · server persistence toujours inactive.
- Pierre autonomous runtime toujours inactive · aucune mission réelle.
- Aucun email/document/PDF/IA · CloneVoice non actif.
- Aucun changement Pierre engine/API · aucune route execute.
- scale 80k non prouvé · lancement public externe non validé.

## 10. Ce qui est activé maintenant

Création d'une Controlled Mission **locale** depuis une promotion preview safe, visible
dans une section dédiée, clairement marquée **non exécutée**, archivable et relisible.

## 11. Ce qui reste non activé

- Persistance serveur · exécution gouvernée · activation runtime · workflow de
  validation humaine appliqué · lancement public externe → phases ultérieures.

## 12. Limites restantes

- Stockage **navigateur uniquement** (pas de synchronisation multi-appareils).
- Pas de validation humaine appliquée (design P4.11, application future).
- Pas d'exécution : la mission reste préparée.

## 13. Prochaine phase recommandée

**PHASE 5.2 — Controlled Mission Local Review & Manual Validation Layer** — couche de
relecture et de validation manuelle locale des missions contrôlées, toujours sans
exécution ni persistance serveur.

---

**localStorage-first uniquement. Mission préparée, pas exécutée. Aucune mission réelle.
Aucune persistance serveur. Aucun appel Pierre / IA. Aucun email/document/PDF.
CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.**
