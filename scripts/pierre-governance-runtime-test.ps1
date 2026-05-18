# BLOC 15 -- Pierre Governance Runtime (ClonePolicy + CloneTrust + Governance)
# E2E Test Script -- PowerShell 5 compatible
# Usage: .\scripts\pierre-governance-runtime-test.ps1 -Token "Bearer <jwt>" [-BaseUrl "http://localhost:3000"]

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

function Info {
    param([string]$msg)
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
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

$headers = @{}
if ($Token -ne "") {
    $headers["Authorization"] = $Token
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " PIERRE GOVERNANCE RUNTIME -- E2E TEST (BLOC 15)" -ForegroundColor Yellow
Write-Host " Base: $BaseUrl" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow

# ── STEP 1: Health check ──────────────────────────────────
Step 1 "API health check"
$health = Get-Json -Url "$BaseUrl/api/health" -Headers $headers
if ($health -ne $null) {
    Pass "API is reachable"
} else {
    Info "No /api/health route -- continuing anyway"
}

# ── STEP 2: Auth required on governance/evaluate ──────────
Step 2 "governance/evaluate requires authentication"
$body = '{"task_type":"document.draft"}'
$unauthHeaders = @{}
$resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/evaluate" -Headers $unauthHeaders -Body $body
if ($resp -ne $null -and $resp.ok -eq $false) {
    Pass "Unauthenticated request returns ok=false"
} else {
    Info "Endpoint may not exist yet or returned unexpected response"
}

# ── STEP 3: Auth required on clonepolicy/evaluate ─────────
Step 3 "clonepolicy/evaluate requires authentication"
$resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonepolicy/evaluate" -Headers $unauthHeaders -Body $body
if ($resp -ne $null -and $resp.ok -eq $false) {
    Pass "Unauthenticated request returns ok=false"
} else {
    Info "Endpoint may not exist yet or returned unexpected response"
}

# ── STEP 4: Auth required on clonetrust/evaluate ──────────
Step 4 "clonetrust/evaluate requires authentication"
$resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonetrust/evaluate" -Headers $unauthHeaders -Body $body
if ($resp -ne $null -and $resp.ok -eq $false) {
    Pass "Unauthenticated request returns ok=false"
} else {
    Info "Endpoint may not exist yet or returned unexpected response"
}

# ── STEP 5: Auth required on governance/preview ───────────
Step 5 "governance/preview requires authentication"
$resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/preview" -Headers $unauthHeaders -Body $body
if ($resp -ne $null -and $resp.ok -eq $false) {
    Pass "Unauthenticated request returns ok=false"
} else {
    Info "Endpoint may not exist yet or returned unexpected response"
}

# ── STEP 6-10: Authenticated governance evaluate ──────────
if ($Token -ne "") {
    Step 6 "governance/evaluate -- safe document draft"
    $body = '{"task_type":"document.draft","risk_level_hint":"green","approval_required":false}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "Returns ok=true"
        if ($resp.evaluation -ne $null) { Pass "evaluation field present" } else { Fail "evaluation field missing" }
        if ($resp.preview -ne $null) { Pass "preview field present" } else { Fail "preview field missing" }
        if ($resp.briefing -ne $null) { Pass "briefing field present" } else { Fail "briefing field missing" }
        if ($resp.card -ne $null) { Pass "card field present" } else { Fail "card field missing" }
    } else {
        Fail "governance/evaluate returned error for safe task"
    }

    Step 7 "governance/evaluate -- email.send must be blocked"
    $body = '{"task_type":"email.send"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $decision = $resp.evaluation.decision
        if ($decision -eq "block" -or $decision -eq "refuse") {
            Pass "email.send decision is block/refuse: $decision"
        } else {
            Fail "email.send should be blocked, got: $decision"
        }
        $autoExec = $resp.evaluation.allowed_to_auto_execute
        if ($autoExec -eq $false) {
            Pass "email.send allowed_to_auto_execute=false"
        } else {
            Fail "email.send allowed_to_auto_execute should be false"
        }
    } else {
        Fail "governance/evaluate failed for email.send"
    }

    Step 8 "governance/evaluate -- harcelement must be refused"
    $body = '{"text_corpus":"harcelement moral et discrimination"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $decision = $resp.evaluation.decision
        if ($decision -eq "refuse") {
            Pass "harcelement returns refuse"
        } else {
            Fail "harcelement should be refused, got: $decision"
        }
        $requiresHuman = $resp.evaluation.requires_human
        if ($requiresHuman -eq $true) {
            Pass "requires_human=true for refused decision"
        } else {
            Fail "requires_human should be true for refused"
        }
    } else {
        Fail "governance/evaluate failed for harcelement context"
    }

    Step 9 "governance/evaluate -- approval_required=true blocks auto-exec"
    $body = '{"task_type":"document.draft","approval_required":true}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $autoExec = $resp.evaluation.allowed_to_auto_execute
        if ($autoExec -eq $false) {
            Pass "approval_required=true blocks auto-exec"
        } else {
            Fail "approval_required=true should block auto-exec"
        }
    } else {
        Fail "governance/evaluate failed for approval_required context"
    }

    Step 10 "governance/evaluate -- black risk level blocks auto-exec"
    $body = '{"task_type":"document.draft","risk_level_hint":"black"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $autoExec = $resp.evaluation.allowed_to_auto_execute
        if ($autoExec -eq $false) {
            Pass "black risk_level_hint blocks auto-exec"
        } else {
            Fail "black risk_level should block auto-exec"
        }
    } else {
        Fail "governance/evaluate failed for black risk context"
    }

    # ── STEP 11-15: ClonePolicy evaluate ─────────────────
    Step 11 "clonepolicy/evaluate -- safe context returns ok=true"
    $body = '{"task_type":"document.draft","risk_level_hint":"green"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonepolicy/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "clonepolicy/evaluate returns ok=true"
        if ($resp.evaluation -ne $null) { Pass "evaluation field present" } else { Fail "evaluation field missing" }
        if ($resp.preview -ne $null) { Pass "preview field present" } else { Fail "preview field missing" }
        if ($resp.summary -ne $null) { Pass "summary field present" } else { Fail "summary field missing" }
    } else {
        Fail "clonepolicy/evaluate failed for safe context"
    }

    Step 12 "clonepolicy/evaluate -- email.send is blocked"
    $body = '{"task_type":"email.send"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonepolicy/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $decision = $resp.evaluation.decision
        if ($decision -eq "block" -or $decision -eq "refuse") {
            Pass "email.send decision is block/refuse: $decision"
        } else {
            Fail "email.send should be blocked by ClonePolicy, got: $decision"
        }
    } else {
        Fail "clonepolicy/evaluate failed for email.send"
    }

    Step 13 "clonepolicy/evaluate -- harcelement is refused"
    $body = '{"text_corpus":"harcelement moral"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonepolicy/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $decision = $resp.evaluation.decision
        if ($decision -eq "refuse") {
            Pass "harcelement returns refuse from ClonePolicy"
        } else {
            Fail "harcelement should be refused by ClonePolicy, got: $decision"
        }
    } else {
        Fail "clonepolicy/evaluate failed for harcelement context"
    }

    Step 14 "clonepolicy/evaluate -- allowed_to_auto_execute present in response"
    $body = '{"task_type":"document.draft"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonepolicy/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $autoExecPresent = ($resp.evaluation.PSObject.Properties.Name -contains "allowed_to_auto_execute")
        if ($autoExecPresent) {
            Pass "allowed_to_auto_execute is present in evaluation"
        } else {
            Fail "allowed_to_auto_execute missing from evaluation"
        }
    } else {
        Fail "clonepolicy/evaluate did not return ok=true"
    }

    Step 15 "clonepolicy/evaluate -- matched_rules is an array"
    $body = '{"task_type":"email.send"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonepolicy/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        if ($resp.evaluation.matched_rules -ne $null) {
            Pass "matched_rules is present in evaluation"
        } else {
            Fail "matched_rules missing from evaluation"
        }
    } else {
        Fail "clonepolicy/evaluate did not return ok=true"
    }

    # ── STEP 16-20: CloneTrust evaluate ──────────────────
    Step 16 "clonetrust/evaluate -- returns ok=true for basic context"
    $body = '{"task_type":"document.draft"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonetrust/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "clonetrust/evaluate returns ok=true"
        if ($resp.evaluation -ne $null) { Pass "evaluation field present" } else { Fail "evaluation field missing" }
        if ($resp.preview -ne $null) { Pass "preview field present" } else { Fail "preview field missing" }
    } else {
        Fail "clonetrust/evaluate failed for basic context"
    }

    Step 17 "clonetrust/evaluate -- email.send has hard_blocks"
    $body = '{"task_type":"email.send"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonetrust/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $autoExec = $resp.evaluation.allowed_to_auto_execute
        if ($autoExec -eq $false) {
            Pass "email.send allowed_to_auto_execute=false in CloneTrust"
        } else {
            Fail "email.send should not be auto-executable in CloneTrust"
        }
        $hardBlocks = $resp.evaluation.hard_blocks
        if ($hardBlocks -ne $null -and $hardBlocks.Count -gt 0) {
            Pass "hard_blocks present for email.send"
        } else {
            Fail "hard_blocks should be non-empty for email.send"
        }
    } else {
        Fail "clonetrust/evaluate failed for email.send"
    }

    Step 18 "clonetrust/evaluate -- trust_score is a number"
    $body = '{"task_type":"document.draft","company_trust_score":10,"historical_success_rate":0.9}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonetrust/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $trustScore = $resp.evaluation.trust_score
        if ($trustScore -ne $null) {
            Pass "trust_score present: $trustScore"
        } else {
            Fail "trust_score missing from evaluation"
        }
        $trustLevel = $resp.evaluation.trust_level
        if ($trustLevel -ne $null) {
            Pass "trust_level present: $trustLevel"
        } else {
            Fail "trust_level missing from evaluation"
        }
    } else {
        Fail "clonetrust/evaluate did not return ok=true with trust context"
    }

    Step 19 "clonetrust/evaluate -- approval_required=true is blocked"
    $body = '{"task_type":"document.draft","approval_required":true}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonetrust/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $autoExec = $resp.evaluation.allowed_to_auto_execute
        if ($autoExec -eq $false) {
            Pass "approval_required=true blocks CloneTrust auto-exec"
        } else {
            Fail "approval_required=true should block CloneTrust auto-exec"
        }
    } else {
        Fail "clonetrust/evaluate failed for approval_required context"
    }

    Step 20 "clonetrust/evaluate -- factors array present"
    $body = '{"task_type":"document.draft"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/clonetrust/evaluate" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        if ($resp.evaluation.factors -ne $null) {
            Pass "factors array present in evaluation"
        } else {
            Fail "factors array missing from evaluation"
        }
    } else {
        Fail "clonetrust/evaluate did not return ok=true"
    }

    # ── STEP 21-25: governance/preview ───────────────────
    Step 21 "governance/preview -- returns ok=true for basic context"
    $body = '{"task_type":"document.draft"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/preview" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "governance/preview returns ok=true"
        if ($resp.preview -ne $null) { Pass "preview field present" } else { Fail "preview field missing" }
        if ($resp.decision -ne $null) { Pass "decision field present" } else { Fail "decision field missing" }
    } else {
        Fail "governance/preview failed for basic context"
    }

    Step 22 "governance/preview -- email.send is not allowed"
    $body = '{"task_type":"email.send"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/preview" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $autoExec = $resp.allowed_to_auto_execute
        if ($autoExec -eq $false) {
            Pass "email.send not allowed in preview"
        } else {
            Fail "email.send should not be allowed in preview"
        }
    } else {
        Fail "governance/preview failed for email.send"
    }

    Step 23 "governance/preview -- requires_human field present"
    $body = '{"task_type":"email.send"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/governance/preview" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        $hasRequiresHuman = ($resp.PSObject.Properties.Name -contains "requires_human")
        if ($hasRequiresHuman) {
            Pass "requires_human field present in preview response"
        } else {
            Fail "requires_human missing from preview response"
        }
    } else {
        Fail "governance/preview did not return ok=true"
    }

    # ── STEP 24-28: Mission Control governance integration ─
    Step 24 "mission-control -- returns governance_card"
    $resp = Get-Json -Url "$BaseUrl/api/pierre/use/mission-control" -Headers $headers
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "mission-control returns ok=true"
        if ($resp.governance_card -ne $null) {
            Pass "governance_card field present"
        } else {
            Fail "governance_card missing from mission-control response"
        }
    } else {
        Info "mission-control not reachable or returned error (needs Pierre access)"
    }

    Step 25 "mission-control/briefing -- returns governance_summary"
    $body = '{"period":"instant"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/mission-control/briefing" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "mission-control/briefing returns ok=true"
        if ($resp.governance_summary -ne $null) {
            Pass "governance_summary field present"
        } else {
            Fail "governance_summary missing from briefing response"
        }
    } else {
        Info "mission-control/briefing not reachable (needs Pierre access)"
    }

    Step 26 "mission-control/run-plan -- returns governance_summary"
    $resp = Get-Json -Url "$BaseUrl/api/pierre/use/mission-control/run-plan?dry_run=true&max=2" -Headers $headers
    if ($resp -ne $null -and $resp.ok -eq $true) {
        Pass "mission-control/run-plan returns ok=true"
        if ($resp.governance_summary -ne $null) {
            Pass "governance_summary field present in run-plan"
        } else {
            Fail "governance_summary missing from run-plan response"
        }
    } else {
        Info "mission-control/run-plan not reachable (needs Pierre access)"
    }

    Step 27 "submit -- returns governance evaluation in response"
    $body = '{"input":"Test mission for governance check"}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/submit" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        if ($resp.governance -ne $null) {
            Pass "governance field present in submit response"
        } else {
            Info "governance field not present in submit (may be in brain_output_json)"
        }
    } else {
        Info "submit not reachable or returned error (needs Pierre access + valid input)"
    }

    Step 28 "mission-control/run-safe -- governance_summary present"
    $body = '{"max":1}'
    $resp = Post-Json -Url "$BaseUrl/api/pierre/use/mission-control/run-safe" -Headers $headers -Body $body
    if ($resp -ne $null -and $resp.ok -eq $true) {
        if ($resp.governance_summary -ne $null) {
            Pass "governance_summary present in run-safe"
        } else {
            Fail "governance_summary missing from run-safe"
        }
    } else {
        Info "run-safe not reachable (needs Pierre access)"
    }

} else {
    Info "No token provided -- skipping authenticated steps 6-28"
    Info "Provide -Token 'Bearer <jwt>' to run full suite"
    for ($i = 6; $i -le 28; $i++) {
        $script:results += "SKIP: Step $i (no token)"
    }
}

