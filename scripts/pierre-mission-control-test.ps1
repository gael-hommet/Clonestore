# BLOC 13 -- Pierre Mission Control
# E2E Test Script -- PowerShell 5 compatible
# Usage: .\scripts\pierre-mission-control-test.ps1 -Token "Bearer <jwt>" [-BaseUrl "http://localhost:3000"]

param(
    [string]$Token = "",
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0
$results = @()

function Step {
    param([int]$n, [string]$label)
    Write-Host ""
    Write-Host "STEP $n -- $label" -ForegroundColor Cyan
}

function Pass {
    param([string]$msg)
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:pass++
    $script:results += "PASS: $msg"
}

function Fail {
    param([string]$msg)
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:fail++
    $script:results += "FAIL: $msg"
}

function Get-Json {
    param([string]$Url, [hashtable]$Headers = @{})
    try {
        $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -ErrorAction Stop
        return $response.Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Post-Json {
    param([string]$Url, [hashtable]$Headers = @{}, [string]$Body = "{}")
    try {
        $response = Invoke-WebRequest -Uri $Url -Method POST -Headers $Headers -Body $Body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        return $response.Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

if ($Token -eq "") {
    Write-Host "Usage: .\scripts\pierre-mission-control-test.ps1 -Token 'Bearer <jwt>'" -ForegroundColor Yellow
    Write-Host "Token is required." -ForegroundColor Red
    exit 1
}

$AuthHeaders = @{ "Authorization" = $Token }

Write-Host ""
Write-Host "======================================================" -ForegroundColor White
Write-Host " BLOC 13 -- Pierre Mission Control -- E2E Test Script" -ForegroundColor White
Write-Host " BaseUrl: $BaseUrl" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor White

# ─── Step 1: GET /api/pierre/use/dashboard — auth required ───
Step 1 "GET /dashboard -- auth required (no token)"
$r1 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard"
if ($r1 -ne $null -and $r1.ok -eq $false) {
    Pass "Returns 401 without token"
} else {
    Fail "Expected 401 without token"
}

# ─── Step 2: GET /api/pierre/use/dashboard — ok=true ─────────
Step 2 "GET /dashboard -- ok=true with valid token"
$r2 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard" -Headers $AuthHeaders
if ($r2 -ne $null -and $r2.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ─── Step 3: Dashboard has required fields ────────────────────
Step 3 "GET /dashboard -- dashboard object has required fields"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    $d = $r2.dashboard
    $hasStatus = $d.status -ne $null
    $hasHeadline = $d.headline -ne $null
    $hasDigest = $d.digest -ne $null
    $hasMetrics = $d.metrics -ne $null
    $hasQueues = $d.queues -ne $null
    $hasRecommended = $d.recommended_order -ne $null
    $hasBriefing = $d.briefing -ne $null
    if ($hasStatus -and $hasHeadline -and $hasDigest -and $hasMetrics -and $hasQueues -and $hasRecommended -and $hasBriefing) {
        Pass "Dashboard has status, headline, digest, metrics, queues, recommended_order, briefing"
    } else {
        Fail "Dashboard missing required fields"
    }
} else {
    Fail "dashboard field missing from response"
}

# ─── Step 4: Dashboard status is valid ───────────────────────
Step 4 "GET /dashboard -- status is a valid value"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    $validStatuses = @("clear", "active", "attention_required", "blocked", "sensitive")
    if ($validStatuses -contains $r2.dashboard.status) {
        Pass "Status is valid: $($r2.dashboard.status)"
    } else {
        Fail "Unexpected status: $($r2.dashboard.status)"
    }
} else {
    Fail "No dashboard to check status"
}

# ─── Step 5: Dashboard has 11 queues ─────────────────────────
Step 5 "GET /dashboard -- queues has 11 entries"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    $qCount = ($r2.dashboard.queues | Measure-Object).Count
    if ($qCount -eq 11) {
        Pass "11 queues present"
    } else {
        Fail "Expected 11 queues, got $qCount"
    }
} else {
    Fail "No queues to check"
}

# ─── Step 6: Dashboard briefing has summary ──────────────────
Step 6 "GET /dashboard -- briefing has summary field"
if ($r2 -ne $null -and $r2.dashboard -ne $null -and $r2.dashboard.briefing -ne $null) {
    $b = $r2.dashboard.briefing
    if ($b.summary -ne $null -and $b.summary.Length -gt 0) {
        Pass "Briefing summary present"
    } else {
        Fail "Briefing summary missing or empty"
    }
} else {
    Fail "No briefing to check"
}

# ─── Step 7: Dashboard digest has tone ───────────────────────
Step 7 "GET /dashboard -- digest has tone"
if ($r2 -ne $null -and $r2.dashboard -ne $null -and $r2.dashboard.digest -ne $null) {
    $validTones = @("calm", "action", "waiting", "blocked", "sensitive")
    if ($validTones -contains $r2.dashboard.digest.tone) {
        Pass "Digest tone is valid: $($r2.dashboard.digest.tone)"
    } else {
        Fail "Unexpected digest tone: $($r2.dashboard.digest.tone)"
    }
} else {
    Fail "No digest to check"
}

# ─── Step 8: Meta fields present ─────────────────────────────
Step 8 "GET /dashboard -- meta fields present"
if ($r2 -ne $null -and $r2.meta -ne $null) {
    $m = $r2.meta
    if ($m.userId -ne $null -and $m.fetchedAt -ne $null) {
        Pass "Meta has userId and fetchedAt"
    } else {
        Fail "Meta missing userId or fetchedAt"
    }
} else {
    Fail "No meta in response"
}

# ─── Step 9: max_safe_actions param ──────────────────────────
Step 9 "GET /dashboard?max_safe_actions=3 -- respects limit"
$r9 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard?max_safe_actions=3" -Headers $AuthHeaders
if ($r9 -ne $null -and $r9.ok -eq $true) {
    $safeCount = ($r9.dashboard.safe_to_run | Measure-Object).Count
    if ($safeCount -le 3) {
        Pass "safe_to_run list has at most 3 items"
    } else {
        Fail "safe_to_run has $safeCount items, expected <= 3"
    }
} else {
    Fail "Request failed"
}

# ─── Step 10: mission_cards field ────────────────────────────
Step 10 "GET /dashboard -- mission_cards is array"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    $mc = $r2.dashboard.mission_cards
    if ($mc -ne $null) {
        Pass "mission_cards present"
    } else {
        Fail "mission_cards missing"
    }
} else {
    Fail "No dashboard"
}

# ─── Step 11: employee_cards field ───────────────────────────
Step 11 "GET /dashboard -- employee_cards is array"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    $ec = $r2.dashboard.employee_cards
    if ($ec -ne $null) {
        Pass "employee_cards present"
    } else {
        Fail "employee_cards missing"
    }
} else {
    Fail "No dashboard"
}

# ─── Step 12: GET /run-plan — auth required ───────────────────
Step 12 "GET /dashboard/run-plan -- auth required (no token)"
$r12 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard/run-plan"
if ($r12 -ne $null -and $r12.ok -eq $false) {
    Pass "Returns 401 without token"
} else {
    Fail "Expected 401 without token"
}

# ─── Step 13: GET /run-plan — ok=true ────────────────────────
Step 13 "GET /dashboard/run-plan -- ok=true with valid token"
$r13 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard/run-plan" -Headers $AuthHeaders
if ($r13 -ne $null -and $r13.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ─── Step 14: run-plan has required fields ────────────────────
Step 14 "GET /dashboard/run-plan -- run_plan has required fields"
if ($r13 -ne $null -and $r13.run_plan -ne $null) {
    $rp = $r13.run_plan
    $hasDryRun = ($rp.dry_run -ne $null)
    $hasSafeActions = ($rp.safe_actions -ne $null)
    $hasSafeTaskIds = ($rp.safe_task_ids -ne $null)
    $hasSummary = ($rp.summary -ne $null)
    if ($hasDryRun -and $hasSafeActions -and $hasSafeTaskIds -and $hasSummary) {
        Pass "run_plan has dry_run, safe_actions, safe_task_ids, summary"
    } else {
        Fail "run_plan missing required fields"
    }
} else {
    Fail "run_plan missing from response"
}

# ─── Step 15: run-plan dry_run=true by default ───────────────
Step 15 "GET /dashboard/run-plan -- dry_run=true by default"
if ($r13 -ne $null -and $r13.run_plan -ne $null) {
    if ($r13.run_plan.dry_run -eq $true) {
        Pass "dry_run is true by default"
    } else {
        Fail "Expected dry_run=true, got $($r13.run_plan.dry_run)"
    }
} else {
    Fail "No run_plan"
}

# ─── Step 16: run-plan max param ─────────────────────────────
Step 16 "GET /dashboard/run-plan?max=2 -- respects max param"
$r16 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard/run-plan?max=2" -Headers $AuthHeaders
if ($r16 -ne $null -and $r16.ok -eq $true) {
    $safeCount = ($r16.run_plan.safe_actions | Measure-Object).Count
    if ($safeCount -le 2) {
        Pass "safe_actions count <= 2"
    } else {
        Fail "safe_actions count $safeCount > 2"
    }
} else {
    Fail "Request failed"
}

# ─── Step 17: run-plan dry_run=false param ───────────────────
Step 17 "GET /dashboard/run-plan?dry_run=false -- dry_run=false"
$r17 = Get-Json -Url "$BaseUrl/api/pierre/use/dashboard/run-plan?dry_run=false" -Headers $AuthHeaders
if ($r17 -ne $null -and $r17.ok -eq $true) {
    if ($r17.run_plan.dry_run -eq $false) {
        Pass "dry_run=false is honored"
    } else {
        Fail "Expected dry_run=false"
    }
} else {
    Fail "Request failed"
}

# ─── Step 18: run-plan meta fields ───────────────────────────
Step 18 "GET /dashboard/run-plan -- meta has expected fields"
if ($r13 -ne $null -and $r13.meta -ne $null) {
    if ($r13.meta.tasks_loaded -ne $null -and $r13.meta.actions_evaluated -ne $null) {
        Pass "Meta has tasks_loaded and actions_evaluated"
    } else {
        Fail "Meta missing tasks_loaded or actions_evaluated"
    }
} else {
    Fail "No meta"
}

# ─── Step 19: POST /execute-safe — auth required ─────────────
Step 19 "POST /dashboard/execute-safe -- auth required (no token)"
$r19 = Post-Json -Url "$BaseUrl/api/pierre/use/dashboard/execute-safe" -Body "{}"
if ($r19 -ne $null -and $r19.ok -eq $false) {
    Pass "Returns 401 without token"
} else {
    Fail "Expected 401 without token"
}

# ─── Step 20: POST /execute-safe — ok=true ───────────────────
Step 20 "POST /dashboard/execute-safe -- ok=true with valid token"
$r20 = Post-Json -Url "$BaseUrl/api/pierre/use/dashboard/execute-safe" -Headers $AuthHeaders -Body '{"max":2}'
if ($r20 -ne $null -and $r20.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ─── Step 21: execute-safe has ran/errors/skipped ────────────
Step 21 "POST /dashboard/execute-safe -- has ran, errors, skipped fields"
if ($r20 -ne $null -and $r20.ok -eq $true) {
    $hasRan = ($r20.ran -ne $null)
    $hasErrors = ($r20.errors -ne $null)
    $hasSkipped = ($r20.skipped -ne $null)
    if ($hasRan -and $hasErrors -and $hasSkipped) {
        Pass "Has ran, errors, skipped"
    } else {
        Fail "Missing ran, errors, or skipped"
    }
} else {
    Fail "No response to check"
}

# ─── Step 22: execute-safe has summary ───────────────────────
Step 22 "POST /dashboard/execute-safe -- has summary"
if ($r20 -ne $null -and $r20.summary -ne $null -and $r20.summary.Length -gt 0) {
    Pass "Summary present"
} else {
    Fail "Summary missing or empty"
}

# ─── Step 23: execute-safe has run_plan ──────────────────────
Step 23 "POST /dashboard/execute-safe -- has run_plan"
if ($r20 -ne $null -and $r20.run_plan -ne $null) {
    Pass "run_plan present"
} else {
    Fail "run_plan missing"
}

# ─── Step 24: execute-safe meta ──────────────────────────────
Step 24 "POST /dashboard/execute-safe -- meta has ran_count, error_count"
if ($r20 -ne $null -and $r20.meta -ne $null) {
    $m = $r20.meta
    if ($m.ran_count -ne $null -and $m.error_count -ne $null) {
        Pass "Meta has ran_count and error_count"
    } else {
        Fail "Meta missing ran_count or error_count"
    }
} else {
    Fail "No meta"
}

# ─── Step 25: execute-safe with max=0 (clamped to 1) ─────────
Step 25 "POST /dashboard/execute-safe -- max=0 clamped to 1"
$r25 = Post-Json -Url "$BaseUrl/api/pierre/use/dashboard/execute-safe" -Headers $AuthHeaders -Body '{"max":0}'
if ($r25 -ne $null -and $r25.ok -eq $true) {
    Pass "Accepts max=0 without crashing"
} else {
    Fail "Expected ok=true even with max=0"
}

# ─── Step 26: continuity has mission_control_summary ─────────
Step 26 "GET /continuity -- mission_control_summary added"
$r26 = Get-Json -Url "$BaseUrl/api/pierre/use/continuity" -Headers $AuthHeaders
if ($r26 -ne $null -and $r26.ok -eq $true -and $r26.mission_control_summary -ne $null) {
    Pass "mission_control_summary present in /continuity"
} else {
    Fail "mission_control_summary missing from /continuity"
}

# ─── Step 27: continuity mission_control_summary.status ──────
Step 27 "GET /continuity -- mission_control_summary.status is valid"
if ($r26 -ne $null -and $r26.mission_control_summary -ne $null) {
    $validStatuses = @("clear", "active", "attention_required", "blocked", "sensitive")
    if ($validStatuses -contains $r26.mission_control_summary.status) {
        Pass "mission_control_summary.status is valid: $($r26.mission_control_summary.status)"
    } else {
        Fail "Unexpected status: $($r26.mission_control_summary.status)"
    }
} else {
    Fail "No mission_control_summary"
}

# ─── Step 28: continuity mission_control_summary.metrics ─────
Step 28 "GET /continuity -- mission_control_summary.metrics is array"
if ($r26 -ne $null -and $r26.mission_control_summary -ne $null) {
    if ($r26.mission_control_summary.metrics -ne $null) {
        Pass "metrics present"
    } else {
        Fail "metrics missing"
    }
} else {
    Fail "No mission_control_summary"
}

# ─── Step 29: continuity mission_control_summary.digest ──────
Step 29 "GET /continuity -- mission_control_summary.digest.tone is valid"
if ($r26 -ne $null -and $r26.mission_control_summary -ne $null -and $r26.mission_control_summary.digest -ne $null) {
    $validTones = @("calm", "action", "waiting", "blocked", "sensitive")
    if ($validTones -contains $r26.mission_control_summary.digest.tone) {
        Pass "digest.tone is valid: $($r26.mission_control_summary.digest.tone)"
    } else {
        Fail "Unexpected tone: $($r26.mission_control_summary.digest.tone)"
    }
} else {
    Fail "No digest in mission_control_summary"
}

# ─── Step 30: dashboard run-plan safe_task_ids ───────────────
Step 30 "GET /dashboard/run-plan -- safe_task_ids is array"
if ($r13 -ne $null -and $r13.run_plan -ne $null) {
    if ($r13.run_plan.safe_task_ids -ne $null) {
        Pass "safe_task_ids is present"
    } else {
        Fail "safe_task_ids missing"
    }
} else {
    Fail "No run_plan"
}

# ─── Step 31: dashboard run-plan blocked_actions ─────────────
Step 31 "GET /dashboard/run-plan -- blocked_actions is array"
if ($r13 -ne $null -and $r13.run_plan -ne $null) {
    if ($r13.run_plan.blocked_actions -ne $null) {
        Pass "blocked_actions is present"
    } else {
        Fail "blocked_actions missing"
    }
} else {
    Fail "No run_plan"
}

# ─── Step 32: dashboard safe_to_run list ─────────────────────
Step 32 "GET /dashboard -- safe_to_run list is array"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    if ($r2.dashboard.safe_to_run -ne $null) {
        Pass "safe_to_run is present"
    } else {
        Fail "safe_to_run missing"
    }
} else {
    Fail "No dashboard"
}

# ─── Step 33: dashboard needs_human list ─────────────────────
Step 33 "GET /dashboard -- needs_human list is present"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    if ($r2.dashboard.needs_human -ne $null) {
        Pass "needs_human is present"
    } else {
        Fail "needs_human missing"
    }
} else {
    Fail "No dashboard"
}

# ─── Step 34: dashboard sensitive list ───────────────────────
Step 34 "GET /dashboard -- sensitive list is present"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    if ($r2.dashboard.sensitive -ne $null) {
        Pass "sensitive list is present"
    } else {
        Fail "sensitive list missing"
    }
} else {
    Fail "No dashboard"
}

