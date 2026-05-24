# scripts/pierre-brain-final-test.ps1
# Pierre Brain Final Core - Script de validation complet
# PowerShell 5 compatible : pas de ?., pas de ??, pas de guillemets typographiques

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AuthToken = "",
  [switch]$SkipApiTests,
  [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# ── Helpers ────────────────────────────────────────────────────────────────────

function Write-Step {
  param([string]$Step, [string]$Msg)
  Write-Host ("[" + $Step + "] " + $Msg) -ForegroundColor Cyan
}

function Write-Pass {
  param([string]$Msg)
  Write-Host ("  PASS: " + $Msg) -ForegroundColor Green
}

function Write-Fail {
  param([string]$Msg)
  Write-Host ("  FAIL: " + $Msg) -ForegroundColor Red
}

function Write-Warn {
  param([string]$Msg)
  Write-Host ("  WARN: " + $Msg) -ForegroundColor Yellow
}

function Write-Info {
  param([string]$Msg)
  Write-Host ("  INFO: " + $Msg) -ForegroundColor Gray
}

$PassCount = 0
$FailCount = 0
$WarnCount = 0

function Assert-True {
  param([bool]$Condition, [string]$Label)
  if ($Condition) {
    $script:PassCount++
    Write-Pass $Label
  } else {
    $script:FailCount++
    Write-Fail $Label
  }
}

function Assert-False {
  param([bool]$Condition, [string]$Label)
  Assert-True (-not $Condition) $Label
}

function Get-JsonResponse {
  param([string]$Method, [string]$Url, [string]$Body, [string]$Token)
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token -ne "") {
    $headers["Authorization"] = "Bearer " + $Token
  }
  try {
    if ($Method -eq "GET") {
      $resp = Invoke-RestMethod -Uri $Url -Method GET -Headers $headers -ErrorAction Stop
    } else {
      $resp = Invoke-RestMethod -Uri $Url -Method POST -Headers $headers -Body $Body -ErrorAction Stop
    }
    return $resp
  } catch {
    return $null
  }
}

# ── Step 1: File existence checks ──────────────────────────────────────────────

Write-Step "01" "Verification des fichiers du bloc 26"

$files = @(
  "src\lib\pierre\brain\types.ts",
  "src\lib\pierre\brain\schema.ts",
  "src\lib\pierre\brain\final-brain.ts",
  "src\lib\pierre\brain\task-bridge.ts",
  "src\lib\pierre\__tests__\pierre-brain-final.test.ts",
  "src\app\api\pierre\use\brain\final\dry-run\route.ts",
  "src\app\api\pierre\use\brain\contracts\route.ts"
)

foreach ($f in $files) {
  Assert-True (Test-Path $f) ("Fichier existe: " + $f)
}

# ── Step 2: types.ts exports ───────────────────────────────────────────────────

Write-Step "02" "Verification exports types.ts"

$typesContent = Get-Content "src\lib\pierre\brain\types.ts" -Raw -ErrorAction SilentlyContinue
if ($typesContent -ne $null) {
  Assert-True ($typesContent -match "PierreBrainFinalOutput") "PierreBrainFinalOutput type"
  Assert-True ($typesContent -match "PierreBrainInterpretation") "PierreBrainInterpretation type"
  Assert-True ($typesContent -match "PierreBrainRiskReview") "PierreBrainRiskReview type"
  Assert-True ($typesContent -match "PierreBrainTaskPlan") "PierreBrainTaskPlan type"
  Assert-True ($typesContent -match "PierreBrainQualityGate") "PierreBrainQualityGate type"
  Assert-True ($typesContent -match "PierreBrainSource") "PierreBrainSource type"
  Assert-True ($typesContent -match '"ai" \| "hybrid" \| "deterministic"') "PierreBrainSource values"
} else {
  $script:FailCount++
  Write-Fail "types.ts non lisible"
}

