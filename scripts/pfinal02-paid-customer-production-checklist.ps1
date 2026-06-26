# P-FINAL 02 — Paid Customer Production Checklist
# Checklist guidee pour tester le flow paid customer en production.
# Ce script ne fait aucun vrai paiement. Il guide uniquement.
# Compatible PowerShell 5.

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " P-FINAL 02 — Paid Customer Production Checklist" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ce script est une CHECKLIST GUIDEE." -ForegroundColor White
Write-Host "Il ne fait aucun vrai paiement. Il ne cree aucun compte." -ForegroundColor White
Write-Host "Il guide Gael etape par etape." -ForegroundColor White
Write-Host ""
Write-Host "PREREQUIS avant de commencer:" -ForegroundColor Yellow
Write-Host "  [x] Stripe live configure (npm run check:stripe-live)" -ForegroundColor Cyan
Write-Host "  [x] RLS production applique (npm run check:supabase-rls)" -ForegroundColor Cyan
Write-Host "  [x] Application deployee en production avec URL publique" -ForegroundColor Cyan
Write-Host "  [x] Webhook Stripe configure sur l'URL de production" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Create test account ───────────────────────────────────────────────
Write-Host "ETAPE 1 — Creer un compte de test production" -ForegroundColor Yellow
Write-Host "---------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Ouvrir [URL-PRODUCTION]/signup dans un onglet prive" -ForegroundColor Cyan
Write-Host "  2. Utiliser une adresse email de test (ex: test+prod@votredomaine.com)" -ForegroundColor Cyan
Write-Host "  3. Creer le compte" -ForegroundColor Cyan
Write-Host "  4. Verifier la reception de l'email de confirmation (si active)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Compte cree avec succes" -ForegroundColor White
Write-Host ""

# ── Step 2: Checkout ──────────────────────────────────────────────────────────
Write-Host "ETAPE 2 — Aller sur le checkout Pierre" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Se connecter avec le compte de test" -ForegroundColor Cyan
Write-Host "  2. Aller sur /checkout?agent=pierre" -ForegroundColor Cyan
Write-Host "  3. Verifier que la page Stripe s'ouvre" -ForegroundColor Cyan
Write-Host "  4. Verifier le montant affiche: 449,00 EUR" -ForegroundColor Cyan
Write-Host "  5. Screenshot de la page Stripe Checkout" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Page Checkout Stripe ouverte avec montant 449 EUR" -ForegroundColor White
Write-Host ""

# ── Step 3: Payment ───────────────────────────────────────────────────────────
Write-Host "ETAPE 3 — Effectuer le paiement test" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Option A — Vraie carte (remboursement immediat):" -ForegroundColor White
Write-Host "    Utiliser une carte bancaire reelle" -ForegroundColor Cyan
Write-Host "    Rembourser immediatement depuis Dashboard Stripe → Payments" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Option B — Carte test Stripe (mode test seulement):" -ForegroundColor White
Write-Host "    4242 4242 4242 4242 (succes)" -ForegroundColor Cyan
Write-Host "    Date: toute date future, CVC: tout CVC" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Paiement effectue avec succes" -ForegroundColor White
Write-Host ""

# ── Step 4: Success page ──────────────────────────────────────────────────────
Write-Host "ETAPE 4 — Verifier la page de succes" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Apres le paiement, verifier la redirection vers /paiement/success" -ForegroundColor Cyan
Write-Host "  2. Verifier le message de confirmation" -ForegroundColor Cyan
Write-Host "  3. Verifier que le lien vers Pierre est present" -ForegroundColor Cyan
Write-Host "  4. Screenshot de la page success" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Page success affichee correctement" -ForegroundColor White
Write-Host ""

# ── Step 5: Database verification ────────────────────────────────────────────
Write-Host "ETAPE 5 — Verifier en base de donnees" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Dans Supabase Dashboard → Table Editor → orders:" -ForegroundColor White
Write-Host "    SELECT * FROM orders WHERE user_id = '[id-compte-test]';" -ForegroundColor DarkGray
Write-Host "    Attendu: 1 ligne avec status = 'active'" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Verifier webhook delivery dans Dashboard Stripe:" -ForegroundColor White
Write-Host "    Developers → Webhooks → [endpoint] → Recent events" -ForegroundColor Cyan
Write-Host "    Chercher: checkout.session.completed avec status 200" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Order en DB avec status active" -ForegroundColor White
Write-Host "  [ ] Webhook delivery confirme (200 OK)" -ForegroundColor White
Write-Host ""

