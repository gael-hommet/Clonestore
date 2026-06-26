# PHASE 4.9 — Runtime Controlled Mission Preview UI / Read-Only Promotion Panel

## 1. Objectif

Câbler dans `/profile/messages` un panneau **read-only** d'aperçu du contrat de
**promotion** (P4.8) d'un brouillon de mission vers une **Controlled Mission**.
PHASE 4.9 est **UI / preview uniquement** : la promotion **n'est pas appliquée**,
**aucune mission réelle** n'est créée, **aucune exécution**, **aucun appel Pierre /
IA**, **aucun write**. L'aperçu est construit **au clic uniquement**.

## 2. État P4.8

Contrat de promotion design-only validé : gates d'éligibilité → décision
(`promotion_applied` toujours false) → `ControlledMission` (gouvernée, validation
humaine, CloneGuard/CloneTrace conservés). Snapshot preview
(`runtime-mission-promotion-snapshot.ts`) disponible mais non câblé.

## 3. Pourquoi un panneau d'aperçu

L'opérateur doit pouvoir **comprendre** ce que donnerait la promotion d'un
brouillon : verdict d'éligibilité, gates, mission contrôlée résultante, et les
invariants (promotion non appliquée, validation humaine requise, aucune
exécution). P4.9 rend ce contrat lisible, sans rien exécuter.

## 4. Intégration /profile/messages

Sous la section « Brouillon de mission », un panneau
**« Promotion en mission contrôlée (aperçu) »** est ajouté. Un bouton
**« Prévisualiser la promotion »** (activé quand un brouillon local est préparé)
construit, **au clic**, le contrat de promotion via
`buildRuntimeMissionPromotionContract` puis le snapshot via
`buildRuntimeMissionPromotionSnapshot`. Aucun aperçu n'est déclenché au montage.

## 5. Ce que le panneau affiche

- Statut + **verdict** d'éligibilité (eligible / requires_human_validation / not_eligible / blocked).
- Message de décision (promotion_applied false).
- **Badges** : Contrat de promotion · Mission contrôlée · Design-only · Validation
  humaine requise · No-execution · Aucune mission réelle · Aucun appel Pierre ·
  Aucun appel IA · CloneGuard obligatoire · CloneTrace obligatoire · CloneVoice non
  actif · Scale 80k non prouvé · Lancement public externe non validé.
- **Cards** : verdict, gates bloquants, mission contrôlée, validations requises, safety flags, scale.
- **Sections** : gates d'éligibilité, mission contrôlée (contrat), gouvernance, invariants.

## 6. Microcopy

« Aperçu du contrat de promotion. La promotion n'est pas appliquée — Aucune mission
réelle créée. Validation humaine requise. Aucune exécution n'est déclenchée. Aucun
appel Pierre / IA. »

## 7. Invariant no-execution

Le panneau n'appelle que des fonctions **pures** P4.8. Aucune promotion appliquée,
aucune mission réelle, aucune exécution. La timeline du snapshot se termine par
`execution_not_started`.

## 8. Aucun write ajouté

Aucun write base de données, aucun POST, aucun appel réseau. La page réutilise les
builders purs existants (P4.3 pour le brouillon, P4.8 pour la promotion).

## 9. Aucun moteur Pierre

Aucun import `src/lib/pierre`, aucune route `/api/pierre`, aucun appel moteur Pierre.

## 10. Aucun appel IA

Aucun appel OpenAI/Anthropic/Stripe. `ai_call_performed` reste false.

## 11. Aucun email/message/document

Aucun email, message, document ou PDF généré ou envoyé.

## 12. CloneVoice non actif

CloneVoice n'est pas activé.

## 13. Scale 80k non prouvé

Le badge « Scale 80k non prouvé » est affiché. Préparation scale uniquement —
**scale 80k non prouvé**.

## 14. QA module

`runtime-mission-promotion-preview-ui-qa.ts` — 19 étapes
(`promotion_preview_panel_visible` → `public_launch_external_not_validated`),
verdict ready/blocked/passed/needs_review/pending, `ui_preview_only: true`.

## 15. Ce qui est activé maintenant

- Panneau d'aperçu de promotion read-only dans `/profile/messages` (au clic).
- QA preview UI · doc · evidence template · tests · package script.

## 16. Ce qui reste non activé

- Aucune promotion appliquée · aucune mission contrôlée réelle · aucune exécution.
- Aucune persistance · aucun SQL · aucun flag.
- **Lancement public externe : toujours non validé.**

## 17. Ce qui n'a PAS été fait en PHASE 4.9

- Aucune promotion appliquée · aucune mission réelle créée · aucune exécution CloneOS.
- Aucun SQL · aucun `.env.local` · aucun flag activé · aucun write · aucun POST.
- Aucun appel moteur Pierre · aucun appel IA · aucun email/message/document/PDF.
- Aucune activation CloneVoice · aucune modification de `go-live-proofs.local.json`.
- Aucune nouvelle persistance (P4.5/P4.6 inchangées).

**P4.9 = aperçu UI read-only. La promotion n'est pas appliquée. Aucune mission
réelle. Aucune exécution. Aucun appel Pierre. Aucun appel IA. Aucun email/message/
document. CloneVoice non actif. scale 80k non prouvé. lancement public externe non
validé.**

## 18. Prochain bloc recommandé

**PHASE 4.10 — Controlled Mission Governed Persistence Design** — concevoir
(design-only) le SQL draft + flags + design de persistance gouvernée de la mission
contrôlée (sur le modèle P4.4), sans appliquer le SQL et sans activer le flag.

Alternative :
- **PHASE 4.10 — Controlled Mission Human Validation Workflow Design** — concevoir
  le workflow de validation humaine (approbateurs, double contrôle) en design-only.