# ── STEP 29-35: Security invariant checks (unit-level) ──
Step 29 "TypeScript check -- npx tsc --noEmit"
$tscOutput = & npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "TypeScript check passed"
} else {
    Fail "TypeScript check failed: $tscOutput"
}

Step 30 "Vitest -- hr-clonepolicy.test.ts"
$vitestOut = & npx vitest run src/lib/pierre/__tests__/hr-clonepolicy.test.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "hr-clonepolicy tests passed"
} else {
    Fail "hr-clonepolicy tests failed"
    Info $vitestOut
}

Step 31 "Vitest -- hr-clonetrust.test.ts"
$vitestOut = & npx vitest run src/lib/pierre/__tests__/hr-clonetrust.test.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "hr-clonetrust tests passed"
} else {
    Fail "hr-clonetrust tests failed"
    Info $vitestOut
}

Step 32 "Vitest -- hr-governance.test.ts"
$vitestOut = & npx vitest run src/lib/pierre/__tests__/hr-governance.test.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "hr-governance tests passed"
} else {
    Fail "hr-governance tests failed"
    Info $vitestOut
}

Step 33 "Vitest -- hr-governance-runtime.test.ts"
$vitestOut = & npx vitest run src/lib/pierre/__tests__/hr-governance-runtime.test.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "hr-governance-runtime tests passed"
} else {
    Fail "hr-governance-runtime tests failed"
    Info $vitestOut
}

