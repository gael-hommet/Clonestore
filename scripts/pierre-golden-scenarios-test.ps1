# scripts/pierre-golden-scenarios-test.ps1
# Pierre Golden Scenarios — Validation Script — Bloc 29
# PS5 compatible: no ?., no ??, no typographic quotes, no ternary operator
# Usage: pwsh -File scripts/pierre-golden-scenarios-test.ps1

$ErrorActionPreference = "Stop"
$totalErrors = 0
$stepsPassed = 0

function Write-Step {
    param([int]$step, [string]$label)
    Write-Host ""
    Write-Host "=== STEP $step : $label ===" -ForegroundColor Cyan
}

function Write-OK {
    param([string]$msg)
    Write-Host "  [OK] $msg" -ForegroundColor Green
    $script:stepsPassed++
}

function Write-FAIL {
    param([string]$msg)
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:totalErrors++
}

function Assert-FileExists {
    param([string]$path, [string]$label)
    if (Test-Path $path) {
        Write-OK "$label existe : $path"
    } else {
        Write-FAIL "$label manquant : $path"
    }
}

function Assert-FileContains {
    param([string]$path, [string]$needle, [string]$label)
    if (-not (Test-Path $path)) {
        Write-FAIL "$label — fichier introuvable : $path"
        return
    }
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match [regex]::Escape($needle)) {
        Write-OK "$label contient '$needle'"
    } else {
        Write-FAIL "$label ne contient pas '$needle' dans $path"
    }
}

