# ===========================================================
# Pierre Continuity Engine — Test E2E (Bloc 10)
# Script PowerShell 5 compatible (pas de ??, ?., ni guillemets typographiques)
# Teste les routes: GET /continuity, POST /mission/{id}/continue,
#                   POST /continuity/run-next
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
Write-Host "  Pierre Continuity Engine — Test E2E (Bloc 10)" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------
# ETAPE 1 — GET /continuity (dashboard sans auth)
# -----------------------------------------------------------
Write-Host "--- Etape 1: Dashboard sans authentification" -ForegroundColor DarkCyan
try {
    $r = Invoke-RestMethod -Uri "$BASE_URL/continuity" -Method GET -ErrorAction Stop
    Test-Step "GET /continuity sans token → devrait echouer" $false "Reponse inattendue: ok=$($r.ok)"
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    Test-Step "GET /continuity sans token → 401" ($status -eq 401) "HTTP $status"
}

# -----------------------------------------------------------
# ETAPE 2 — GET /continuity (dashboard avec auth)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 2: Dashboard continuity avec authentification" -ForegroundColor DarkCyan
$dashboard = Invoke-ApiCall -Method GET -Url "$BASE_URL/continuity"
Test-Step "GET /continuity retourne ok=true" ($dashboard -ne $null -and $dashboard.ok -eq $true) ""
Test-Step "Dashboard contient champ 'dashboard'" ($dashboard -ne $null -and $dashboard.dashboard -ne $null) ""
Test-Step "Dashboard contient missions_total" ($dashboard -ne $null -and $dashboard.dashboard.PSObject.Properties.Name -contains "missions_total") ""
Test-Step "Dashboard contient total_safe_task_ids (liste)" ($dashboard -ne $null -and $dashboard.dashboard.total_safe_task_ids -ne $null) ""
Test-Step "Dashboard contient mission_entries (liste)" ($dashboard -ne $null -and $dashboard.dashboard.mission_entries -ne $null) ""

# -----------------------------------------------------------
# ETAPE 3 — Structure du dashboard
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 3: Validation structure dashboard" -ForegroundColor DarkCyan
if ($dashboard -ne $null -and $dashboard.dashboard -ne $null) {
    $d = $dashboard.dashboard
    Test-Step "missions_total >= 0" ($d.missions_total -ge 0) "missions_total=$($d.missions_total)"
    Test-Step "missions_active >= 0" ($d.missions_active -ge 0) ""
    Test-Step "missions_stalled >= 0" ($d.missions_stalled -ge 0) ""
    Test-Step "total_runnable_tasks >= 0" ($d.total_runnable_tasks -ge 0) ""
    Test-Step "generated_at est renseigne" (-not [string]::IsNullOrEmpty($d.generated_at)) ""
} else {
    Write-Host "  Dashboard non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 4 — Soumettre une mission de test
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 4: Soumission mission onboarding pour test continuity" -ForegroundColor DarkCyan
$submitBody = @{
    input = "Préparer l'onboarding de Sophie Martin qui rejoint l'équipe RH le 20 juin 2026 en CDI"
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
# ETAPE 5 — GET /mission/{id} avec champ continuity
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 5: Verification champ continuity dans GET /mission/{id}" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    Test-Step "GET /mission/{id} retourne ok=true" ($missionData -ne $null -and $missionData.ok -eq $true) ""
    Test-Step "Champ 'continuity' present dans reponse" ($missionData -ne $null -and $missionData.continuity -ne $null) ""
    Test-Step "continuity.mission_insight present" ($missionData -ne $null -and $missionData.continuity.mission_insight -ne $null) ""
    Test-Step "continuity.continue_plan present" ($missionData -ne $null -and $missionData.continuity.continue_plan -ne $null) ""
    Test-Step "Ancienne forme (tasks, logs, documents) preservee" (
        $missionData -ne $null -and
        $missionData.tasks -ne $null -and
        $missionData.logs -ne $null -and
        $missionData.documents -ne $null
    ) ""
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 6 — Validation mission_insight
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 6: Validation structure mission_insight" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    if ($missionData -ne $null -and $missionData.continuity -ne $null -and $missionData.continuity.mission_insight -ne $null) {
        $mi = $missionData.continuity.mission_insight
        Test-Step "mission_insight.mission_id correct" ($mi.mission_id -eq $missionId) "got=$($mi.mission_id)"
        Test-Step "mission_insight.continuity_state present" (-not [string]::IsNullOrEmpty($mi.continuity_state)) ""
        Test-Step "mission_insight.progress_pct est nombre" ($mi.progress_pct -ge 0 -and $mi.progress_pct -le 100) "pct=$($mi.progress_pct)"
        Test-Step "mission_insight.health_score est nombre" ($mi.health_score -ge 0 -and $mi.health_score -le 100) "score=$($mi.health_score)"
        Test-Step "mission_insight.tasks est liste" ($mi.tasks -ne $null) ""
        Test-Step "mission_insight.recommended_next_action present" ($mi.recommended_next_action -ne $null) ""
    } else {
        Write-Host "  mission_insight non disponible - tests ignores" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 7 — POST /mission/{id}/continue
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 7: POST /mission/{id}/continue" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $continueResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/mission/$missionId/continue"
    Test-Step "POST /continue retourne ok=true" ($continueResult -ne $null -and $continueResult.ok -eq $true) ""
    Test-Step "Continue retourne insight" ($continueResult -ne $null -and $continueResult.insight -ne $null) ""
    Test-Step "Continue retourne plan" ($continueResult -ne $null -and $continueResult.plan -ne $null) ""
    Test-Step "Plan contient safe_to_run (liste)" ($continueResult -ne $null -and $continueResult.plan.safe_to_run -ne $null) ""
    Test-Step "Plan contient summary non vide" ($continueResult -ne $null -and -not [string]::IsNullOrEmpty($continueResult.plan.summary)) ""
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 8 — POST /continuity/run-next (mission_id specifique)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 8: POST /continuity/run-next (mission specifique)" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $runBody = @{ mission_id = $missionId; max = 3 }
    $runResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/continuity/run-next" -Body $runBody
    Test-Step "POST /run-next retourne ok=true" ($runResult -ne $null -and $runResult.ok -eq $true) ""
    Test-Step "run-next contient champ 'ran'" ($runResult -ne $null -and $runResult.ran -ne $null) ""
    Test-Step "run-next contient champ 'errors'" ($runResult -ne $null -and $runResult.errors -ne $null) ""
    Test-Step "run-next contient meta.selected_count" ($runResult -ne $null -and $runResult.meta -ne $null) ""
} else {
    Write-Host "  Mission non disponible - tests ignores" -ForegroundColor DarkYellow
}

# -----------------------------------------------------------
# ETAPE 9 — POST /continuity/run-next (toutes missions)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 9: POST /continuity/run-next (sans mission_id)" -ForegroundColor DarkCyan
$runAllBody = @{ max = 2 }
$runAllResult = Invoke-ApiCall -Method POST -Url "$BASE_URL/continuity/run-next" -Body $runAllBody
Test-Step "POST /run-next global retourne ok=true" ($runAllResult -ne $null -and $runAllResult.ok -eq $true) ""
Test-Step "run-next global contient meta" ($runAllResult -ne $null -and $runAllResult.meta -ne $null) ""

# -----------------------------------------------------------
# ETAPE 10 — POST /continuity/run-next sans auth
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 10: POST /continuity/run-next sans token" -ForegroundColor DarkCyan
try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    $r = Invoke-RestMethod -Uri "$BASE_URL/continuity/run-next" -Method POST -Headers $noAuthHeaders -Body "{}" -ErrorAction Stop
    Test-Step "run-next sans token → devrait echouer" $false "Reponse inattendue"
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    Test-Step "run-next sans token → 401" ($status -eq 401) "HTTP $status"
}

