# P-FINAL 01 — Go-Live Checklist

**Status: DRAFT — Ne pas cocher sans preuve réelle**
**Phase: 9 — Public Launch Closure**
**Système de vérification: manuel + automatisé**

---

## Comment utiliser ce checklist

Chaque item doit être coché UNIQUEMENT lorsqu'une preuve concrète existe :
email de validation, screenshot, test documenté, ou commit prouvant l'action.

⚠️ **Jamais cocher "par défaut" ou "ça devrait être bon".**

---

## BLOC A — Legal (Bloquant)

- [ ] **CGU validées par un conseil juridique**
  - Preuve: Email ou document de validation d'un juriste avec date
  - Flag: `B48_CGU_CGV_PRIVACY_VERIFIED`
  - Proof ID: `proof_legal_cgu_validated`

- [ ] **CGV validées par un conseil juridique**
  - Preuve: Email ou document de validation d'un juriste avec date
  - Proof ID: `proof_legal_cgv_validated`

- [ ] **DPA validé par un spécialiste RGPD**
  - Preuve: Validation documentée d'un DPO ou juriste RGPD
  - Flag: `B48_LEGAL_REVIEW_COMPLETED`
  - Proof ID: `proof_legal_dpa_validated`

- [ ] **Politique de confidentialité validée**
  - Preuve: Validation juridique documentée
  - Proof ID: `proof_legal_confidentialite_validated`

- [ ] **Mentions légales complétées avec les vraies informations**
  - Preuve: Vérification manuelle que tous les placeholders sont remplacés
  - Proof ID: `proof_legal_mentions_completed`

---

## BLOC B — Sécurité (Bloquant)

- [ ] **RLS Supabase appliqué en production**
  - Preuve: Screenshot de pg_policies ou confirmation d'application du SQL
  - Script: `docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql`
  - Flag: `B48_SUPABASE_RLS_VERIFIED`
  - Proof ID: `proof_rls_applied_production`

- [ ] **Isolation RLS testée avec 2 comptes de test**
  - Preuve: Test manuel documenté — 0 rows cross-company
  - Proof ID: `proof_rls_isolation_tested`

---

## BLOC C — Paiement (Bloquant)

- [ ] **Clés Stripe live configurées en production**
  - Preuve: Vérification des variables d'environnement (sans exposer les clés)
  - Variables: `STRIPE_SECRET_KEY=sk_live_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`, `STRIPE_WEBHOOK_SECRET`
  - Flag: `B48_STRIPE_PRODUCTION_VERIFIED`
  - Proof ID: `proof_stripe_live_keys_configured`

- [ ] **Flux paiement Pierre 449€ testé de bout en bout**
  - Preuve: Test documenté avec vraie carte ou Stripe test clock
  - Proof ID: `proof_stripe_payment_flow_tested`

- [ ] **Webhook Stripe live configuré et testé**
  - Preuve: Screenshot du webhook Dashboard Stripe avec statut actif
  - Proof ID: `proof_stripe_webhook_live`

---

## BLOC D — Technique B48 (Bloquant)

- [ ] **monitoring_enabled** — Alertes production actives
- [ ] **backup_procedure_tested** — Procédure de backup testée
- [ ] **support_channel_ready** — Canal de support configuré
- [ ] **team_notified** — Équipe informée du go-live

---

## BLOC E — Produit (Non-bloquant, recommandé)

- [ ] **Mission Pierre testée de bout en bout en production**
  - Proof ID: `proof_pierre_e2e_tested`

- [ ] **Scan du contenu public passé sans violations bloquantes**
  - Outil: `src/lib/production-readiness/public-copy/copy-scanner.ts`
  - Proof ID: `proof_copy_scan_passed`

---

## Verdict final

Avant de passer `B48_PUBLIC_LAUNCH_ENABLED=true` :

1. Tous les items BLOQUANTS ci-dessus sont cochés avec preuve
2. `buildFinalGoLiveVerdict()` retourne `status: "go"`
3. `buildPublicLaunchGate()` retourne `is_go: true`
4. Un responsable a relu et signé ce document

**Système de vérification programmatique :**
```typescript
import { buildFinalGoLiveVerdict } from "@/lib/launch-readiness/final-go-live-verdict";
import { getAllBlockingProofIds } from "@/lib/launch-readiness/final-go-live-verdict";

const verdict = buildFinalGoLiveVerdict({
  b48_flags: { /* flags réels */ },
  verified_proof_ids: getAllBlockingProofIds(), // seulement si réellement vérifiés
});

console.log(verdict.status); // doit être "go"
```

---

*Généré par P-FINAL 01 — Phase 9 — Ne pas modifier sans validation équipe*
