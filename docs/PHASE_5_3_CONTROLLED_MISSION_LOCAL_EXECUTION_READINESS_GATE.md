# PHASE 5.3 — Controlled Mission Local Execution Readiness Gate / No-Execution Runtime Preflight

## 1. Objectif

Créer une couche **locale** de « preflight » / readiness gate qui détermine si une
Controlled Mission **approuvée humainement** (P5.2) serait **théoriquement candidate**
à une future exécution gouvernée. **Cette phase prépare le terrain — elle ne lance
rien.** Un statut `ready` signifie uniquement **« candidate pour une future exécution
gouvernée »**, jamais « mission lancée ». localStorage-first uniquement. Aucun runtime,
aucun serveur, aucun Pierre, aucune IA, aucun email/document/PDF.

Flux : Controlled Mission locale → review locale approuvée → **preflight local** →
rapport readiness local → statut « prête pour future exécution gouvernée » ou « non
prête » → **aucune exécution**.

## 2. État P5.2 (verrouillé)

Safe apply local VALIDATED · review locale VALIDATED · approbation locale active ·
missions en localStorage · même approuvées, jamais exécutées · runtime/server/Pierre
inactifs.

## 3. Modèle étendu

`LocalControlledMission` reçoit un bloc optionnel `preflight_state` :
`preflight_status` (`not_started`/`ready_for_preflight`/`preflight_running_local`/
`ready_for_future_governed_execution`/`blocked_by_missing_review`/`blocked_by_guard`/
`blocked_by_missing_information`/`blocked_by_manual_decision`/
`blocked_by_runtime_requirements`/`archived_local`), `readiness_score`,
`readiness_level` (`not_ready`/`needs_review`/`locally_ready`/
`future_execution_candidate`), `checked_at`, `checks`, `blocking_reasons`,
`warnings`, `required_next_steps`, `runtime_requirements_snapshot`,
`guard_requirements_snapshot`, `human_validation_snapshot`, `local_only: true`,
`no_execution_performed: true`, `runtime_execution_after_preflight: disabled`,
`server_persistence_after_preflight: disabled`.

Chaque check : `id`, `label`, `status` (`pass`/`warning`/`fail`), `detail`,
`blocking`, `local_only: true`, `execution_enabled: false`.

## 4. Module preflight

`controlled-mission-preflight.ts` :
`buildControlledMissionPreflightChecks`, `computeControlledMissionReadinessScore`
(déterministe), `runLocalControlledMissionPreflight`,
`getControlledMissionPreflightState`, `validateControlledMissionPreflightEligibility`,
`buildControlledMissionPreflightResult`, `summarizeControlledMissionPreflightState`,
`buildControlledMissionRuntimeRequirementsSnapshot`,
`buildControlledMissionGuardRequirementsSnapshot`,
`buildControlledMissionHumanValidationSnapshot`,
`sanitizeControlledMissionPreflightPayload`.

Comportement :
- mission **introuvable** → erreur propre · **archivée** → preflight impossible.
- **non reviewée / in_review** → `blocked_by_missing_review`.
- **changes_requested / blocked_local** → `blocked_by_manual_decision`.
- **blocked_by_guard** → `blocked_by_guard` · **missing information** → `blocked_by_missing_information`.
- **approved_local** seulement → preflight possible.
- tous les checks bloquants passent → `ready_for_future_governed_execution`
  (= candidate future, **jamais exécution**).
- `readiness_score` **déterministe** · résultat stocké **uniquement en localStorage**.
- double preflight met à jour le même `preflight_state`, **sans dupliquer** la mission.
- localStorage **corrompu** → fallback sûr · **indisponible** → échec propre.
- aucune fonction ne `fetch`, n'importe une base de données, ni n'appelle une route API.

## 5. Checks preflight

`mission_exists`, `mission_not_archived`, `local_review_exists`,
`local_review_approved`, `no_changes_requested`, `not_blocked_locally`,
`not_blocked_by_guard`, `required_information_present`, `employee_identified`,
`steps_present`, `human_validation_understood`, `runtime_execution_still_disabled`,
`server_persistence_still_disabled`, `pierre_not_called`, `ai_not_called`,
`email_not_sent`, `document_not_generated`, `clonevoice_not_active`,
`future_governed_execution_requires_new_phase`, `scale_not_proven`.

## 6. UI Preflight

Dans la section « Missions contrôlées locales » : panneau preflight par mission avec
action **« Lancer le preflight local »** + rapport (score, niveau, statut, checks,
blocking reasons, badges). Actions autorisées : Lancer le preflight local · Relire ·
Archiver localement. **Aucune action Exécuter / Lancer la mission / Envoyer /
Automatiser / Démarrer Pierre / Créer mission réelle / Persister serveur.**

Microcopy : « Preflight local uniquement · Aucune exécution » · « Ce contrôle vérifie
si la mission pourrait être candidate à une future exécution gouvernée. » · « Ce
contrôle ne lance pas Pierre. » · « Un statut ready ne déclenche aucune action. » · « La
mission reste préparée et non exécutée. » Si ready : « Préflight local réussi. Candidate
pour une future exécution gouvernée. Aucune exécution n'a eu lieu. » Badges : Preflight
local ready · Non exécutée · Serveur désactivé · Phase future requise.

## 7. Rapport preflight visible

score readiness · readiness_level · preflight_status · checks pass/warning/fail ·
blocking reasons · warnings · required next steps · runtime requirements snapshot ·
guard requirements snapshot · human validation snapshot. Compact et lisible.

## 8. Guardrails UI

« Ce panneau prépare une future exécution gouvernée, mais ne l'active pas. Aucune
mission réelle n'est créée dans cette phase. »

## 9. Invariants confirmés

- Preflight local actif · candidate future execution readiness active.
- `ready` = candidate future uniquement — **ne déclenche aucune exécution**.
- Runtime execution toujours inactive · server persistence toujours inactive.
- Pierre autonomous runtime toujours inactive · aucune mission réelle.
- Aucun email/document/PDF/IA · CloneVoice non actif.
- Aucun changement Pierre engine/API · aucune route preflight/execute.
- scale 80k non prouvé · lancement public externe non validé.

## 10. Ce qui est activé maintenant

Un preflight local déterministe qui produit un rapport de readiness et un statut
« candidate future exécution gouvernée » ou « non prête » — **sans exécution, sans
serveur, sans mission réelle**.

## 11. Limites restantes

- Stockage **navigateur uniquement** (pas de sync, pas de persistance serveur).
- `ready` n'active **rien** : prépare une future exécution gouvernée.
- Pas de persistance serveur gouvernée (phase suivante).

## 12. Prochaine phase recommandée

**PHASE 5.4 — Controlled Mission Governed Server Persistence Draft / Still No Execution**
— concevoir le draft de persistance serveur gouvernée des missions contrôlées,
**toujours sans exécution**.

---

**Preflight local uniquement. « ready » = candidate pour future exécution gouvernée,
jamais exécution. Mission non exécutée. Aucune mission réelle. Aucune persistance
serveur. Aucun appel Pierre / IA. Aucun email/document/PDF. CloneVoice non actif.
scale 80k non prouvé. lancement public externe non validé.**
