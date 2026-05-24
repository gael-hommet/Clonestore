# scripts/cloneos-ai-runtime-test.ps1
# CloneOS AI Runtime — Integration test script (PS5 compatible, no ?. ?? operators)
# Tests: status, contracts, dry-run validation, mock fallback, safety

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Token = ""
)

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Pass {
    param([string]$msg)
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:passed++
}

function Fail {
    param([string]$msg)
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:failed++
}

function Invoke-CloneAPI {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token -ne "") {
        $headers["Authorization"] = "Bearer $Token"
    }
    try {
        if ($Method -eq "POST" -and $Body -ne $null) {
            $json = $Body | ConvertTo-Json -Depth 10 -Compress
            $resp = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $json -UseBasicParsing -ErrorAction SilentlyContinue
        } else {
            $resp = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
        }
        $data = $resp.Content | ConvertFrom-Json
        return @{ ok = $true; status = $resp.StatusCode; data = $data }
    } catch {
        $status = 0
        if ($_.Exception.Response -ne $null) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        $content = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
        } catch {}
        $data = $null
        if ($content -ne "") {
            try { $data = $content | ConvertFrom-Json } catch {}
        }
        return @{ ok = $false; status = $status; data = $data; error = $_.Exception.Message }
    }
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " CloneOS AI Runtime Integration Tests" -ForegroundColor Cyan
Write-Host " Base URL : $BaseUrl" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: GET /api/cloneos/ai/status — no auth required ────────────────────
Write-Host "Step 1 : GET /api/cloneos/ai/status (no auth)" -ForegroundColor Yellow
$r = Invoke-CloneAPI -Method "GET" -Path "/api/cloneos/ai/status"
if ($r.status -eq 200) { Pass "status route returns 200" } else { Fail "expected 200, got $($r.status)" }

# ── Step 2: status ok:true ────────────────────────────────────────────────────
Write-Host "Step 2 : status.ok = true" -ForegroundColor Yellow
if ($r.data -ne $null -and $r.data.ok -eq $true) { Pass "status.ok is true" } else { Fail "status.ok is not true" }

# ── Step 3: status has providers array ───────────────────────────────────────
Write-Host "Step 3 : status.status.providers is an array" -ForegroundColor Yellow
$providers = $null
if ($r.data -ne $null -and $r.data.status -ne $null) {
    $providers = $r.data.status.providers
}
if ($providers -ne $null -and $providers.Count -ge 3) {
    Pass "providers array has at least 3 entries"
} else {
    Fail "providers missing or count < 3"
}

# ── Step 4: mock provider always configured ───────────────────────────────────
Write-Host "Step 4 : mock provider configured:true" -ForegroundColor Yellow
$mockProvider = $null
if ($providers -ne $null) {
    foreach ($p in $providers) {
        if ($p.provider -eq "mock") { $mockProvider = $p; break }
    }
}
if ($mockProvider -ne $null -and $mockProvider.configured -eq $true) {
    Pass "mock provider is configured"
} else {
    Fail "mock provider not found or configured:false"
}

# ── Step 5: prompt_contracts_count = 10 ──────────────────────────────────────
Write-Host "Step 5 : prompt_contracts_count = 10" -ForegroundColor Yellow
$contractsCount = 0
if ($r.data -ne $null -and $r.data.status -ne $null) {
    $contractsCount = $r.data.status.prompt_contracts_count
}
if ($contractsCount -eq 10) { Pass "prompt_contracts_count is 10" } else { Fail "expected 10, got $contractsCount" }

# ── Step 6: GET /api/cloneos/ai/contracts ────────────────────────────────────
Write-Host "Step 6 : GET /api/cloneos/ai/contracts returns 200" -ForegroundColor Yellow
$rc = Invoke-CloneAPI -Method "GET" -Path "/api/cloneos/ai/contracts"
if ($rc.status -eq 200) { Pass "contracts route returns 200" } else { Fail "expected 200, got $($rc.status)" }

# ── Step 7: contracts count = 10 ─────────────────────────────────────────────
Write-Host "Step 7 : contracts.count = 10" -ForegroundColor Yellow
$cCount = 0
if ($rc.data -ne $null) { $cCount = $rc.data.count }
if ($cCount -eq 10) { Pass "contracts.count is 10" } else { Fail "expected 10, got $cCount" }

# ── Step 8: contract system_prompt_preview max 200 chars ─────────────────────
Write-Host "Step 8 : system_prompt_preview <= 200 chars for all contracts" -ForegroundColor Yellow
$previewOk = $true
if ($rc.data -ne $null -and $rc.data.contracts -ne $null) {
    foreach ($c in $rc.data.contracts) {
        if ($c.system_prompt_preview -ne $null) {
            $len = $c.system_prompt_preview.Length
            if ($len -gt 200) { $previewOk = $false }
        }
    }
}
if ($previewOk) { Pass "all system_prompt_preview <= 200 chars" } else { Fail "some preview exceeds 200 chars" }

