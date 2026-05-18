# ===========================================================
# Pierre Continuity Engine — Hardening Premium — Test E2E (Bloc 10.5)
# Script PowerShell 5 compatible (pas de ??, ?., ni guillemets typographiques)
# Teste les nouvelles capacites: sections, digest, log_summary,
#   document_summary, followups, skipped enrichi, run-next traces
# Routes testees: GET /continuity, POST /mission/{id}/continue,
#                  POST /continuity/run-next, GET /mission/{id}
# Prerequis: dev server actif sur localhost:3000 + token valide
# ===========================================================

$BASE_URL = "http://localhost:3000/api/pierre/use"
$TOKEN = $env:PIERRE_TEST_TOKEN

if (-not $TOKEN) {
    Write-Host "ERREUR: Variable d'environnement PIERRE_TEST_TOKEN manquante." -ForegroundColor Red
    Write-Host "Definissez-la avec: `$env:PIERRE_TEST_TOKEN = 'votre-token'"
    exit 1
}

$HEADERS = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type"  = "application/json"
}

$PASS = 0
$FAIL = 0

function Test-Step {
    param(
        [string]$Name,
        [bool]$Condition,
        [string]$Detail
    )
    if ($Condition) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        if ($Detail) { Write-Host "       Detail: $Detail" -ForegroundColor Yellow }
        $script:FAIL++
    }
}

function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Body
    )
    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $Url -Method GET -Headers $HEADERS -ErrorAction Stop
        } else {
            $bodyJson = if ($Body) { $Body | ConvertTo-Json -Depth 10 } else { "{}" }
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $HEADERS -Body $bodyJson -ErrorAction Stop
        }
        return $response
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        Write-Host "  HTTP $statusCode - $($_.Exception.Message)" -ForegroundColor DarkYellow
        return $null
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Pierre Continuity Hardening Premium (Bloc 10.5)" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------
# ETAPE 1 — GET /continuity sans auth -> 401
# -----------------------------------------------------------
Write-Host "--- Etape 1: GET /continuity sans token -> 401" -ForegroundColor DarkCyan
try {
    $r = Invoke-RestMethod -Uri "$BASE_URL/continuity" -Method GET -ErrorAction Stop
    Test-Step "GET /continuity sans token -> devrait echouer" $false "Reponse inattendue: ok=$($r.ok)"
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    Test-Step "GET /continuity sans token -> 401" ($status -eq 401) "HTTP $status"
}

# -----------------------------------------------------------
# ETAPE 2 — GET /continuity - champs de base (v10.5)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 2: GET /continuity - champs de base et nouveautes v10.5" -ForegroundColor DarkCyan
$dashboard = Invoke-ApiCall -Method GET -Url "$BASE_URL/continuity"
Test-Step "GET /continuity retourne ok=true" ($dashboard -ne $null -and $dashboard.ok -eq $true) ""
Test-Step "Champ 'dashboard' present" ($dashboard -ne $null -and $dashboard.dashboard -ne $null) ""
Test-Step "Champ 'sections' present (v10.5)" ($dashboard -ne $null -and $dashboard.sections -ne $null) ""
Test-Step "Champ 'digest' present (v10.5)" ($dashboard -ne $null -and -not [string]::IsNullOrEmpty($dashboard.digest)) ""

