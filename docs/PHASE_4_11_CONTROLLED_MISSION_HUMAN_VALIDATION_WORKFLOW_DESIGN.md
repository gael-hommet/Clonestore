# PHASE 4.11 — Controlled Mission Human Validation Workflow Design

## 1. Objectif

Concevoir (**design-only**) le workflow de **validation humaine** des candidates de
`ControlledMission` avant toute vraie mission. PHASE 4.11 définit qui valide, quand
une double validation est requise, quand bloquer, et garantit que
**« approved_preview » ne crée AUCUNE vraie mission et n'exécute RIEN**. Aucune
route POST, aucun write, aucun appel Pierre/IA.

## 2. État P4.10

Persistance gouvernée des candidates conçue (design-only) : SQL draft non appliqué,
flag default false, record mapper, health design, QA, script read-only PASS.

## 3. Pourquoi la validation humaine est obligatoire

Une mission contrôlée touche des sujets RH potentiellement sensibles
(licenciement, sanction, paie, contrat, contentieux, RGPD…). Aucune mission réelle
ne doit pouvoir être créée ou exécutée sans **validation humaine** — et, pour les
cas sensibles, sans **double validation** et/ou **revue légale**.

## 4. Différence entre approval_preview et vraie mission

`approved_preview` signifie « l'aperçu a été approuvé en design » — **pas** « une
mission a été créée ou exécutée ». En P4.11, `approval_applied` reste **false**,
`mission_created`/`controlled_mission_created`/`execution_enabled` restent **false**.
La validation est un **aperçu gouverné**, jamais une exécution.

## 5. Types validation humaine

`runtime-controlled-mission-human-validation-types.ts` : modes (design_only/
preview_only/future_governed_runtime), statuts, décisions, rôles d'acteurs,
sensibilité, gates, validateurs, requirements, decision records, trace preview,
workflow (avec tous les flags d'exécution littéralement false).

## 6. Policy classification

`runtime-controlled-mission-human-validation-policy.ts` classe la **sensibilité**
(low/medium/high/sensitive_hr/legal_sensitive/blocked) et le **risque**, et
détermine les validateurs requis. Détection par mots-clés sur le texte de la
candidate (titre/objectif/résumé/domaine).

## 7. Cas RH sensibles

licenciement, rupture, sanction, disciplinaire, avertissement, harcèlement,
discrimination, conflit salarié, accident du travail, arrêt maladie, maladie,
handicap, grossesse, paie, salaire → au moins `sensitive_hr`. contrat, avenant,
prud'hommes, contentieux, RGPD, données personnelles sensibles → `legal_sensitive`.

## 8. Second validator

Une **double validation** est requise pour les cas `sensitive_hr` / `legal_sensitive`
/ `blocked`, le risque `high`/`sensitive`, ou les mots-clés sanction / licenciement
/ harcèlement / discrimination / paie / contrat / contentieux.

## 9. Legal reviewer

Une **revue légale** est requise pour les cas juridiques (contrat, avenant,
prud'hommes, contentieux, RGPD, licenciement, sanction).

## 10. HR manager

Un **HR manager** valide tout workflow RH (employé Pierre routé) ou toute candidate
non triviale.

## 11. Gates

`runtime-controlled-mission-human-validation-gates.ts` : gates obligatoires
(human_validator_required, cloneguard_required, clonetrace_required,
tenant_scope_required, risk_review_required, no_execution_required,
no_real_mission_required, promotion_not_applied_required, audit_trace_required) +
gates conditionnels (second_validator_required, sensitive_hr_review_required,
legal_review_required, missing_context_review_required).

## 12. Workflow builder

`runtime-controlled-mission-human-validation-workflow.ts` construit le workflow,
simule des décisions **en aperçu** (`applyRuntimeControlledMissionHumanValidationDecisionPreview`)
sans rien appliquer, et valide/sanitize. Immuable — ne mute jamais le contrat.

## 13. Decisions

`approve_preview`, `request_changes`, `reject`, `block`, `escalate`, `no_decision`.
Chaque décision est `preview_only: true`, `approval_applied: false`,
`execution_started: false`.

## 14. Statuses

`not_started`, `awaiting_validator`, `awaiting_second_validator`,
`changes_requested`, `approved_preview`, `rejected`, `blocked`, `expired`,
`cancelled`. `approved_preview` = « validé mais pas encore créé/exécuté ».

## 15. Trace preview

CloneTrace preview (design) : events `workflow_created`, `policy_classified`,
`gates_built`, `validators_required`, `decision_preview_only`, `no_execution`,
`promotion_not_applied`, final_event `execution_not_started`. `server_write_enabled`
false.

## 16. Snapshot / future UI model

`runtime-controlled-mission-human-validation-snapshot.ts` — badges/cards/sections/
timeline/warnings pour une future UI / docs (read-only). Non câblé dans une page en P4.11.

## 17. Invariant no-execution

Aucune exécution. `execution_not_started` est l'événement terminal. Une approbation
en aperçu ne déclenche jamais de mission réelle.

## 18. Aucun write DB

Aucun write base de données, aucun POST, aucun appel réseau. Modules **purs**.

## 19. Aucune route POST approve/reject

Aucune route POST approve/reject n'est créée. La validation reste design-only.

## 20. Aucun moteur Pierre

Aucun import `src/lib/pierre`, aucune route `/api/pierre`, aucun appel moteur Pierre.

## 21. Aucun appel IA

Aucun appel OpenAI/Anthropic/Stripe. `ai_call_performed` false.

## 22. Aucun email/message/document

Aucun email, message, document ou PDF généré ou envoyé.

## 23. CloneVoice non actif

CloneVoice n'est pas activé.

## 24. Scale 80k non prouvé

Préparation scale uniquement — **scale 80k non prouvé**.

## 25. Ce qui est activé maintenant

- Types + policy + gates + workflow builder + snapshot + QA + script read-only + doc + evidence + tests.

## 26. Ce qui reste non activé

- Aucune approbation appliquée · aucune route POST · aucune persistance active.
- Aucun safe apply implémenté.
- **Lancement public externe : toujours non validé.**

## 27. Ce qui n'a PAS été fait en PHASE 4.11

- Aucune route POST approve/reject · aucune mission réelle créée · aucun write DB.
- Aucune approbation appliquée (`approval_applied` false) · aucune promotion appliquée.
- Aucune exécution CloneOS · aucun appel moteur Pierre · aucun appel IA.
- Aucun email/message/document/PDF · aucune activation CloneVoice.
- Aucun SQL appliqué · aucun `.env.local` modifié · aucun flag activé.
- Aucune modification de `go-live-proofs.local.json`.

**approval_preview n'est pas une vraie approbation appliquée. Aucune mission n'est
créée en base. Aucune exécution. Aucun appel Pierre. Aucun email/message/document.
CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.**

## 28. Prochain bloc recommandé

**PHASE 4.12 — Phase 4 Final QA Gate / Runtime Closure** — consolider et vérifier
PHASE 4.1 → 4.11, clôturer la phase 4 runtime (design-only), et planifier la suite.

Alternative :
- **PHASE 4.12 — Controlled Mission Runtime Closure + Next Phase Plan**.
