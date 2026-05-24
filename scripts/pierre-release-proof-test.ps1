# scripts/pierre-release-proof-test.ps1
# Bloc 22 - Pierre Release Hardening & End-to-End Sellable Proof
# Test E2E de l'API release-proof
# Compatible PowerShell 5.1 - pas de ?., pas de ??, pas de guillemets typographiques
# Usage: $env:PIERRE_TEST_TOKEN = "your-token"; .\scripts\pierre-release-proof-test.ps1

param(
    [string]$BaseUrl = "http://localhost:3000/api/pierre/use",
    [string]$Token = ""
)

if ($Token -eq "") {
    $Token = $env:PIERRE_TEST_TOKEN
}

$Passed = 0
$Failed = 0
$Errors = @()

function Test-Step {
    param(
        [int]$Step,
        [string]$Name,
        [scriptblock]$Check
    )
    Write-Host ""
    Write-Host "Step $Step : $Name" -ForegroundColor Cyan
    try {
        $result = & $Check
        if ($result -eq $true) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:Passed++
        } else {
            Write-Host "  FAIL : $result" -ForegroundColor Red
            $script:Failed++
            $script:Errors += "Step $Step ($Name): $result"
        }
    } catch {
        Write-Host "  ERROR : $_" -ForegroundColor Red
        $script:Failed++
        $script:Errors += "Step $Step ($Name): exception - $_"
    }
}

function Invoke-PierreApi {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = "",
        [string]$AuthToken = ""
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($AuthToken -ne "") {
        $headers["Authorization"] = "Bearer $AuthToken"
    }
    if ($Method -eq "POST" -and $Body -ne "") {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -Body $Body -UseBasicParsing -ErrorAction SilentlyContinue
    } else {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
    }
    return $response
}

Write-Host "========================================" -ForegroundColor Magenta
Write-Host " Pierre Release Proof - Tests E2E (B22)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Base URL : $BaseUrl"
Write-Host "Token    : $( if ($Token -ne "") { "configured" } else { "NOT SET - some tests will fail" } )"
Write-Host ""

# ── Step 1 : 401 sans token sur GET /release-proof ───────────────────────────

Test-Step -Step 1 -Name "GET /release-proof returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET"
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Step 2 : ok:true avec token sur GET /release-proof ──────────────────────

Test-Step -Step 2 -Name "GET /release-proof returns ok:true with valid token" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true : $($body.ok)" }
    return $true
}

# ── Step 3 : report present dans la reponse ──────────────────────────────────

Test-Step -Step 3 -Name "GET /release-proof response contains report object" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    if ($body.report -eq $null) { return "report is null or missing" }
    if ($body.report.gates -eq $null) { return "report.gates is missing" }
    return $true
}

# ── Step 4 : report.gates a exactement 13 gates ──────────────────────────────

Test-Step -Step 4 -Name "report.gates has exactly 13 gates" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $gateCount = ($body.report.gates | Measure-Object).Count
    if ($gateCount -ne 13) { return "Expected 13 gates, got $gateCount" }
    return $true
}

# ── Step 5 : report.demo_scenarios = 8 ───────────────────────────────────────

Test-Step -Step 5 -Name "report.demo_scenarios has 8 entries" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $count = ($body.report.demo_scenarios | Measure-Object).Count
    if ($count -ne 8) { return "Expected 8 demo_scenarios, got $count" }
    return $true
}

# ── Step 6 : global_score entre 0 et 100 ─────────────────────────────────────

Test-Step -Step 6 -Name "report.global_score is between 0 and 100" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $score = $body.report.global_score
    if ($score -lt 0 -or $score -gt 100) { return "global_score out of range : $score" }
    return $true
}

# ── Step 7 : level est une valeur valide ──────────────────────────────────────

Test-Step -Step 7 -Name "report.level is a valid PierreReleaseLevel" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $validLevels = @("blocked", "internal_demo", "client_demo", "pilot_ready", "sellable")
    if ($validLevels -notcontains $body.report.level) {
        return "Invalid level : $($body.report.level)"
    }
    return $true
}

# ── Step 8 : GET /release-proof/demo-scenarios retourne 8 scenarios ──────────

Test-Step -Step 8 -Name "GET /release-proof/demo-scenarios returns 8 scenarios" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios" -Method "GET" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    $count = ($body.scenarios | Measure-Object).Count
    if ($count -ne 8) { return "Expected 8 scenarios, got $count" }
    return $true
}

# ── Step 9 : demo-scenarios summary est correct ───────────────────────────────

Test-Step -Step 9 -Name "GET /release-proof/demo-scenarios has valid summary" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    if ($body.summary -eq $null) { return "summary is missing" }
    if ($body.summary.count -ne 8) { return "summary.count expected 8, got $($body.summary.count)" }
    if ($body.summary.critical_count -lt 1) { return "summary.critical_count should be >= 1, got $($body.summary.critical_count)" }
    return $true
}

# ── Step 10 : dry-run all scenarios ───────────────────────────────────────────

Test-Step -Step 10 -Name "POST /release-proof/demo-scenarios/dry-run (all scenarios)" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios/dry-run" -Method "POST" -Body "{}" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    $evalCount = ($body.evaluations | Measure-Object).Count
    if ($evalCount -ne 8) { return "Expected 8 evaluations, got $evalCount" }
    return $true
}

