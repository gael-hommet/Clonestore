# Template d'Evidence — PHASE 7.2 First Live Customer Controlled Run

> **Important** : Ce template doit être rempli manuellement avec des PREUVES RÉELLES.
> Ne pas auto-remplir. Ne pas inventer de client, paiement, capture, log ou feedback.
> Ne pas modifier go-live-proofs.local.json automatiquement. Public launch reste **BLOCKED**.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Qualification client

- [ ] PME simple · besoin RH clair · accepte activation contrôlée · accepte limites
- [ ] Pas de paie officielle · pas d'email live immédiat · pas d'intégration complexe
- [ ] Décideur accessible · feedback rapide possible · risque juridique faible à moyen — *(preuve)*

## 4. Pré-vente & limites

- [ ] Pierre expliqué (employé IA RH contrôlé) · limites expliquées
- [ ] Aucune promesse public launch / runtime autonome / email live / paie officielle
- [ ] Scénario P6.2 choisi · success criteria · interlocuteur · approbateur · canal support

## 5. Contrat / CGV

- [ ] Contrat / CGV signés avec limites — *(document)*
- [ ] Validation humaine · paie officielle exclue · licenciement/sanction exclus

## 6. Activation runbook (15 étapes)

- [ ] select → qualify → limits → contrat → accès → vérif accès → setup → accompagner setup
- [ ] scénario → mission contrôlée → premier livrable → validation humaine → evidence → feedback → décision

## 7. Setup

- [ ] Entreprise · contexte RH · sites · salariés · règles · approbateurs · limites · scénario prioritaire

## 8. Première mission

- [ ] Scénario choisi (S1/S2 recommandés) · validation humaine · aucun runtime · aucun email réel · aucun document officiel

## 9. Evidence collectée

- [ ] Qualification · contrat · accès · setup · scénario · trace · livrable · validation · feedback · logs · décision

## 10. Feedback client

- [ ] Gain de temps ? · livrable utile ? · limites claires ? · setup compréhensible ?
- [ ] Scénario le plus vendable ? · améliorations avant client 2 ? · continuer après ce run ?

## 11. Invariants littéraux

- [ ] `ready_to_prepare_first_live_customer` true
- [ ] `first_live_customer_completed` / `real_customer_selected` false
- [ ] `real_payment_verified` / `contract_signed_verified` / `setup_completed_verified` false
- [ ] `first_value_delivered_verified` / `feedback_collected_verified` false
- [ ] `stripe_live_verified` / `supabase_prod_rls_verified` / `domain_email_verified` false
- [ ] `runtime_execution_active` / `real_email_sent` / `official_document_generated` false
- [ ] `public_launch_ready` / `scale_80k_proven` / `go_live_proofs_modified` / `env_modified` / `ai_call_performed` false

## 12. No-go & rollback

- [ ] No-go : autonomie totale · paie officielle · email live · refus validation · juridique sensible · contrat non signé · accès KO · setup incomplet · livrable non validé · evidence absente
- [ ] Rollback : suspendre accès · demo-only · rembourser si besoin · documenter · supprimer données test · ne pas déclarer success · **ne pas update go-live proof**

## 13. Résultats commandes

- [ ] `npm run check:first-live-customer-controlled-run` → *(PASS)*
- [ ] `npm run test:phase7-2` → *(XX/XX)*
- [ ] `npx tsc --noEmit` → *(clean)*
- [ ] `npm run test:phase7-1` → *(110/110)*
- [ ] `npm run test:phase6-6` → *(114/114)*
- [ ] `npm run test:pfinal02` → *(2525/2525)*
- [ ] `npm test` → *(green)*
- [ ] `npm run build` → *(clean)*

## 14. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — premier client préparé mais non inventé, runbook complet, preuves demandées non inventées, public launch reste false, go-live proofs non modifiés. Prêt pour First Customer Evidence Review.
- [ ] **FAIL** — client/paiement/feedback inventé, public launch déclaré, ou go-live proofs modifiés automatiquement.
- [ ] **NEEDS REVIEW** — points non bloquants à revoir.

## 15. Notes

*(Observations)*

---

> **Rappel** : P7.2 = runbook du premier client réel. Aucune preuve client inventée. Public launch
> BLOCKED. Les go-live proofs restent manuels et vérifiables. Prochaine étape : First Customer
> Evidence Review.