function Assert-FileNotContains {
    param([string]$path, [string]$needle, [string]$label)
    if (-not (Test-Path $path)) {
        Write-FAIL "$label — fichier introuvable : $path"
        return
    }
    $content = Get-Content $path -Raw -Encoding UTF8
    if (-not ($content -match [regex]::Escape($needle))) {
        Write-OK "$label n'utilise pas '$needle'"
    } else {
        Write-FAIL "$label utilise '$needle' dans $path (interdit)"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " PIERRE GOLDEN SCENARIOS — BLOC 29" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# ── STEP 1 : Module types.ts ──────────────────────────────────
Write-Step 1 "scenarios/types.ts — types purs"
$typesFile = "src/lib/pierre/scenarios/types.ts"
Assert-FileExists $typesFile "types.ts"
Assert-FileContains $typesFile "PierreGoldenScenarioId" "PierreGoldenScenarioId type"
Assert-FileContains $typesFile "gs_onboarding_complete" "ID gs_onboarding_complete"
Assert-FileContains $typesFile "gs_invalid_request" "ID gs_invalid_request"
Assert-FileContains $typesFile "gs_cloneguard_block" "ID gs_cloneguard_block"
Assert-FileContains $typesFile "PierreGoldenScenarioResult" "PierreGoldenScenarioResult"
Assert-FileContains $typesFile "PierreGoldenScenarioSuiteResult" "PierreGoldenScenarioSuiteResult"
Assert-FileContains $typesFile "PierreGoldenScenarioReport" "PierreGoldenScenarioReport"

# ── STEP 2 : Module golden-registry.ts ────────────────────────
Write-Step 2 "scenarios/golden-registry.ts — 13 scenarios"
$registryFile = "src/lib/pierre/scenarios/golden-registry.ts"
Assert-FileExists $registryFile "golden-registry.ts"
Assert-FileContains $registryFile "gs_onboarding_complete" "Scenario onboarding"
Assert-FileContains $registryFile "gs_hiring_offer" "Scenario hiring"
Assert-FileContains $registryFile "gs_absence_justified" "Scenario absence"
Assert-FileContains $registryFile "gs_contract_renewal" "Scenario contract"
Assert-FileContains $registryFile "gs_trial_activation" "Scenario trial"
Assert-FileContains $registryFile "gs_payroll_prep" "Scenario payroll"
Assert-FileContains $registryFile "gs_employee_360" "Scenario employee_360"
Assert-FileContains $registryFile "gs_document_premium" "Scenario document"
Assert-FileContains $registryFile "gs_cloneguard_allow" "Scenario cloneguard_allow"
Assert-FileContains $registryFile "gs_cloneadn_configured" "Scenario cloneadn"
Assert-FileContains $registryFile "gs_cloneguard_block" "Scenario cloneguard_block"
Assert-FileContains $registryFile "gs_missing_employee" "Scenario missing_employee"
Assert-FileContains $registryFile "gs_invalid_request" "Scenario invalid_request"
Assert-FileContains $registryFile "getGoldenScenarioRegistry" "Registry export"
Assert-FileContains $registryFile "isValidGoldenScenarioId" "Validation export"

# ── STEP 3 : Module fixtures.ts ────────────────────────────────
Write-Step 3 "scenarios/fixtures.ts — company/employee/adn"
$fixturesFile = "src/lib/pierre/scenarios/fixtures.ts"
Assert-FileExists $fixturesFile "fixtures.ts"
Assert-FileContains $fixturesFile "tech_company" "Fixture tech_company"
Assert-FileContains $fixturesFile "trial_company" "Fixture trial_company"
Assert-FileContains $fixturesFile "new_employee" "Fixture new_employee"
Assert-FileContains $fixturesFile "active_employee" "Fixture active_employee"
Assert-FileContains $fixturesFile "cdd_employee" "Fixture cdd_employee"
Assert-FileContains $fixturesFile "configured_adn" "Fixture configured_adn"
Assert-FileContains $fixturesFile "event_type" "Logs utilisent event_type"
Assert-FileContains $fixturesFile "meta_json" "Logs utilisent meta_json"
Assert-FileNotContains $fixturesFile "scheduled_for" "Pas de scheduled_for"
Assert-FileNotContains $fixturesFile '"event"' "Pas de champ event legacy"

# ── STEP 4 : Module validator.ts ──────────────────────────────
Write-Step 4 "scenarios/validator.ts — moteur assertions"
$validatorFile = "src/lib/pierre/scenarios/validator.ts"
Assert-FileExists $validatorFile "validator.ts"
Assert-FileContains $validatorFile "runScenarioCheck" "runScenarioCheck"
Assert-FileContains $validatorFile "runAllChecks" "runAllChecks"
Assert-FileContains $validatorFile "buildTaskDraftSafetyData" "buildTaskDraftSafetyData"
Assert-FileContains $validatorFile "buildValidationErrorArtifact" "buildValidationErrorArtifact"
Assert-FileContains $validatorFile "computeCheckSummary" "computeCheckSummary"
Assert-FileContains $validatorFile "determineScenarioStatus" "determineScenarioStatus"
Assert-FileContains $validatorFile "has_email_send" "Invariant email.send detection"
Assert-FileContains $validatorFile "has_scheduled_for" "Invariant scheduled_for detection"

# ── STEP 5 : Module runner.ts ─────────────────────────────────
Write-Step 5 "scenarios/runner.ts — async runner"
$runnerFile = "src/lib/pierre/scenarios/runner.ts"
Assert-FileExists $runnerFile "runner.ts"
Assert-FileContains $runnerFile "runGoldenScenario" "runGoldenScenario"
Assert-FileContains $runnerFile "runGoldenScenarioSuite" "runGoldenScenarioSuite"
Assert-FileContains $runnerFile "buildScenarioSummaryList" "buildScenarioSummaryList"
Assert-FileContains $runnerFile 'ai_mode: "off"' "ai_mode off par defaut"
Assert-FileContains $runnerFile "runPierreFinalBrain" "Import brain final"
Assert-FileContains $runnerFile "buildPierreHrWorkflowPlan" "Import workflow"
Assert-FileContains $runnerFile "evaluatePierreCloneGuard" "Import cloneguard"
Assert-FileContains $runnerFile "buildEmployeeFile360" "Import employee 360"
Assert-FileContains $runnerFile "renderPierrePremiumDocument" "Import document premium"
Assert-FileNotContains $runnerFile "scheduled_for" "Pas de scheduled_for"

# ── STEP 6 : Module report.ts ─────────────────────────────────
Write-Step 6 "scenarios/report.ts — rapport executif"
$reportFile = "src/lib/pierre/scenarios/report.ts"
Assert-FileExists $reportFile "report.ts"
Assert-FileContains $reportFile "buildGoldenScenarioReport" "buildGoldenScenarioReport"
Assert-FileContains $reportFile "buildQuickReport" "buildQuickReport"
Assert-FileContains $reportFile "buildModuleCoverageReport" "buildModuleCoverageReport"
Assert-FileContains $reportFile "sellable" "Niveau sellable"
Assert-FileContains $reportFile "demo_ready" "Niveau demo_ready"
Assert-FileContains $reportFile "internal_only" "Niveau internal_only"
Assert-FileContains $reportFile "blocked" "Niveau blocked"

# ── STEP 7 : Route scenarios GET ──────────────────────────────
Write-Step 7 "Route GET /api/pierre/use/scenarios"
$routeList = "src/app/api/pierre/use/scenarios/route.ts"
Assert-FileExists $routeList "Route scenarios list"
Assert-FileContains $routeList "export async function GET" "Export GET"
Assert-FileContains $routeList "no_db_writes" "no_db_writes"
Assert-FileContains $routeList "dry_run" "dry_run flag"

# ── STEP 8 : Route scenarios/[scenarioId]/run POST ────────────
Write-Step 8 "Route POST /api/pierre/use/scenarios/[scenarioId]/run"
$routeRun = "src/app/api/pierre/use/scenarios/[scenarioId]/run/route.ts"
Assert-FileExists $routeRun "Route scenario run"
Assert-FileContains $routeRun "export async function POST" "Export POST"
Assert-FileContains $routeRun "runGoldenScenario" "runGoldenScenario appele"
Assert-FileContains $routeRun "isValidGoldenScenarioId" "Validation scenarioId"

# ── STEP 9 : Route run-suite POST ─────────────────────────────
Write-Step 9 "Route POST /api/pierre/use/scenarios/run-suite"
$routeSuite = "src/app/api/pierre/use/scenarios/run-suite/route.ts"
Assert-FileExists $routeSuite "Route run-suite"
Assert-FileContains $routeSuite "export async function POST" "Export POST"
Assert-FileContains $routeSuite "runGoldenScenarioSuite" "runGoldenScenarioSuite appele"
Assert-FileContains $routeSuite "buildGoldenScenarioReport" "buildGoldenScenarioReport"

# ── STEP 10 : Route report GET ────────────────────────────────
Write-Step 10 "Route GET /api/pierre/use/scenarios/report"
$routeReport = "src/app/api/pierre/use/scenarios/report/route.ts"
Assert-FileExists $routeReport "Route report"
Assert-FileContains $routeReport "export async function GET" "Export GET"
Assert-FileContains $routeReport "runGoldenScenarioSuite" "runGoldenScenarioSuite"
Assert-FileContains $routeReport "buildModuleCoverageReport" "buildModuleCoverageReport"

# ── STEP 11 : Mission hint ────────────────────────────────────
Write-Step 11 "golden_scenarios_hint dans mission/[missionId]/route.ts"
$missionRoute = "src/app/api/pierre/use/mission/[missionId]/route.ts"
Assert-FileExists $missionRoute "Route mission"
Assert-FileContains $missionRoute "golden_scenarios_hint" "golden_scenarios_hint present"
Assert-FileContains $missionRoute "getGoldenScenarioRegistry" "Import registry"
Assert-FileContains $missionRoute "dry_run_endpoint" "Endpoint dry_run reference"

# ── STEP 12 : Tests unitaires ─────────────────────────────────
Write-Step 12 "Tests unitaires golden-scenarios.test.ts"
$testFile = "src/lib/pierre/__tests__/golden-scenarios.test.ts"
Assert-FileExists $testFile "golden-scenarios.test.ts"
Assert-FileContains $testFile "runGoldenScenario" "runGoldenScenario test"
Assert-FileContains $testFile "runGoldenScenarioSuite" "runGoldenScenarioSuite test"
Assert-FileContains $testFile "buildGoldenScenarioReport" "buildGoldenScenarioReport test"
Assert-FileContains $testFile "Security invariants" "Tests invariants securite"
Assert-FileContains $testFile "has_email_send" "Test email.send detection"
Assert-FileContains $testFile "has_scheduled_for" "Test scheduled_for detection"

# ── STEP 13 : Tests crossblock ────────────────────────────────
Write-Step 13 "Tests crossblock golden-scenarios-crossblock.test.ts"
$crossFile = "src/lib/pierre/__tests__/golden-scenarios-crossblock.test.ts"
Assert-FileExists $crossFile "golden-scenarios-crossblock.test.ts"
Assert-FileContains $crossFile "Cross-bloc Bloc 26" "Regression Bloc 26 Brain"
Assert-FileContains $crossFile "Cross-bloc Bloc 17" "Regression Bloc 17 Workflows"
Assert-FileContains $crossFile "Cross-bloc Bloc 11" "Regression Bloc 11 Employee 360"
Assert-FileContains $crossFile "Cross-bloc Bloc 28" "Regression Bloc 28 CloneADN"
Assert-FileContains $crossFile "Cross-bloc Bloc 14" "Regression Bloc 14 CloneGuard"

# ── STEP 14 : package.json ────────────────────────────────────
Write-Step 14 "package.json — scripts de test"
$pkgFile = "package.json"
Assert-FileExists $pkgFile "package.json"
Assert-FileContains $pkgFile "golden-scenarios.test.ts" "Test golden-scenarios dans test global"
Assert-FileContains $pkgFile "golden-scenarios-crossblock.test.ts" "Test crossblock dans test global"
Assert-FileContains $pkgFile "test:golden-scenarios" "Script test:golden-scenarios"

# ── STEP 15 : tsc check ───────────────────────────────────────
Write-Step 15 "TypeScript — tsc --noEmit"
try {
    $tscResult = & npx tsc --noEmit 2>&1
    $tscExitCode = $LASTEXITCODE
    if ($tscExitCode -eq 0) {
        Write-OK "tsc --noEmit : 0 erreurs"
    } else {
        $errLines = $tscResult | Select-String "error TS" | Select-Object -First 5
        foreach ($line in $errLines) {
            Write-FAIL "tsc: $line"
        }
        Write-FAIL "tsc --noEmit : erreurs TypeScript detectees"
    }
} catch {
    Write-FAIL "tsc --noEmit a lance une exception : $_"
}

# ── STEP 16 : Test unitaires golden-scenarios ─────────────────
Write-Step 16 "vitest golden-scenarios.test.ts"
try {
    $vitestResult = & npx vitest run src/lib/pierre/__tests__/golden-scenarios.test.ts 2>&1
    $vitestExitCode = $LASTEXITCODE
    if ($vitestExitCode -eq 0) {
        $passLine = $vitestResult | Select-String "passed" | Select-Object -Last 1
        Write-OK "golden-scenarios.test.ts : $passLine"
    } else {
        $failLine = $vitestResult | Select-String "failed" | Select-Object -Last 1
        Write-FAIL "golden-scenarios.test.ts : $failLine"
    }
} catch {
    Write-FAIL "vitest golden-scenarios.test.ts a lance une exception : $_"
}

# ── STEP 17 : Test crossblock ─────────────────────────────────
Write-Step 17 "vitest golden-scenarios-crossblock.test.ts"
try {
    $vitestResult = & npx vitest run src/lib/pierre/__tests__/golden-scenarios-crossblock.test.ts 2>&1
    $vitestExitCode = $LASTEXITCODE
    if ($vitestExitCode -eq 0) {
        $passLine = $vitestResult | Select-String "passed" | Select-Object -Last 1
        Write-OK "golden-scenarios-crossblock.test.ts : $passLine"
    } else {
        $failLine = $vitestResult | Select-String "failed" | Select-Object -Last 1
        Write-FAIL "golden-scenarios-crossblock.test.ts : $failLine"
    }
} catch {
    Write-FAIL "vitest crossblock a lance une exception : $_"
}

# ── STEP 18 : Test suite complete ─────────────────────────────
Write-Step 18 "vitest run — suite complete (npm test)"
try {
    $vitestResult = & npm test 2>&1
    $vitestExitCode = $LASTEXITCODE
    if ($vitestExitCode -eq 0) {
        $passLine = $vitestResult | Select-String "passed" | Select-Object -Last 1
        Write-OK "Suite complete : $passLine"
    } else {
        $failLine = $vitestResult | Select-String "failed" | Select-Object -Last 1
        Write-FAIL "Suite complete echouee : $failLine"
    }
} catch {
    Write-FAIL "npm test a lance une exception : $_"
}

# ── STEP 19 : Invariant — pas de scheduled_for ────────────────
Write-Step 19 "Invariant — aucun scheduled_for dans les modules scenarios"
$scenarioFiles = @(
    "src/lib/pierre/scenarios/runner.ts",
    "src/lib/pierre/scenarios/fixtures.ts",
    "src/lib/pierre/scenarios/golden-registry.ts"
)
$foundScheduledFor = $false
foreach ($f in $scenarioFiles) {
    if (Test-Path $f) {
        $content = Get-Content $f -Raw -Encoding UTF8
        if ($content -match "scheduled_for") {
            Write-FAIL "scheduled_for detecte dans $f"
            $foundScheduledFor = $true
        }
    }
}
if (-not $foundScheduledFor) {
    Write-OK "Aucun scheduled_for dans les modules scenarios"
}

# ── STEP 20 : Invariant — pas d'email.send auto ───────────────
Write-Step 20 "Invariant — email.send jamais auto-execute"
$runnerContent = ""
if (Test-Path $runnerFile) {
    $runnerContent = Get-Content $runnerFile -Raw -Encoding UTF8
}
if ($runnerContent -match '"email\.send"') {
    Write-FAIL "runner.ts contient email.send (interdit en auto-execution)"
} else {
    Write-OK "runner.ts ne produit pas email.send en auto-execution"
}

# ── STEP 21 : Invariant — dry_run dans routes ─────────────────
Write-Step 21 "Invariant — dry_run dans toutes les routes scenarios"
$scenarioRoutes = @(
    "src/app/api/pierre/use/scenarios/route.ts",
    "src/app/api/pierre/use/scenarios/run-suite/route.ts",
    "src/app/api/pierre/use/scenarios/report/route.ts"
)
foreach ($route in $scenarioRoutes) {
    if (Test-Path $route) {
        $content = Get-Content $route -Raw -Encoding UTF8
        if ($content -match "dry_run") {
            Write-OK "$route a dry_run flag"
        } else {
            Write-FAIL "$route manque dry_run flag"
        }
    }
}

# ── STEP 22 : Build next ──────────────────────────────────────
Write-Step 22 "next build"
try {
    $buildResult = & npx next build 2>&1
    $buildExitCode = $LASTEXITCODE
    if ($buildExitCode -eq 0) {
        Write-OK "next build : success"
    } else {
        $errLines = $buildResult | Select-String "Error" | Select-Object -First 5
        foreach ($line in $errLines) {
            Write-FAIL "build: $line"
        }
        Write-FAIL "next build a echoue"
    }
} catch {
    Write-FAIL "next build a lance une exception : $_"
}

# ── RESUME ────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Yellow
Write-Host " RESUME BLOC 29 — GOLDEN SCENARIOS" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host " Steps reussis : $stepsPassed" -ForegroundColor Green
Write-Host " Erreurs totales : $totalErrors" -ForegroundColor $(if ($totalErrors -eq 0) { "Green" } else { "Red" })

if ($totalErrors -eq 0) {
    Write-Host ""
    Write-Host " BLOC 29 VALIDE — Pierre Golden Scenarios operationnel" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host " BLOC 29 ECHEC — $totalErrors erreur(s) a corriger" -ForegroundColor Red
    exit 1
}
