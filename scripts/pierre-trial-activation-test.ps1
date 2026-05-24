# scripts/pierre-trial-activation-test.ps1
# Bloc 23 - Pierre Trial Activation & First-Value Engine
# Test E2E de l'API trial activation
# Compatible PowerShell 5.1 - pas de ?., pas de ??, pas de guillemets typographiques
# Usage: $env:PIERRE_TEST_TOKEN = "your-token"; .\scripts\pierre-trial-activation-test.ps1

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
Write-Host " Pierre Trial Activation - Tests E2E (B23)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Base URL : $BaseUrl"
Write-Host "Token    : $( if ($Token -ne "") { "configured" } else { "NOT SET - some tests will fail" } )"
Write-Host ""

# ── Step 1 : 401 sans token sur GET /trial/activation ────────────────────────

Test-Step -Step 1 -Name "GET /trial/activation returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET"
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Step 2 : ok:true avec token sur GET /trial/activation ───────────────────

Test-Step -Step 2 -Name "GET /trial/activation returns ok:true with valid token" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true : $($body.ok)" }
    return $true
}

# ── Step 3 : report.stage est une valeur valide ───────────────────────────────

Test-Step -Step 3 -Name "GET /trial/activation report.stage is a valid stage" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $validStages = @("not_started", "setup_needed", "ready_to_launch", "first_value_started", "value_proven", "conversion_ready", "blocked")
    if ($validStages -notcontains $body.report.stage) {
        return "Invalid stage : $($body.report.stage)"
    }
    return $true
}

# ── Step 4 : report.status est une valeur valide ──────────────────────────────

Test-Step -Step 4 -Name "GET /trial/activation report.status is valid" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $validStatuses = @("green", "yellow", "orange", "red", "black")
    if ($validStatuses -notcontains $body.report.status) {
        return "Invalid status : $($body.report.status)"
    }
    return $true
}

# ── Step 5 : report.activation_score est entre 0 et 100 ──────────────────────

Test-Step -Step 5 -Name "report.activation_score is between 0 and 100" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $score = $body.report.activation_score
    if ($score -lt 0 -or $score -gt 100) { return "activation_score out of range : $score" }
    return $true
}

# ── Step 6 : report.day_plan a exactement 8 jours ────────────────────────────

Test-Step -Step 6 -Name "report.day_plan has exactly 8 days" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $dayCount = ($body.report.day_plan | Measure-Object).Count
    if ($dayCount -ne 8) { return "Expected 8 days, got $dayCount" }
    return $true
}

# ── Step 7 : report.value_score coherent ─────────────────────────────────────

Test-Step -Step 7 -Name "report.value_score is coherent" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $vs = $body.report.value_score
    if ($vs -eq $null) { return "value_score is null" }
    if ($vs.score -lt 0 -or $vs.score -gt 100) { return "value_score.score out of range : $($vs.score)" }
    if ($vs.estimated_hours_saved_low -gt $vs.estimated_hours_saved_high) {
        return "hours_low > hours_high"
    }
    $validConf = @("low", "medium", "high")
    if ($validConf -notcontains $vs.confidence) { return "Invalid confidence : $($vs.confidence)" }
    return $true
}

# ── Step 8 : report.conversion_score coherent ────────────────────────────────

Test-Step -Step 8 -Name "report.conversion_score is coherent" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $cs = $body.report.conversion_score
    if ($cs -eq $null) { return "conversion_score is null" }
    if ($cs.score -lt 0 -or $cs.score -gt 100) { return "conversion_score.score out of range" }
    $validBands = @("low", "medium", "high", "very_high")
    if ($validBands -notcontains $cs.probability_band) { return "Invalid probability_band : $($cs.probability_band)" }
    return $true
}

# ── Step 9 : meta contient les champs attendus ────────────────────────────────

Test-Step -Step 9 -Name "GET /trial/activation meta has expected fields" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/activation" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $meta = $body.meta
    if ($meta -eq $null) { return "meta is null" }
    if ($meta.userId -eq $null) { return "meta.userId is missing" }
    if ($meta.fetchedAt -eq $null) { return "meta.fetchedAt is missing" }
    if ($null -eq $meta.release_available) { return "meta.release_available is missing" }
    if ($null -eq $meta.readiness_available) { return "meta.readiness_available is missing" }
    return $true
}

# ── Step 10 : GET /trial/plan returns 401 sans token ─────────────────────────

Test-Step -Step 10 -Name "GET /trial/plan returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/plan" -Method "GET"
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Step 11 : GET /trial/plan ok:true avec token ──────────────────────────────

Test-Step -Step 11 -Name "GET /trial/plan returns ok:true with valid token" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/plan" -Method "GET" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    return $true
}

# ── Step 12 : /trial/plan day_plan a 8 jours ─────────────────────────────────

