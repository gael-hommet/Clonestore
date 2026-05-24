# CloneStore Runtime Context — Integration Test Script (Bloc 19)
# PowerShell 5.1 compatible: no ?., no ??, no typographic quotes
# Usage: $env:PIERRE_TEST_TOKEN = "<your_jwt>"; .\scripts\clonestore-runtime-test.ps1

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Token = $env:PIERRE_TEST_TOKEN
)

# ── Setup ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0
$total = 0

function Assert-Pass {
    param([string]$Label)
    $script:pass++
    $script:total++
    Write-Host "[PASS] $Label" -ForegroundColor Green
}

function Assert-Fail {
    param([string]$Label, [string]$Reason)
    $script:fail++
    $script:total++
    Write-Host "[FAIL] $Label -- $Reason" -ForegroundColor Red
}

function Invoke-API {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null
    )
    $url = "$BaseUrl$Path"
    $headers = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Depth 10
            $resp = Invoke-WebRequest -Uri $url -Method $Method -Headers $headers -Body $json -UseBasicParsing -ErrorAction Stop
        } else {
            $resp = Invoke-WebRequest -Uri $url -Method $Method -Headers $headers -UseBasicParsing -ErrorAction Stop
        }
        return @{ ok = $true; status = $resp.StatusCode; data = ($resp.Content | ConvertFrom-Json) }
    } catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        $errBody = $null
        try {
            $errStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errStream)
            $errBody = $reader.ReadToEnd() | ConvertFrom-Json
        } catch {}
        return @{ ok = $false; status = $status; data = $errBody; error = $_.Exception.Message }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CloneStore Runtime — Bloc 19 Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " BaseUrl : $BaseUrl"
Write-Host " Token   : $(if ($Token) { $Token.Substring(0, [Math]::Min(12, $Token.Length)) + '...' } else { '(none)' })"
Write-Host ""

if (-not $Token) {
    Write-Host "[WARN] No token set. Auth-required tests will fail as expected." -ForegroundColor Yellow
}

# ── Step 1: GET /api/clonestore/runtime — unauthenticated ────────────────────

Write-Host "-- Step 1: GET /api/clonestore/runtime (no auth)" -ForegroundColor DarkGray
$r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
if ($r.status -eq 401) {
    Assert-Pass "Step 1 - Unauthenticated GET returns 401"
} else {
    Assert-Fail "Step 1 - Unauthenticated GET returns 401" "Got status $($r.status)"
}

# ── Step 2: POST /api/clonestore/runtime — unauthenticated ───────────────────

Write-Host "-- Step 2: POST /api/clonestore/runtime (no auth)" -ForegroundColor DarkGray
$r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create" }
if ($r.status -eq 401) {
    Assert-Pass "Step 2 - Unauthenticated POST returns 401"
} else {
    Assert-Fail "Step 2 - Unauthenticated POST returns 401" "Got status $($r.status)"
}

# ── Step 3: GET /api/clonestore/runtime — authenticated ──────────────────────

Write-Host "-- Step 3: GET /api/clonestore/runtime (authenticated)" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    if ($r.status -eq 200 -and $r.data.ok -eq $true) {
        Assert-Pass "Step 3 - Authenticated GET returns 200 + ok=true"
    } else {
        Assert-Fail "Step 3 - Authenticated GET returns 200 + ok=true" "Got status $($r.status)"
    }
} else {
    Assert-Fail "Step 3 - Authenticated GET (skipped — no token)" "No token"
}

# ── Step 4: GET response has snapshot field ───────────────────────────────────

Write-Host "-- Step 4: GET response.snapshot exists" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    if ($r.data.snapshot) {
        Assert-Pass "Step 4 - snapshot field present"
    } else {
        Assert-Fail "Step 4 - snapshot field present" "snapshot is null or missing"
    }
} else {
    Assert-Fail "Step 4 - snapshot field (skipped — no token)" "No token"
}

# ── Step 5: Snapshot has required sub-fields ──────────────────────────────────

Write-Host "-- Step 5: snapshot.context and snapshot.governance exist" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    $snap = $r.data.snapshot
    if ($snap -and $snap.context -and $snap.governance) {
        Assert-Pass "Step 5 - snapshot.context + snapshot.governance present"
    } else {
        Assert-Fail "Step 5 - snapshot.context + snapshot.governance present" "One or both missing"
    }
} else {
    Assert-Fail "Step 5 - snapshot sub-fields (skipped — no token)" "No token"
}