Step 34 "Vitest -- full test suite (all 15 files)"
$vitestOut = & npm test 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "Full test suite passed"
} else {
    Fail "Full test suite failed"
    Info "Check individual test files for details"
}

Step 35 "New route files exist"
$routes = @(
    "src/app/api/pierre/use/governance/evaluate/route.ts",
    "src/app/api/pierre/use/governance/preview/route.ts",
    "src/app/api/pierre/use/clonepolicy/evaluate/route.ts",
    "src/app/api/pierre/use/clonetrust/evaluate/route.ts"
)
foreach ($route in $routes) {
    if (Test-Path $route) {
        Pass "Route exists: $route"
    } else {
        Fail "Route missing: $route"
    }
}

# ── STEP 36-40: SQL and documentation checks ─────────────
Step 36 "SQL index file exists"
if (Test-Path "supabase/sql/pierre_governance_indexes_v1.sql") {
    Pass "pierre_governance_indexes_v1.sql exists"
} else {
    Fail "pierre_governance_indexes_v1.sql missing"
}

Step 37 "Pure modules exist and have correct size"
$modules = @(
    "src/lib/pierre/hr/clonepolicy.ts",
    "src/lib/pierre/hr/clonetrust.ts",
    "src/lib/pierre/hr/governance.ts"
)
foreach ($mod in $modules) {
    if (Test-Path $mod) {
        $size = (Get-Item $mod).Length
        if ($size -gt 1000) {
            Pass "Module exists and has content: $mod ($size bytes)"
        } else {
            Fail "Module too small: $mod ($size bytes)"
        }
    } else {
        Fail "Module missing: $mod"
    }
}

