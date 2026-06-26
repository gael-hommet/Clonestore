# Template d'Evidence — PHASE 7.5 Second Customer Controlled Run / Public Launch Review Prep

> **Important** : Ce template doit être rempli manuellement avec des PREUVES RÉELLES.
> Ne pas auto-remplir. Ne pas inventer de deuxième client. Ne pas déclarer le client 2 démarré.
> Ne pas modifier go-live-proofs.local.json automatiquement. Public launch reste **BLOCKED**.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Qualification client 2

- [ ] Client simple · besoin RH clair · décideur accessible · accepte limites / run contrôlé / feedback
- [ ] S1/S2 · risque juridique faible · pas de paie officielle / email live / intégration complexe
- [ ] Profil légèrement différent du client 1 — *(preuve)*

## 4. Pré-vente client 2

- [ ] Client 2 = run contrôlé · aucune promesse public launch / runtime / email live / paie officielle
- [ ] Contrat / CGV signés · critères de succès · comparaison client 1 prévue · evidence dès le départ

## 5. Activation runbook (15 étapes, non démarré)

- [ ] select → qualify → limits → contrat → accès → setup → scénario → mission → livrable
- [ ] validation → evidence → feedback → comparer client 1 → reproductibilité → préparer revue

## 6. Setup

- [ ] Entreprise · contexte RH · salariés · sites · règles · approbateurs · limites · scénario
- [ ] Différences avec le client 1

## 7. Scénario

- [ ] S1/S2 recommandés · S5 non recommandé · validation humaine · runtime / email / document off

## 8. Evidence plan (collected: false par défaut)

- [ ] qualification · contrat · activation · setup · scénario · mission · livrable · validation
- [ ] feedback · incidents · comparaison client 1 · reproductibilité · décision post-run

## 9. Comparaison client 1 / client 2

- [ ] 12 axes · `customer_1_value` / `customer_2_value` = null · `comparison_status: not_compared`

## 10. Reproductibilité

- [ ] setup · output · guardrail · customer_value · operator_load · technical_reliability
- [ ] Chaque `current_score: 0` · `verified: false`

## 11. Multi-client & public launch review

- [ ] `verified_customer_count: 0` · required 2 · recommended 3 · `evidence_ready: false`
- [ ] Public launch review : `review_ready: false` · `all_inputs_verified: false` · `final_decision: blocked`
- [ ] Blockers : Stripe / Supabase / domaine-email / légal / support / monitoring / evidence / multi-client / scale
- [ ] Review inputs : chaque `verified: false` · `evidence_link: null`

## 12. Invariants littéraux

- [ ] `ready_to_prepare_second_customer` true
- [ ] `second_customer_selected` / `second_customer_started` / `second_customer_completed` / `second_customer_evidence_collected` false
- [ ] `customer_comparison_completed` / `reproducibility_verified` / `multi_customer_evidence_ready` / `public_launch_review_ready` false
- [ ] `public_launch_ready` / `scale_80k_proven` / `stripe_live_verified` / `supabase_prod_rls_verified` / `domain_email_verified` false
- [ ] `runtime_execution_active` / `real_email_sent` / `official_document_generated` / `go_live_proofs_modified` / `env_modified` / `ai_call_performed` false

## 13. Résultats commandes

- [ ] `npm run check:second-customer-controlled-run-public-launch-prep` → *(PASS)*
- [ ] `npm run test:phase7-5` → *(XX/XX)*
- [ ] `npx tsc --noEmit` → *(clean)*
- [ ] `npm run test:phase7-4` → *(99/99)*
- [ ] `npm run test:phase7-1` → *(110/110)*
- [ ] `npm run test:pfinal02` → *(2525/2525)*
- [ ] `npm test` → *(green)*
- [ ] `npm run build` → *(clean)*

## 14. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — client 2 préparé mais non démarré, evidence plan vide, comparaison non effectuée, reproductibilité non déclarée, public launch review préparée mais non prête, public launch bloqué. Prêt pour Public Launch Final Review Gate.
- [ ] **FAIL** — deuxième client inventé, client 2 démarré, reproductibilité/multi-client déclarés sans preuve, public launch déclaré, ou go-live proofs modifiés automatiquement.
- [ ] **NEEDS REVIEW** — points non bloquants à revoir.

## 15. Notes

*(Observations)*

---

> **Rappel** : P7.5 = second customer controlled run planning + public launch review preparation.
> Client 2 non démarré. La comparaison multi-client reste à prouver. Le lancement public reste
> bloqué. Prochaine étape : Public Launch Final Review Gate.
