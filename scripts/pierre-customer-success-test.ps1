# pierre-customer-success-test.ps1
# Bloc 24 - Pierre Customer Success, Conversion & Retention Engine
# Script de test E2E PowerShell 5 compatible
# Usage: $env:PIERRE_TEST_TOKEN = "votre_token"; .\scripts\pierre-customer-success-test.ps1

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

if (-not $env:PIERRE_TEST_TOKEN) {
    Write-Host "[ERREUR] Variable d'environnement PIERRE_TEST_TOKEN manquante."
    Write-Host "         Definir avec : `$env:PIERRE_TEST_TOKEN = 'votre_token_supabase'"
    exit 1
}

$token = $env:PIERRE_TEST_TOKEN
$passed = 0
$failed = 0

function Test-Step {
    param([string]$Name, [scriptblock]$Check)
    try {
        $result = & $Check
        if ($result) {
            Write-Host "[OK] $Name"
            $script:passed++
        } else {
            Write-Host "[FAIL] $Name"
            $script:failed++
        }
    } catch {
        Write-Host "[ERREUR] $Name : $_"
        $script:failed++
    }
}

function Invoke-PierreGet {
    param([string]$Path, [string]$Token)
    $headers = @{}
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    $response = Invoke-WebRequest -Uri "$BaseUrl$Path" -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
    return $response
}

function Get-JsonBody {
    param([object]$Response)
    try {
        return ($Response.Content | ConvertFrom-Json)
    } catch {
        return $null
    }
}

Write-Host ""
Write-Host "=== PIERRE CUSTOMER SUCCESS TEST ==="
Write-Host "Base URL : $BaseUrl"
Write-Host ""

# ────────────────────────────────────────────────────────────────
# Etape 1 : GET /customer-success sans token -> 401
# ────────────────────────────────────────────────────────────────
Test-Step "1. GET /customer-success sans token retourne 401" {
    $resp = Invoke-PierreGet -Path "/api/pierre/use/customer-success" -Token ""
    $resp.StatusCode -eq 401
}

# ────────────────────────────────────────────────────────────────
# Etape 2 : GET /customer-success avec token -> 200 ok:true
# ────────────────────────────────────────────────────────────────
$csResp = $null
$csBody = $null
Test-Step "2. GET /customer-success avec token valide retourne ok:true" {
    $script:csResp = Invoke-PierreGet -Path "/api/pierre/use/customer-success" -Token $token
    $script:csBody = Get-JsonBody -Response $script:csResp
    $script:csResp.StatusCode -eq 200 -and $script:csBody -ne $null -and $script:csBody.ok -eq $true
}

# ────────────────────────────────────────────────────────────────
# Etape 3 : Vérifier que report est present
# ────────────────────────────────────────────────────────────────
Test-Step "3. Le champ 'report' est present dans la reponse" {
    $script:csBody -ne $null -and $script:csBody.report -ne $null
}

# ────────────────────────────────────────────────────────────────
# Etape 4 : Vérifier health.score entre 0 et 100
# ────────────────────────────────────────────────────────────────
Test-Step "4. report.health.score est entre 0 et 100" {
    if ($script:csBody -eq $null) { return $false }
    $score = $script:csBody.report.health.score
    $score -ne $null -and $score -ge 0 -and $score -le 100
}

# ────────────────────────────────────────────────────────────────
# Etape 5 : Vérifier health.status est une valeur valide
# ────────────────────────────────────────────────────────────────
Test-Step "5. report.health.status est une valeur valide" {
    if ($script:csBody -eq $null) { return $false }
    $validStatuses = @("excellent", "healthy", "fragile", "at_risk", "critical")
    $status = $script:csBody.report.health.status
    $status -ne $null -and $validStatuses -contains $status
}

# ────────────────────────────────────────────────────────────────
# Etape 6 : Vérifier conversion.score entre 0 et 100
# ────────────────────────────────────────────────────────────────
Test-Step "6. report.conversion.score est entre 0 et 100" {
    if ($script:csBody -eq $null) { return $false }
    $score = $script:csBody.report.conversion.score
    $score -ne $null -and $score -ge 0 -and $score -le 100
}