# ── Step 6: GET with employee_slug=pierre ────────────────────────────────────

Write-Host "-- Step 6: GET with employee_slug=pierre" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime?employee_slug=pierre"
    if ($r.status -eq 200 -and $r.data.snapshot.employee_slug -eq "pierre") {
        Assert-Pass "Step 6 - employee_slug=pierre reflected in snapshot"
    } else {
        Assert-Fail "Step 6 - employee_slug=pierre reflected in snapshot" "Mismatch or error"
    }
} else {
    Assert-Fail "Step 6 - employee_slug GET (skipped — no token)" "No token"
}

# ── Step 7: GET meta.storage_source is set ───────────────────────────────────

Write-Host "-- Step 7: GET meta.storage_source is one of known values" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    $src = $r.data.meta.storage_source
    $validSources = @("platform_table", "legacy_json", "defaults")
    if ($validSources -contains $src) {
        Assert-Pass "Step 7 - meta.storage_source is valid: $src"
    } else {
        Assert-Fail "Step 7 - meta.storage_source is valid" "Got: $src"
    }
} else {
    Assert-Fail "Step 7 - meta.storage_source (skipped — no token)" "No token"
}

# ── Step 8: POST with action_type=email.send → blocked_by_policy ─────────────

Write-Host "-- Step 8: POST email.send => blocked_by_policy" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "email.send"; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "blocked_by_policy") {
        Assert-Pass "Step 8 - email.send => blocked_by_policy"
    } else {
        Assert-Fail "Step 8 - email.send => blocked_by_policy" "Got: $decision"
    }
} else {
    Assert-Fail "Step 8 - POST email.send (skipped — no token)" "No token"
}

# ── Step 9: POST with action_type=send_email → blocked_by_policy ─────────────

Write-Host "-- Step 9: POST send_email => blocked_by_policy" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "send_email"; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "blocked_by_policy") {
        Assert-Pass "Step 9 - send_email => blocked_by_policy"
    } else {
        Assert-Fail "Step 9 - send_email => blocked_by_policy" "Got: $decision"
    }
} else {
    Assert-Fail "Step 9 - POST send_email (skipped — no token)" "No token"
}

# ── Step 10: POST with risk_level=black → blocked_by_policy ──────────────────

Write-Host "-- Step 10: POST risk_level=black => blocked_by_policy" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; risk_level = "black"; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "blocked_by_policy") {
        Assert-Pass "Step 10 - risk_level=black => blocked_by_policy"
    } else {
        Assert-Fail "Step 10 - risk_level=black => blocked_by_policy" "Got: $decision"
    }
} else {
    Assert-Fail "Step 10 - POST risk_level=black (skipped — no token)" "No token"
}

# ── Step 11: POST with approval_required=true → requires_validation ──────────

Write-Host "-- Step 11: POST approval_required=true => requires_validation" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; approval_required = $true; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "requires_validation") {
        Assert-Pass "Step 11 - approval_required=true => requires_validation"
    } else {
        Assert-Fail "Step 11 - approval_required=true => requires_validation" "Got: $decision"
    }
} else {
    Assert-Fail "Step 11 - POST approval_required (skipped — no token)" "No token"
}

# ── Step 12: POST with risk_level=red → requires_validation ──────────────────

Write-Host "-- Step 12: POST risk_level=red => requires_validation" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; risk_level = "red"; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "requires_validation") {
        Assert-Pass "Step 12 - risk_level=red => requires_validation"
    } else {
        Assert-Fail "Step 12 - risk_level=red => requires_validation" "Got: $decision"
    }
} else {
    Assert-Fail "Step 12 - POST risk_level=red (skipped — no token)" "No token"
}

# ── Step 13: POST with contains_sensitive_keywords=true → requires_review ────

Write-Host "-- Step 13: POST contains_sensitive_keywords=true => requires_review" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; contains_sensitive_keywords = $true; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "requires_review") {
        Assert-Pass "Step 13 - contains_sensitive_keywords=true => requires_review"
    } else {
        Assert-Fail "Step 13 - contains_sensitive_keywords=true => requires_review" "Got: $decision"
    }
} else {
    Assert-Fail "Step 13 - POST contains_sensitive_keywords (skipped — no token)" "No token"
}

# ── Step 14: POST document.generate → requires_review ────────────────────────