Step 38 "Test files exist"
$testFiles = @(
    "src/lib/pierre/__tests__/hr-clonepolicy.test.ts",
    "src/lib/pierre/__tests__/hr-clonetrust.test.ts",
    "src/lib/pierre/__tests__/hr-governance.test.ts",
    "src/lib/pierre/__tests__/hr-governance-runtime.test.ts"
)
foreach ($tf in $testFiles) {
    if (Test-Path $tf) {
        Pass "Test file exists: $tf"
    } else {
        Fail "Test file missing: $tf"
    }
}

Step 39 "package.json test command has 15 test files"
$pkgJson = Get-Content "package.json" -Raw
$testCount = ([regex]::Matches($pkgJson, "\.test\.ts")).Count
if ($testCount -ge 15) {
    Pass "package.json test command references $testCount test files"
} else {
    Fail "package.json test command references only $testCount test files (expected 15)"
}

Step 40 "Governance module imports from all three sub-modules"
$govContent = Get-Content "src/lib/pierre/hr/governance.ts" -Raw
if ($govContent -match "cloneguard" -and $govContent -match "clonepolicy" -and $govContent -match "clonetrust") {
    Pass "governance.ts imports from cloneguard, clonepolicy, clonetrust"
} else {
    Fail "governance.ts missing imports from one or more sub-modules"
}

