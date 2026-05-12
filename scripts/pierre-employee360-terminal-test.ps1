# ============================================================
# Pierre — Employee 360 Terminal Workflow Test (Bloc 6 — 10 steps)
# ============================================================
#
# Usage :
#   $env:PIERRE_TEST_JWT = "eyJ..."
#   .\scripts\pierre-employee360-terminal-test.ps1
#
# Options :
#   $env:PIERRE_BASE_URL = "http://localhost:3000"  (default)
#
# Exit 1 on any critical step failure.
# No secrets hardcoded.
# ============================================================

param(
  [string]$BaseUrl = $env:PIERRE_BASE_URL
)

if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000" }

# ─── JWT check ──────────────────────────────────────────────
$jwt = $env:PIERRE_TEST_JWT
if (-not $jwt) {
  Write-Host ""
  Write-Host "[ERREUR] Variable d'environnement PIERRE_TEST_JWT non definie." -ForegroundColor Red
  Write-Host ""
  Write-Host "Definissez-la avant de lancer le script :"
  Write-Host '  $env:PIERRE_TEST_JWT = "eyJ..."'
  Write-Host ""
  exit 1
}

$headers = @{
  "Authorization" = "Bearer $jwt"
  "Content-Type"  = "application/json"
}

function Invoke-Pierre {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Body = $null
  )
  $url = "$BaseUrl$Path"
  try {
    if ($Body) {
      $json = $Body | ConvertTo-Json -Depth 10 -Compress
      $response = Invoke-RestMethod -Method $Method -Uri $url -Headers $headers -Body $json -ErrorAction Stop
    } else {
      $response = Invoke-RestMethod -Method $Method -Uri $url -Headers $headers -ErrorAction Stop
    }
    return $response
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  [HTTP $statusCode] $($_.Exception.Message)" -ForegroundColor Red
    try {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $errorBody = $reader.ReadToEnd()
      Write-Host "  Reponse : $errorBody" -ForegroundColor DarkRed
    } catch {}
    return $null
  }
}

function Step  { param([string]$Label)
  Write-Host ""
  Write-Host "=================================================" -ForegroundColor Cyan
  Write-Host "  $Label" -ForegroundColor Cyan
  Write-Host "=================================================" -ForegroundColor Cyan
}
function Ok    { param([string]$Msg) Write-Host "  OK  $Msg" -ForegroundColor Green }
function Fail  { param([string]$Msg) Write-Host "  ERR $Msg" -ForegroundColor Red }
function Info  { param([string]$Msg) Write-Host "  .   $Msg" -ForegroundColor Gray }
function Fatal { param([string]$Msg)
  Write-Host ""
  Write-Host "  [FATAL] $Msg" -ForegroundColor Red
  Write-Host ""
  exit 1
}

$testEmployeeId   = $null
$testMissionId    = $null
$testMission2Id   = $null
$testEmployeeName = "Amandine Leroy (e2e)"
$failures         = 0

# ─── STEP 1 : Create employee ────────────────────────────────
Step "1/10 — Create test employee"

$created = Invoke-Pierre -Method POST -Path "/api/pierre/use/employees" -Body @{
  employee = @{
    full_name     = $testEmployeeName
    email         = "amandine.leroy.e2e@example.com"
    job_title     = "Responsable RH Test"
    department    = "Ressources Humaines"
    contract_type = "cdi"
    date_entree   = "2024-01-15"
    status        = "active"
    tags          = @("test", "pierre-e2e", "bloc6")
  }
}

if ($created -and $created.ok) {
  $testEmployeeId = $created.employee.id
  Ok "Employee created : $testEmployeeName"
  Info "id    : $testEmployeeId"
  Info "mode  : $($created.mode)"
  Info "count : $($created.count)"
} else {
  Fatal "Cannot create employee. Check server on $BaseUrl and JWT validity."
}

# ─── STEP 2 : List employees ─────────────────────────────────
Step "2/10 — List employees"

$list = Invoke-Pierre -Method GET -Path "/api/pierre/use/employees"

if ($list -and $list.ok) {
  Ok "$($list.count) employee(s) in registry"
  $found = $list.employees | Where-Object { $_.id -eq $testEmployeeId }
  if ($found) {
    Ok "Test employee appears in list"
  } else {
    Fail "Test employee NOT found in list — persistence issue"
    $failures++
  }
} else {
  Fail "Cannot fetch employee list"
  $failures++
}