# ─── Step 35: dashboard deliveries list ──────────────────────
Step 35 "GET /dashboard -- deliveries list is present"
if ($r2 -ne $null -and $r2.dashboard -ne $null) {
    if ($r2.dashboard.deliveries -ne $null) {
        Pass "deliveries list is present"
    } else {
        Fail "deliveries list missing"
    }
} else {
    Fail "No dashboard"
}

# ─── Step 36: GET /mission-control (canonical) -- auth ────────
Step 36 "GET /mission-control -- auth required (no token)"
$r36 = Get-Json -Url "$BaseUrl/api/pierre/use/mission-control"
if ($r36 -ne $null -and $r36.ok -eq $false) {
    Pass "Returns 401 without token"
} else {
    Fail "Expected 401 without token"
}

# ─── Step 37: GET /mission-control -- ok=true ─────────────────
Step 37 "GET /mission-control -- ok=true with valid token"
$r37 = Get-Json -Url "$BaseUrl/api/pierre/use/mission-control" -Headers $AuthHeaders
if ($r37 -ne $null -and $r37.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true from canonical mission-control route"
}

# ─── Step 38: /mission-control has mission_control field ──────
Step 38 "GET /mission-control -- has mission_control field"
if ($r37 -ne $null -and $r37.mission_control -ne $null) {
    Pass "mission_control field present"
} else {
    Fail "mission_control field missing"
}