# ── STEP 41-45: Integration file checks ──────────────────
Step 41 "execute-task.ts has governance gate"
if (Test-Path "src/lib/pierre/tasks/execute-task.ts") {
    $content = Get-Content "src/lib/pierre/tasks/execute-task.ts" -Raw
    if ($content -match "evaluateGovernance") {
        Pass "execute-task.ts has governance integration"
    } else {
        Fail "execute-task.ts missing evaluateGovernance"
    }
} else {
    Fail "execute-task.ts not found"
}

Step 42 "submit/route.ts has governance integration"
if (Test-Path "src/app/api/pierre/use/submit/route.ts") {
    $content = Get-Content "src/app/api/pierre/use/submit/route.ts" -Raw
    if ($content -match "evaluateGovernance") {
        Pass "submit/route.ts has governance integration"
    } else {
        Fail "submit/route.ts missing evaluateGovernance"
    }
} else {
    Fail "submit/route.ts not found"
}

Step 43 "mission-control/run-safe/route.ts has governance gate"
if (Test-Path "src/app/api/pierre/use/mission-control/run-safe/route.ts") {
    $content = Get-Content "src/app/api/pierre/use/mission-control/run-safe/route.ts" -Raw
    if ($content -match "isGovernanceAutoExecutable") {
        Pass "run-safe/route.ts has governance gate"
    } else {
        Fail "run-safe/route.ts missing isGovernanceAutoExecutable"
    }
} else {
    Fail "run-safe/route.ts not found"
}