Write-Host "-- Step 14: POST document.generate => requires_review" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "document.generate"; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "requires_review") {
        Assert-Pass "Step 14 - document.generate => requires_review"
    } else {
        Assert-Fail "Step 14 - document.generate => requires_review" "Got: $decision"
    }
} else {
    Assert-Fail "Step 14 - POST document.generate (skipped — no token)" "No token"
}

# ── Step 15: POST evaluation.can_auto_execute is boolean ─────────────────────

Write-Host "-- Step 15: POST evaluation.can_auto_execute is present and boolean" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; employee_slug = "pierre" }
    $val = $r.data.evaluation.can_auto_execute
    if ($val -is [bool] -or $val -eq $true -or $val -eq $false) {
        Assert-Pass "Step 15 - can_auto_execute is boolean"
    } else {
        Assert-Fail "Step 15 - can_auto_execute is boolean" "Got: $val (type: $($val.GetType().Name))"
    }
} else {
    Assert-Fail "Step 15 - POST can_auto_execute (skipped — no token)" "No token"
}

# ── Step 16: POST evaluation.explanation is non-empty string ─────────────────

Write-Host "-- Step 16: POST evaluation.explanation is non-empty string" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; employee_slug = "pierre" }
    $exp = $r.data.evaluation.explanation
    if ($exp -and $exp.Length -gt 0) {
        Assert-Pass "Step 16 - explanation is non-empty"
    } else {
        Assert-Fail "Step 16 - explanation is non-empty" "Got: '$exp'"
    }
} else {
    Assert-Fail "Step 16 - POST explanation (skipped — no token)" "No token"
}

# ── Step 17: POST missing action_type → empty action → blocked_by_policy ─────

Write-Host "-- Step 17: POST empty action_type => blocked_by_policy" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = ""; employee_slug = "pierre" }
    $decision = $r.data.evaluation.decision
    if ($decision -eq "blocked_by_policy") {
        Assert-Pass "Step 17 - empty action_type => blocked_by_policy"
    } else {
        Assert-Fail "Step 17 - empty action_type => blocked_by_policy" "Got: $decision"
    }
} else {
    Assert-Fail "Step 17 - POST empty action_type (skipped — no token)" "No token"
}

# ── Step 18: GET /api/pierre/use/mission-control has clone_runtime_summary ───

Write-Host "-- Step 18: GET /api/pierre/use/mission-control has clone_runtime_summary" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/pierre/use/mission-control"
    if ($r.status -eq 200 -and $r.data.clone_runtime_summary) {
        Assert-Pass "Step 18 - mission-control returns clone_runtime_summary"
    } else {
        Assert-Fail "Step 18 - mission-control returns clone_runtime_summary" "status=$($r.status), field=$(if ($r.data.clone_runtime_summary) { 'present' } else { 'missing' })"
    }
} else {
    Assert-Fail "Step 18 - mission-control clone_runtime_summary (skipped — no token)" "No token"
}

# ── Step 19: clone_runtime_summary.unavailable is boolean ────────────────────

Write-Host "-- Step 19: clone_runtime_summary.unavailable is boolean" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/pierre/use/mission-control"
    $crs = $r.data.clone_runtime_summary
    if ($crs -and ($crs.unavailable -is [bool] -or $crs.unavailable -eq $true -or $crs.unavailable -eq $false)) {
        Assert-Pass "Step 19 - clone_runtime_summary.unavailable is boolean"
    } else {
        Assert-Fail "Step 19 - clone_runtime_summary.unavailable is boolean" "Got: $($crs.unavailable)"
    }
} else {
    Assert-Fail "Step 19 - clone_runtime_summary.unavailable (skipped — no token)" "No token"
}

# ── Step 20: GET /api/pierre/use/dashboard has clone_runtime_summary ─────────

Write-Host "-- Step 20: GET /api/pierre/use/dashboard has clone_runtime_summary" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/pierre/use/dashboard"
    if ($r.status -eq 200 -and $r.data.clone_runtime_summary) {
        Assert-Pass "Step 20 - dashboard returns clone_runtime_summary"
    } else {
        Assert-Fail "Step 20 - dashboard returns clone_runtime_summary" "status=$($r.status), field=$(if ($r.data.clone_runtime_summary) { 'present' } else { 'missing' })"
    }
} else {
    Assert-Fail "Step 20 - dashboard clone_runtime_summary (skipped — no token)" "No token"
}

# ── Step 21: POST context_summary has required fields ─────────────────────────