# ── Step 11 : dry-run scenario specifique ─────────────────────────────────────

Test-Step -Step 11 -Name "POST /release-proof/demo-scenarios/dry-run with scenario_key=sensitive_case_blocked" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $bodyJson = '{"scenario_key":"sensitive_case_blocked","include_prompt":true}'
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios/dry-run" -Method "POST" -Body $bodyJson -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    if ($body.scenario_key -ne "sensitive_case_blocked") { return "Wrong scenario_key : $($body.scenario_key)" }
    $evalCount = ($body.evaluations | Measure-Object).Count
    if ($evalCount -ne 1) { return "Expected 1 evaluation, got $evalCount" }
    if ($body.prompts -eq $null) { return "prompts is missing when include_prompt=true" }
    return $true
}

# ── Step 12 : dry-run meta contient dry_run:true ──────────────────────────────

Test-Step -Step 12 -Name "dry-run meta contains dry_run:true" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios/dry-run" -Method "POST" -Body "{}" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    if ($body.meta -eq $null) { return "meta is missing" }
    if ($body.meta.dry_run -ne $true) { return "meta.dry_run is not true : $($body.meta.dry_run)" }
    return $true
}

# ── Step 13 : dry-run 400 avec scenario_key invalide ─────────────────────────

Test-Step -Step 13 -Name "POST /dry-run returns 400 with invalid scenario_key" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $bodyJson = '{"scenario_key":"invalid_scenario_xyz"}'
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios/dry-run" -Method "POST" -Body $bodyJson -AuthToken $Token
    if ($resp.StatusCode -ne 400) { return "Expected 400, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.code -ne "INVALID_SCENARIO_KEY") { return "Expected INVALID_SCENARIO_KEY code, got $($body.code)" }
    return $true
}

# ── Step 14 : release_proof_hint present dans la route mission ────────────────

Test-Step -Step 14 -Name "GET /mission/:id contains release_proof_hint" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    # Get list of missions first
    $listResp = Invoke-PierreApi -Url "$BaseUrl/missions" -Method "GET" -AuthToken $Token
    if ($listResp.StatusCode -ne 200) { return "Could not load missions list (status $($listResp.StatusCode)) - skipping" }
    $listBody = $listResp.Content | ConvertFrom-Json
    $missions = $listBody.missions
    if ($missions -eq $null) { $missions = $listBody.data }
    if ($missions -eq $null -or ($missions | Measure-Object).Count -eq 0) {
        return "No missions available to test - skipping"
    }
    $firstMission = $missions[0]
    $missionId = $firstMission.id
    if ($missionId -eq $null) { return "Mission has no id - skipping" }
    $missionResp = Invoke-PierreApi -Url "$BaseUrl/mission/$missionId" -Method "GET" -AuthToken $Token
    if ($missionResp.StatusCode -ne 200) { return "Expected 200, got $($missionResp.StatusCode)" }
    $missionBody = $missionResp.Content | ConvertFrom-Json
    if ($missionBody.release_proof_hint -eq $null) { return "release_proof_hint is missing from mission response" }
    $hint = $missionBody.release_proof_hint
    $validLevels = @("blocked", "internal_demo", "client_demo", "pilot_ready", "sellable")
    if ($validLevels -notcontains $hint.level) { return "release_proof_hint.level invalid : $($hint.level)" }
    return $true
}

# ── Step 15 : value_estimation est presente et coherente ─────────────────────

Test-Step -Step 15 -Name "report.value_estimation is present and coherent" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $ve = $body.report.value_estimation
    if ($ve -eq $null) { return "value_estimation is missing" }
    if ($ve.monthly_hours_saved_low -gt $ve.monthly_hours_saved_high) {
        return "hours_low > hours_high : $($ve.monthly_hours_saved_low) > $($ve.monthly_hours_saved_high)"
    }
    if ($ve.estimated_monthly_value_eur_low -gt $ve.estimated_monthly_value_eur_high) {
        return "eur_low > eur_high"
    }
    $validConf = @("low", "medium", "high")
    if ($validConf -notcontains $ve.confidence) { return "Invalid confidence : $($ve.confidence)" }
    return $true
}

# ── Step 16 : GET demo-scenarios 401 sans token ───────────────────────────────

Test-Step -Step 16 -Name "GET /release-proof/demo-scenarios returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios" -Method "GET"
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Step 17 : POST dry-run 401 sans token ─────────────────────────────────────

Test-Step -Step 17 -Name "POST /release-proof/demo-scenarios/dry-run returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/release-proof/demo-scenarios/dry-run" -Method "POST" -Body "{}"
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Bilan ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host " Bilan final" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Passed : $Passed" -ForegroundColor Green
Write-Host "  Failed : $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Green" })

if ($Errors.Count -gt 0) {
    Write-Host ""
    Write-Host "  Echecs :" -ForegroundColor Red
    foreach ($err in $Errors) {
        Write-Host "    - $err" -ForegroundColor Red
    }
}

Write-Host ""
if ($Failed -eq 0) {
    Write-Host "  Bloc 22 - Tous les tests ont passe !" -ForegroundColor Green
} else {
    Write-Host "  $Failed test(s) en echec." -ForegroundColor Red
}

exit $Failed
