# Template d'Evidence — PHASE 7.1 External Go-Live Proofs

> **Important** : Ce template doit être rempli manuellement avec des PREUVES RÉELLES.
> Ne pas auto-remplir. Ne pas inventer de preuve. Ne pas modifier go-live-proofs.local.json
> automatiquement. Par défaut rien n'est vérifié, public launch reste **BLOCKED**.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Stripe live

- [ ] Clés live configurées (hors repo) — *(preuve)*
- [ ] Webhook live vérifié (signature + événement) — *(preuve)*
- [ ] Produit / prix live (449€/mois) — *(preuve)*
- [ ] **Transaction live réelle puis remboursée (D, bloquant)** — *(preuve datée)*
- [ ] Portail client live testé — *(preuve)*

## 4. Supabase prod / RLS

- [ ] Projet production provisionné — *(preuve)*
- [ ] **RLS activé sur toutes les tables tenant (D, bloquant)** — *(preuve)*
- [ ] **Policies RLS testées avec auth réelle, aucune fuite (D, bloquant)** — *(sortie de tests)*
- [ ] Service role audité — *(preuve)*
- [ ] Backups / PITR configurés — *(preuve)*

## 5. Domaine / email

- [ ] Domaine acheté + DNS pointant — *(preuve)*
- [ ] **SPF / DKIM / DMARC configurés et vérifiés (D, bloquant)** — *(preuve)*
- [ ] Domaine expéditeur vérifié — *(preuve)*
- [ ] Délivrabilité testée (en-têtes) — *(preuve)*
- [ ] Adresse contact / support active — *(preuve)*

## 6. Premier client réel

- [ ] Candidat identifié — *(notes)*
- [ ] Contrat / CGV contrôlés signés — *(document)*
- [ ] Activation réelle sous contrôle — *(logs)*
- [ ] Première valeur livrée + validée humainement — *(livrable + trace)*
- [ ] Evidence capturée — *(dossier)*

## 7. Invariants littéraux

- [ ] `external_go_live_proofs_ready` / `public_launch_ready` false (sauf preuves réelles)
- [ ] `stripe_live_verified` / `supabase_prod_rls_verified` / `domain_email_verified` false
- [ ] `first_live_customer_verified` / `scale_80k_proven` false
- [ ] `real_payment_performed` / `real_email_sent` / `runtime_execution_active` false
- [ ] `env_modified` / `go_live_proofs_modified` / `ai_call_performed` false

## 8. Rollback

- [ ] Retour test mode Stripe · webhook désactivé · client en pause
- [ ] Restauration backup Supabase · retour DNS antérieur · communication/documentation

## 9. Résultats commandes

- [ ] `npm run check:external-go-live-proofs` → *(PASS)*
- [ ] `npm run test:phase7-1` → *(XX/XX)*
- [ ] `npx tsc --noEmit` → *(clean)*
- [ ] `npm run test:phase6-6` → *(114/114)*
- [ ] `npm run test:pfinal02` → *(2525/2525)*
- [ ] `npm test` → *(green)*
- [ ] `npm run build` → *(clean)*

## 10. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — readiness documentée, étapes manuelles & rollback prêts, public launch reste bloqué sans preuve réelle. Prêt pour First Live Customer Controlled Run.
- [ ] **FAIL** — preuve inventée, public launch déclaré sans preuve, ou go-live proofs modifiés automatiquement.
- [ ] **NEEDS REVIEW** — points non bloquants à revoir.

## 11. Notes

*(Observations)*

---

> **Rappel** : P7.1 = gate de preuves externes. Aucune preuve inventée. Public launch BLOCKED
> sans preuve réelle. Ne jamais déclarer public launch ready sans preuve réelle. Prochaine
> étape : First Live Customer Controlled Run.
