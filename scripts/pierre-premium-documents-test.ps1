# scripts/pierre-premium-documents-test.ps1
# Bloc 27 - Pierre Premium Documents & Enterprise Template System
# PowerShell 5 compatible: no ?., no ??, no null-coalescing
# Usage: .\scripts\pierre-premium-documents-test.ps1

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0
$errors = @()

function Write-Step {
    param([int]$Step, [string]$Label)
    Write-Host ""
    Write-Host "=== STEP $Step : $Label ===" -ForegroundColor Cyan
}

function Pass {
    param([string]$Msg)
    Write-Host "  [PASS] $Msg" -ForegroundColor Green
    $script:passed++
}

function Fail {
    param([string]$Msg)
    Write-Host "  [FAIL] $Msg" -ForegroundColor Red
    $script:failed++
    $script:errors += $Msg
}

function Assert-FileExists {
    param([string]$Path, [string]$Label)
    if (Test-Path $Path) {
        Pass $Label
    } else {
        Fail "$Label : file not found at $Path"
    }
}

function Assert-FileContains {
    param([string]$Path, [string]$Pattern, [string]$Label)
    if (-not (Test-Path $Path)) {
        Fail "$Label : file not found at $Path"
        return
    }
    $content = Get-Content $Path -Raw
    if ($content -match [regex]::Escape($Pattern)) {
        Pass $Label
    } elseif ($content -match $Pattern) {
        Pass $Label
    } else {
        Fail "$Label : pattern not found in $Path"
    }
}