# ─── Step 39: /mission-control meta has canonical_route ───────
Step 39 "GET /mission-control -- meta.canonical_route is set"
if ($r37 -ne $null -and $r37.meta -ne $null -and $r37.meta.canonical_route -eq "/api/pierre/use/mission-control") {
    Pass "canonical_route is /api/pierre/use/mission-control"
} else {
    Fail "canonical_route missing or wrong: $($r37.meta.canonical_route)"
}

# ─── Step 40: /mission-control has preview ────────────────────
Step 40 "GET /mission-control -- has preview field"
if ($r37 -ne $null -and $r37.preview -ne $null) {
    Pass "preview field present"
} else {
    Fail "preview missing"
}

# ─── Step 41: /mission-control preview.status valid ───────────
Step 41 "GET /mission-control -- preview.status is valid"
if ($r37 -ne $null -and $r37.preview -ne $null) {
    $validStatuses = @("clear", "active", "attention_required", "blocked", "sensitive")
    if ($validStatuses -contains $r37.preview.status) {
        Pass "preview.status valid: $($r37.preview.status)"
    } else {
        Fail "preview.status invalid: $($r37.preview.status)"
    }
} else {
    Fail "No preview"
}

# ─── Step 42: /mission-control has scale_profile ──────────────
Step 42 "GET /mission-control -- has scale_profile"
if ($r37 -ne $null -and $r37.scale_profile -ne $null) {
    if ($r37.scale_profile.target_active_clients -eq 100000) {
        Pass "scale_profile.target_active_clients = 100000"
    } else {
        Fail "Unexpected target_active_clients: $($r37.scale_profile.target_active_clients)"
    }
} else {
    Fail "scale_profile missing"
}

