# GO-LIVE 02 -- Stripe Live Verification Script
# Lit .env.local, verifie la config Stripe sans appeler l'API Stripe.
# Masque les secrets. N'effectue aucun paiement. Ne modifie rien.
# Compatible PowerShell 5 -- pas de ?. ni ?? ni operateurs modernes.
#
# CORRECTIONS GO-LIVE 02 :
# - Utilise STRIPE_PRICE_PIERRE (nom reel dans le code) et non STRIPE_PIERRE_ANNUAL_PRICE_ID
# - URL webhook correcte : /api/webhooks/stripe (et non /api/stripe/webhook)
# - Pierre : 449 EUR/mois (mensuel), pas annuel
# - Ne marque JAMAIS proof verified automatiquement

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " GO-LIVE 02 -- Stripe Live Verification" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ce script verifie votre configuration Stripe SANS appeler l'API Stripe." -ForegroundColor White
Write-Host "Il ne fait aucun paiement. Il ne modifie aucun proof ID." -ForegroundColor White
Write-Host ""

# ── ETAPE 1 : Lire .env.local ─────────────────────────────────────────────────

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERREUR] .env.local introuvable." -ForegroundColor Red
    Write-Host "         Copiez .env.example vers .env.local et remplissez les valeurs." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] .env.local present" -ForegroundColor Green

$envContent = Get-Content $envFile -ErrorAction SilentlyContinue

$stripeSecret = $null
$stripePublishable = $null
$stripeWebhook = $null
$stripePierrePrice = $null

foreach ($line in $envContent) {
    if ($line -match "^STRIPE_SECRET_KEY=(.+)$") { $stripeSecret = $Matches[1].Trim() }
    if ($line -match "^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(.+)$") { $stripePublishable = $Matches[1].Trim() }
    if ($line -match "^STRIPE_WEBHOOK_SECRET=(.+)$") { $stripeWebhook = $Matches[1].Trim() }
    if ($line -match "^STRIPE_PRICE_PIERRE=(.+)$") { $stripePierrePrice = $Matches[1].Trim() }
}

Write-Host ""

# ── ETAPE 2 : Verifier les cles Stripe ───────────────────────────────────────

Write-Host "ETAPE 2 -- Verification des cles Stripe" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""

$isLive = $false

if ($stripeSecret) {
    if ($stripeSecret.StartsWith("sk_live_")) {
        $maskedSk = $stripeSecret.Substring(0, 12) + "..." + $stripeSecret.Substring($stripeSecret.Length - 4)
        Write-Host "[LIVE] STRIPE_SECRET_KEY : LIVE ($maskedSk)" -ForegroundColor Green
        $isLive = $true
    } elseif ($stripeSecret.StartsWith("sk_test_")) {
        $maskedSk = $stripeSecret.Substring(0, 12) + "..." + $stripeSecret.Substring($stripeSecret.Length - 4)
        Write-Host "[TEST] STRIPE_SECRET_KEY : TEST ($maskedSk) -- cle live requise pour lancement" -ForegroundColor Yellow
        $isLive = $false
    } else {
        Write-Host "[ERREUR] STRIPE_SECRET_KEY : format inconnu (attendu sk_live_ ou sk_test_)" -ForegroundColor Red
        $isLive = $false
    }
} else {
    Write-Host "[MANQUANT] STRIPE_SECRET_KEY non defini dans .env.local" -ForegroundColor Red
}

if ($stripePublishable) {
    if ($stripePublishable.StartsWith("pk_live_")) {
        $maskedPk = $stripePublishable.Substring(0, 12) + "..." + $stripePublishable.Substring($stripePublishable.Length - 4)
        Write-Host "[LIVE] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : LIVE ($maskedPk)" -ForegroundColor Green
    } elseif ($stripePublishable.StartsWith("pk_test_")) {
        $maskedPk = $stripePublishable.Substring(0, 12) + "..." + $stripePublishable.Substring($stripePublishable.Length - 4)
        Write-Host "[TEST] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : TEST ($maskedPk)" -ForegroundColor Yellow
    } else {
        Write-Host "[ERREUR] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : format inconnu" -ForegroundColor Red
    }
} else {
    Write-Host "[MANQUANT] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY non defini dans .env.local" -ForegroundColor Red
}