function Assert-FileNotContains {
    param([string]$Path, [string]$Pattern, [string]$Label)
    if (-not (Test-Path $Path)) {
        Fail "$Label : file not found at $Path"
        return
    }
    $content = Get-Content $Path -Raw
    if ($content -notmatch $Pattern) {
        Pass $Label
    } else {
        Fail "$Label : forbidden pattern found in $Path"
    }
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# ── STEP 1 : Core document engine files exist ─────────────────────────────────
Write-Step 1 "Core document engine files"
Assert-FileExists "$root\src\lib\clonestore\documents\types.ts" "types.ts exists"
Assert-FileExists "$root\src\lib\clonestore\documents\utils.ts" "utils.ts exists"
Assert-FileExists "$root\src\lib\clonestore\documents\template-registry.ts" "template-registry.ts exists"
Assert-FileExists "$root\src\lib\clonestore\documents\renderer.ts" "renderer.ts exists"
Assert-FileExists "$root\src\lib\clonestore\documents\company-templates.ts" "company-templates.ts exists"

# ── STEP 2 : Types file content ───────────────────────────────────────────────
Write-Step 2 "Types file content"
Assert-FileContains "$root\src\lib\clonestore\documents\types.ts" "CloneDocumentRiskLevel" "CloneDocumentRiskLevel defined"
Assert-FileContains "$root\src\lib\clonestore\documents\types.ts" "CloneDocumentTemplate" "CloneDocumentTemplate defined"
Assert-FileContains "$root\src\lib\clonestore\documents\types.ts" "CloneDocumentRenderResult" "CloneDocumentRenderResult defined"
Assert-FileContains "$root\src\lib\clonestore\documents\types.ts" "CloneDocumentBlockType" "CloneDocumentBlockType defined"
Assert-FileContains "$root\src\lib\clonestore\documents\types.ts" "human_only" "human_only validation mode defined"
Assert-FileContains "$root\src\lib\clonestore\documents\types.ts" "critical" "critical risk level defined"

# ── STEP 3 : Utils file content ───────────────────────────────────────────────
Write-Step 3 "Utils file content"
Assert-FileContains "$root\src\lib\clonestore\documents\utils.ts" "escapeHtml" "escapeHtml exported"
Assert-FileContains "$root\src\lib\clonestore\documents\utils.ts" "renderDocumentVariables" "renderDocumentVariables exported"
Assert-FileContains "$root\src\lib\clonestore\documents\utils.ts" "extractDocumentVariableKeys" "extractDocumentVariableKeys exported"
Assert-FileContains "$root\src\lib\clonestore\documents\utils.ts" "requiresHumanValidationForDocument" "requiresHumanValidationForDocument exported"
Assert-FileContains "$root\src\lib\clonestore\documents\utils.ts" "getHighestDocumentRiskLevel" "getHighestDocumentRiskLevel exported"
Assert-FileContains "$root\src\lib\clonestore\documents\utils.ts" "mergeDocumentVariables" "mergeDocumentVariables exported"

# ── STEP 4 : Template registry — 12 templates ────────────────────────────────
Write-Step 4 "Template registry — 12 default templates"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_hr_contract_draft_v1" "hr_contract_draft template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_hr_amendment_draft_v1" "hr_amendment_draft template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_candidate_rejection_v1" "candidate_rejection template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_interview_invitation_v1" "interview_invitation template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_onboarding_plan_v1" "onboarding_plan template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_absence_followup_v1" "absence_followup template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_prepay_summary_v1" "prepay_summary template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_employee_file_summary_v1" "employee_file_summary template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_sensitive_case_note_v1" "sensitive_case_note template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_offboarding_checklist_v1" "offboarding_checklist template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_hr_weekly_briefing_v1" "hr_weekly_briefing template"
Assert-FileContains "$root\src\lib\clonestore\documents\template-registry.ts" "pierre_manager_notification_v1" "manager_notification template"

# ── STEP 5 : Renderer exports ─────────────────────────────────────────────────
Write-Step 5 "Renderer exports"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "renderCloneDocument" "renderCloneDocument exported"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "validateCloneDocumentTemplate" "validateCloneDocumentTemplate exported"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "renderCloneDocumentToText" "renderCloneDocumentToText exported"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "renderCloneDocumentToMarkdown" "renderCloneDocumentToMarkdown exported"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "renderCloneDocumentToHtml" "renderCloneDocumentToHtml exported"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "renderCloneDocumentToPdfReadyHtml" "renderCloneDocumentToPdfReadyHtml exported"

# ── STEP 6 : Company templates safety constraints ─────────────────────────────
Write-Step 6 "Company templates safety constraints"
Assert-FileContains "$root\src\lib\clonestore\documents\company-templates.ts" "document_templates" "stores in document_templates key"
Assert-FileContains "$root\src\lib\clonestore\documents\company-templates.ts" "employees" "employees key preserved"
Assert-FileContains "$root\src\lib\clonestore\documents\company-templates.ts" "sanitizeCompanyDocumentTemplate" "sanitizeCompanyDocumentTemplate exported"
Assert-FileContains "$root\src\lib\clonestore\documents\company-templates.ts" "buildCompanyTemplateStoragePatch" "buildCompanyTemplateStoragePatch exported"
Assert-FileNotContains "$root\src\lib\clonestore\documents\company-templates.ts" "memory_json" "never touches memory_json"
Assert-FileNotContains "$root\src\lib\clonestore\documents\company-templates.ts" "send_email" "never sends email"
Assert-FileNotContains "$root\src\lib\clonestore\documents\company-templates.ts" "email.send" "never triggers email.send"

# ── STEP 7 : Pierre adapter in premium-document-system.ts ────────────────────
Write-Step 7 "Pierre adapter (Bloc 27) in premium-document-system.ts"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "PierrePremiumDocumentKind" "PierrePremiumDocumentKind defined"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "normalizePierrePremiumDocumentKind" "normalizePierrePremiumDocumentKind exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "buildPierreDocumentVariables" "buildPierreDocumentVariables exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "renderPierrePremiumDocument" "renderPierrePremiumDocument exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "buildPierrePremiumDocumentQualitySummary" "buildPierrePremiumDocumentQualitySummary exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "selectPierreDocumentTemplate" "selectPierreDocumentTemplate exported"

# ── STEP 8 : Bloc 27 adapter does NOT break existing exports ──────────────────
Write-Step 8 "Existing exports preserved in premium-document-system.ts"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "renderPremiumDocument" "renderPremiumDocument still exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "inferPremiumDocumentFamily" "inferPremiumDocumentFamily still exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "buildDefaultPremiumDocumentConfig" "buildDefaultPremiumDocumentConfig still exported"
Assert-FileContains "$root\src\lib\pierre\documents\premium-document-system.ts" "buildPremiumDocumentEmailPayload" "buildPremiumDocumentEmailPayload still exported"

# ── STEP 9 : Artifacts.ts Bloc 27 integration ────────────────────────────────
Write-Step 9 "artifacts.ts Bloc 27 integration"
Assert-FileContains "$root\src\lib\pierre\tasks\artifacts.ts" "normalizePierrePremiumDocumentKind" "Bloc 27 kind normalization used"
Assert-FileContains "$root\src\lib\pierre\tasks\artifacts.ts" "renderPierrePremiumDocument" "Bloc 27 renderer used"
Assert-FileContains "$root\src\lib\pierre\tasks\artifacts.ts" "document_kind" "document_kind payload key handled"
Assert-FileContains "$root\src\lib\pierre\tasks\artifacts.ts" "premium_document" "premium_document payload key handled"
Assert-FileContains "$root\src\lib\pierre\tasks\artifacts.ts" "bloc27" "bloc27 tag added"

# ── STEP 10 : API routes exist ────────────────────────────────────────────────
Write-Step 10 "API routes created"
Assert-FileExists "$root\src\app\api\pierre\use\document-templates\route.ts" "list/create route exists"
Assert-FileExists "$root\src\app\api\pierre\use\document-templates\[templateId]\route.ts" "get/put/patch/delete route exists"
Assert-FileExists "$root\src\app\api\pierre\use\document-templates\preview\route.ts" "preview route exists"

# ── STEP 11 : API route safety constraints ────────────────────────────────────
Write-Step 11 "API route safety constraints"
Assert-FileNotContains "$root\src\app\api\pierre\use\document-templates\preview\route.ts" "email.send" "preview never sends email"
Assert-FileNotContains "$root\src\app\api\pierre\use\document-templates\preview\route.ts" ".insert(" "preview never writes to DB"
Assert-FileNotContains "$root\src\app\api\pierre\use\document-templates\preview\route.ts" "pierre_missions" "preview never creates mission"
Assert-FileNotContains "$root\src\app\api\pierre\use\document-templates\preview\route.ts" "pierre_task_logs" "preview never writes task logs"
Assert-FileContains "$root\src\app\api\pierre\use\document-templates\[templateId]\route.ts" "PLATFORM_TEMPLATE_IMMUTABLE" "platform templates cannot be deleted"
Assert-FileContains "$root\src\app\api\pierre\use\document-templates\route.ts" "reusable_rh_context_json" "stores in correct location"

# ── STEP 12 : Submit route enrichment ────────────────────────────────────────
Write-Step 12 "submit/route.ts document_template_capability enrichment"
Assert-FileContains "$root\src\app\api\pierre\use\submit\route.ts" "document_template_capability" "document_template_capability in context_snapshot_json"
Assert-FileContains "$root\src\app\api\pierre\use\submit\route.ts" "buildCloneDocumentTemplateIndex" "buildCloneDocumentTemplateIndex imported"

# ── STEP 13 : Critical invariants ─────────────────────────────────────────────
Write-Step 13 "Critical invariants"
Assert-FileNotContains "$root\src\lib\clonestore\documents\renderer.ts" "scheduled_for" "renderer never uses scheduled_for column"
Assert-FileNotContains "$root\src\lib\clonestore\documents\renderer.ts" "process.env" "renderer never reads env secrets"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "try {" "renderer uses try/catch (no throw)"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "requires_human_validation" "requires_human_validation in render result"
Assert-FileContains "$root\src\lib\clonestore\documents\renderer.ts" "quality_score" "quality_score in render result"

# ── STEP 14 : Test files exist ────────────────────────────────────────────────
Write-Step 14 "Test files created"
Assert-FileExists "$root\src\lib\clonestore\documents\__tests__\premium-documents.test.ts" "premium-documents.test.ts exists"
Assert-FileExists "$root\src\lib\pierre\__tests__\premium-artifacts.test.ts" "premium-artifacts.test.ts exists"

# ── STEP 15 : TypeScript check ────────────────────────────────────────────────
Write-Step 15 "TypeScript compilation check"
Write-Host "  Running: npx tsc --noEmit" -ForegroundColor Gray
$tscOutput = & npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "tsc --noEmit: 0 errors"
} else {
    $errorLines = $tscOutput | Where-Object { $_ -match "error TS" }
    $count = if ($errorLines) { ($errorLines | Measure-Object).Count } else { 1 }
    Fail "tsc --noEmit: $count type error(s) found"
    if ($tscOutput) {
        Write-Host "  Output:" -ForegroundColor Yellow
        $tscOutput | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    }
}

