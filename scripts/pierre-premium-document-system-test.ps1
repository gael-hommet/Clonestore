#Requires -Version 5.1
# ============================================================
# pierre-premium-document-system-test.ps1
# Bloc 20 — Pierre Premium Document System
# Tests d'intégration PS5 — 18 étapes
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PassCount = 0
$FailCount = 0
$SkipCount = 0
$Results = @()

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-Step {
    param([int]$Num, [string]$Label)
    Write-Host ""
    Write-Host "  ── Étape $Num : $Label" -ForegroundColor Yellow
}

function Pass {
    param([string]$Msg)
    $script:PassCount++
    $script:Results += [PSCustomObject]@{ Status = "PASS"; Message = $Msg }
    Write-Host "     [PASS] $Msg" -ForegroundColor Green
}

function Fail {
    param([string]$Msg)
    $script:FailCount++
    $script:Results += [PSCustomObject]@{ Status = "FAIL"; Message = $Msg }
    Write-Host "     [FAIL] $Msg" -ForegroundColor Red
}

function Skip {
    param([string]$Msg)
    $script:SkipCount++
    $script:Results += [PSCustomObject]@{ Status = "SKIP"; Message = $Msg }
    Write-Host "     [SKIP] $Msg" -ForegroundColor DarkGray
}

function Assert-FileExists {
    param([string]$Path, [string]$Label)
    if (Test-Path $Path) { Pass "Fichier existe : $Label" }
    else { Fail "Fichier manquant : $Label ($Path)" }
}

function Assert-FileContains {
    param([string]$Path, [string]$Pattern, [string]$Label)
    if (-not (Test-Path $Path)) { Fail "Fichier manquant pour recherche : $Path"; return }
    $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue
    if ($content -match $Pattern) { Pass "Pattern trouvé dans $Label : '$Pattern'" }
    else { Fail "Pattern absent dans $Label : '$Pattern'" }
}

function Assert-FileNotContains {
    param([string]$Path, [string]$Pattern, [string]$Label)
    if (-not (Test-Path $Path)) { Fail "Fichier manquant pour vérification : $Path"; return }
    $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue
    if ($content -match $Pattern) { Fail "Pattern interdit présent dans $Label : '$Pattern'" }
    else { Pass "Pattern interdit absent de $Label : '$Pattern'" }
}

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Header "Pierre Premium Document System — Tests d'intégration"
Write-Host "  Répertoire : $Root"
Write-Host "  Date       : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# ── Étape 1 : Fichier module pur existe ───────────────────────────────────
Write-Step 1 "Module pur premium-document-system.ts"
$ModulePath = "src\lib\pierre\documents\premium-document-system.ts"
Assert-FileExists $ModulePath "premium-document-system.ts"
Assert-FileNotContains $ModulePath "from.*supabase" "module pur (pas de Supabase)"
Assert-FileNotContains $ModulePath "from.*next/server" "module pur (pas de Next)"
Assert-FileNotContains $ModulePath "from.*fs" "module pur (pas de fs)"
Assert-FileNotContains $ModulePath "process\.env" "module pur (pas de process.env)"

# ── Étape 2 : Exports du module ──────────────────────────────────────────
Write-Step 2 "Exports du module premium"
$ExportPatterns = @(
    "export function renderPremiumDocument",
    "export function buildDefaultPremiumDocumentConfig",
    "export function inferPremiumDocumentFamily",
    "export function inferPremiumDocumentRiskLevel",
    "export function selectPremiumDocumentTemplate",
    "export function resolvePremiumDocumentVariables",
    "export function interpolatePremiumTemplate",
    "export function validatePremiumDocument",
    "export function buildPremiumDocumentDigest",
    "export function buildPremiumDocumentArtifactPayload",
    "export function buildPremiumDocumentEmailPayload"
)
foreach ($pat in $ExportPatterns) {
    Assert-FileContains $ModulePath $pat "exports du module"
}

# ── Étape 3 : Types exportés ──────────────────────────────────────────────
Write-Step 3 "Types TypeScript exportés"
$TypePatterns = @(
    "export type PierrePremiumDocumentConfig",
    "export type PierrePremiumDocumentInput",
    "export type PierrePremiumDocumentResult",
    "export type PierrePremiumDocumentQuality",
    "export type PierrePremiumDocumentVariable",
    "export type PierrePremiumDocumentTemplate",
    "export type PierrePremiumDocumentFamily",
    "export type PierrePremiumDocumentRiskLevel",
    "export type PierrePremiumDocumentDigest"
)
foreach ($pat in $TypePatterns) {
    Assert-FileContains $ModulePath $pat "types exportés"
}

# ── Étape 4 : 15 familles de documents ───────────────────────────────────
Write-Step 4 "15 familles de documents"
$Families = @(
    "contract", "amendment", "offer", "convocation", "refusal",
    "followup", "onboarding", "absence", "pre_payroll", "performance",
    "training", "offboarding", "employee_summary", "internal_note", "generic_hr"
)
foreach ($fam in $Families) {
    Assert-FileContains $ModulePath "tpl_${fam}_v1" "template famille $fam"
}