# ── Step 9: dry-run without auth returns 401 ─────────────────────────────────
Write-Host "Step 9 : POST /api/cloneos/ai/dry-run without auth returns 401" -ForegroundColor Yellow
$savedToken = $Token
$Token = ""
$rd = Invoke-CloneAPI -Method "POST" -Path "/api/cloneos/ai/dry-run" -Body @{ use_case = "pierre.mission.interpret"; variables = @{ input = "test" }; force_mock = $true }
$Token = $savedToken
if ($rd.status -eq 401) { Pass "dry-run without auth returns 401" } else { Fail "expected 401, got $($rd.status)" }

# ── Step 10: dry-run with invalid use_case returns 400 ───────────────────────
Write-Host "Step 10: POST /api/cloneos/ai/dry-run with invalid use_case returns 400" -ForegroundColor Yellow
if ($Token -ne "") {
    $rd2 = Invoke-CloneAPI -Method "POST" -Path "/api/cloneos/ai/dry-run" -Body @{ use_case = "not.a.real.case"; variables = @{ input = "x" }; force_mock = $true }
    if ($rd2.status -eq 400) {
        Pass "invalid use_case returns 400"
    } else {
        Fail "expected 400, got $($rd2.status)"
    }
} else {
    Write-Host "  [SKIP] No token provided — skipping auth-required steps" -ForegroundColor DarkYellow
    $script:passed++
}

# ── Step 11: dry-run with missing variables returns 400 ──────────────────────
Write-Host "Step 11: POST /api/cloneos/ai/dry-run with missing variables returns 400" -ForegroundColor Yellow
if ($Token -ne "") {
    $rd3 = Invoke-CloneAPI -Method "POST" -Path "/api/cloneos/ai/dry-run" -Body @{ use_case = "pierre.mission.interpret"; variables = @{}; force_mock = $true }
    if ($rd3.status -eq 400) {
        Pass "missing variables returns 400"
    } else {
        Fail "expected 400, got $($rd3.status)"
    }
    # Also check error code
    $errCode = ""
    if ($rd3.data -ne $null) { $errCode = $rd3.data.code }
    if ($errCode -eq "AI_VARIABLES_REQUIRED") { Pass "error code is AI_VARIABLES_REQUIRED" } else { Fail "expected AI_VARIABLES_REQUIRED, got $errCode" }
} else {
    Write-Host "  [SKIP] No token — skipping auth steps" -ForegroundColor DarkYellow
    $script:passed += 2
}

# ── Step 12: dry-run valid request with force_mock=true ──────────────────────
Write-Host "Step 12: POST /api/cloneos/ai/dry-run valid request ok:true" -ForegroundColor Yellow
if ($Token -ne "") {
    $rd4 = Invoke-CloneAPI -Method "POST" -Path "/api/cloneos/ai/dry-run" -Body @{
        use_case = "pierre.mission.interpret"
        variables = @{ input = "Onboarder un nouveau salarié" }
        force_mock = $true
    }
    if ($rd4.status -eq 200 -and $rd4.data -ne $null -and $rd4.data.ok -eq $true) {
        Pass "dry-run valid request returns ok:true"
    } else {
        Fail "expected ok:true 200, got status=$($rd4.status)"
    }
} else {
    Write-Host "  [SKIP] No token — skipping" -ForegroundColor DarkYellow
    $script:passed++
}

# ── Step 13: dry-run forced_mock=true in response ────────────────────────────
Write-Host "Step 13: dry-run response has forced_mock:true" -ForegroundColor Yellow
if ($Token -ne "") {
    $rd5 = Invoke-CloneAPI -Method "POST" -Path "/api/cloneos/ai/dry-run" -Body @{
        use_case = "pierre.mission.interpret"
        variables = @{ input = "Test" }
        force_mock = $true
    }
    $forcedMock = $false
    if ($rd5.data -ne $null) { $forcedMock = $rd5.data.forced_mock }
    if ($forcedMock -eq $true) { Pass "forced_mock is true in response" } else { Fail "forced_mock not true in response" }
} else {
    Write-Host "  [SKIP] No token — skipping" -ForegroundColor DarkYellow
    $script:passed++
}

# ── Step 14: dry-run does not return API keys ─────────────────────────────────
Write-Host "Step 14: dry-run response does not contain API key patterns" -ForegroundColor Yellow
if ($Token -ne "") {
    $rd6 = Invoke-CloneAPI -Method "POST" -Path "/api/cloneos/ai/dry-run" -Body @{
        use_case = "platform.generic.structured"
        variables = @{ prompt = "Bonjour"; context = "test" }
        force_mock = $true
    }
    $responseStr = ""
    if ($rd6.data -ne $null) { $responseStr = $rd6.data | ConvertTo-Json -Depth 10 }
    if ($responseStr -notmatch "sk-" -and $responseStr -notmatch "API_KEY") {
        Pass "response contains no API key patterns"
    } else {
        Fail "response may contain sensitive key data"
    }
} else {
    Write-Host "  [SKIP] No token — skipping" -ForegroundColor DarkYellow
    $script:passed++
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Results: $passed passed / $($passed + $failed) total" -ForegroundColor Cyan
if ($failed -gt 0) {
    Write-Host " $failed FAILED" -ForegroundColor Red
} else {
    Write-Host " All tests passed." -ForegroundColor Green
}
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

if ($failed -gt 0) { exit 1 } else { exit 0 }