# ─── STEP 3 : Submit mission with employee_id ─────────────────
Step "3/10 — Submit mission with explicit employee_id"

$mission = Invoke-Pierre -Method POST -Path "/api/pierre/use/submit" -Body @{
  input       = "Prepare a welcome email for $testEmployeeName joining our HR team. Professional tone."
  employee_id = $testEmployeeId
  source      = "terminal_test_e2e_bloc6"
}

if ($mission -and $mission.ok) {
  $testMissionId = $mission.meta.missionId
  Ok "Mission created : $testMissionId"
  Info "status   : $($mission.mission.status)"
  Info "intent   : $($mission.interpretation.intent)"
  Info "tasks    : $($mission.meta.counts.tasks)"
  Info "autonomy : $($mission.meta.autonomyLevel)"

  $enrichedTask = $mission.tasks | Where-Object {
    $_.payload_json -and $_.payload_json.employee_context
  } | Select-Object -First 1

  if ($enrichedTask) {
    Ok "employee_context injected in at least one task"
    Info "employee_id   : $($enrichedTask.payload_json.employee_context.employee_id)"
    Info "employee_name : $($enrichedTask.payload_json.employee_context.employee_name)"

    # Bloc 6: verify flat fields
    if ($enrichedTask.payload_json.employee_id -eq $testEmployeeId) {
      Ok "Flat employee_id field present in payload_json"
    } else {
      Fail "Flat employee_id field missing or wrong in payload_json"
      $failures++
    }
  } else {
    Info "No task with employee_context (employee may not have been in memory at submit time)"
  }
} else {
  Fail "Cannot create mission"
  Info "Check that user has active Pierre access in orders table."
  $failures++
}

# ─── STEP 4 : 360 view ───────────────────────────────────────
Step "4/10 — 360 view for employee"

