# PHASE 7.2 — First Live Customer Controlled Run / Sell · Activate · Accompany First Real Customer With Evidence

> **Runbook / evidence gate du premier vrai client Pierre.** Prépare la vente, l'activation,
> l'accompagnement et la documentation du premier client réel — **sans déclarer public launch,
> sans mentir sur les preuves live, en collectant l'evidence réelle nécessaire**. Aucune preuve
> client n'est inventée. Public launch reste **BLOCKED**. Les go-live proofs restent manuels et
> vérifiables.

## Objectif

Répondre à : « Comment vendre, activer, accompagner et documenter le premier vrai client Pierre,
sous contrôle ? » Ce bloc est un **runbook opérateur** lecture seule, prêt pour un futur passage
réel, mais qui ne valide rien et n'invente rien.

## Statut & verdict par défaut

- `run_status: "ready_to_prepare_first_customer"`
- `ready_to_prepare_first_live_customer: true`
- `first_live_customer_completed: false` · `real_customer_selected: false`
- `real_payment_verified` / `contract_signed_verified` / `setup_completed_verified` /
  `first_value_delivered_verified` / `feedback_collected_verified`: **false**
- `stripe_live_verified` / `supabase_prod_rls_verified` / `domain_email_verified`: **false**
- `public_launch_ready: false` · `scale_80k_proven: false`
- `go_live_proofs_modified: false` · `env_modified: false` · `ai_call_performed: false`

## Contenu du runbook

1. **Customer qualification matrix** — PME simple, besoin RH clair, accepte activation contrôlée
   et limites, pas de paie officielle / email live / intégration complexe, décideur accessible,
   feedback rapide, risque juridique faible à moyen (chaque item `verified: false`).
2. **Pre-sale conditions** — expliquer Pierre (employé IA RH contrôlé) et les limites ; aucune
   promesse public launch / runtime autonome / email live / paie officielle ; choisir un des 5
   scénarios P6.2 ; success criteria, interlocuteur, approbateur, canal support.
3. **Legal & commercial limits** — CGV/contrat avec limites, validation humaine, paie/licenciement
   exclus, emails réels exclus (sauf future preuve domaine/email), pas de SLA public launch / scale.
4. **Activation runbook** — 15 étapes ordonnées (select → qualify → limits → contrat → accès →
   setup → scénario → mission → livrable → validation → evidence → feedback → décision suite),
   chacune `can_be_marked_done_now: false`, `verified: false`.
5. **Setup runbook** — entreprise, contexte RH, sites, salariés, règles, approbateurs, limites,
   scénario prioritaire, informations manquantes.
6. **First mission runbook (S1→S5)** — S1/S2 recommandés pour le premier client (valeur visible,
   risque maîtrisé) ; chaque scénario `human_validation_required: true`,
   `runtime_execution_allowed: false`, `real_email_allowed: false`, `official_document_allowed: false`.
7. **Evidence collection plan** — qualification, contrat, accès, setup, scénario, trace, livrable,
   validation humaine, feedback, logs, décision post-run (chaque item `collected: false`).
8. **Customer feedback plan** — 7 questions (gain de temps, utilité, clarté des limites, setup,
   scénario le plus vendable, améliorations avant client 2, volonté de continuer).
9. **Operator responsibilities** — founder/operator, client decision maker, HR approver,
   technical observer, legal/commercial reviewer.
10. **No-go conditions** — autonomie totale, paie officielle, email live, refus de validation
    humaine, action juridique sensible, contrat non signé, accès KO, setup incomplet, livrable
    non validé, evidence non collectée.
11. **Rollback plan** — suspendre accès, revenir demo-only, ne pas encaisser / rembourser,
    documenter incident, supprimer données test, ne pas déclarer success, **ne pas update go-live proof**.
12. **Public launch impact** — `public_launch_ready` reste false ; un client réel peut améliorer
    l'evidence ; public launch seulement après preuves externes ; un client ≠ preuve de scale.
13. **Go-live proof updates policy** — manuel uniquement, après preuve réelle, **jamais via ce
    module**, daté, vérifiable, rollback noté en cas d'échec.

## Rappels (invariants)

Aucun client/paiement/capture/log/feedback inventé · aucune exécution autonome · aucun email réel ·
aucun document officiel sans validation · aucune modification `.env.local` · aucune modification
automatique des go-live proofs · public launch NON validé · scale 80k NON prouvé.

## Prochaine phase

**FIRST CUSTOMER EVIDENCE REVIEW — revoir les preuves réelles du premier client avant toute
décision de lancement public.**