Write-Host "-- Step 21: POST context_summary has employee_slug, autonomy_level, guard_mode" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; employee_slug = "pierre" }
    $cs = $r.data.context_summary
    if ($cs -and $cs.employee_slug -and $cs.autonomy_level -and $cs.guard_mode) {
        Assert-Pass "Step 21 - context_summary has required fields"
    } else {
        Assert-Fail "Step 21 - context_summary has required fields" "Missing fields in context_summary"
    }
} else {
    Assert-Fail "Step 21 - POST context_summary (skipped — no token)" "No token"
}

# ── Step 22: POST with invalid JSON body → 400 ───────────────────────────────

Write-Host "-- Step 22: POST with non-JSON body => 400" -ForegroundColor DarkGray
if ($Token) {
    $url = "$BaseUrl/api/clonestore/runtime"
    $headers = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }
    try {
        $resp = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body "not-json" -UseBasicParsing -ErrorAction Stop
        Assert-Fail "Step 22 - Invalid JSON => 400" "Got status $($resp.StatusCode) instead of 400"
    } catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 400) {
            Assert-Pass "Step 22 - Invalid JSON => 400"
        } else {
            Assert-Fail "Step 22 - Invalid JSON => 400" "Got status $status"
        }
    }
} else {
    Assert-Fail "Step 22 - POST invalid JSON (skipped — no token)" "No token"
}

# ── Step 23: GET snapshot.capabilities is array ───────────────────────────────

Write-Host "-- Step 23: GET snapshot.capabilities is array" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    $caps = $r.data.snapshot.capabilities
    if ($caps -is [array] -or $caps -is [System.Collections.IEnumerable]) {
        Assert-Pass "Step 23 - snapshot.capabilities is array"
    } else {
        Assert-Fail "Step 23 - snapshot.capabilities is array" "Got type: $($caps.GetType().Name)"
    }
} else {
    Assert-Fail "Step 23 - snapshot.capabilities (skipped — no token)" "No token"
}

# ── Step 24: GET snapshot.governance.governance_health is valid ───────────────

Write-Host "-- Step 24: GET snapshot.governance.governance_health is valid" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    $health = $r.data.snapshot.governance.governance_health
    $validHealth = @("healthy", "degraded", "locked")
    if ($validHealth -contains $health) {
        Assert-Pass "Step 24 - governance_health is valid: $health"
    } else {
        Assert-Fail "Step 24 - governance_health is valid" "Got: $health"
    }
} else {
    Assert-Fail "Step 24 - governance_health (skipped — no token)" "No token"
}

# ── Step 25: POST meta.method is POST ────────────────────────────────────────

Write-Host "-- Step 25: POST meta.method = 'POST'" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "task.create"; employee_slug = "pierre" }
    if ($r.data.meta.method -eq "POST") {
        Assert-Pass "Step 25 - meta.method is POST"
    } else {
        Assert-Fail "Step 25 - meta.method is POST" "Got: $($r.data.meta.method)"
    }
} else {
    Assert-Fail "Step 25 - POST meta.method (skipped — no token)" "No token"
}

# ── Step 26: GET snapshot.summary is non-empty string ────────────────────────

Write-Host "-- Step 26: GET snapshot.summary is non-empty string" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method GET -Path "/api/clonestore/runtime"
    $summary = $r.data.snapshot.summary
    if ($summary -and $summary.Length -gt 0) {
        Assert-Pass "Step 26 - snapshot.summary is non-empty"
    } else {
        Assert-Fail "Step 26 - snapshot.summary is non-empty" "Got: '$summary'"
    }
} else {
    Assert-Fail "Step 26 - snapshot.summary (skipped — no token)" "No token"
}

# ── Step 27: POST evaluation.action_type matches input ───────────────────────

Write-Host "-- Step 27: POST evaluation.action_type matches input" -ForegroundColor DarkGray
if ($Token) {
    $r = Invoke-API -Method POST -Path "/api/clonestore/runtime" -Body @{ action_type = "calendar.create"; employee_slug = "pierre" }
    if ($r.data.evaluation.action_type -eq "calendar.create") {
        Assert-Pass "Step 27 - evaluation.action_type echoes input"
    } else {
        Assert-Fail "Step 27 - evaluation.action_type echoes input" "Got: $($r.data.evaluation.action_type)"
    }
} else {
    Assert-Fail "Step 27 - POST action_type echo (skipped — no token)" "No token"
}

# ── Final Report ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Results: $pass passed / $fail failed / $total total" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    exit 1
} else {
    exit 0
}
