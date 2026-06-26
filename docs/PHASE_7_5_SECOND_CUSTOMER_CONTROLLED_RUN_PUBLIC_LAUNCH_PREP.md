# PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep

> **Runbook / planning gate.** Prépare l'exécution d'un **deuxième client contrôlé**, la
> comparaison client 1 / client 2, la base de preuves multi-client, et la **future revue de
> lancement public** — **sans exécuter le client 2, sans inventer de preuve, sans déclarer public
> launch**. La comparaison multi-client reste à prouver, le lancement public reste **bloqué**.

## Objectif

Répondre à : « Comment exécuter proprement un deuxième client contrôlé, comparer ses résultats au
premier, construire une base de preuves multi-client, et préparer une revue de lancement public
sans déclarer public launch ? »

P7.5 = second customer controlled run planning + public launch review preparation.
**P7.5 ≠ second customer executed ≠ public launch ≠ multi-customer evidence complete ≠ prod.**

## Statut & verdict par défaut

- `run_status: "ready_to_prepare_second_customer"` · `ready_to_prepare_second_customer: true`
- `second_customer_selected` / `second_customer_started` / `second_customer_completed` /
  `second_customer_evidence_collected` : **false**
- `customer_comparison_completed` / `reproducibility_verified` / `multi_customer_evidence_ready` /
  `public_launch_review_ready` : **false**
- `public_launch_ready` / `scale_80k_proven` / `stripe_live_verified` /
  `supabase_prod_rls_verified` / `domain_email_verified` : **false**
- `runtime_execution_active` / `real_email_sent` / `official_document_generated` /
  `go_live_proofs_modified` / `env_modified` / `ai_call_performed` : **false**

## Contenu du gate

1. **Second customer qualification matrix** — client simple, besoin RH clair, décideur accessible,
   accepte limites/run contrôlé/feedback, S1/S2, risque juridique faible, pas de paie/email
   live/intégration complexe, profil légèrement différent du client 1 (chaque item `verified: false`).
2. **Pre-sale conditions** — client 2 reste un run contrôlé ; aucune promesse public launch /
   runtime / email live / paie officielle ; contrat signé ; critères de succès ; comparaison
   client 1 prévue ; evidence dès le départ.
3. **Activation runbook** — 15 étapes ordonnées (select → … → comparer client 1 → reproductibilité
   → préparer revue public launch) ; chacune `verified: false`, `can_start_now: false`.
4. **Setup runbook** — entreprise, contexte RH, salariés, sites, règles, approbateurs, limites,
   scénario, données manquantes, **différences avec le client 1**.
5. **Scenario matrix (S1→S5)** — S1/S2 recommandés, S5 **non recommandé** pour le client 2 ;
   chaque scénario `human_validation_required: true`, `runtime_execution_allowed: false`,
   `real_email_allowed: false`, `official_document_allowed: false`.
6. **Evidence plan** — qualification → … → comparaison client 1 → reproductibilité → décision
   post-run (chaque item `collected: false`, `verification_method`).
7. **Customer 1 vs customer 2 comparison matrix** — 12 axes ; chacun `customer_1_value: null`,
   `customer_2_value: null`, `comparison_status: "not_compared"`, `conclusion: null`.
8. **Reproducibility assessment** — 6 dimensions (setup, output, guardrail, customer_value,
   operator_load, technical_reliability) ; chacune `current_score: 0`, `verified: false`, seuils.
9. **Multi-customer evidence readiness** — `verified_customer_count: 0`, `required: 2`,
   `recommended: 3`, `evidence_ready: false`, `comparison_complete: false`,
   `reproducibility_verified: false`.
10. **Public launch review prep** — 12 inputs requis (Stripe live, Supabase prod/RLS, domain/email,
    legal, support, monitoring, customer evidence, multi-customer comparison, incident register,
    rollback readiness, public copy, pricing/checkout) ; `review_ready: false`,
    `all_inputs_verified: false`, `final_public_launch_decision: "blocked"`.
11. **Public launch blocker matrix** — Stripe / Supabase / domaine-email / légal / support /
    monitoring / evidence client 1-2 / evidence multi-client / scale 80k.
12. **Public launch review inputs** — chaque input `verified: false`, `evidence_link: null`,
    `blocking_if_missing`.
13. **Operator checklist** — relire P7.4, qualifier, contractualiser, accompagner setup, collecter
    evidence, comparer client 1, évaluer reproductibilité, préparer revue, **ne pas déclarer public
    launch**, ne pas modifier les go-live proofs automatiquement.
14. **Rollback plan** — suspendre client 2, demo-only, rembourser, documenter, ne pas déclarer
    réussite, ne pas modifier go-live proofs, revenir à un seul client contrôlé.

## Rappels (invariants)

Aucun deuxième client inventé · client 2 non démarré · aucune preuve multi-client complète ·
aucune exécution autonome · aucun email réel · aucun document officiel · aucune modification
`.env.local` · aucune modification automatique des go-live proofs · public launch NON validé ·
scale 80k NON prouvé.

## Prochaine phase

**PUBLIC LAUNCH FINAL REVIEW GATE — revue finale de lancement public à partir des preuves
multi-client réelles et des preuves externes.**