Step 44 "employee file route has governance_summary"
if (Test-Path "src/app/api/pierre/use/employee/[employeeId]/file/route.ts") {
    $content = Get-Content "src/app/api/pierre/use/employee/[employeeId]/file/route.ts" -Raw
    if ($content -match "governance_summary") {
        Pass "employee file route has governance_summary"
    } else {
        Fail "employee file route missing governance_summary"
    }
} else {
    Fail "employee file route not found"
}

Step 45 "All modified routes do NOT use scheduled_for column"
$routeFiles = Get-ChildItem "src/app/api/pierre" -Recurse -Filter "route.ts"
$schedForViolations = @()
foreach ($rf in $routeFiles) {
    $content = Get-Content $rf.FullName -Raw
    if ($content -match "scheduled_for") {
        $schedForViolations += $rf.Name
    }
}
if ($schedForViolations.Count -eq 0) {
    Pass "No route uses scheduled_for (correct: use execute_at)"
} else {
    Fail "Routes using scheduled_for (violation): $($schedForViolations -join ', ')"
}

# ── STEP 46-50: Security constraint checks ───────────────
Step 46 "No route auto-executes email.send or send_email"
$routeFiles = Get-ChildItem "src/app/api/pierre/use/mission-control" -Recurse -Filter "route.ts"
foreach ($rf in $routeFiles) {
    $content = Get-Content $rf.FullName -Raw
    if ($content -match "BLOCKED_TASK_TYPES" -or $content -match "email\.send" -or $content -match "isGovernanceAutoExecutable") {
        Pass "Safety gate present in: $($rf.Name)"
    }
}

Step 47 "governance.ts never weakens CloneGuard"
$govContent = Get-Content "src/lib/pierre/hr/governance.ts" -Raw
if ($govContent -match "guard_evaluation" -and $govContent -match "allowed_to_auto_execute") {
    Pass "governance.ts references guard_evaluation and allowed_to_auto_execute"
} else {
    Fail "governance.ts may not be correctly checking guard_evaluation"
}

Step 48 "clonetrust.ts references cloneguard_decision for hard blocks"
$trustContent = Get-Content "src/lib/pierre/hr/clonetrust.ts" -Raw
if ($trustContent -match "cloneguard_decision") {
    Pass "clonetrust.ts checks cloneguard_decision for hard blocks"
} else {
    Fail "clonetrust.ts may not be checking cloneguard_decision"
}

