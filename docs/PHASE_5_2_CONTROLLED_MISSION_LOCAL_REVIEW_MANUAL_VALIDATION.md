# PHASE 5.2 — Controlled Mission Local Review & Manual Validation Layer

## 1. Objectif

Ajouter une couche **locale** de relecture et validation humaine des Controlled
Missions créées en P5.1 : ouverture en mode review → **checklist humaine** →
**décision locale** (approuver localement / demander modification / bloquer
localement / archiver localement). **Même après approbation locale, la mission ne
s'exécute PAS.** L'approbation locale signifie seulement « revue humaine terminée /
prête pour phase ultérieure ». Aucun runtime, aucun serveur, aucun Pierre, aucun
email/document/PDF, aucune IA.

## 2. État P5.1 (verrouillé)

Controlled Mission local safe apply VALIDATED · missions en localStorage · visibles,
relisibles, archivables · marquées non exécutées · runtime/server/Pierre inactifs.

## 3. Modèle étendu

`LocalControlledMission` reçoit un bloc optionnel `review_state` :
`review_status` (`not_reviewed`/`in_review`/`approved_local`/`changes_requested`/
`blocked_local`/`archived_local`), `reviewer_role`, `reviewer_note`, `reviewed_at`,
`decision_reason`, `required_changes`, `checklist`, `validation_score`, `timeline`,
`local_approval_only: true`, `runtime_execution_after_approval: disabled`,
`server_persistence_after_approval: disabled`.

La mission garde toujours : `execution_status` non-exécutable, `runtime_execution`
disabled, `server_persistence` disabled, `real_mission_created` false,
`pierre_engine_called` false, `ai_call_performed` false, `email_sent` false,
`document_generated` false, `clonevoice_active` false.

## 4. Module de review locale

`controlled-mission-local-review.ts` :
`buildControlledMissionReviewChecklist`, `startLocalControlledMissionReview`,
`approveLocalControlledMission`, `requestChangesForLocalControlledMission`,
`blockLocalControlledMission`, `archiveReviewedLocalControlledMission`,
`validateControlledMissionLocalReviewDecision`,
`sanitizeControlledMissionReviewPayload`, `buildControlledMissionLocalReviewResult`,
`summarizeControlledMissionReviewState`, `getControlledMissionReviewState`.

Comportement :
- **Idempotence** : approuver deux fois ne duplique rien et ne crée aucune mission.
- **approval local = `review_status` `approved_local` uniquement** — ne change jamais
  `runtime_execution` ni `server_persistence`, ne crée aucune route/API/server call.
- notes et `required_changes` **sanitizés** (HTML/script + redaction secrets).
- mission **introuvable** → erreur propre · localStorage **corrompu** → fallback sûr ·
  **indisponible** → échec propre.
- mission **archivée** → approbation impossible.
- mission **blocked_by_guard / missing information** → approbation impossible /
  `blocked_local` forcé avec raison visible.

## 5. UI review

Dans la section « Missions contrôlées locales » : badges de statut review, **checklist
humaine** par mission, microcopy, et actions **Relire · Démarrer la review · Approuver
localement · Demander modification · Bloquer localement · Archiver localement**.
**Aucune action Exécuter / Lancer / Envoyer / Automatiser / Démarrer Pierre / Créer
mission réelle / Persister serveur.**

Microcopy : « Approbation locale uniquement · Aucune exécution » · « Cette validation
ne lance pas Pierre. » · « La mission reste préparée et non exécutée. » · « La
persistance serveur et l'exécution gouvernée seront traitées dans une phase
ultérieure. » Après approbation : « Mission approuvée localement. Elle n'a pas été
exécutée. » + badge « Approuvée localement » + « Non exécutée » + « Serveur désactivé ».

## 6. Checklist humaine

Objectif clair · Employé IA concerné identifié · Données suffisantes · Risque
acceptable · Validation humaine requise comprise · Aucune action sensible non validée ·
Étapes relues · Résultat attendu clair · Aucune exécution automatique attendue.
Générée localement depuis la mission, pure/localStorage.

## 7. Historique local de review

Chaque décision ajoute un item de timeline locale : `review_started`, `local_approved`,
`changes_requested`, `local_blocked`, `archived_local` — avec id, event, label, detail,
created_at, reviewer_role, `local_only: true`, `execution_enabled: false`.

## 8. Guardrails UI

« Ce panneau sert à relire et valider humainement une mission contrôlée locale. Même
approuvée, elle ne sera pas exécutée dans cette phase. »

## 9. Invariants confirmés

- Review locale active · approbation locale active.
- Runtime execution toujours inactive · server persistence toujours inactive.
- Pierre autonomous runtime toujours inactive · aucune mission réelle.
- Aucun email/document/PDF/IA · CloneVoice non actif.
- Aucun changement Pierre engine/API · aucune route execute.
- scale 80k non prouvé · lancement public externe non validé.

## 10. Ce qui est activé maintenant

Relecture, checklist humaine locale, décisions locales (approuver/modifier/bloquer/
archiver) tracées en timeline locale — **sans exécution, sans serveur**.

## 11. Limites restantes

- Stockage **navigateur uniquement** (pas de sync, pas de persistance serveur).
- L'approbation locale **ne déclenche aucune exécution** (préparée pour phase ultérieure).
- Pas de readiness gate d'exécution (préflight no-execution) — phase suivante.

## 12. Prochaine phase recommandée

**PHASE 5.3 — Controlled Mission Local Execution Readiness Gate / No-Execution Runtime
Preflight** — préflight de préparation à l'exécution, **toujours sans exécuter**.

---

**localStorage-first uniquement. Approbation locale = jamais exécution. Mission non
exécutée. Aucune mission réelle. Aucune persistance serveur. Aucun appel Pierre / IA.
Aucun email/document/PDF. CloneVoice non actif. scale 80k non prouvé. lancement public
externe non validé.**