# ─── Step 43: /mission-control has data_window ────────────────
Step 43 "GET /mission-control -- has data_window"
if ($r37 -ne $null -and $r37.data_window -ne $null) {
    if ($r37.data_window.safe_execution_hard_limit -eq 10) {
        Pass "data_window.safe_execution_hard_limit = 10"
    } else {
        Fail "Unexpected safe_execution_hard_limit: $($r37.data_window.safe_execution_hard_limit)"
    }
} else {
    Fail "data_window missing"
}

# ─── Step 44: GET /mission-control/run-plan (canonical) ───────
Step 44 "GET /mission-control/run-plan -- ok=true"
$r44 = Get-Json -Url "$BaseUrl/api/pierre/use/mission-control/run-plan" -Headers $AuthHeaders
if ($r44 -ne $null -and $r44.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ─── Step 45: /mission-control/run-plan canonical_route ───────
Step 45 "GET /mission-control/run-plan -- meta.canonical_route"
if ($r44 -ne $null -and $r44.meta -ne $null -and $r44.meta.canonical_route -eq "/api/pierre/use/mission-control/run-plan") {
    Pass "canonical_route is /api/pierre/use/mission-control/run-plan"
} else {
    Fail "canonical_route missing or wrong: $($r44.meta.canonical_route)"
}

# ─── Step 46: /mission-control/run-plan hard_max_tasks ────────
Step 46 "GET /mission-control/run-plan -- meta.hard_max_tasks = 10"
if ($r44 -ne $null -and $r44.meta -ne $null -and $r44.meta.hard_max_tasks -eq 10) {
    Pass "hard_max_tasks = 10"
} else {
    Fail "hard_max_tasks missing or != 10"
}

# ─── Step 47: POST /mission-control/run-safe -- ok=true ───────
Step 47 "POST /mission-control/run-safe -- ok=true"
$r47 = Post-Json -Url "$BaseUrl/api/pierre/use/mission-control/run-safe" -Headers $AuthHeaders -Body '{"max":2}'
if ($r47 -ne $null -and $r47.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ─── Step 48: /mission-control/run-safe canonical_route ───────
Step 48 "POST /mission-control/run-safe -- meta.canonical_route"
if ($r47 -ne $null -and $r47.meta -ne $null -and $r47.meta.canonical_route -eq "/api/pierre/use/mission-control/run-safe") {
    Pass "canonical_route is /api/pierre/use/mission-control/run-safe"
} else {
    Fail "canonical_route missing or wrong: $($r47.meta.canonical_route)"
}

# ─── Step 49: /mission-control/run-safe safety_gate ──────────
Step 49 "POST /mission-control/run-safe -- meta.safety_gate"
if ($r47 -ne $null -and $r47.meta -ne $null -and $r47.meta.safety_gate -eq "mission_control_safe_execution") {
    Pass "safety_gate = mission_control_safe_execution"
} else {
    Fail "safety_gate missing or wrong"
}

# ─── Step 50: POST /mission-control/briefing -- ok=true ───────
Step 50 "POST /mission-control/briefing -- ok=true"
$r50 = Post-Json -Url "$BaseUrl/api/pierre/use/mission-control/briefing" -Headers $AuthHeaders -Body '{"period":"instant"}'
if ($r50 -ne $null -and $r50.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ─── Step 51: /mission-control/briefing has briefing field ────
Step 51 "POST /mission-control/briefing -- briefing field present"
if ($r50 -ne $null -and $r50.briefing -ne $null) {
    Pass "briefing field present"
} else {
    Fail "briefing field missing"
}

# ─── Step 52: briefing has decisions_required ─────────────────
Step 52 "POST /mission-control/briefing -- briefing.decisions_required is array"
if ($r50 -ne $null -and $r50.briefing -ne $null) {
    if ($r50.briefing.decisions_required -ne $null) {
        Pass "decisions_required present"
    } else {
        Fail "decisions_required missing"
    }
} else {
    Fail "No briefing"
}

# ─── Step 53: briefing has scale_profile ──────────────────────
Step 53 "POST /mission-control/briefing -- briefing.scale_profile present"
if ($r50 -ne $null -and $r50.briefing -ne $null -and $r50.briefing.scale_profile -ne $null) {
    if ($r50.briefing.scale_profile.target_active_clients -eq 100000) {
        Pass "scale_profile.target_active_clients = 100000"
    } else {
        Fail "Unexpected target_active_clients: $($r50.briefing.scale_profile.target_active_clients)"
    }
} else {
    Fail "scale_profile missing from briefing"
}

# ─── Step 54: /dashboard has canonical_route in meta ──────────
Step 54 "GET /dashboard -- meta.canonical_route points to /mission-control"
if ($r2 -ne $null -and $r2.meta -ne $null -and $r2.meta.canonical_route -eq "/api/pierre/use/mission-control") {
    Pass "meta.canonical_route = /api/pierre/use/mission-control"
} else {
    Fail "meta.canonical_route missing or wrong: $($r2.meta.canonical_route)"
}

# ─── Step 55: /dashboard/run-plan has canonical_route ─────────
Step 55 "GET /dashboard/run-plan -- meta.canonical_route"
if ($r13 -ne $null -and $r13.meta -ne $null -and $r13.meta.canonical_route -eq "/api/pierre/use/mission-control/run-plan") {
    Pass "meta.canonical_route = /api/pierre/use/mission-control/run-plan"
} else {
    Fail "meta.canonical_route missing or wrong: $($r13.meta.canonical_route)"
}

# ─── Step 56: /dashboard/execute-safe has canonical_route ─────
Step 56 "POST /dashboard/execute-safe -- meta.canonical_route"
if ($r20 -ne $null -and $r20.meta -ne $null -and $r20.meta.canonical_route -eq "/api/pierre/use/mission-control/run-safe") {
    Pass "meta.canonical_route = /api/pierre/use/mission-control/run-safe"
} else {
    Fail "meta.canonical_route missing or wrong: $($r20.meta.canonical_route)"
}

# ─── Step 57: /continuity has mission_control block ───────────
Step 57 "GET /continuity -- mission_control block present"
if ($r26 -ne $null -and $r26.mission_control -ne $null) {
    Pass "mission_control block present in /continuity"
} else {
    Fail "mission_control block missing from /continuity"
}

# ─── Step 58: /continuity mission_control.scale_profile ───────
Step 58 "GET /continuity -- mission_control.scale_profile present"
if ($r26 -ne $null -and $r26.mission_control -ne $null -and $r26.mission_control.scale_profile -ne $null) {
    if ($r26.mission_control.scale_profile.target_active_clients -eq 100000) {
        Pass "scale_profile.target_active_clients = 100000"
    } else {
        Fail "Unexpected target_active_clients"
    }
} else {
    Fail "scale_profile missing from mission_control block"
}

# ─── Step 59: /continuity mission_control.preview ─────────────
Step 59 "GET /continuity -- mission_control.preview present"
if ($r26 -ne $null -and $r26.mission_control -ne $null -and $r26.mission_control.preview -ne $null) {
    Pass "preview present in mission_control block"
} else {
    Fail "preview missing from mission_control block"
}

# ─── Step 60: briefing period param -- daily ──────────────────
Step 60 "POST /mission-control/briefing -- period=daily is honored"
$r60 = Post-Json -Url "$BaseUrl/api/pierre/use/mission-control/briefing" -Headers $AuthHeaders -Body '{"period":"daily"}'
if ($r60 -ne $null -and $r60.ok -eq $true -and $r60.meta.period -eq "daily") {
    Pass "period=daily honored in meta"
} else {
    Fail "period=daily not honored"
}

# ─── Résumé ───────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================" -ForegroundColor White
Write-Host " RÉSULTATS -- BLOC 13.1 Pierre Mission Control" -ForegroundColor White
Write-Host " PASS: $pass   FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host "======================================================" -ForegroundColor White

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "Echecs :" -ForegroundColor Red
    $results | Where-Object { $_ -like "FAIL:*" } | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
}

exit $fail