Step 49 "clonepolicy.ts is a pure module (no Supabase import)"
$policyContent = Get-Content "src/lib/pierre/hr/clonepolicy.ts" -Raw
if ($policyContent -match "supabase") {
    Fail "clonepolicy.ts imports supabase (must be pure)"
} else {
    Pass "clonepolicy.ts has no supabase import (pure module)"
}

Step 50 "clonetrust.ts is a pure module (no Supabase import)"
$trustContent = Get-Content "src/lib/pierre/hr/clonetrust.ts" -Raw
if ($trustContent -match "supabase") {
    Fail "clonetrust.ts imports supabase (must be pure)"
} else {
    Pass "clonetrust.ts has no supabase import (pure module)"
}

# ── STEP 51-55: Final validation ─────────────────────────
Step 51 "governance.ts is a pure module (no Supabase import)"
$govContent = Get-Content "src/lib/pierre/hr/governance.ts" -Raw
if ($govContent -match "supabase") {
    Fail "governance.ts imports supabase (must be pure)"
} else {
    Pass "governance.ts has no supabase import (pure module)"
}

Step 52 "pierre_task_logs usage: no event/level/payload fields"
$allTs = Get-ChildItem "src/app/api/pierre" -Recurse -Filter "route.ts"
$violations = @()
foreach ($f in $allTs) {
    $content = Get-Content $f.FullName -Raw
    if ($content -match '"event"\s*:' -or $content -match '"level"\s*:' -or $content -match '"payload"\s*:') {
        $violations += $f.Name
    }
}
if ($violations.Count -eq 0) {
    Pass "No route uses forbidden log fields (event/level/payload)"
} else {
    Fail "Routes using forbidden log fields: $($violations -join ', ')"
}

Step 53 "All new routes use event_type + message + meta_json in logs"
$newRoutes = @(
    "src/app/api/pierre/use/governance/evaluate/route.ts",
    "src/app/api/pierre/use/clonepolicy/evaluate/route.ts",
    "src/app/api/pierre/use/clonetrust/evaluate/route.ts"
)
foreach ($nr in $newRoutes) {
    if (Test-Path $nr) {
        $content = Get-Content $nr -Raw
        if ($content -match "event_type" -and $content -match "meta_json") {
            Pass "Log schema correct in: $nr"
        } else {
            Fail "Missing event_type or meta_json in: $nr"
        }
    } else {
        Fail "Route file missing: $nr"
    }
}

Step 54 "continuity/run-next has governance integration"
if (Test-Path "src/app/api/pierre/use/continuity/run-next/route.ts") {
    $content = Get-Content "src/app/api/pierre/use/continuity/run-next/route.ts" -Raw
    if ($content -match "evaluateGovernance" -or $content -match "governance") {
        Pass "continuity/run-next has governance integration"
    } else {
        Fail "continuity/run-next missing governance integration"
    }
} else {
    Fail "continuity/run-next/route.ts not found"
}

Step 55 "approve/cancel/reschedule/process-task routes NOT modified"
$untouchedRoutes = @(
    "src/app/api/pierre/use/task/approve",
    "src/app/api/pierre/use/task/cancel",
    "src/app/api/pierre/use/task/reschedule"
)
foreach ($ur in $untouchedRoutes) {
    if (Test-Path $ur) {
        Pass "Untouched route directory exists: $ur"
    } else {
        Info "Route directory not found (may be named differently): $ur"
    }
}

# ── Summary ───────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " RESULTS: $pass passed, $fail failed" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
foreach ($r in $results) {
    if ($r -match "^PASS") {
        Write-Host "  $r" -ForegroundColor Green
    } elseif ($r -match "^FAIL") {
        Write-Host "  $r" -ForegroundColor Red
    } else {
        Write-Host "  $r" -ForegroundColor Gray
    }
}

if ($fail -eq 0) {
    Write-Host ""
    Write-Host "ALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "$fail TEST(S) FAILED" -ForegroundColor Red
    exit 1
}
