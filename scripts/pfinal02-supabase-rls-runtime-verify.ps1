# GO-LIVE 01E -- Supabase RLS Runtime Verification Launcher
# Lance le script Node.js rls-runtime-verify.mjs qui teste le RLS en conditions reelles.
# Compatible PowerShell 5 -- pas de ?. ni ?? ni operateurs modernes.
#
# Prerequis:
#   - .env.local avec NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
#   - Node.js 18+ installe
#   - npm install effectue (node_modules present)
#
# Optionnel pour test cross-user :
#   - RLS_TEST_USER_A_EMAIL, RLS_TEST_USER_A_PASSWORD
#   - RLS_TEST_USER_B_EMAIL, RLS_TEST_USER_B_PASSWORD
#
# Ce script :
#   - verifie la presence de .env.local
#   - verifie les variables sans les afficher
#   - lance node scripts/rls-runtime-verify.mjs
#   - affiche les resultats et le verdict

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " GO-LIVE 01E -- RLS Runtime Verification Launcher" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── ETAPE 1 : Verifier .env.local ─────────────────────────────────────────────

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERREUR] .env.local introuvable." -ForegroundColor Red
    Write-Host "         Creez .env.local avec vos cles Supabase." -ForegroundColor Red
    Write-Host "         Voir .env.example pour le format." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] .env.local present" -ForegroundColor Green

# ── ETAPE 2 : Verifier presence des variables (sans afficher les valeurs) ──────

$envContent = Get-Content $envFile -ErrorAction SilentlyContinue
$hasUrl = $false
$hasAnon = $false
$hasService = $false
$hasUserA = $false
$hasUserB = $false

foreach ($line in $envContent) {
    if ($line -match "^NEXT_PUBLIC_SUPABASE_URL=.+") { $hasUrl = $true }
    if ($line -match "^NEXT_PUBLIC_SUPABASE_ANON_KEY=.+") { $hasAnon = $true }
    if ($line -match "^SUPABASE_SERVICE_ROLE_KEY=.+") { $hasService = $true }
    if ($line -match "^RLS_TEST_USER_A_EMAIL=.+") { $hasUserA = $true }
    if ($line -match "^RLS_TEST_USER_B_EMAIL=.+") { $hasUserB = $true }
}

if ($hasUrl) {
    Write-Host "[OK] NEXT_PUBLIC_SUPABASE_URL : defini (valeur masquee)" -ForegroundColor Green
} else {
    Write-Host "[MANQUANT] NEXT_PUBLIC_SUPABASE_URL non defini dans .env.local" -ForegroundColor Red
    exit 1
}

if ($hasAnon) {
    Write-Host "[OK] NEXT_PUBLIC_SUPABASE_ANON_KEY : defini (valeur masquee)" -ForegroundColor Green
} else {
    Write-Host "[MANQUANT] NEXT_PUBLIC_SUPABASE_ANON_KEY non defini dans .env.local" -ForegroundColor Red
    exit 1
}

if ($hasService) {
    Write-Host "[OK] SUPABASE_SERVICE_ROLE_KEY : defini (valeur masquee)" -ForegroundColor Green
} else {
    Write-Host "[INFO] SUPABASE_SERVICE_ROLE_KEY non defini -- optionnel" -ForegroundColor Yellow
}

if ($hasUserA -and $hasUserB) {
    Write-Host "[OK] Comptes test User A / User B definis -- test cross-user ACTIF" -ForegroundColor Green
} else {
    Write-Host "[INFO] Comptes test User A/B non definis -- test cross-user SAUTE" -ForegroundColor Yellow
    Write-Host "       Ajoutez dans .env.local pour activer l'isolation cross-user :" -ForegroundColor Yellow
    Write-Host "         RLS_TEST_USER_A_EMAIL=..." -ForegroundColor DarkGray
    Write-Host "         RLS_TEST_USER_A_PASSWORD=..." -ForegroundColor DarkGray
    Write-Host "         RLS_TEST_USER_B_EMAIL=..." -ForegroundColor DarkGray
    Write-Host "         RLS_TEST_USER_B_PASSWORD=..." -ForegroundColor DarkGray
}