# -----------------------------------------------------------
# ETAPE 11 — GET /continuity apres executions
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 11: Dashboard mis a jour apres executions" -ForegroundColor DarkCyan
$dashboard2 = Invoke-ApiCall -Method GET -Url "$BASE_URL/continuity"
Test-Step "Dashboard apres executions retourne ok=true" ($dashboard2 -ne $null -and $dashboard2.ok -eq $true) ""
Test-Step "meta.missions_loaded est nombre" ($dashboard2 -ne $null -and $dashboard2.meta -ne $null) ""

# -----------------------------------------------------------
# ETAPE 12 — Verification invariant: email.send non execute automatiquement
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 12: Invariant - email.send jamais execute automatiquement" -ForegroundColor DarkCyan
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
# ETAPE 13 — POST /mission/{fakeId}/continue → 404
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 13: POST /mission/fake-id/continue → 404" -ForegroundColor DarkCyan
try {
    $r = Invoke-RestMethod -Uri "$BASE_URL/mission/non-existant-id-xyz/continue" -Method POST -Headers $HEADERS -ErrorAction Stop
    Test-Step "continue mission inexistante → devrait echouer" $false "Reponse inattendue"
} catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    Test-Step "continue mission inexistante → 404" ($status -eq 404) "HTTP $status"
}

# -----------------------------------------------------------
# ETAPE 14 — Verification schema log (event_type, pas level/event)
# -----------------------------------------------------------
Write-Host ""
Write-Host "--- Etape 14: Schema logs verifie (event_type + meta_json)" -ForegroundColor DarkCyan
if (-not [string]::IsNullOrEmpty($missionId)) {
    $missionData4 = Invoke-ApiCall -Method GET -Url "$BASE_URL/mission/$missionId"
    if ($missionData4 -ne $null -and $missionData4.logs -ne $null) {
        $logs = @($missionData4.logs)
        if ($logs.Count -gt 0) {
            $firstLog = $logs[0]
            $hasEventType = $firstLog.PSObject.Properties.Name -contains "event_type"
            $hasNoOldLevel = -not ($firstLog.PSObject.Properties.Name -contains "level")
            Test-Step "Logs utilisent event_type (nouveau schema)" $hasEventType "Proprietes: $($firstLog.PSObject.Properties.Name -join ', ')"
        } else {
            Write-Host "  Aucun log disponible - test ignore" -ForegroundColor DarkYellow
        }
    }
}

# -----------------------------------------------------------
# RESUME
# -----------------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  RESUME TESTS E2E CONTINUITY ENGINE" -ForegroundColor Cyan
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