# ── Step 3: schema.ts exports ─────────────────────────────────────────────────

Write-Step "03" "Verification schema.ts"

$schemaContent = Get-Content "src\lib\pierre\brain\schema.ts" -Raw -ErrorAction SilentlyContinue
if ($schemaContent -ne $null) {
  Assert-True ($schemaContent -match "normalizePierreBrainInterpretation") "normalizePierreBrainInterpretation export"
  Assert-True ($schemaContent -match "normalizePierreBrainRiskReview") "normalizePierreBrainRiskReview export"
  Assert-True ($schemaContent -match "normalizePierreBrainTaskDraft") "normalizePierreBrainTaskDraft export"
  Assert-True ($schemaContent -match "normalizePierreBrainTaskPlan") "normalizePierreBrainTaskPlan export"
  Assert-True ($schemaContent -match "normalizePierreBrainQualityGate") "normalizePierreBrainQualityGate export"
  Assert-True ($schemaContent -match "buildSafePierreBrainFallback") "buildSafePierreBrainFallback export"
  Assert-True ($schemaContent -match "buildNormalizedPierreBrainOutputJson") "buildNormalizedPierreBrainOutputJson export"
  Assert-True ($schemaContent -match "CRITICAL_SIGNALS") "CRITICAL_SIGNALS array"
  Assert-True ($schemaContent -match "licenciement") "licenciement in CRITICAL_SIGNALS"
  Assert-True ($schemaContent -match "harcelement") "harcelement in CRITICAL_SIGNALS"
  Assert-False ($schemaContent -match "scheduled_for") "Pas de scheduled_for dans schema.ts"
} else {
  $script:FailCount++
  Write-Fail "schema.ts non lisible"
}

# ── Step 4: task-bridge.ts exports ────────────────────────────────────────────

Write-Step "04" "Verification task-bridge.ts"

$bridgeContent = Get-Content "src\lib\pierre\brain\task-bridge.ts" -Raw -ErrorAction SilentlyContinue
if ($bridgeContent -ne $null) {
  Assert-True ($bridgeContent -match "sanitizeBrainTaskType") "sanitizeBrainTaskType export"
  Assert-True ($bridgeContent -match "enforceBrainTaskSafety") "enforceBrainTaskSafety export"
  Assert-True ($bridgeContent -match "convertPierreBrainTaskPlanToTaskDrafts") "convertPierreBrainTaskPlanToTaskDrafts export"
  Assert-True ($bridgeContent -match "mergeDeterministicAndBrainTasks") "mergeDeterministicAndBrainTasks export"
  Assert-True ($bridgeContent -match '"email.send".*"email.draft"') "email.send maps to email.draft"
  Assert-True ($bridgeContent -match "ALWAYS_APPROVAL_TASK_TYPES") "ALWAYS_APPROVAL_TASK_TYPES set"
  Assert-False ($bridgeContent -match "scheduled_for") "Pas de scheduled_for dans task-bridge.ts"
  Assert-True ($bridgeContent -match "execute_at") "execute_at present dans task-bridge.ts"
} else {
  $script:FailCount++
  Write-Fail "task-bridge.ts non lisible"
}

# ── Step 5: final-brain.ts exports ────────────────────────────────────────────

Write-Step "05" "Verification final-brain.ts"

$brainContent = Get-Content "src\lib\pierre\brain\final-brain.ts" -Raw -ErrorAction SilentlyContinue
if ($brainContent -ne $null) {
  Assert-True ($brainContent -match "export async function runPierreFinalBrain") "runPierreFinalBrain export"
  Assert-True ($brainContent -match "runPierreBrainInterpretationOnly") "runPierreBrainInterpretationOnly export"
  Assert-True ($brainContent -match "runPierreBrainQualityGate") "runPierreBrainQualityGate export"
  Assert-True ($brainContent -match "buildSafePierreBrainFallback") "fallback utilise dans final-brain"
  Assert-True ($brainContent -match '"off"') "mode off gere"
  Assert-True ($brainContent -match '"assist"') "mode assist gere"
  Assert-True ($brainContent -match '"primary"') "mode primary gere"
  Assert-True ($brainContent -match "pierre.brain.final_interpret") "use case interpret"
  Assert-True ($brainContent -match "pierre.brain.risk_review") "use case risk_review"
  Assert-True ($brainContent -match "pierre.brain.task_plan") "use case task_plan"
  Assert-True ($brainContent -match "pierre.brain.quality_gate") "use case quality_gate"
} else {
  $script:FailCount++
  Write-Fail "final-brain.ts non lisible"
}