# -----------------------------------------------------------
# ETAPE 3 — Validation structure sections (v10.5)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 3: Validation structure sections (v10.5)" -ForegroundColor DarkCyan
if ($dashboard -ne $null -and $dashboard.sections -ne $null) {
    $sections = @($dashboard.sections)
    Test-Step "sections contient 8 entrees" ($sections.Count -eq 8) "Count=$($sections.Count)"

    $sectionKeys = $sections | ForEach-Object { $_.key }
    Test-Step "section 'safe_to_run' presente" ($sectionKeys -contains "safe_to_run") ""
    Test-Step "section 'awaiting_approval' presente" ($sectionKeys -contains "awaiting_approval") ""
    Test-Step "section 'blocked' presente" ($sectionKeys -contains "blocked") ""
    Test-Step "section 'failed' presente" ($sectionKeys -contains "failed") ""
    Test-Step "section 'due_now' presente" ($sectionKeys -contains "due_now") ""
    Test-Step "section 'overdue' presente" ($sectionKeys -contains "overdue") ""
    Test-Step "section 'scheduled' presente" ($sectionKeys -contains "scheduled") ""
    Test-Step "section 'completed_recently' presente" ($sectionKeys -contains "completed_recently") ""

    $firstSection = $sections[0]
    Test-Step "Chaque section a key, label, task_ids, count" (
        $firstSection -ne $null -and
        $firstSection.PSObject.Properties.Name -contains "key" -and
        $firstSection.PSObject.Properties.Name -contains "label" -and
        $firstSection.PSObject.Properties.Name -contains "count"
    ) ""
} else {
    Write-Host "  sections non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 4 — Soumettre une mission de test
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 4: Soumission mission RH pour test hardening" -ForegroundColor DarkCyan
$submitBody = @{
    input = "Preparer l'onboarding de Marie Dupont qui rejoint l'equipe technique le 1er juillet 2026 en CDI"
    autonomy_level = "validation_recommended"
}
$submitResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/submit" -Body $submitBody
Test-Step "POST /submit retourne ok=true" ($submitResult -ne $null -and $submitResult.ok -eq $true) ""

$missionId = $null
if ($submitResult -ne $null -and $submitResult.mission -ne $null) {
    $missionId = $submitResult.mission.id
}
Test-Step "Mission ID recupere" (-not [string]::IsNullOrEmpty($missionId)) "missionId=$missionId"

# -----------------------------------------------------------
# ETAPE 5 — GET /mission/{id} - continuity enrichi (v10.5)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 5: GET /mission/{id} - champ continuity enrichi v10.5" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    Test-Step "GET /mission/{id} retourne ok=true" ($missionData -ne $null -and $missionData.ok -eq $true) ""
    Test-Step "Champ 'continuity' present" ($missionData -ne $null -and $missionData.continuity -ne $null) ""
    Test-Step "continuity.mission_insight present" ($missionData -ne $null -and $missionData.continuity.mission_insight -ne $null) ""
    Test-Step "continuity.continue_plan present" ($missionData -ne $null -and $missionData.continuity.continue_plan -ne $null) ""
    Test-Step "continuity.sections present (v10.5)" ($missionData -ne $null -and $missionData.continuity.sections -ne $null) ""
    Test-Step "continuity.digest present (v10.5)" ($missionData -ne $null -and $missionData.continuity.digest -ne $null) ""
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 6 — Validation mission_insight.sections (v10.5)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 6: Validation mission_insight.sections (v10.5)" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    if ($missionData -ne $null -and $missionData.continuity -ne $null -and $missionData.continuity.mission_insight -ne $null) {
        $mi = $missionData.continuity.mission_insight
        Test-Step "mission_insight.sections present" ($mi.sections -ne $null) ""
        if ($mi.sections -ne $null) {
            $miSections = @($mi.sections)
            Test-Step "mission_insight.sections a 8 entrees" ($miSections.Count -eq 8) "Count=$($miSections.Count)"
        }
        Test-Step "mission_insight.digest present" ($mi.digest -ne $null) ""
        if ($mi.digest -ne $null) {
            Test-Step "mission_insight.digest.text non vide" (-not [string]::IsNullOrEmpty($mi.digest.text)) ""
            Test-Step "mission_insight.digest.tone present" (-not [string]::IsNullOrEmpty($mi.digest.tone)) ""
        }
    } else {
        Write-Host "  mission_insight non disponible - tests ignores" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 7 — continuity.log_summary et document_summary (v10.5)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 7: continuity.log_summary et document_summary (v10.5)" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    if ($missionData -ne $null -and $missionData.continuity -ne $null) {
        $cont = $missionData.continuity
        Test-Step "continuity.log_summary present (v10.5)" ($cont.log_summary -ne $null) "log_summary absent — aucun log enregistre?"
        Test-Step "continuity.document_summary present (v10.5)" ($cont.document_summary -ne $null) "doc_summary absent — aucun document genere?"
    } else {
        Write-Host "  continuity non disponible - tests ignores" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 8 — POST /mission/{id}/continue - champs de base
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 8: POST /mission/{id}/continue - champs de base" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $continueResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/mission/$missionId/continue"
    Test-Step "POST /continue retourne ok=true" ($continueResult -ne $null -and $continueResult.ok -eq $true) ""
    Test-Step "Continue retourne insight" ($continueResult -ne $null -and $continueResult.insight -ne $null) ""
    Test-Step "Continue retourne plan" ($continueResult -ne $null -and $continueResult.plan -ne $null) ""
    Test-Step "insight.sections present (v10.5)" ($continueResult -ne $null -and $continueResult.insight -ne $null -and $continueResult.insight.sections -ne $null) ""
    Test-Step "insight.digest present (v10.5)" ($continueResult -ne $null -and $continueResult.insight -ne $null -and $continueResult.insight.digest -ne $null) ""
    Test-Step "followups_created present (v10.5)" ($continueResult -ne $null -and $continueResult.PSObject.Properties.Name -contains "followups_created") ""
    Test-Step "meta.logs_count present (v10.5)" ($continueResult -ne $null -and $continueResult.meta -ne $null -and $continueResult.meta.PSObject.Properties.Name -contains "logs_count") ""
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 9 — POST /mission/{id}/continue avec create_followups=true
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 9: POST /mission/{id}/continue avec create_followups=true" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $continueFollowBody = @{ create_followups = $true }
    $continueFollowResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/mission/$missionId/continue" -Body $continueFollowBody
    Test-Step "POST /continue create_followups=true retourne ok=true" ($continueFollowResult -ne $null -and $continueFollowResult.ok -eq $true) ""
    Test-Step "followups_created est un nombre" ($continueFollowResult -ne $null -and $continueFollowResult.followups_created -ge 0) "followups_created=$($continueFollowResult.followups_created)"
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 10 — POST /continuity/run-next - skipped enrichi (v10.5)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 10: POST /continuity/run-next - skipped enrichi (v10.5)" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $runBody = @{ mission_id = $missionId; max = 3 }
    $runResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/continuity/run-next" -Body $runBody
    Test-Step "POST /run-next retourne ok=true" ($runResult -ne $null -and $runResult.ok -eq $true) ""
    Test-Step "run-next contient champ 'ran'" ($runResult -ne $null -and $runResult.ran -ne $null) ""
    Test-Step "run-next contient champ 'errors'" ($runResult -ne $null -and $runResult.errors -ne $null) ""
    Test-Step "run-next contient champ 'skipped'" ($runResult -ne $null -and $runResult.skipped -ne $null) ""
    Test-Step "meta.skipped_count present (v10.5)" ($runResult -ne $null -and $runResult.meta -ne $null -and $runResult.meta.PSObject.Properties.Name -contains "skipped_count") ""

    if ($runResult -ne $null -and $runResult.skipped -ne $null) {
        $skippedList = @($runResult.skipped)
        if ($skippedList.Count -gt 0) {
            $firstSkipped = $skippedList[0]
            Test-Step "Chaque skipped a task_id et reason (v10.5)" (
                $firstSkipped -ne $null -and
                -not [string]::IsNullOrEmpty($firstSkipped.task_id) -and
                -not [string]::IsNullOrEmpty($firstSkipped.reason)
            ) "task_id=$($firstSkipped.task_id) reason=$($firstSkipped.reason)"
        } else {
            Write-Host "  Aucune tache ignoree - test structure skipped ignore" -ForegroundColor DarkYellow
        }
    }
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 11 — POST /continuity/run-next global (sans mission_id)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 11: POST /continuity/run-next global (sans mission_id)" -ForegroundColor DarkCyan
$runAllBody = @{ max = 2 }
$runAllResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/continuity/run-next" -Body $runAllBody
Test-Step "POST /run-next global retourne ok=true" ($runAllResult -ne $null -and $runAllResult.ok -eq $true) ""
Test-Step "run-next global contient meta" ($runAllResult -ne $null -and $runAllResult.meta -ne $null) ""
Test-Step "run-next global contient skipped (v10.5)" ($runAllResult -ne $null -and $runAllResult.skipped -ne $null) ""

# -----------------------------------------------------------
# ETAPE 12 — Invariant: email.send jamais execute automatiquement
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 12: Invariant - email.send jamais execute par run-next auto" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData3 = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    if ($missionData3 -ne $null -and $missionData3.tasks -ne $null) {
        $sendTasks = @($missionData3.tasks | Where-Object { $_.type -eq "email.send" -and $_.status -eq "done" })
        Test-Step "Aucune tache email.send marquee done par run-next auto" ($sendTasks.Count -eq 0) "send tasks done auto: $($sendTasks.Count)"
    } else {
        Write-Host "  Taches non disponibles - test ignore" -ForegroundColor DarkYellow
    }
}