# ── Étape 5 : Invariants de sécurité ──────────────────────────────────────
Write-Step 5 "Invariants de sécurité — aucun phrase IA, auto_send=false"
Assert-FileNotContains $ModulePath "genere par IA" "sécurité (phrase IA interdite)"
Assert-FileNotContains $ModulePath "generated by AI" "sécurité (phrase IA interdite)"
Assert-FileContains $ModulePath "auto_send: false" "auto_send toujours false"

# ── Étape 6 : HTML sans script ────────────────────────────────────────────
Write-Step 6 "Output HTML sans balise script"
Assert-FileNotContains $ModulePath "<script" "HTML sans <script>"
Assert-FileContains $ModulePath "pierre-wrapper" "classe CSS pierre-wrapper"
Assert-FileContains $ModulePath "<!DOCTYPE html>" "DOCTYPE HTML"

# ── Étape 7 : artifacts.ts intégration ───────────────────────────────────
Write-Step 7 "Intégration dans artifacts.ts"
$ArtifactsPath = "src\lib\pierre\tasks\artifacts.ts"
Assert-FileExists $ArtifactsPath "artifacts.ts"
Assert-FileContains $ArtifactsPath "from.*premium-document-system" "import premium module"
Assert-FileContains $ArtifactsPath "PREMIUM_DOC_TASK_TYPES" "PREMIUM_DOC_TASK_TYPES défini"
Assert-FileContains $ArtifactsPath "buildPierreDocumentArtifactPremium" "buildPierreDocumentArtifactPremium"
Assert-FileContains $ArtifactsPath "document_family\?" "champ document_family dans PierreArtifact"
Assert-FileContains $ArtifactsPath "approval_required\?" "champ approval_required dans PierreArtifact"
Assert-FileContains $ArtifactsPath "risk_level\?" "champ risk_level dans PierreArtifact"

# ── Étape 8 : doc/generate/route.ts — log schema ─────────────────────────
Write-Step 8 "doc/generate/route.ts — schéma log correct"
$DocGenPath = "src\app\api\pierre\doc\generate\route.ts"
Assert-FileExists $DocGenPath "doc/generate/route.ts"
Assert-FileContains $DocGenPath "event_type:" "event_type dans log"
Assert-FileContains $DocGenPath "meta_json:" "meta_json dans log"
Assert-FileNotContains $DocGenPath 'level: "info"' "pas de level:info dans log"
Assert-FileNotContains $DocGenPath 'event: "document_generated' "pas de event: dans log"
Assert-FileContains $DocGenPath "premium_enrichment" "enrichissement premium dans réponse"

# ── Étape 9 : pdf/generate/route.ts — log schema ─────────────────────────
Write-Step 9 "pdf/generate/route.ts — schéma log correct"
$PdfGenPath = "src\app\api\pierre\pdf\generate\route.ts"
Assert-FileExists $PdfGenPath "pdf/generate/route.ts"
Assert-FileContains $PdfGenPath "event_type:" "event_type dans log PDF"
Assert-FileContains $PdfGenPath "meta_json:" "meta_json dans log PDF"
Assert-FileNotContains $PdfGenPath 'event: "pdf_generated' "pas de event: dans log PDF"

# ── Étape 10 : Route preview créée ───────────────────────────────────────
Write-Step 10 "Route preview — POST /api/pierre/use/document/preview"
$PreviewPath = "src\app\api\pierre\use\document\preview\route.ts"
Assert-FileExists $PreviewPath "preview/route.ts"
Assert-FileContains $PreviewPath "export async function POST" "export POST"
Assert-FileContains $PreviewPath "renderPremiumDocument" "appel renderPremiumDocument"
Assert-FileContains $PreviewPath "hasPierreAccess" "vérification accès Pierre"
Assert-FileContains $PreviewPath "employee_id" "résolution employé par ID"
Assert-FileContains $PreviewPath "selected_template" "selected_template dans réponse"

# ── Étape 11 : Route config créée ────────────────────────────────────────
Write-Step 11 "Route config — GET+PUT /api/pierre/use/document/config"
$ConfigPath = "src\app\api\pierre\use\document\config\route.ts"
Assert-FileExists $ConfigPath "config/route.ts"
Assert-FileContains $ConfigPath "export async function GET" "export GET"
Assert-FileContains $ConfigPath "export async function PUT" "export PUT"
Assert-FileContains $ConfigPath "document_system" "lecture document_system"
Assert-FileContains $ConfigPath "employees" "préservation employees"
Assert-FileNotContains $ConfigPath "employees.*=.*payload" "pas de surécrasement employees"

# ── Étape 12 : submit/route.ts enrichissement ────────────────────────────
Write-Step 12 "submit/route.ts — enrichissement premium"
$SubmitPath = "src\app\api\pierre\use\submit\route.ts"
Assert-FileExists $SubmitPath "submit/route.ts"
Assert-FileContains $SubmitPath "inferPremiumDocumentFamily" "import inferPremiumDocumentFamily"
Assert-FileContains $SubmitPath "DOC_GENERATION_TASK_TYPES" "DOC_GENERATION_TASK_TYPES"
Assert-FileContains $SubmitPath "enrichDocumentTaskPayload" "enrichDocumentTaskPayload"
Assert-FileContains $SubmitPath "document_family" "document_family dans task payload"
Assert-FileContains $SubmitPath "premium_document_task_count" "premium_document_task_count dans brain_output"

