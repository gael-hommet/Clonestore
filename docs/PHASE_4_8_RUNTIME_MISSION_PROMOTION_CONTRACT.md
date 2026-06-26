# PHASE 4.8 — Runtime Mission Promotion Contract / Draft → Controlled Mission

## 1. Objectif

Concevoir (**design-only / contract-only**) le contrat de **promotion** d'un
`RuntimeMissionDraft` (P4.3) vers une **Controlled Mission** : une mission
**gouvernée**, soumise à **validation humaine**, **sans exécution autonome**.
PHASE 4.8 ne promeut rien réellement, ne crée **aucune mission réelle**,
n'exécute **rien**, n'appelle **pas** le moteur Pierre, n'écrit **pas** en base.

## 2. État P4.7

Restore UI Polish validée — panneau « Statut brouillon runtime » dans
`/profile/messages`, dérivé des résultats P4.5, sans nouvelle persistance.

## 3. Pourquoi un contrat de promotion

Le brouillon P4.3 est un objet local. Pour aller un jour vers une exécution
contrôlée, il faut d'abord un **contrat** qui décrit : quelles conditions
(gates) rendent un brouillon promouvable, quelle décision en découle, et à quoi
ressemble la mission contrôlée résultante — **toujours sans exécution**.

## 4. Draft → Controlled Mission

Le contrat prend un `RuntimeMissionDraft` en entrée et produit un
`RuntimeMissionPromotionContract` contenant : gates d'éligibilité, décision,
et — si éligible — une `ControlledMission` (statut `awaiting_validation` ou
`controlled_ready`). La promotion **n'est jamais appliquée** (`promotion_applied`
toujours false).

## 5. Gates d'éligibilité

`draft_valid` · `draft_no_execution_flags` · `draft_not_blocked` ·
`employee_route_present` · `guard_decision_present` · `trace_contract_present` ·
`idempotency_present` · `human_validation_defined` · `tenant_scope_strict` ·
`no_real_mission_side_effect` · `scale_80k_not_proven_ack`.

## 6. Décision

Verdicts : `eligible` · `requires_human_validation` · `not_eligible` · `blocked`.
- **eligible** → contrat prêt, mission contrôlée produite (`controlled_ready`).
- **requires_human_validation** → mission contrôlée `awaiting_validation`.
- **not_eligible** → aucun employé IA actif → aucune mission contrôlée.
- **blocked** → bloqué par CloneGuard (action finale) → aucune mission contrôlée.

`decision.promotion_applied` est **toujours false**.

## 7. Controlled Mission

Représentation gouvernée (contrat) : `controlled_mission_id`, références
draft/command/intent/route/plan, étapes plan-only de gouvernance, validations
humaines requises, snapshots CloneGuard/CloneTrace/scale/queue/cost/idempotency
recopiés du brouillon, safety flags tous false. `controlled` true,
`execution_enabled` false, `read_only` true.

## 8. Étapes plan-only de promotion

`governance_review` (humain) · `human_validation` (humain) ·
`controlled_preparation` · `trace_registration` · `controlled_handoff` (humain).
Toutes `plan_only: true`, `execution_enabled: false` — jamais exécutées.

## 9. Safety flags

`promotion_applied` false · `execution_enabled` false · `mission_executed` false ·
`autonomous_execution` false · `pierre_engine_called` false · `ai_call_performed`
false · `db_write_performed` false · `email_sent`/`message_sent`/`document_generated`
false · `clonevoice_active` false · `public_launch_external_validated` false ·
`requires_human_validation` true · `controlled` true · `scale_80k_not_proven` true.

## 10. Preview snapshot

`runtime-mission-promotion-snapshot.ts` — modèle UI pur (badges/cards/sections/
timeline) pour une future preview read-only. Non câblé dans une page en P4.8.

## 11. CloneGuard / CloneTrace obligatoires

La mission contrôlée conserve la décision CloneGuard et le contrat CloneTrace du
brouillon — la validation impose leur présence.

## 12. Invariant no-execution

Aucune exécution n'est déclenchée. `execution_not_started` est l'événement
terminal de la timeline. La promotion ne crée **aucune mission réelle**.

## 13. Aucun write ajouté

Aucun write base de données, aucun POST, aucun appel réseau. Modules **purs**.

## 14. Aucun moteur Pierre

Aucun import `src/lib/pierre`, aucune route `/api/pierre`, aucun appel moteur Pierre.

## 15. Aucun appel IA

Aucun appel OpenAI/Anthropic/Stripe. `ai_call_performed` reste false.

## 16. Aucun email/message/document

Aucun email, message, document ou PDF généré ou envoyé.

## 17. CloneVoice non actif

CloneVoice n'est pas activé.

## 18. Scale 80k non prouvé

Préparation scale uniquement — **scale 80k non prouvé** (gate `scale_80k_not_proven_ack`).

## 19. Ce qui est activé maintenant

- Types `ControlledMission` + `RuntimeMissionPromotionContract`.
- Builder de contrat (gates + décision + mission contrôlée), validation, assertion no-execution.
- Preview snapshot (modèle UI pur) · QA 20 étapes · doc · evidence template · tests · package script.

## 20. Ce qui reste non activé

- Aucune mission contrôlée réelle · aucune exécution · aucune persistance.
- Aucune page modifiée (contrat design-only, preview non câblée).
- **Lancement public externe : toujours non validé.**

## 21. Ce qui n'a PAS été fait en PHASE 4.8

- Aucune promotion appliquée · aucune mission réelle créée · aucune exécution CloneOS.
- Aucun SQL · aucun `.env.local` · aucun flag activé · aucun write · aucun POST.
- Aucun appel moteur Pierre · aucun appel IA · aucun email/message/document/PDF.
- Aucune activation CloneVoice · aucune modification de `go-live-proofs.local.json`.
- Aucune intégration page (réservée à un futur bloc UI preview).

**Contrat design-only. promotion_applied false. Validation humaine requise.
CloneGuard et CloneTrace obligatoires. Aucune mission réelle. Aucune exécution.
Aucun appel Pierre. Aucun appel IA. CloneVoice non actif. scale 80k non prouvé.
lancement public externe non validé.**

## 22. Prochain bloc recommandé

**PHASE 4.9 — Runtime Controlled Mission Preview UI / Read-Only Promotion Panel**
Câbler la preview du contrat de promotion dans `/profile/messages` (read-only),
sur le modèle des blocs preview précédents.

Alternative :
- **PHASE 4.9 — Controlled Mission Governed Persistence Design** — concevoir le
  SQL draft + flags + design de persistance gouvernée (sur le modèle P4.4),
  toujours sans appliquer le SQL et sans activer le flag.