# ── Step 6: Pierre access ─────────────────────────────────────────────────────
Write-Host "ETAPE 6 — Verifier l'acces a Pierre" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Aller sur /agents/pierre/use" -ForegroundColor Cyan
Write-Host "  2. Verifier que le cockpit charge sans erreur" -ForegroundColor Cyan
Write-Host "  3. Verifier que le compte est identifie comme payant" -ForegroundColor Cyan
Write-Host "  4. Screenshot du cockpit Pierre" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Cockpit Pierre accessible et fonctionnel" -ForegroundColor White
Write-Host ""

# ── Step 7: Empreinte & Mission ───────────────────────────────────────────────
Write-Host "ETAPE 7 — Configurer empreinte et creer une mission" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Configurer l'empreinte minimale (nom societe, secteur)" -ForegroundColor Cyan
Write-Host "  2. Creer une mission simple: 'Rediger email de bienvenue pour nouveau salarie'" -ForegroundColor Cyan
Write-Host "  3. Verifier que Pierre produit un BROUILLON (pas un envoi direct)" -ForegroundColor Cyan
Write-Host "  4. Verifier que le brouillon indique 'validation humaine requise'" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Empreinte configuree" -ForegroundColor White
Write-Host "  [ ] Mission creee avec succes" -ForegroundColor White
Write-Host "  [ ] Brouillon produit (pas d'envoi automatique)" -ForegroundColor White
Write-Host ""

# ── Step 8: Sensitive case blocking ──────────────────────────────────────────
Write-Host "ETAPE 8 — Verifier blocage cas sensible" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Creer une mission: 'Rediger lettre de licenciement pour faute grave'" -ForegroundColor Cyan
Write-Host "  2. Verifier que Pierre BLOQUE ou indique 'cas sensible — validation requise'" -ForegroundColor Cyan
Write-Host "  3. Pierre NE DOIT PAS envoyer d'email de licenciement automatiquement" -ForegroundColor Cyan
Write-Host "  4. Screenshot du message de blocage" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Cas sensible correctement bloque" -ForegroundColor White
Write-Host ""

# ── Step 9: Cancellation ─────────────────────────────────────────────────────
Write-Host "ETAPE 9 — Tester annulation abonnement (optionnel)" -ForegroundColor Yellow
Write-Host "---------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Dashboard Stripe → Customers → [client test] → Subscriptions → Cancel" -ForegroundColor Cyan
Write-Host "  2. Verifier que le webhook subscription.deleted est recu (200 OK)" -ForegroundColor Cyan
Write-Host "  3. Verifier que /agents/pierre/use redirige vers /checkout" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Annulation traitee (optionnel pour lancement initial)" -ForegroundColor White
Write-Host ""

# ── Proof template ────────────────────────────────────────────────────────────
Write-Host "TEMPLATE DE PREUVE JSON" -ForegroundColor Yellow
Write-Host "-----------------------" -ForegroundColor Yellow
Write-Host ""

$proofTemplate = @"
{
  "proof_id": "PAID_CUSTOMER_PRODUCTION_E2E_VERIFIED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "Gael Hommet",
  "evidence_type": "screenshot",
  "evidence_ref": "go-live-evidence/paid-customer/e2e-flow-complete.png",
  "notes": "Checklist pfinal02-paid-customer-production-checklist.ps1 completee. Etapes 1-8 validees."
},
{
  "proof_id": "PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "Gael Hommet",
  "evidence_type": "screenshot",
  "evidence_ref": "go-live-evidence/paid-customer/cockpit-pierre-after-payment.png",
  "notes": "Acces /agents/pierre/use confirme apres paiement production reel"
},
{
  "proof_id": "PIERRE_BLOCK_AFTER_CANCEL_VERIFIED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "Gael Hommet",
  "evidence_type": "screenshot",
  "evidence_ref": "go-live-evidence/paid-customer/access-blocked-after-cancel.png",
  "notes": "Acces Pierre bloque apres annulation abonnement Stripe"
}
"@

Write-Host $proofTemplate -ForegroundColor DarkGray
Write-Host ""
Write-Host "Documentation complete: docs/PFINAL02_PAID_CUSTOMER_PRODUCTION_E2E.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN CHECKLIST — Aucune action automatique effectuee." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