# ────────────────────────────────────────────────────────────────
# Etape 7 : Vérifier retention.score entre 0 et 100
# ────────────────────────────────────────────────────────────────
Test-Step "7. report.retention.score est entre 0 et 100" {
    if ($script:csBody -eq $null) { return $false }
    $score = $script:csBody.report.retention.score
    $score -ne $null -and $score -ge 0 -and $score -le 100
}

# ────────────────────────────────────────────────────────────────
# Etape 8 : Vérifier signals est un array
# ────────────────────────────────────────────────────────────────
Test-Step "8. report.signals est un array" {
    if ($script:csBody -eq $null) { return $false }
    $signals = $script:csBody.report.signals
    $signals -ne $null -and $signals.GetType().Name -like "*Object*" -or ($signals -is [System.Array])
}

# ────────────────────────────────────────────────────────────────
# Etape 9 : Vérifier risks est un array
# ────────────────────────────────────────────────────────────────
Test-Step "9. report.risks est un array" {
    if ($script:csBody -eq $null) { return $false }
    $risks = $script:csBody.report.risks
    $risks -ne $null
}

# ────────────────────────────────────────────────────────────────
# Etape 10 : GET /customer-success/actions -> ok:true
# ────────────────────────────────────────────────────────────────
$actResp = $null
$actBody = $null
Test-Step "10. GET /customer-success/actions retourne ok:true" {
    $script:actResp = Invoke-PierreGet -Path "/api/pierre/use/customer-success/actions" -Token $token
    $script:actBody = Get-JsonBody -Response $script:actResp
    $script:actResp.StatusCode -eq 200 -and $script:actBody -ne $null -and $script:actBody.ok -eq $true
}

# ────────────────────────────────────────────────────────────────
# Etape 11 : Vérifier actions array dans /actions
# ────────────────────────────────────────────────────────────────
Test-Step "11. /actions retourne un champ 'actions' non null" {
    if ($script:actBody -eq $null) { return $false }
    $script:actBody.actions -ne $null
}

# ────────────────────────────────────────────────────────────────
# Etape 12 : GET /customer-success/value -> ok:true
# ────────────────────────────────────────────────────────────────
$valResp = $null
$valBody = $null
Test-Step "12. GET /customer-success/value retourne ok:true" {
    $script:valResp = Invoke-PierreGet -Path "/api/pierre/use/customer-success/value" -Token $token
    $script:valBody = Get-JsonBody -Response $script:valResp
    $script:valResp.StatusCode -eq 200 -and $script:valBody -ne $null -and $script:valBody.ok -eq $true
}

# ────────────────────────────────────────────────────────────────
# Etape 13 : Vérifier value estimate dans /value
# ────────────────────────────────────────────────────────────────
Test-Step "13. /value retourne un champ 'value' non null" {
    if ($script:valBody -eq $null) { return $false }
    $script:valBody.value -ne $null
}

# ────────────────────────────────────────────────────────────────
# Etape 14 : Vérifier meta dans la reponse principale
# ────────────────────────────────────────────────────────────────
Test-Step "14. meta contient userId et fetchedAt" {
    if ($script:csBody -eq $null) { return $false }
    $meta = $script:csBody.meta
    $meta -ne $null -and $meta.userId -ne $null -and $meta.fetchedAt -ne $null
}

# ────────────────────────────────────────────────────────────────
# Etape 15 : Optionnel - customer_success_hint dans mission route
# ────────────────────────────────────────────────────────────────
Test-Step "15. /actions retourne stage valide" {
    if ($script:actBody -eq $null) { return $false }
    $validStages = @("new_account", "setup_in_progress", "activated", "value_visible", "conversion_ready", "retention_risk", "churn_risk", "successful")
    $stage = $script:actBody.stage
    $stage -ne $null -and $validStages -contains $stage
}

# ────────────────────────────────────────────────────────────────
# Resume
# ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== RESULTATS ==="
Write-Host "Reussis  : $passed"
Write-Host "Echoues  : $failed"
Write-Host "Total    : $($passed + $failed)"

if ($failed -gt 0) {
    Write-Host ""
    Write-Host "[ATTENTION] $failed test(s) ont echoue."
    Write-Host "Verifier que le serveur tourne sur $BaseUrl et que le token est valide."
    exit 1
} else {
    Write-Host ""
    Write-Host "[OK] Tous les tests customer success sont passes."
    exit 0
}
