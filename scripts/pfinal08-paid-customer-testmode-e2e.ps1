# pfinal08-paid-customer-testmode-e2e.ps1
# GO-LIVE 08 -- Paid Customer E2E Test Mode Readiness Check
#
# SAFETY: This script only runs in STRIPE TEST MODE.
# It refuses to execute if sk_live_ is detected.
# It NEVER modifies go-live-proofs.local.json.
# It NEVER contacts OpenAI or Anthropic.
# It NEVER sends real emails.
# It NEVER exposes secrets in output.
#
# Usage: npm run check:paid-customer-testmode

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  GO-LIVE 08 -- Paid Customer E2E -- TEST MODE ONLY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[SAFETY] This script operates in STRIPE TEST MODE ONLY." -ForegroundColor Yellow
Write-Host "[SAFETY] No real payments. No live Stripe calls. No production data." -ForegroundColor Yellow
Write-Host ""

# -- Load .env.local ----------------------------------------------------------

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "[FAIL] .env.local not found. Copy .env.example to .env.local and fill in Stripe test keys." -ForegroundColor Red
    exit 1
}

$envVars = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
    if ($line -match '^([^=]+)=(.*)$') {
        $envVars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

Write-Host "[INFO] .env.local loaded. Checking variables..." -ForegroundColor Gray
Write-Host ""

$pass = 0
$fail = 0
$warn = 0

function CheckVar {
    param($name, $required, $prefix, $label)
    $val = $envVars[$name]
    if (-not $val) {
        if ($required) {
            Write-Host "  [FAIL] $name - missing (required)" -ForegroundColor Red
            $script:fail++
        } else {
            Write-Host "  [WARN] $name - not set (optional)" -ForegroundColor Yellow
            $script:warn++
        }
        return $false
    }
    if ($prefix -and -not $val.StartsWith($prefix)) {
        Write-Host "  [FAIL] $name - found but does not start with '$prefix'" -ForegroundColor Red
        $script:fail++
        return $false
    }
    # Never print secret values -- only mask
    $masked = $val.Substring(0, [Math]::Min(12, $val.Length)) + "****"
    Write-Host "  [OK]   $name = $masked ($label)" -ForegroundColor Green
    $script:pass++
    return $true
}

# -- Safety check: refuse sk_live_ -------------------------------------------

Write-Host "-- SAFETY CHECK -----------------------------------------------" -ForegroundColor Cyan
$stripeKey = $envVars["STRIPE_SECRET_KEY"]
if ($stripeKey -and $stripeKey.StartsWith("sk_live_")) {
    Write-Host ""
    Write-Host "  [BLOCKED] STRIPE_SECRET_KEY starts with sk_live_." -ForegroundColor Red
    Write-Host "  [BLOCKED] GO-LIVE 08 refuses to run with live Stripe keys." -ForegroundColor Red
    Write-Host "  [BLOCKED] Switch to sk_test_ keys for E2E test mode validation." -ForegroundColor Red
    Write-Host ""
    exit 1
}
$pubKey = $envVars["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]
if ($pubKey -and $pubKey.StartsWith("pk_live_")) {
    Write-Host ""
    Write-Host "  [BLOCKED] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY starts with pk_live_." -ForegroundColor Red
    Write-Host "  [BLOCKED] GO-LIVE 08 refuses to run with live Stripe keys." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK]   No sk_live_ or pk_live_ detected. Test mode confirmed." -ForegroundColor Green
$pass++
Write-Host ""

# -- Stripe test mode vars ----------------------------------------------------

Write-Host "-- STRIPE TEST MODE -------------------------------------------" -ForegroundColor Cyan
$null = CheckVar "STRIPE_SECRET_KEY" $true "sk_test_" "Stripe secret key (test)"
$null = CheckVar "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" $true "pk_test_" "Stripe publishable key (test)"
$null = CheckVar "STRIPE_WEBHOOK_SECRET" $true "whsec_" "Stripe webhook secret"
$null = CheckVar "STRIPE_PRICE_PIERRE" $true "price_" "Pierre test price ID"
Write-Host ""

# -- Supabase vars ------------------------------------------------------------

Write-Host "-- SUPABASE ---------------------------------------------------" -ForegroundColor Cyan
$null = CheckVar "NEXT_PUBLIC_SUPABASE_URL" $true "https://" "Supabase project URL"
$null = CheckVar "NEXT_PUBLIC_SUPABASE_ANON_KEY" $true "eyJ" "Supabase anon key"
$null = CheckVar "SUPABASE_SERVICE_ROLE_KEY" $false "eyJ" "Supabase service role key (for DB checks)"
Write-Host ""

# -- App URL ------------------------------------------------------------------

Write-Host "-- APP --------------------------------------------------------" -ForegroundColor Cyan
$null = CheckVar "NEXT_PUBLIC_APP_URL" $false "http" "App base URL"
Write-Host ""

# -- Results ------------------------------------------------------------------

Write-Host "-- RESULTS ----------------------------------------------------" -ForegroundColor Cyan
Write-Host "  PASS: $pass | FAIL: $fail | WARN: $warn" -ForegroundColor White
Write-Host ""

if ($fail -gt 0) {
    Write-Host "[FAIL] Environment is NOT ready for Stripe test mode E2E." -ForegroundColor Red
    Write-Host "       Fix the above FAIL items before proceeding." -ForegroundColor Red
    Write-Host ""
} else {
    Write-Host "[OK]   Environment is ready for Stripe test mode E2E." -ForegroundColor Green
    Write-Host ""
}

# -- E2E Status ---------------------------------------------------------------

Write-Host "-- E2E TEST STATUS --------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To run the full E2E verification, use the Node script:" -ForegroundColor Gray
Write-Host "  node scripts/paid-customer-testmode-e2e.mjs" -ForegroundColor White
Write-Host ""
Write-Host "  If STRIPE_TEST_CHECKOUT_SESSION_ID is set in .env.local," -ForegroundColor Gray
Write-Host "  the script will verify the checkout session against Stripe." -ForegroundColor Gray
Write-Host ""

$csid = $envVars["STRIPE_TEST_CHECKOUT_SESSION_ID"]
if ($csid) {
    $maskedCsid = $csid.Substring(0, [Math]::Min(20, $csid.Length)) + "****"
    Write-Host "  STRIPE_TEST_CHECKOUT_SESSION_ID = $maskedCsid (found)" -ForegroundColor Green
} else {
    Write-Host "  STRIPE_TEST_CHECKOUT_SESSION_ID - not set (pending manual E2E run)" -ForegroundColor Yellow
}

$testEmail = $envVars["STRIPE_TEST_USER_EMAIL"]
if ($testEmail) {
    $maskedEmail = $testEmail -replace '(?<=.{3}).+(?=@)', '****'
    Write-Host "  STRIPE_TEST_USER_EMAIL = $maskedEmail (found)" -ForegroundColor Green
} else {
    Write-Host "  STRIPE_TEST_USER_EMAIL - not set (optional for DB access check)" -ForegroundColor Yellow
}
Write-Host ""

# -- Evidence file ------------------------------------------------------------

$evidenceDir = "go-live-evidence/paid-customer-testmode"
if (-not (Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
    Write-Host "  [INFO] Created evidence directory: $evidenceDir" -ForegroundColor Gray
}

$evidenceFile = "$evidenceDir/paid-customer-testmode-e2e.txt"
Write-Host "-- EVIDENCE FILE ----------------------------------------------" -ForegroundColor Cyan
Write-Host "  Expected path: $evidenceFile" -ForegroundColor Gray
if (Test-Path $evidenceFile) {
    Write-Host "  [EXISTS] Evidence file found." -ForegroundColor Green
} else {
    Write-Host "  [PENDING] Evidence file not yet created." -ForegroundColor Yellow
    Write-Host "  Run the E2E test and copy the template below." -ForegroundColor Gray
}
Write-Host ""

# -- Proof templates ----------------------------------------------------------

Write-Host "-- PROOF TEMPLATES (copy manually after E2E passes) ----------" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NOTE: NEVER run this script to auto-write go-live-proofs.local.json." -ForegroundColor Yellow
Write-Host "  Copy these templates manually after verifying each step." -ForegroundColor Yellow
Write-Host ""

$now = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

$proofs = @(
    @{ id = "STRIPE_TEST_CHECKOUT_E2E_STARTED"; notes = "Checkout session created in Stripe test mode." },
    @{ id = "STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED"; notes = "Payment confirmed via Stripe test card 4242 4242 4242 4242." },
    @{ id = "STRIPE_TEST_WEBHOOK_RECEIVED"; notes = "Webhook checkout.session.completed received with 200 OK." },
    @{ id = "PIERRE_ACCESS_AFTER_TEST_PAYMENT_VERIFIED"; notes = "orders table shows active/trialing for test user after webhook." },
    @{ id = "PIERRE_SETUP_AFTER_TEST_PAYMENT_VERIFIED"; notes = "/agents/pierre/setup accessible after test payment." },
    @{ id = "PIERRE_COCKPIT_AFTER_TEST_PAYMENT_VERIFIED"; notes = "/agents/pierre/use accessible and Pierre cockpit shows active." },
    @{ id = "STRIPE_TEST_SUBSCRIPTION_CANCEL_VERIFIED"; notes = "Subscription cancelled in Stripe test dashboard. Webhook received." },
    @{ id = "PIERRE_BLOCK_AFTER_TEST_CANCEL_VERIFIED"; notes = "orders table updated to canceled. Access revoked or marked non-active." },
    @{ id = "PAID_CUSTOMER_TESTMODE_E2E_COMPLETED"; notes = "Full test mode paid customer E2E verified: checkout, payment, webhook, access, setup, cockpit, cancel, access update." }
)

foreach ($proof in $proofs) {
    Write-Host "  -----------------------------------------------------" -ForegroundColor DarkGray

    $proofObject = [ordered]@{
        proof_id      = $proof.id
        status        = "verified"
        verified_at   = $now
        verified_by   = "Gael Hommet"
        evidence_type = "manual_e2e"
        evidence_ref  = "go-live-evidence/paid-customer-testmode/paid-customer-testmode-e2e.txt"
        notes         = $proof.notes
    }

    $proofJson = $proofObject | ConvertTo-Json -Depth 5
    Write-Host $proofJson -ForegroundColor White
}

Write-Host ""
Write-Host "-- END --------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Docs: docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md" -ForegroundColor Gray
Write-Host "  Node: node scripts/paid-customer-testmode-e2e.mjs" -ForegroundColor Gray
Write-Host "  Evidence: $evidenceFile" -ForegroundColor Gray
Write-Host ""
Write-Host "[TEST MODE ONLY] No live Stripe calls. No real payments." -ForegroundColor Yellow
Write-Host ""

if ($fail -gt 0) { exit 1 }
exit 0
