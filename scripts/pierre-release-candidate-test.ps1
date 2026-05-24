# scripts/pierre-release-candidate-test.ps1
# Pierre Release Candidate — Validation Script — Bloc 30
# PS5 compatible: no ?., no ??, no typographic quotes, no ternary operator
# Usage: pwsh -File scripts/pierre-release-candidate-test.ps1

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

function Assert-FileNotMatchPattern {
    param([string]$path, [string]$pattern, [string]$label)
    if (-not (Test-Path $path)) {
        Write-FAIL "$label — fichier introuvable : $path"
        return
    }
    $content = Get-Content $path -Raw -Encoding UTF8
    if (-not ($content -match $pattern)) {
        Write-OK "$label — pattern interdit absent"
    } else {
        Write-FAIL "$label — pattern interdit detecte dans $path : $pattern"
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host " PIERRE RELEASE CANDIDATE — BLOC 30" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

# ── STEP 1 : Fichiers types RC ────────────────────────────────
Write-Step 1 "release-candidate/types.ts — types RC purs"
$rcTypesFile = "src/lib/pierre/release-candidate/types.ts"
Assert-FileExists $rcTypesFile "types.ts RC"
Assert-FileContains $rcTypesFile "PierreReleaseCandidateStatus" "PierreReleaseCandidateStatus"
Assert-FileContains $rcTypesFile "PierreReleaseCandidateSeverity" "PierreReleaseCandidateSeverity"
Assert-FileContains $rcTypesFile "PierreReleaseCandidateArea" "PierreReleaseCandidateArea"
Assert-FileContains $rcTypesFile "PierreReleaseCandidateCheck" "PierreReleaseCandidateCheck"
Assert-FileContains $rcTypesFile "PierreReleaseCandidateReport" "PierreReleaseCandidateReport"
Assert-FileContains $rcTypesFile "can_start_cockpit" "can_start_cockpit"
Assert-FileContains $rcTypesFile '"ready"' "Status ready"
Assert-FileContains $rcTypesFile '"almost_ready"' "Status almost_ready"
Assert-FileContains $rcTypesFile '"blocked"' "Status blocked"

# ── STEP 2 : Module checks.ts ─────────────────────────────────
Write-Step 2 "release-candidate/checks.ts — moteur scoring"
$rcChecksFile = "src/lib/pierre/release-candidate/checks.ts"
Assert-FileExists $rcChecksFile "checks.ts"
Assert-FileContains $rcChecksFile "buildRCCheck" "buildRCCheck"
Assert-FileContains $rcChecksFile "buildRCWarning" "buildRCWarning"
Assert-FileContains $rcChecksFile "buildRCFail" "buildRCFail"
Assert-FileContains $rcChecksFile "scoreRCChecks" "scoreRCChecks"
Assert-FileContains $rcChecksFile "summarizeRCModules" "summarizeRCModules"
Assert-FileContains $rcChecksFile "classifyRCStatus" "classifyRCStatus"
Assert-FileContains $rcChecksFile "buildPierreReleaseCandidateReport" "buildPierreReleaseCandidateReport"
Assert-FileContains $rcChecksFile "can_start_cockpit" "can_start_cockpit dans rapport"

# ── STEP 3 : Module invariant-auditor.ts ──────────────────────
Write-Step 3 "release-candidate/invariant-auditor.ts — invariants globaux"
$auditorFile = "src/lib/pierre/release-candidate/invariant-auditor.ts"
Assert-FileExists $auditorFile "invariant-auditor.ts"
Assert-FileContains $auditorFile "auditPierreTaskSafety" "auditPierreTaskSafety"
Assert-FileContains $auditorFile "auditPierreLogSchema" "auditPierreLogSchema"
Assert-FileContains $auditorFile "auditPierreStorageShape" "auditPierreStorageShape"
Assert-FileContains $auditorFile "auditPierreDocumentsSafety" "auditPierreDocumentsSafety"
Assert-FileContains $auditorFile "auditPierreAIRuntimeShape" "auditPierreAIRuntimeShape"
Assert-FileContains $auditorFile "auditPierreGoldenScenarioSuiteShape" "auditPierreGoldenScenarioSuiteShape"
Assert-FileContains $auditorFile "auditPierreGlobalInvariants" "auditPierreGlobalInvariants"
Assert-FileContains $auditorFile "scheduled_for" "Detection scheduled_for"
Assert-FileContains $auditorFile "email.send" "Detection email.send"
Assert-FileContains $auditorFile "event_type" "Schema event_type requis"

# ── STEP 4 : Invariant — scheduled_for interdit dans auditor ──
Write-Step 4 "Invariant — scheduled_for detecte comme FAIL dans auditor"
$auditorContent = Get-Content $auditorFile -Raw -Encoding UTF8
if ($auditorContent -match "scheduled_for" -and $auditorContent -match '"fail"') {
    Write-OK "auditor detecte scheduled_for comme fail"
} else {
    Write-FAIL "auditor doit detecter scheduled_for comme fail"
}

# ── STEP 5 : Invariant — email.send interdit dans auditor ─────
Write-Step 5 "Invariant — email.send/send_email detecte comme FAIL"
if ($auditorContent -match "email\.send" -and $auditorContent -match "send_email") {
    Write-OK "Deux formes email.send + send_email detectees"
} else {
    Write-FAIL "Les deux formes email.send ET send_email doivent etre detectees"
}

# ── STEP 6 : Invariant — schema log legacy detectable ─────────
Write-Step 6 "Invariant — champs log legacy (level/event/payload) detectes"
if (($auditorContent -match '"level"') -and ($auditorContent -match '"event"') -and ($auditorContent -match '"payload"')) {
    Write-OK "Champs log legacy level/event/payload detectes dans auditor"
} else {
    Write-FAIL "Auditor doit detecter les champs level, event et payload comme legacy"
}

# ── STEP 7 : Module preflight.ts ──────────────────────────────
Write-Step 7 "release-candidate/preflight.ts — checklist statique + async"
$preflightFile = "src/lib/pierre/release-candidate/preflight.ts"
Assert-FileExists $preflightFile "preflight.ts"
Assert-FileContains $preflightFile "buildPierreReleaseCandidateStaticChecklist" "Checklist statique"
Assert-FileContains $preflightFile "buildPierreReleaseCandidatePreflight" "Preflight async"
Assert-FileContains $preflightFile "listCloneDocumentTemplates" "listCloneDocumentTemplates"
Assert-FileContains $preflightFile "buildDefaultCloneADNProfile" "buildDefaultCloneADNProfile"
Assert-FileContains $preflightFile "OFFICIAL_TO_GS_ALIAS_MAP" "Alias map import"

# ── STEP 8 : Preflight — pas de require() dynamique ───────────
Write-Step 8 "Preflight — pas de require() dynamique"
Assert-FileNotContains $preflightFile "require(" "Pas de require() dynamique"

# ── STEP 9 : Preflight — pas de DB write, no email, no exec ──
Write-Step 9 "Preflight — annotations read-only dans le fichier"
Assert-FileContains $preflightFile "No DB write" "Annotation no DB write"

# ── STEP 10 : Module report.ts RC ─────────────────────────────
Write-Step 10 "release-candidate/report.ts — rapport executif"
$rcReportFile = "src/lib/pierre/release-candidate/report.ts"
Assert-FileExists $rcReportFile "report.ts RC"
Assert-FileContains $rcReportFile "buildPierreReleaseCandidateExecutiveSummary" "Executive summary"
Assert-FileContains $rcReportFile "renderPierreReleaseCandidateMarkdown" "Markdown render"
Assert-FileContains $rcReportFile "Bloc 31" "Reference Bloc 31 dans rapport"

# ── STEP 11 : Route GET /release-candidate ────────────────────
Write-Step 11 "Route GET /api/pierre/use/release-candidate"
$rcRouteGet = "src/app/api/pierre/use/release-candidate/route.ts"
Assert-FileExists $rcRouteGet "Route RC GET"
Assert-FileContains $rcRouteGet "export async function GET" "Export GET"
Assert-FileContains $rcRouteGet "read_only" "Meta read_only"
Assert-FileContains $rcRouteGet "no_db_writes" "Meta no_db_writes"
Assert-FileContains $rcRouteGet "no_email" "Meta no_email"
Assert-FileContains $rcRouteGet "no_execution" "Meta no_execution"
Assert-FileNotContains $rcRouteGet "supabase.from(" "Pas de DB write dans route GET"

# ── STEP 12 : Route POST /release-candidate/preflight ─────────
Write-Step 12 "Route POST /api/pierre/use/release-candidate/preflight"
$rcRoutePreflight = "src/app/api/pierre/use/release-candidate/preflight/route.ts"
Assert-FileExists $rcRoutePreflight "Route preflight"
Assert-FileContains $rcRoutePreflight "export async function POST" "Export POST"
Assert-FileContains $rcRoutePreflight "include_golden_suite" "Param include_golden_suite"
Assert-FileContains $rcRoutePreflight "buildPierreReleaseCandidatePreflight" "Appel preflight"
Assert-FileContains $rcRoutePreflight "read_only" "Meta read_only"
Assert-FileNotContains $rcRoutePreflight ".insert(" "Pas d'insert en base"
Assert-FileNotContains $rcRoutePreflight ".update(" "Pas d'update en base"

# ── STEP 13 : Route POST /release-candidate/invariants ────────
Write-Step 13 "Route POST /api/pierre/use/release-candidate/invariants"
$rcRouteInvariants = "src/app/api/pierre/use/release-candidate/invariants/route.ts"
Assert-FileExists $rcRouteInvariants "Route invariants"
Assert-FileContains $rcRouteInvariants "export async function POST" "Export POST"
Assert-FileContains $rcRouteInvariants "auditPierreGlobalInvariants" "Appel audit global"
Assert-FileContains $rcRouteInvariants "scoreRCChecks" "scoreRCChecks"
Assert-FileContains $rcRouteInvariants "read_only" "Meta read_only"
Assert-FileContains $rcRouteInvariants "no_db_writes" "Meta no_db_writes"
Assert-FileNotContains $rcRouteInvariants ".insert(" "Pas d'insert dans route invariants"
Assert-FileNotContains $rcRouteInvariants ".update(" "Pas d'update dans route invariants"

# ── STEP 14 : Routes RC — pas de secrets exposés ──────────────
Write-Step 14 "Routes RC — aucun secret expose"
$rcRoutes = @($rcRouteGet, $rcRoutePreflight, $rcRouteInvariants)
$secretsFound = $false
foreach ($routePath in $rcRoutes) {
    if (Test-Path $routePath) {
        $rContent = Get-Content $routePath -Raw -Encoding UTF8
        if ($rContent -match "sk-[a-zA-Z0-9]") {
            Write-FAIL "Secret API key detecte dans $routePath"
            $secretsFound = $true
        }
        if ($rContent -match "SUPABASE_SERVICE_ROLE_KEY\s*=\s*[""']") {
            Write-FAIL "Cle service hardcodee dans $routePath"
            $secretsFound = $true
        }
    }
}
if (-not $secretsFound) {
    Write-OK "Aucun secret API expose dans les routes RC"
}

# ── STEP 15 : Routes RC — pas d'email automatique ─────────────
Write-Step 15 "Routes RC — pas d'envoi email automatique"
$emailFound = $false
foreach ($routePath in $rcRoutes) {
    if (Test-Path $routePath) {
        $rContent = Get-Content $routePath -Raw -Encoding UTF8
        if ($rContent -match "sendEmail|send_email|email\.send|nodemailer|resend\.send") {
            Write-FAIL "Envoi email detecte dans $routePath (interdit)"
            $emailFound = $true
        }
    }
}
if (-not $emailFound) {
    Write-OK "Aucun envoi email automatique dans les routes RC"
}

# ── STEP 16 : Harmonisation IDs scenariois officiel/gs_* ──────
Write-Step 16 "scenarios/types.ts — IDs officiels + alias map"
$scenTypesFile = "src/lib/pierre/scenarios/types.ts"
Assert-FileExists $scenTypesFile "scenarios/types.ts"
Assert-FileContains $scenTypesFile "PierreOfficialScenarioId" "PierreOfficialScenarioId"
Assert-FileContains $scenTypesFile "OFFICIAL_TO_GS_ALIAS_MAP" "OFFICIAL_TO_GS_ALIAS_MAP"
Assert-FileContains $scenTypesFile "onboarding_cdi" "ID officiel onboarding_cdi"
Assert-FileContains $scenTypesFile "contract_draft" "ID officiel contract_draft"
Assert-FileContains $scenTypesFile "sensitive_case" "ID officiel sensitive_case"
Assert-FileContains $scenTypesFile "offboarding" "ID officiel offboarding"
Assert-FileContains $scenTypesFile "out_of_scope" "ID officiel out_of_scope"
Assert-FileContains $scenTypesFile "incomplete_request" "ID officiel incomplete_request"

# ── STEP 17 : golden-registry.ts — normaliseur bidirectionnel ─
Write-Step 17 "scenarios/golden-registry.ts — normalizePierreGoldenScenarioId"
$registryFile = "src/lib/pierre/scenarios/golden-registry.ts"
Assert-FileExists $registryFile "golden-registry.ts"
Assert-FileContains $registryFile "normalizePierreGoldenScenarioId" "normalizePierreGoldenScenarioId"
Assert-FileContains $registryFile "isValidOfficialScenarioId" "isValidOfficialScenarioId"
Assert-FileContains $registryFile "getGoldenScenarioByOfficialIdOrAlias" "getGoldenScenarioByOfficialIdOrAlias"
Assert-FileContains $registryFile "OFFICIAL_TO_GS_ALIAS_MAP" "Re-export OFFICIAL_TO_GS_ALIAS_MAP"

# ── STEP 18 : Route run scenarioId — utilise normaliseur ──────
Write-Step 18 "Route POST /scenarios/[scenarioId]/run — normaliseur actif"
$routeScenRun = "src/app/api/pierre/use/scenarios/[scenarioId]/run/route.ts"
Assert-FileExists $routeScenRun "Route scenario run"
Assert-FileContains $routeScenRun "normalizePierreGoldenScenarioId" "normalizePierreGoldenScenarioId utilise"

# ── STEP 19 : Tests release-candidate.test.ts ─────────────────
Write-Step 19 "Tests release-candidate.test.ts — fichier present"
$rcTestFile = "src/lib/pierre/__tests__/release-candidate.test.ts"
Assert-FileExists $rcTestFile "release-candidate.test.ts"
Assert-FileContains $rcTestFile "buildRCCheck" "Test buildRCCheck"
Assert-FileContains $rcTestFile "auditPierreGlobalInvariants" "Test invariants"
Assert-FileContains $rcTestFile "buildPierreReleaseCandidatePreflight" "Test preflight"
Assert-FileContains $rcTestFile "normalizePierreGoldenScenarioId" "Test normalisation IDs"
Assert-FileNotContains $rcTestFile "supabase" "Pas de Supabase dans tests"
Assert-FileNotContains $rcTestFile "openai.com" "Pas d'appel OpenAI reel"

# ── STEP 20 : Tests release-candidate-crossblock.test.ts ──────
Write-Step 20 "Tests release-candidate-crossblock.test.ts — fichier present"
$rcCrossFile = "src/lib/pierre/__tests__/release-candidate-crossblock.test.ts"
Assert-FileExists $rcCrossFile "release-candidate-crossblock.test.ts"
Assert-FileContains $rcCrossFile "RC Engine" "Section RC Engine"
Assert-FileContains $rcCrossFile "Brain Final" "Crossblock Brain Final"
Assert-FileContains $rcCrossFile "CloneADN" "Crossblock CloneADN"
Assert-FileContains $rcCrossFile "can_start_cockpit" "can_start_cockpit dans crossblock"

# ── STEP 21 : Securite — pas de scheduled_for dans lib RC ─────
Write-Step 21 "Securite — scheduled_for absent du code lib RC (hors detection)"
$rcLibFiles = @(
    "src/lib/pierre/release-candidate/checks.ts",
    "src/lib/pierre/release-candidate/preflight.ts",
    "src/lib/pierre/release-candidate/report.ts"
)
$scheduledForFound = $false
foreach ($rcFile in $rcLibFiles) {
    if (Test-Path $rcFile) {
        $rContent = Get-Content $rcFile -Raw -Encoding UTF8
        if ($rContent -match [regex]::Escape("scheduled_for")) {
            Write-FAIL "scheduled_for trouve dans $rcFile (interdit en dehors de l'auditor)"
            $scheduledForFound = $true
        }
    }
}
if (-not $scheduledForFound) {
    Write-OK "scheduled_for absent des modules RC (hors auditor)"
}

# ── STEP 22 : Securite — pas de level/event/payload dans lib RC
Write-Step 22 "Securite — schema log legacy absent des modules RC"
$legacyLogFound = $false
foreach ($rcFile in $rcLibFiles) {
    if (Test-Path $rcFile) {
        $rContent = Get-Content $rcFile -Raw -Encoding UTF8
        if ($rContent -match '"level"' -or $rContent -match '"payload"') {
            Write-FAIL "Champ log legacy (level/payload) dans $rcFile (interdit)"
            $legacyLogFound = $true
        }
    }
}
if (-not $legacyLogFound) {
    Write-OK "Schema log legacy absent des modules RC"
}

# ── STEP 23 : Documentation PIERRE_HR_ENGINE_FOUNDATION.md ────
Write-Step 23 "docs/PIERRE_HR_ENGINE_FOUNDATION.md — Bloc 30 documente"
$docFile = "docs/PIERRE_HR_ENGINE_FOUNDATION.md"
Assert-FileExists $docFile "PIERRE_HR_ENGINE_FOUNDATION.md"
Assert-FileContains $docFile "Bloc 30" "Bloc 30 documente"
Assert-FileContains $docFile "Release Candidate" "Release Candidate mentionne"
Assert-FileContains $docFile "can_start_cockpit" "can_start_cockpit documente"
Assert-FileContains $docFile "Bloc 31" "Bloc 31 next step documente"

# ── STEP 24 : Coherence package.json — scripts test RC ────────
Write-Step 24 "package.json — scripts test release-candidate"
$pkgFile = "package.json"
Assert-FileExists $pkgFile "package.json"
Assert-FileContains $pkgFile "test:release-candidate" "Script test:release-candidate"
Assert-FileContains $pkgFile "test:release-candidate-crossblock" "Script test:release-candidate-crossblock"
Assert-FileContains $pkgFile "release-candidate.test.ts" "Test RC inclus dans test global"
Assert-FileContains $pkgFile "release-candidate-crossblock.test.ts" "Test RC crossblock inclus"

# ── STEP 25 : RC Area coverage — 19 areas dans types ─────────
Write-Step 25 "Types RC — 19 areas couvertes"
if (Test-Path $rcTypesFile) {
    $rcTypesContent = Get-Content $rcTypesFile -Raw -Encoding UTF8
    $areasToCheck = @(
        "schema", "security", "ai_runtime", "brain", "cloneadn",
        "documents", "employee_file", "continuity", "trial",
        "customer_success", "readiness", "release_proof",
        "golden_scenarios", "routes", "tests", "docs",
        "scripts", "build", "product"
    )
    $areasMissing = 0
    foreach ($area in $areasToCheck) {
        if (-not ($rcTypesContent -match [regex]::Escape($area))) {
            Write-FAIL "Area manquante dans types RC : $area"
            $areasMissing++
        }
    }
    if ($areasMissing -eq 0) {
        Write-OK "Les 19 areas RC sont definies dans types.ts"
    }
} else {
    Write-FAIL "types.ts RC introuvable, verification des areas impossible"
}

# ── STEP 26 : Invariant auditor — pas de DB write ─────────────
Write-Step 26 "Invariant auditor — read-only, aucune operation DB"
Assert-FileNotContains $auditorFile ".insert(" "Pas d'insert dans auditor"
Assert-FileNotContains $auditorFile ".update(" "Pas d'update dans auditor"
Assert-FileNotContains $auditorFile ".delete(" "Pas de delete dans auditor"
Assert-FileNotContains $auditorFile "supabase.from(" "Pas d'appel DB dans auditor"

# ── STEP 27 : Route mission — release_candidate_hint ──────────
Write-Step 27 "Route mission/[missionId] — release_candidate_hint"
$missionRoute = "src/app/api/pierre/use/mission/[missionId]/route.ts"
Assert-FileExists $missionRoute "Route mission"
Assert-FileContains $missionRoute "release_candidate_hint" "release_candidate_hint present"
Assert-FileContains $missionRoute "backend_ready" "backend_ready dans hint"
Assert-FileContains $missionRoute "can_start_cockpit" "can_start_cockpit dans mission hint"

# ── SUMMARY ───────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host " RESULTATS — BLOC 30 RELEASE CANDIDATE" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "  Etapes reussies : $stepsPassed" -ForegroundColor Green
Write-Host "  Erreurs         : $totalErrors" -ForegroundColor $(if ($totalErrors -eq 0) { "Green" } else { "Red" })

if ($totalErrors -eq 0) {
    Write-Host ""
    Write-Host "  [RELEASE CANDIDATE READY] Pierre Bloc 30 valide." -ForegroundColor Green
    Write-Host "  Backend RC pret. Cockpit Bloc 31 peut demarrer." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  [BLOCKED] $totalErrors erreur(s) detectee(s). Corriger avant Bloc 31." -ForegroundColor Red
    exit 1
}