# ── Step 6: submit/route.ts integration ───────────────────────────────────────

Write-Step "06" "Verification integration submit/route.ts"

$submitContent = Get-Content "src\app\api\pierre\use\submit\route.ts" -Raw -ErrorAction SilentlyContinue
if ($submitContent -ne $null) {
  Assert-True ($submitContent -match "runPierreFinalBrain") "runPierreFinalBrain dans submit"
  Assert-True ($submitContent -match "convertPierreBrainTaskPlanToTaskDrafts") "convertPierreBrainTaskPlanToTaskDrafts dans submit"
  Assert-True ($submitContent -match "brain_final") "brain_final dans brain_output_json"
  Assert-True ($submitContent -match "brain_runtime") "brain_runtime dans context_snapshot_json"
  Assert-True ($submitContent -match "brain_mode") "brain_mode stocke"
  Assert-True ($submitContent -match "resolveAiMode") "resolveAiMode helper"
  Assert-True ($submitContent -match "insertBrainTasks") "insertBrainTasks helper"
  Assert-True ($submitContent -match '"primary"') "mode primary gere dans submit"
  Assert-False ($submitContent -match "interpretPierreMissionWithAI") "Pas d appel interpretPierreMissionWithAI (remplace par brain)"
} else {
  $script:FailCount++
  Write-Fail "submit/route.ts non lisible"
}

# ── Step 7: mission/[missionId]/route.ts ──────────────────────────────────────

Write-Step "07" "Verification mission/[missionId]/route.ts"

$missionContent = Get-Content "src\app\api\pierre\use\mission\[missionId]\route.ts" -Raw -ErrorAction SilentlyContinue
if ($missionContent -ne $null) {
  Assert-True ($missionContent -match "brain_final_hint") "brain_final_hint dans GET mission"
  Assert-True ($missionContent -match "brain_final") "lecture brain_final depuis brain_output_json"
  Assert-True ($missionContent -match "quality_safe") "quality_safe dans brain_final_hint"
  Assert-True ($missionContent -match "requires_human_validation") "requires_human_validation dans brain_final_hint"
} else {
  $script:FailCount++
  Write-Fail "mission/[missionId]/route.ts non lisible"
}

# ── Step 8: Brain route files ─────────────────────────────────────────────────

Write-Step "08" "Verification routes brain"

$dryRunContent = Get-Content "src\app\api\pierre\use\brain\final\dry-run\route.ts" -Raw -ErrorAction SilentlyContinue
if ($dryRunContent -ne $null) {
  Assert-True ($dryRunContent -match "export async function POST") "POST export dry-run"
  Assert-True ($dryRunContent -match "runPierreFinalBrain") "runPierreFinalBrain dans dry-run"
  Assert-True ($dryRunContent -match "dry_run.*true") "dry_run: true dans reponse"
  Assert-True ($dryRunContent -match "no mission created") "note pas de mission creee"
  Assert-True ($dryRunContent -match "hasPierreAccess") "auth pierre dans dry-run"
} else {
  $script:FailCount++
  Write-Fail "dry-run/route.ts non lisible"
}