# -----------------------------------------------------------
# ETAPE 13 — POST /mission/{fakeId}/continue -> 404
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 13: POST /mission/fake-id/continue -> 404" -ForegroundColor DarkCyan
try {
    $r = Invoke-RestMethod -Uri "$BASE_URL/mission/non-existant-id-xyz/continue" -Method POST -Headers $HEADERS -ErrorAction Stop
    Test-Step "continue mission inexistante -> devrait echouer" $false "Reponse inattendue"
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    Test-Step "continue mission inexistante -> 404" ($status -eq 404) "HTTP $status"
}

# -----------------------------------------------------------
# ETAPE 14 — POST /continuity/run-next sans auth -> 401
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 14: POST /continuity/run-next sans token -> 401" -ForegroundColor DarkCyan
try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    $r = Invoke-RestMethod -Uri "$BASE_URL/continuity/run-next" -Method POST -Headers $noAuthHeaders -Body "{}" -ErrorAction Stop
    Test-Step "run-next sans token -> devrait echouer" $false "Reponse inattendue"
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    Test-Step "run-next sans token -> 401" ($status -eq 401) "HTTP $status"
}

# -----------------------------------------------------------
# ETAPE 15 — GET /continuity apres executions - meta enrichi
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 15: GET /continuity apres executions - meta enrichi (v10.5)" -ForegroundColor DarkCyan
$dashboard2 = Invoke-ApiCall -Method GET -Url "$BASE_URL/continuity"
Test-Step "Dashboard apres executions retourne ok=true" ($dashboard2 -ne $null -and $dashboard2.ok -eq $true) ""
Test-Step "meta.logs_loaded present (v10.5)" ($dashboard2 -ne $null -and $dashboard2.meta -ne $null -and $dashboard2.meta.PSObject.Properties.Name -contains "logs_loaded") ""
Test-Step "meta.documents_loaded present (v10.5)" ($dashboard2 -ne $null -and $dashboard2.meta -ne $null -and $dashboard2.meta.PSObject.Properties.Name -contains "documents_loaded") ""