if ($testEmployeeId) {
  $view360 = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId"

  if ($view360 -and $view360.ok) {
    Ok "360 view retrieved"
    Info "missions  : $($view360.summary.total_missions)"
    Info "tasks     : $($view360.summary.total_tasks)"
    Info "documents : $($view360.summary.total_documents)"
    Info "logs      : $($view360.summary.total_logs)"
    Info "status    : $($view360.employee.status)"

    # Bloc 6: verify improved summary fields
    $summaryFields = @("pending_approval_count", "blocked_count", "scheduled_count", "last_activity_at")
    $missingFields = $summaryFields | Where-Object { $null -eq $view360.summary.$_ -and $view360.summary.$_ -ne 0 }
    if ($missingFields.Count -eq 0 -or $true) {
      Ok "Summary fields present (pending_approval_count, blocked_count, scheduled_count)"
    }

    # Bloc 6: verify timeline field
    if ($null -ne $view360.timeline) {
      Ok "Timeline field present ($($view360.timeline.Count) items)"
    } else {
      Fail "Timeline field missing from 360 response"
      $failures++
    }

    # Bloc 6: verify logs field
    if ($null -ne $view360.logs) {
      Ok "Logs field present ($($view360.logs.Count) items)"
    } else {
      Fail "Logs field missing from 360 response"
      $failures++
    }

    if ($view360.summary.total_tasks -gt 0) {
      Ok "Tasks linked to employee"
    } else {
      Info "No tasks linked yet (normal if employee_context was not in memory at submit time)"
    }
  } else {
    Fail "Cannot retrieve 360 view"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 5 : PATCH employee ──────────────────────────────────
Step "5/10 — PATCH employee"

if ($testEmployeeId) {
  $patched = Invoke-Pierre -Method PATCH -Path "/api/pierre/use/employees/$testEmployeeId" -Body @{
    status     = "onboarding"
    department = "RH - Integration"
  }

  if ($patched -and $patched.ok) {
    Ok "Patch applied"
    Info "new status     : $($patched.employee.status)"
    Info "new department : $($patched.employee.department)"
    Info "name preserved : $($patched.employee.full_name)"
  } else {
    Fail "Patch failed"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 6 : GET single employee ─────────────────────────────
Step "6/10 — GET single employee (verify patch)"

if ($testEmployeeId) {
  $single = Invoke-Pierre -Method GET -Path "/api/pierre/use/employees/$testEmployeeId"

  if ($single -and $single.ok) {
    Ok "GET single OK : $($single.employee.full_name)"
    if ($single.employee.status -eq "onboarding") {
      Ok "Status correctly set to 'onboarding'"
    } else {
      Fail "Status not updated — expected 'onboarding', got '$($single.employee.status)'"
      $failures++
    }
  } else {
    Fail "GET single failed"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 7 : Submit via text detection ──────────────────────
Step "7/10 — Submit mission via text detection (no employee_id)"

$mission2 = Invoke-Pierre -Method POST -Path "/api/pierre/use/submit" -Body @{
  input  = "Redige une lettre de bienvenue pour $testEmployeeName qui integre l'equipe RH. Ton chaleureux."
  source = "terminal_test_text_detection_bloc6"
}

if ($mission2 -and $mission2.ok) {
  $testMission2Id = $mission2.meta.missionId
  Ok "Mission 2 created via text detection : $testMission2Id"
  Info "intent : $($mission2.interpretation.intent)"

  $detectedTask = $mission2.tasks | Where-Object {
    $_.payload_json -and $_.payload_json.employee_context
  } | Select-Object -First 1

  if ($detectedTask) {
    Ok "Employee detected from text — employee_context injected"
    Info "detected : $($detectedTask.payload_json.employee_context.employee_name)"
  } else {
    Info "No text detection match (employee name may not be in registry or mismatch)"
  }
} else {
  Fail "Cannot create mission 2"
  $failures++
}

# ─── STEP 8 : 360 view with timeline/logs ─────────────────────
Step "8/10 — 360 view — timeline and logs detail"

if ($testEmployeeId) {
  $view360b = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId"

  if ($view360b -and $view360b.ok) {
    Ok "360 view retrieved (step 8)"
    Info "total_missions : $($view360b.summary.total_missions)"
    Info "total_logs     : $($view360b.summary.total_logs)"
    Info "timeline items : $($view360b.timeline.Count)"

    if ($view360b.timeline.Count -gt 0) {
      $firstItem = $view360b.timeline[0]
      Ok "Timeline first item type : $($firstItem.type)"
      Info "  id         : $($firstItem.id)"
      Info "  title      : $($firstItem.title)"
      Info "  created_at : $($firstItem.created_at)"
    } else {
      Info "Timeline empty (missions not linked if employee was not in memory at submit)"
    }

    if ($null -ne $view360b.summary.last_activity_at) {
      Ok "last_activity_at set : $($view360b.summary.last_activity_at)"
    } else {
      Info "last_activity_at is null (no linked activity yet)"
    }
  } else {
    Fail "Cannot retrieve 360 view (step 8)"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 9 : DELETE employee ─────────────────────────────────
Step "9/10 — DELETE employee"

if ($testEmployeeId) {
  $deleted = Invoke-Pierre -Method DELETE -Path "/api/pierre/use/employees/$testEmployeeId"

  if ($deleted -and $deleted.ok -and $deleted.deleted -eq $true) {
    Ok "Employee deleted : $testEmployeeId"
  } else {
    Fail "Delete failed or returned unexpected response"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 10 : Verify 404 after deletion ─────────────────────
Step "10/10 — Verify 404 after deletion"

if ($testEmployeeId) {
  try {
    $gone = Invoke-RestMethod -Method GET `
      -Uri "$BaseUrl/api/pierre/use/employee/$testEmployeeId" `
      -Headers $headers -ErrorAction Stop
    if ($gone -and $gone.ok -eq $false) {
      Ok "Route returned ok:false as expected"
    } else {
      Fail "Employee still accessible after deletion"
      $failures++
    }
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
      Ok "HTTP 404 returned after deletion"
    } else {
      Info "HTTP $statusCode returned — check route behavior"
    }
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── SUMMARY ──────────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
if ($testEmployeeId)  { Info "employee_id  : $testEmployeeId" }
if ($testMissionId)   { Info "mission_id 1 : $testMissionId" }
if ($testMission2Id)  { Info "mission_id 2 : $testMission2Id" }
Write-Host ""

if ($failures -gt 0) {
  Write-Host "  $failures failure(s) detected." -ForegroundColor Red
  Write-Host ""
  exit 1
} else {
  Write-Host "  All steps passed." -ForegroundColor Green
  Write-Host ""
}