$contractsContent = Get-Content "src\app\api\pierre\use\brain\contracts\route.ts" -Raw -ErrorAction SilentlyContinue
if ($contractsContent -ne $null) {
  Assert-True ($contractsContent -match "export async function GET") "GET export contracts"
  Assert-True ($contractsContent -match "pierre.brain.") "filtre use cases brain"
  Assert-True ($contractsContent -match "slice\(0, 200\)") "preview 200 chars seulement"
  Assert-True ($contractsContent -match "hasPierreAccess") "auth pierre dans contracts"
} else {
  $script:FailCount++
  Write-Fail "contracts/route.ts non lisible"
}

# ── Step 9: prompt-registry.ts brain contracts ────────────────────────────────

Write-Step "09" "Verification prompt-registry.ts contrats brain"

$registryContent = Get-Content "src\lib\cloneos\ai\prompt-registry.ts" -Raw -ErrorAction SilentlyContinue
if ($registryContent -ne $null) {
  Assert-True ($registryContent -match "pierre.brain.final_interpret") "contrat final_interpret"
  Assert-True ($registryContent -match "pierre.brain.task_plan") "contrat task_plan"
  Assert-True ($registryContent -match "pierre.brain.risk_review") "contrat risk_review"
  Assert-True ($registryContent -match "pierre.brain.answer") "contrat answer"
  Assert-True ($registryContent -match "pierre.brain.quality_gate") "contrat quality_gate"
  Assert-True ($registryContent -match "pierre.brain.missing_info") "contrat missing_info"
} else {
  $script:FailCount++
  Write-Fail "prompt-registry.ts non lisible"
}

# ── Step 10: model-router.ts brain use cases ──────────────────────────────────

Write-Step "10" "Verification model-router.ts use cases brain"

$routerContent = Get-Content "src\lib\cloneos\ai\model-router.ts" -Raw -ErrorAction SilentlyContinue
if ($routerContent -ne $null) {
  Assert-True ($routerContent -match "pierre.brain.final_interpret.*structured_reasoning") "final_interpret -> structured_reasoning"
  Assert-True ($routerContent -match "pierre.brain.risk_review.*risk_analysis") "risk_review -> risk_analysis"
  Assert-True ($routerContent -match "pierre.brain.answer.*conversation") "answer -> conversation"
  Assert-True ($routerContent -match "pierre.brain.quality_gate.*quality_review") "quality_gate -> quality_review"
  Assert-True ($routerContent -match "pierre.brain.missing_info.*fast_classification") "missing_info -> fast_classification"
} else {
  $script:FailCount++
  Write-Fail "model-router.ts non lisible"
}

# ── Step 11: tsc check ────────────────────────────────────────────────────────

Write-Step "11" "TypeScript compilation check"

$tscResult = & npx tsc --noEmit 2>&1
$tscOk = $LASTEXITCODE -eq 0
Assert-True $tscOk "tsc --noEmit clean (0 erreurs)"
if (-not $tscOk) {
  Write-Warn ("tsc errors: " + ($tscResult -join "`n"))
}

# ── Step 12: Jest tests for brain modules ─────────────────────────────────────

Write-Step "12" "Jest tests pierre-brain-final"

$jestResult = & npx jest "pierre-brain-final" --no-coverage --passWithNoTests 2>&1
$jestOk = $LASTEXITCODE -eq 0
Assert-True $jestOk "Jest pierre-brain-final tests passent"
if ($Verbose -or -not $jestOk) {
  $jestResult | Select-Object -Last 20 | ForEach-Object { Write-Info $_ }
}

# ── Step 13: Jest tests brain/schema ─────────────────────────────────────────

Write-Step "13" "Jest tests targeted brain modules"

$jestBrainResult = & npx jest --testPathPattern="pierre-brain" --no-coverage 2>&1
$jestBrainOk = $LASTEXITCODE -eq 0
Assert-True $jestBrainOk "Tous les tests brain passent"

# Extraire le total de tests
$jestBrainOutput = $jestBrainResult -join "`n"
if ($jestBrainOutput -match "Tests:\s+(\d+) passed") {
  Write-Info ("Tests brain passes: " + $Matches[1])
}