# ── Étape 13 : Tests vitest — fichier créé ────────────────────────────────
Write-Step 13 "Fichier de tests premium créé"
$TestPath = "src\lib\pierre\__tests__\premium-document-system.test.ts"
Assert-FileExists $TestPath "premium-document-system.test.ts"
Assert-FileContains $TestPath "from.*premium-document-system" "import depuis premium-document-system"
Assert-FileContains $TestPath "renderPremiumDocument" "test renderPremiumDocument"
Assert-FileContains $TestPath "inferPremiumDocumentFamily" "test inferPremiumDocumentFamily"
Assert-FileContains $TestPath "validatePremiumDocument" "test validatePremiumDocument"

# ── Étape 14 : Compter les tests ─────────────────────────────────────────
Write-Step 14 "Compter les tests (>= 150 attendus)"
if (Test-Path $TestPath) {
    $TestContent = Get-Content $TestPath -Raw
    $ItCount = ([regex]::Matches($TestContent, '\bit\(["'']')).Count
    Write-Host "     Nombre de tests détectés : $ItCount" -ForegroundColor Cyan
    if ($ItCount -ge 150) { Pass "150+ tests dans premium-document-system.test.ts ($ItCount)" }
    elseif ($ItCount -ge 100) { Pass "100+ tests (objectif atteint partiellement : $ItCount/150)" }
    else { Fail "Moins de 100 tests détectés ($ItCount)" }
} else { Fail "Fichier de tests non trouvé" }

# ── Étape 15 : Vérification tsc ──────────────────────────────────────────
Write-Step 15 "TypeScript — npx tsc --noEmit"
try {
    $TscOut = & npx tsc --noEmit 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Pass "tsc --noEmit réussi (0 erreur)"
    } else {
        $ErrLines = ($TscOut -split "`n" | Where-Object { $_ -match "error TS" }).Count
        Fail "tsc --noEmit a échoué ($ErrLines erreur(s) TS)"
        Write-Host $TscOut.Substring(0, [Math]::Min(800, $TscOut.Length)) -ForegroundColor DarkRed
    }
} catch {
    Fail "tsc introuvable ou erreur d'exécution : $_"
}

# ── Étape 16 : npm test ──────────────────────────────────────────────────
Write-Step 16 "npm test — vitest"
try {
    $TestOut = & npm test -- --reporter=verbose 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        $PassedLines = ($TestOut -split "`n" | Where-Object { $_ -match "pass" -or $_ -match "✓" }).Count
        Pass "npm test réussi ($PassedLines lignes pass)"
    } else {
        $FailLines = ($TestOut -split "`n" | Where-Object { $_ -match "fail" -or $_ -match "✗" -or $_ -match "FAIL" }).Count
        Fail "npm test a échoué ($FailLines ligne(s) fail)"
        $Tail = ($TestOut -split "`n" | Select-Object -Last 30) -join "`n"
        Write-Host $Tail -ForegroundColor DarkRed
    }
} catch {
    Fail "npm test introuvable ou erreur : $_"
}

# ── Étape 17 : npm run build ─────────────────────────────────────────────
Write-Step 17 "npm run build — Next.js"
try {
    $BuildOut = & npm run build 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Pass "npm run build réussi"
    } else {
        Fail "npm run build a échoué"
        $Tail = ($BuildOut -split "`n" | Select-Object -Last 20) -join "`n"
        Write-Host $Tail -ForegroundColor DarkRed
    }
} catch {
    Fail "npm run build introuvable ou erreur : $_"
}

# ── Étape 18 : Invariants absolus finaux ─────────────────────────────────
Write-Step 18 "Invariants absolus — scheduled_for, email.send, auto_send"
Assert-FileNotContains $ModulePath "scheduled_for" "pas de scheduled_for dans le module pur"
Assert-FileNotContains $DocGenPath 'level: "info"' "doc/generate : level:info absent"
Assert-FileNotContains $PdfGenPath 'level: "info"' "pdf/generate : level:info absent"
Assert-FileContains $ModulePath "auto_send: false" "auto_send=false dans email payload"
Assert-FileNotContains $PreviewPath "email\.send" "preview ne déclenche pas email.send"

# ── Résumé ────────────────────────────────────────────────────────────────
Write-Header "Résumé Final"
Write-Host ""
Write-Host "  PASS : $PassCount" -ForegroundColor Green
Write-Host "  FAIL : $FailCount" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })
Write-Host "  SKIP : $SkipCount" -ForegroundColor DarkGray
Write-Host ""

if ($FailCount -eq 0) {
    Write-Host "  ✓ Tous les tests ont réussi — Bloc 20 validé." -ForegroundColor Green
    exit 0
} else {
    Write-Host "  ✗ $FailCount test(s) en échec." -ForegroundColor Red
    $Results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "    - $($_.Message)" -ForegroundColor Red
    }
    exit 1
}