# ── STEP 16 : Run premium-documents tests ────────────────────────────────────
Write-Step 16 "Run premium-documents.test.ts"
Write-Host "  Running: npx vitest run premium-documents.test.ts" -ForegroundColor Gray
$vitestOutput = & npx vitest run "src/lib/clonestore/documents/__tests__/premium-documents.test.ts" 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "premium-documents tests: all passed"
} else {
    Fail "premium-documents tests: some failed"
    if ($vitestOutput) {
        $vitestOutput | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    }
}

# ── STEP 17 : Run premium-artifacts regression tests ─────────────────────────
Write-Step 17 "Run premium-artifacts.test.ts"
Write-Host "  Running: npx vitest run premium-artifacts.test.ts" -ForegroundColor Gray
$artifactsOutput = & npx vitest run "src/lib/pierre/__tests__/premium-artifacts.test.ts" 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "premium-artifacts tests: all passed"
} else {
    Fail "premium-artifacts tests: some failed"
    if ($artifactsOutput) {
        $artifactsOutput | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    }
}

# ── STEP 18 : Run full test suite ─────────────────────────────────────────────
Write-Step 18 "Full test suite (npm test)"
Write-Host "  Running: npm test" -ForegroundColor Gray
$npmTestOutput = & npm test 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "npm test: all passed"
} else {
    Fail "npm test: some tests failed"
    if ($npmTestOutput) {
        $npmTestOutput | Select-Object -Last 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    }
}

# ── SUMMARY ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " BLOC 27 — RESULTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Passed : $passed" -ForegroundColor Green
Write-Host " Failed : $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host " Failed checks:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "   - $e" -ForegroundColor Red
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host " Bloc 27 validation COMPLETE" -ForegroundColor Green
    exit 0
} else {
    Write-Host " Bloc 27 validation INCOMPLETE - fix the above issues" -ForegroundColor Red
    exit 1
}