# ── Step 14: Full test suite regression check ────────────────────────────────

Write-Step "14" "Regression : suite complete"

$fullResult = & npx jest --no-coverage 2>&1
$fullOk = $LASTEXITCODE -eq 0
Assert-True $fullOk "Suite complete passe (regression)"

$fullOutput = $fullResult -join "`n"
if ($fullOutput -match "Tests:\s+([\d,]+) passed") {
  Write-Info ("Total tests passes: " + $Matches[1])
}
if ($fullOutput -match "Test Suites:\s+(\d+) passed") {
  Write-Info ("Test suites passes: " + $Matches[1])
}

# ── Step 15: API tests (optional) ────────────────────────────────────────────

if (-not $SkipApiTests -and $AuthToken -ne "") {
  Write-Step "15" "Tests API brain (serveur requis)"

  $dryRunBody = '{"input":"Embaucher un nouveau candidat","ai_mode":"off"}'
  $dryRunResp = Get-JsonResponse -Method "POST" -Url ($BaseUrl + "/api/pierre/use/brain/final/dry-run") -Body $dryRunBody -Token $AuthToken
  if ($dryRunResp -ne $null) {
    Assert-True ($dryRunResp.dry_run -eq $true) "dry_run: true dans reponse"
    Assert-True ($dryRunResp.ok -eq $true) "ok: true dans reponse"
    Assert-True ($dryRunResp.source -ne $null) "source presente"
  } else {
    $script:WarnCount++
    Write-Warn "Dry-run API non joignable (serveur off ?)"
  }

  $contractsResp = Get-JsonResponse -Method "GET" -Url ($BaseUrl + "/api/pierre/use/brain/contracts") -Body "" -Token $AuthToken
  if ($contractsResp -ne $null) {
    Assert-True ($contractsResp.ok -eq $true) "contracts GET ok"
    Assert-True ($contractsResp.count -ge 6) "Au moins 6 contrats brain"
  } else {
    $script:WarnCount++
    Write-Warn "Contracts API non joignable (serveur off ?)"
  }
} else {
  Write-Step "15" "Tests API skipped (pas de token ou -SkipApiTests)"
  $script:WarnCount++
  Write-Warn "Ajouter -AuthToken <jwt> pour tester les routes API"
}

# ── Step 16: docs check ────────────────────────────────────────────────────────

Write-Step "16" "Verification documentation"

$docsContent = Get-Content "docs\PIERRE_HR_ENGINE_FOUNDATION.md" -Raw -ErrorAction SilentlyContinue
if ($docsContent -ne $null) {
  Assert-True ($docsContent -match "Bloc 26") "Bloc 26 dans docs"
  Assert-True ($docsContent -match "Pierre Brain Final Core") "Titre Bloc 26"
  Assert-True ($docsContent -match "task-bridge.ts") "task-bridge.ts mentionne dans docs"
  Assert-True ($docsContent -match "pierre.brain.final_interpret") "contrat final_interpret mentionne"
  Assert-True ($docsContent -match "brain_final_hint") "brain_final_hint mentionne"
} else {
  $script:FailCount++
  Write-Fail "docs/PIERRE_HR_ENGINE_FOUNDATION.md non lisible"
}

# ── Summary ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "   Pierre Brain Final — Resultats" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Write-Host ("PASS: " + $PassCount) -ForegroundColor Green
Write-Host ("FAIL: " + $FailCount) -ForegroundColor Red
Write-Host ("WARN: " + $WarnCount) -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor White

if ($FailCount -eq 0) {
  Write-Host "Bloc 26 VALIDE - Pierre Brain Final Core operationnel." -ForegroundColor Green
  exit 0
} else {
  Write-Host "Bloc 26 ECHOUE - Corriger les erreurs ci-dessus." -ForegroundColor Red
  exit 1
}