# Detecter mismatch live/test
if ($stripeSecret -and $stripePublishable) {
    $secretIsLive = $stripeSecret.StartsWith("sk_live_")
    $pubIsLive = $stripePublishable.StartsWith("pk_live_")
    if ($secretIsLive -ne $pubIsLive) {
        Write-Host ""
        Write-Host "[ALERTE] MISMATCH : une cle est live et l'autre est test !" -ForegroundColor Red
        Write-Host "         Ceci causera des erreurs de paiement en production." -ForegroundColor Red
    }
}

if ($stripeWebhook) {
    if ($stripeWebhook.StartsWith("whsec_")) {
        Write-Host "[OK]    STRIPE_WEBHOOK_SECRET : present (whsec_...)" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] STRIPE_WEBHOOK_SECRET : format invalide (attendu whsec_...)" -ForegroundColor Red
    }
} else {
    Write-Host "[MANQUANT] STRIPE_WEBHOOK_SECRET non defini dans .env.local" -ForegroundColor Red
}

if ($stripePierrePrice) {
    if ($stripePierrePrice.StartsWith("price_")) {
        Write-Host "[OK]    STRIPE_PRICE_PIERRE : $stripePierrePrice" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] STRIPE_PRICE_PIERRE : format invalide (attendu price_...)" -ForegroundColor Red
    }
} else {
    Write-Host "[MANQUANT] STRIPE_PRICE_PIERRE non defini dans .env.local" -ForegroundColor Red
    Write-Host "           Creer le prix 449 EUR/mois dans Stripe Dashboard puis copier le price_..." -ForegroundColor Yellow
}

Write-Host ""

# ── ETAPE 3 : Resume mode ─────────────────────────────────────────────────────

Write-Host "ETAPE 3 -- Resume" -ForegroundColor Yellow
Write-Host "-----------------" -ForegroundColor Yellow
Write-Host ""

if ($isLive) {
    Write-Host "[LIVE] Configuration Stripe detectee en mode PRODUCTION" -ForegroundColor Green
    Write-Host "       Verifiez que TOUTES les cles sont live avant de continuer." -ForegroundColor White
    Write-Host "       Pierre attendu : 449 EUR/mois (mensuel)." -ForegroundColor White
} else {
    Write-Host "[TEST] Configuration Stripe en mode TEST ou incomplete" -ForegroundColor Yellow
    Write-Host "       Pour le lancement public, remplacer par les cles LIVE." -ForegroundColor White
    Write-Host ""
    Write-Host "  Comment obtenir les cles live :" -ForegroundColor White
    Write-Host "  1. https://dashboard.stripe.com → basculer en mode Live (toggle haut droite)" -ForegroundColor Cyan
    Write-Host "  2. Developers → API keys → Reveal live key" -ForegroundColor Cyan
    Write-Host "  3. Copier sk_live_... et pk_live_... dans .env.local" -ForegroundColor Cyan
}

Write-Host ""

# ── ETAPE 4 : Actions Dashboard Stripe ───────────────────────────────────────

Write-Host "ETAPE 4 -- Actions a realiser dans le Dashboard Stripe" -ForegroundColor Yellow
Write-Host "-------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "A. Creer le produit Pierre :" -ForegroundColor White
Write-Host "   Products → Add product" -ForegroundColor Cyan
Write-Host "   Nom : Pierre -- Employe IA RH" -ForegroundColor Cyan
Write-Host "   Prix : 449.00 EUR / Mensuel / Recurring" -ForegroundColor Cyan
Write-Host "   Copier le Price ID (price_...) → STRIPE_PRICE_PIERRE dans .env.local" -ForegroundColor Cyan
Write-Host ""
Write-Host "B. Configurer le webhook :" -ForegroundColor White
Write-Host "   Developers → Webhooks → Add endpoint" -ForegroundColor Cyan
Write-Host "   URL : https://[votre-domaine]/api/webhooks/stripe" -ForegroundColor Cyan
Write-Host "   (ATTENTION : /api/webhooks/stripe -- pas /api/stripe/webhook)" -ForegroundColor Yellow
Write-Host "   Events : checkout.session.completed" -ForegroundColor Cyan
Write-Host "            customer.subscription.created" -ForegroundColor Cyan
Write-Host "            customer.subscription.updated" -ForegroundColor Cyan
Write-Host "            customer.subscription.deleted" -ForegroundColor Cyan
Write-Host "            invoice.payment_failed" -ForegroundColor Cyan
Write-Host "   Copier Signing secret (whsec_...) → STRIPE_WEBHOOK_SECRET" -ForegroundColor Cyan
Write-Host ""
Write-Host "C. Tester le checkout :" -ForegroundColor White
Write-Host "   Ouvrir /checkout?agent=pierre en production" -ForegroundColor Cyan
Write-Host "   Verifier montant : 449 EUR/mois + essai 7 jours (carte requise)" -ForegroundColor Cyan
Write-Host "   Screenshot de la page Checkout avant le formulaire carte" -ForegroundColor Cyan
Write-Host ""