Write-Host ""

# ── ETAPE 3 : Verifier Node.js ────────────────────────────────────────────────

$nodeAvailable = $false
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $nodeAvailable = $true
        Write-Host "[OK] Node.js disponible : $nodeVersion" -ForegroundColor Green
    }
} catch {
    $nodeAvailable = $false
}

if (-not $nodeAvailable) {
    Write-Host "[ERREUR] Node.js introuvable. Installez Node.js 18+." -ForegroundColor Red
    exit 1
}

# ── ETAPE 4 : Verifier node_modules ──────────────────────────────────────────

if (-not (Test-Path "node_modules")) {
    Write-Host "[ERREUR] node_modules introuvable. Lancez : npm install" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules/@supabase/supabase-js")) {
    Write-Host "[ERREUR] @supabase/supabase-js non installe. Lancez : npm install" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] node_modules et @supabase/supabase-js presents" -ForegroundColor Green
Write-Host ""

# ── ETAPE 5 : Verifier le script runtime ─────────────────────────────────────

$runtimeScript = "scripts/rls-runtime-verify.mjs"
if (-not (Test-Path $runtimeScript)) {
    Write-Host "[ERREUR] Script runtime introuvable : $runtimeScript" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Script runtime present : $runtimeScript" -ForegroundColor Green
Write-Host ""

# ── ETAPE 6 : Rappel securite ─────────────────────────────────────────────────

Write-Host "SECURITE -- rappels avant lancement" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow
Write-Host "  - Les cles Supabase ne seront jamais affichees." -ForegroundColor White
Write-Host "  - Aucune donnee reelle ne sera inseree (test uniquement)." -ForegroundColor White
Write-Host "  - Ce script ne modifie pas go-live-proofs.local.json." -ForegroundColor White
Write-Host "  - Aucun appel OpenAI, Stripe ou email." -ForegroundColor White
Write-Host "  - Le verdict PASS ne marque pas automatiquement les preuves." -ForegroundColor White
Write-Host ""

# ── ETAPE 7 : Lancer le script runtime ────────────────────────────────────────

Write-Host "Lancement de la verification RLS runtime..." -ForegroundColor Cyan
Write-Host "--------------------------------------------" -ForegroundColor Cyan
Write-Host ""

node scripts/rls-runtime-verify.mjs
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Cyan

if ($exitCode -eq 0) {
    Write-Host "[OK] Script termine avec succes (exit 0)" -ForegroundColor Green
    Write-Host ""
    Write-Host "ETAPES SUIVANTES :" -ForegroundColor White
    Write-Host "  1. Consulter le rapport : go-live-evidence/supabase/rls-runtime-verification-staging.txt" -ForegroundColor Cyan
    Write-Host "  2. Prendre un screenshot Supabase pg_policies comme evidence complementaire." -ForegroundColor Cyan
    Write-Host "  3. Si verdict PASS complet : coller le JSON dans go-live-proofs.local.json." -ForegroundColor Cyan
    Write-Host "  4. Si verdict PARTIAL : relancer avec comptes test User A/B pour cross-user." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  IMPORTANT : ne pas modifier go-live-proofs.local.json sans relecture du rapport." -ForegroundColor Yellow
    Write-Host "  Le script ne modifie jamais ce fichier automatiquement." -ForegroundColor Yellow
} else {
    Write-Host "[FAIL] Script termine avec erreur (exit $exitCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  RLS verification FAILED ou erreur de configuration." -ForegroundColor Red
    Write-Host "  Ne pas marquer SUPABASE_RLS_STAGING_VERIFIED." -ForegroundColor Red
    Write-Host "  Relire les lignes [FAIL] dans la sortie ci-dessus." -ForegroundColor Red
}

Write-Host ""
Write-Host "  SUPABASE_RLS_STAGING_VERIFIED : toujours PENDING jusqu'au vrai run confirme." -ForegroundColor Yellow
Write-Host "  Public launch : toujours NO-GO jusqu'a tous les proof IDs verifies." -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN GO-LIVE 01E RLS Runtime Verification" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
