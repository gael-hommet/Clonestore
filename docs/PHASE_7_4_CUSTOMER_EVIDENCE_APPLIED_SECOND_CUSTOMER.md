# PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer

> **Evidence application planning gate.** Prépare l'application contrôlée des preuves RÉELLES
> relues (P7.3) ET la préparation d'un deuxième client contrôlé — **sans inventer de preuve, sans
> modifier automatiquement les go-live proofs, sans déclarer public launch**. Un ou deux clients
> ne suffisent pas à déclarer le lancement public. Les go-live proofs restent manuels.

## Objectif

Répondre à : « Si des preuves réelles du premier client existent et ont été relues, comment les
appliquer proprement, décider ce qui peut contribuer aux go-live proofs, et préparer un deuxième
client contrôlé sans déclarer public launch ? »

P7.4 prépare le passage de **P7.3 = revue des preuves** vers **P7.4 = application contrôlée des
preuves + préparation client 2** — **sans** preuves inventées, **sans** modification automatique
des go-live proofs, **sans** déclaration de public launch.

P7.4 = evidence application planning gate. **P7.4 ≠ preuves réelles disponibles ≠ public launch ≠
deuxième client exécuté ≠ go-live proofs update automatique.**

## Statut & verdict par défaut

- `application_status: "ready_to_apply_when_verified"`
- `ready_to_apply_customer_evidence_when_verified: true`
- `evidence_applied` / `real_evidence_available` / `go_live_contribution_applied` /
  `first_customer_success_declared` : **false**
- `second_customer_selected` / `second_customer_started` / `second_customer_completed` /
  `multi_customer_evidence_ready` : **false**
- `public_launch_ready` / `scale_80k_proven` / `stripe_live_verified` /
  `supabase_prod_rls_verified` / `domain_email_verified` : **false**
- `runtime_execution_active` / `real_email_sent` / `official_document_generated` /
  `go_live_proofs_modified` / `env_modified` / `ai_call_performed` : **false**

## Contenu du gate

1. **Reviewed evidence application matrix** — 9 catégories (identité, contrat/CGV,
   paiement/activation, setup, premier livrable, validation humaine, feedback, incidents, décision
   post-run) ; chaque item `application_decision: "not_applied"`,
   `reason_not_applied: "no_verified_real_evidence_yet"`, `applied: false`, `verified: false`,
   `can_contribute_to_go_live_proofs`, `source_from_p7_3`.
2. **Applied evidence categories** — `[]` vide (aucune preuve réelle vérifiée disponible).
3. **Unapplied evidence categories** — toutes les catégories, raisons : `no_verified_real_evidence_yet`,
   `manual_review_required`, `cannot_auto_apply`.
4. **Go-live contribution matrix** — 7 contributions ; chacune `currently_eligible: false`,
   `applied_to_go_live_proofs: false`, `auto_update_allowed: false`.
5. **First customer continuation plan** — défaut `request_more_evidence` (options :
   continue_controlled, pause_and_fix, request_more_evidence, refund_or_cancel,
   convert_to_reference_later, prepare_case_study_later).
6. **Second customer preparation matrix** — préparer le client 2 **sans l'exécuter** (secteur/taille
   différents, même scénario si succès, scénario plus sûr si P7.3 partiel, éviter cas sensible,
   contrat vérifié, runtime/email désactivés, evidence dès le début, comparer au client 1) ; chaque
   ligne `ready: false`.
7. **Second customer selection criteria** — client simple, besoin RH net, décideur accessible,
   accepte limites/run contrôlé/feedback rapide, S1 ou S2, risque juridique faible, pas d'email
   live / paie officielle / intégration complexe.
8. **Multi-customer evidence base** — `customer_count_required_before_public_launch: 2` (2 ou 3
   recommandés), `current_verified_customer_count: 0`, `evidence_base_ready: false`, 7 catégories
   à comparer.
9. **Customer 1 vs customer 2 comparison plan** — scénario, temps setup, temps première valeur,
   qualité livrable, validation humaine, feedback, incidents, limites comprises, volonté de continuer.
10. **Public launch safety gate** — `final_decision: "blocked"` ;
    `first_customer_success_not_enough: true` ; `second_customer_success_not_enough_alone: true` ;
    exige preuves externes / légal / support / evidence multi-client.
11. **Evidence application rules** — preuve réelle + vérifiée seulement, aucune auto-application,
    opérateur humain obligatoire, go-live update manuel, jamais de public launch depuis un seul
    client, données sensibles masquées, rollback si preuve invalide.
12. **Operator apply checklist** — relire P7.3, vérifier preuves réelles, décider catégories
    applicables, préparer client 2, documenter limites, ne pas update automatiquement, ne pas
    déclarer public launch, ne pas déclarer scale.
13. **Second customer runbook** — 11 étapes ; chacune `verified: false`, `can_start_now: false`.

## Rappels (invariants)

Aucune preuve inventée ni auto-appliquée · aucune exécution autonome · aucun email réel · aucun
document officiel · aucune modification `.env.local` · aucune modification automatique des go-live
proofs · client 2 non démarré · public launch NON validé · scale 80k NON prouvé.

## Prochaine phase

**SECOND CUSTOMER CONTROLLED RUN / PUBLIC LAUNCH REVIEW PREP — exécuter un deuxième client contrôlé
avec preuves et préparer la revue de lancement public.**