# ── ETAPE 5 : Templates proof JSON (a coller manuellement) ───────────────────

Write-Host "ETAPE 5 -- Templates proof JSON" -ForegroundColor Yellow
Write-Host "   IMPORTANT : coller dans go-live-proofs.local.json" -ForegroundColor Yellow
Write-Host "   UNIQUEMENT apres verification manuelle." -ForegroundColor Yellow
Write-Host "   Ce script ne modifie JAMAIS go-live-proofs.local.json." -ForegroundColor Yellow
Write-Host "-------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

$proofTemplate = @'
[
  {
    "proof_id": "STRIPE_LIVE_SECRET_SET",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "script_output",
    "evidence_ref": "go-live-evidence/stripe/stripe-live-env-check.txt",
    "notes": "STRIPE_SECRET_KEY sk_live_ detecte. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_live_ detecte."
  },
  {
    "proof_id": "STRIPE_LIVE_PRICE_PIERRE_449_CREATED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "dashboard",
    "evidence_ref": "go-live-evidence/stripe/product-price-449.png",
    "notes": "Prix 449 EUR/mois cree dans Dashboard Stripe live. Price ID copie dans STRIPE_PRICE_PIERRE."
  },
  {
    "proof_id": "STRIPE_LIVE_WEBHOOK_CONFIGURED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "dashboard",
    "evidence_ref": "go-live-evidence/stripe/webhook-configured.png",
    "notes": "Webhook /api/webhooks/stripe actif dans Dashboard Stripe avec statut OK."
  },
  {
    "proof_id": "STRIPE_LIVE_CHECKOUT_TESTED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/stripe/checkout-449eur.png",
    "notes": "Page Checkout Stripe s'ouvre avec 449 EUR/mois visible. Essai 7 jours + carte requise."
  },
  {
    "proof_id": "STRIPE_LIVE_PAYMENT_SUCCESS_TESTED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/stripe/payment-success-pierre-activated.png",
    "notes": "Paiement test reussi, Pierre active, webhook delivery 200 OK dans Dashboard."
  },
  {
    "proof_id": "STRIPE_LIVE_PAYMENT_FAILURE_TESTED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/stripe/payment-failure-tested.png",
    "notes": "Paiement echoue teste (carte declinee). Acces Pierre reste ou passe past_due selon logique."
  },
  {
    "proof_id": "STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/stripe/subscription-cancel-tested.png",
    "notes": "Cancel subscription teste. Acces Pierre retire. Dashboard Stripe confirme annulation."
  },
  {
    "proof_id": "PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/stripe/pierre-access-after-payment.png",
    "notes": "Apres paiement reussi, /agents/pierre/use accessible avec Pierre actif."
  },
  {
    "proof_id": "PIERRE_BLOCK_AFTER_CANCEL_VERIFIED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/stripe/pierre-blocked-after-cancel.png",
    "notes": "Apres cancel subscription, acces Pierre bloque. /agents/pierre/use renvoie vers checkout."
  }
]
'@

Write-Host $proofTemplate -ForegroundColor DarkGray
Write-Host ""
Write-Host "Documentation complete : docs/GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN GO-LIVE 02 -- Aucun appel Stripe. Aucune modification." -ForegroundColor Cyan
Write-Host " STRIPE_LIVE_SECRET_SET : toujours PENDING jusqu'a verification manuelle." -ForegroundColor Cyan
Write-Host " Public launch : toujours NO-GO jusqu'a tous les proofs verifies." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