Test-Step -Step 12 -Name "GET /trial/plan day_plan has 8 days" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/plan" -Method "GET" -AuthToken $Token
    $body = $resp.Content | ConvertFrom-Json
    $dayCount = ($body.day_plan | Measure-Object).Count
    if ($dayCount -ne 8) { return "Expected 8 days, got $dayCount" }
    return $true
}

# ── Step 13 : GET /trial/templates returns 401 sans token ───────────────────

Test-Step -Step 13 -Name "GET /trial/templates returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/templates" -Method "GET"
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Step 14 : GET /trial/templates returns 10 templates ─────────────────────

Test-Step -Step 14 -Name "GET /trial/templates returns 10 templates" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/templates" -Method "GET" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    $count = ($body.templates | Measure-Object).Count
    if ($count -ne 10) { return "Expected 10 templates, got $count" }
    return $true
}

# ── Step 15 : POST /trial/first-value-prompt returns 401 sans token ──────────

Test-Step -Step 15 -Name "POST /trial/first-value-prompt returns 401 without token" -Check {
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/first-value-prompt" -Method "POST" -Body '{"template_key":"audit_rh_initial"}'
    if ($resp.StatusCode -eq 401) { return $true }
    return "Expected 401, got $($resp.StatusCode)"
}

# ── Step 16 : POST /trial/first-value-prompt with valid key ──────────────────

Test-Step -Step 16 -Name "POST /trial/first-value-prompt with audit_rh_initial" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $bodyJson = '{"template_key":"audit_rh_initial","company_name":"TestCo"}'
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/first-value-prompt" -Method "POST" -Body $bodyJson -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    if ($body.template_key -ne "audit_rh_initial") { return "Wrong template_key : $($body.template_key)" }
    if ($body.prompt.Length -lt 20) { return "prompt too short : $($body.prompt.Length)" }
    return $true
}

# ── Step 17 : POST /trial/first-value-prompt with invalid key returns 400 ────

Test-Step -Step 17 -Name "POST /trial/first-value-prompt with invalid key returns 400" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $bodyJson = '{"template_key":"invalid_template_xyz"}'
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/first-value-prompt" -Method "POST" -Body $bodyJson -AuthToken $Token
    if ($resp.StatusCode -ne 400) { return "Expected 400, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.code -ne "INVALID_TRIAL_TEMPLATE_KEY") { return "Expected INVALID_TRIAL_TEMPLATE_KEY, got $($body.code)" }
    return $true
}

# ── Step 18 : sensitive_case_review prompt contient IMPORTANT ────────────────

Test-Step -Step 18 -Name "POST /trial/first-value-prompt sensitive_case_review has IMPORTANT warning" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $bodyJson = '{"template_key":"sensitive_case_review"}'
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/first-value-prompt" -Method "POST" -Body $bodyJson -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.prompt -notmatch "IMPORTANT") { return "IMPORTANT warning missing from sensitive prompt" }
    if ($body.requires_human_validation -ne $true) { return "requires_human_validation should be true" }
    return $true
}

# ── Step 19 : GET /trial/first-value-prompt returns valid_template_keys ──────

Test-Step -Step 19 -Name "GET /trial/first-value-prompt returns valid_template_keys" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
    $resp = Invoke-PierreApi -Url "$BaseUrl/trial/first-value-prompt" -Method "GET" -AuthToken $Token
    if ($resp.StatusCode -ne 200) { return "Expected 200, got $($resp.StatusCode)" }
    $body = $resp.Content | ConvertFrom-Json
    if ($body.ok -ne $true) { return "ok is not true" }
    $keyCount = ($body.valid_template_keys | Measure-Object).Count
    if ($keyCount -ne 10) { return "Expected 10 valid_template_keys, got $keyCount" }
    return $true
}

# ── Step 20 : mission route contient trial_activation_hint ───────────────────

Test-Step -Step 20 -Name "GET /mission/:id contains trial_activation_hint" -Check {
    if ($Token -eq "") { return "Token not set - skipping" }
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
    if ($missionBody.trial_activation_hint -eq $null) { return "trial_activation_hint is missing from mission response" }
    $hint = $missionBody.trial_activation_hint
    $validStages = @("not_started", "setup_needed", "ready_to_launch", "first_value_started", "value_proven", "conversion_ready", "blocked")
    if ($validStages -notcontains $hint.stage) { return "trial_activation_hint.stage invalid : $($hint.stage)" }
    $validStatuses = @("green", "yellow", "orange", "red", "black")
    if ($validStatuses -notcontains $hint.status) { return "trial_activation_hint.status invalid : $($hint.status)" }
    return $true
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
    Write-Host "  Bloc 23 - Tous les tests ont passe !" -ForegroundColor Green
} else {
    Write-Host "  $Failed test(s) en echec." -ForegroundColor Red
}

exit $Failed