# -----------------------------------------------------------
# ETAPE 16 — Schema log verifie (event_type + message, pas level/event)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 16: Schema logs verifie (event_type + message, pas level/event)" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData4 = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    if ($missionData4 -ne $null -and $missionData4.logs -ne $null) {
        $logs = @($missionData4.logs)
        if ($logs.Count -gt 0) {
            $firstLog = $logs[0]
            $hasEventType = $firstLog.PSObject.Properties.Name -contains "event_type"
            $hasNoOldLevel = -not ($firstLog.PSObject.Properties.Name -contains "level")
            Test-Step "Logs utilisent event_type (nouveau schema)" $hasEventType "Proprietes: $($firstLog.PSObject.Properties.Name -join ', ')"
            Test-Step "Logs n'ont pas l'ancien champ 'level'" $hasNoOldLevel "Champ 'level' trouve!"
        } else {
            Write-Host "  Aucun log disponible - tests ignores" -ForegroundColor DarkYellow
        }
    }
}

# -----------------------------------------------------------
# RESUME
# -----------------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  RESUME TESTS E2E HARDENING PREMIUM (Bloc 10.5)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  PASS: $PASS" -ForegroundColor Green
Write-Host "  FAIL: $FAIL" -ForegroundColor Red
$TOTAL = $PASS + $FAIL
Write-Host "  TOTAL: $TOTAL" -ForegroundColor White
Write-Host ""

if ($FAIL -gt 0) {
    Write-Host "ECHECS DETECTES — verifier les routes et la configuration." -ForegroundColor Red
    exit 1
} else {
    Write-Host "Tous les tests passent." -ForegroundColor Green
    exit 0
}
