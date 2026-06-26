# Template d'Evidence — PHASE 7.4 Customer Evidence Applied / Second Controlled Customer

> **Important** : Ce template doit être rempli manuellement avec des PREUVES RÉELLES vérifiées.
> Ne pas auto-remplir. Ne pas inventer de preuve. Aucune application sans preuve réelle vérifiée.
> Ne pas modifier go-live-proofs.local.json automatiquement. Public launch reste **BLOCKED**.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Reviewed evidence application matrix (9 catégories)

- [ ] customer_identity · contract_cgv · payment_or_activation · setup · first_output
- [ ] human_validation · feedback · incident_log · post_run_decision
- [ ] Chaque catégorie : preuve réelle P7.3 vérifiée avant toute application — *(lien)*

## 4. Application

- [ ] applied_evidence_categories : vide tant qu'aucune preuve réelle vérifiée
- [ ] unapplied_evidence_categories : raisons (no_verified_real_evidence_yet / manual_review_required / cannot_auto_apply)

## 5. Go-live contribution

- [ ] Chaque contribution : `currently_eligible: false` · `auto_update_allowed: false`
- [ ] Aucune contribution appliquée aux go-live proofs sans relecture manuelle

## 6. First customer continuation

- [ ] request_more_evidence (défaut) / continue_controlled / pause_and_fix / refund_or_cancel / convert_to_reference_later / prepare_case_study_later

## 7. Second customer preparation

- [ ] Secteur/taille · même/plus sûr scénario · éviter cas sensible · contrat vérifié
- [ ] runtime désactivé · email réel désactivé · evidence dès le début · comparer client 1
- [ ] Critères : client simple · S1/S2 · risque juridique faible · pas d'email live / paie officielle
- [ ] Chaque ligne `ready: false` (client 2 non démarré)

## 8. Multi-customer evidence base

- [ ] `customer_count_required_before_public_launch: 2` (2 ou 3 recommandés)
- [ ] `current_verified_customer_count: 0` · `evidence_base_ready: false`
- [ ] Comparer : time_saved · output_quality · setup_friction · limit_clarity · legal_safety · technical_reliability · willingness_to_continue

## 9. Public launch safety gate

- [ ] `final_decision: blocked` · un client ne suffit pas · deux clients ne suffisent pas seuls
- [ ] Exige preuves externes · légal · support · evidence multi-client

## 10. Invariants littéraux

- [ ] `ready_to_apply_customer_evidence_when_verified` true
- [ ] `evidence_applied` / `real_evidence_available` / `go_live_contribution_applied` / `first_customer_success_declared` false
- [ ] `second_customer_selected` / `second_customer_started` / `second_customer_completed` / `multi_customer_evidence_ready` false
- [ ] `public_launch_ready` / `scale_80k_proven` / `stripe_live_verified` / `supabase_prod_rls_verified` / `domain_email_verified` false
- [ ] `runtime_execution_active` / `real_email_sent` / `official_document_generated` / `go_live_proofs_modified` / `env_modified` / `ai_call_performed` false

## 11. Résultats commandes

- [ ] `npm run check:customer-evidence-applied-second-customer` → *(PASS)*
- [ ] `npm run test:phase7-4` → *(XX/XX)*
- [ ] `npx tsc --noEmit` → *(clean)*
- [ ] `npm run test:phase7-3` → *(105/105)*
- [ ] `npm run test:phase7-1` → *(110/110)*
- [ ] `npm run test:pfinal02` → *(2525/2525)*
- [ ] `npm test` → *(green)*
- [ ] `npm run build` → *(clean)*

## 12. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — application prête mais non appliquée, aucune preuve inventée, go-live non modifié, client 2 préparé mais non démarré, public launch bloqué. Prêt pour Second Customer Controlled Run / Public Launch Review Prep.
- [ ] **FAIL** — preuve inventée/auto-appliquée, public launch déclaré, go-live proofs modifiés automatiquement, ou client 2 démarré.
- [ ] **NEEDS REVIEW** — points non bloquants à revoir.

## 13. Notes

*(Observations)*

---

> **Rappel** : P7.4 = evidence application planning gate. Aucune preuve inventée ni auto-appliquée.
> Un ou deux clients ne suffisent pas à déclarer le lancement public. Les go-live proofs restent
> manuels. Prochaine étape : Second Customer Controlled Run / Public Launch Review Prep.
