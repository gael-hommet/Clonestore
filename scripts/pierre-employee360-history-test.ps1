# ============================================================
# Pierre — Employee 360 Operational History Terminal Test (Bloc 7 — 12 steps)
# ============================================================
#
# Usage :
#   $env:PIERRE_TEST_JWT = "eyJ..."
#   .\scripts\pierre-employee360-history-test.ps1
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
$testEmployeeName = "Sophie Renard (bloc7-e2e)"
$failures         = 0

# ─── STEP 1 : Create employee ────────────────────────────────
Step "1/12 — Create test employee"

$created = Invoke-Pierre -Method POST -Path "/api/pierre/use/employees" -Body @{
  employee = @{
    full_name     = $testEmployeeName
    email         = "sophie.renard.bloc7@example.com"
    job_title     = "Responsable Formation"
    department    = "Formation"
    contract_type = "cdi"
    date_entree   = "2023-09-01"
    status        = "active"
    tags          = @("bloc7", "e2e", "formation")
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

# ─── STEP 2 : Submit mission with explicit employee_id ────────
Step "2/12 — Submit mission with explicit employee_id"

$mission = Invoke-Pierre -Method POST -Path "/api/pierre/use/submit" -Body @{
  input       = "Prepare a welcome email for $testEmployeeName joining our Formation team. Professional tone."
  employee_id = $testEmployeeId
  source      = "terminal_test_bloc7"
}

if ($mission -and $mission.ok) {
  $testMissionId = $mission.meta.missionId
  Ok "Mission created : $testMissionId"
  Info "status   : $($mission.mission.status)"
  Info "intent   : $($mission.interpretation.intent)"
  Info "tasks    : $($mission.meta.counts.tasks)"

  # Bloc 7: verify employee_resolution_source
  $brainOutput = $mission.mission.brain_output_json
  if ($brainOutput -and $brainOutput.employee_resolution_source -eq "explicit_id") {
    Ok "employee_resolution_source = 'explicit_id'"
  } elseif ($brainOutput) {
    Info "employee_resolution_source = '$($brainOutput.employee_resolution_source)' (expected explicit_id)"
  }

  # Bloc 7: verify flat employee_id in brain_output_json
  if ($brainOutput -and $brainOutput.employee_id -eq $testEmployeeId) {
    Ok "Flat employee_id present in brain_output_json"
  } else {
    Fail "Flat employee_id missing or wrong in brain_output_json"
    $failures++
  }

  $enrichedTask = $mission.tasks | Where-Object {
    $_.payload_json -and $_.payload_json.employee_context
  } | Select-Object -First 1

  if ($enrichedTask) {
    Ok "employee_context injected in task"
    Info "employee_id   : $($enrichedTask.payload_json.employee_context.employee_id)"
    Info "employee_name : $($enrichedTask.payload_json.employee_context.employee_name)"
  } else {
    Info "No task with employee_context (may not have been in memory at submit time)"
  }
} else {
  Fail "Cannot create mission"
  Info "Check Pierre access in orders table."
  $failures++
}

# ─── STEP 3 : Submit via text detection ──────────────────────
Step "3/12 — Submit mission via text detection (no employee_id)"

$mission2 = Invoke-Pierre -Method POST -Path "/api/pierre/use/submit" -Body @{
  input  = "Redige une lettre de bienvenue pour $testEmployeeName qui integre l'equipe Formation. Ton chaleureux."
  source = "terminal_test_bloc7_text_detection"
}

if ($mission2 -and $mission2.ok) {
  $testMission2Id = $mission2.meta.missionId
  Ok "Mission 2 created : $testMission2Id"

  # Bloc 7: verify employee_resolution_source = text_detection
  $brainOutput2 = $mission2.mission.brain_output_json
  if ($brainOutput2 -and $brainOutput2.employee_resolution_source -eq "text_detection") {
    Ok "employee_resolution_source = 'text_detection'"
  } elseif ($brainOutput2) {
    Info "employee_resolution_source = '$($brainOutput2.employee_resolution_source)'"
  }

  $detectedTask = $mission2.tasks | Where-Object {
    $_.payload_json -and $_.payload_json.employee_context
  } | Select-Object -First 1

  if ($detectedTask) {
    Ok "Employee detected from text — employee_context injected"
    Info "detected : $($detectedTask.payload_json.employee_context.employee_name)"
  } else {
    Info "No text detection match (employee name may not match exactly)"
  }
} else {
  Fail "Cannot create mission 2"
  $failures++
}

# ─── STEP 4 : Submit with explicit name ──────────────────────
Step "4/12 — Submit mission with explicit employee_name"

$mission3 = Invoke-Pierre -Method POST -Path "/api/pierre/use/submit" -Body @{
  input         = "Prepare un compte-rendu de formation pour ce mois."
  employee_name = $testEmployeeName
  source        = "terminal_test_bloc7_explicit_name"
}

if ($mission3 -and $mission3.ok) {
  Ok "Mission 3 created : $($mission3.meta.missionId)"

  $brainOutput3 = $mission3.mission.brain_output_json
  if ($brainOutput3 -and $brainOutput3.employee_resolution_source -eq "explicit_name") {
    Ok "employee_resolution_source = 'explicit_name'"
  } elseif ($brainOutput3) {
    Info "employee_resolution_source = '$($brainOutput3.employee_resolution_source)'"
  }
} else {
  Fail "Cannot create mission 3"
  $failures++
}

# ─── STEP 5 : 360 view with insights ─────────────────────────
Step "5/12 — 360 view — verify insights and new summary fields"

if ($testEmployeeId) {
  $view360 = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId"

  if ($view360 -and $view360.ok) {
    Ok "360 view retrieved"
    Info "missions  : $($view360.summary.total_missions)"
    Info "tasks     : $($view360.summary.total_tasks)"
    Info "documents : $($view360.summary.total_documents)"
    Info "logs      : $($view360.summary.total_logs)"

    # Bloc 7: verify new summary fields
    if ($null -ne $view360.summary.completed_or_done_count) {
      Ok "completed_or_done_count present : $($view360.summary.completed_or_done_count)"
    } else {
      Fail "completed_or_done_count missing from summary"
      $failures++
    }

    if ($view360.summary.PSObject.Properties.Name -contains "last_log_at") {
      Ok "last_log_at field present : $($view360.summary.last_log_at)"
    } else {
      Fail "last_log_at missing from summary"
      $failures++
    }

    # Bloc 7: verify insights object
    if ($null -ne $view360.insights) {
      Ok "insights object present"
      Info "has_pending_approvals  : $($view360.insights.has_pending_approvals)"
      Info "has_blocked_items      : $($view360.insights.has_blocked_items)"
      Info "has_scheduled_followups: $($view360.insights.has_scheduled_followups)"
      Info "needs_attention        : $($view360.insights.needs_attention)"
      Info "latest_activity_label  : $($view360.insights.latest_activity_label)"
      Info "recommended_next_action: $($view360.insights.recommended_next_action)"
    } else {
      Fail "insights object missing from 360 response"
      $failures++
    }

    # Bloc 7: verify timeline has mission_id and task_id fields
    if ($view360.timeline -and $view360.timeline.Count -gt 0) {
      $firstItem = $view360.timeline[0]
      if ($firstItem.PSObject.Properties.Name -contains "mission_id") {
        Ok "Timeline items have mission_id field"
      } else {
        Fail "Timeline items missing mission_id field"
        $failures++
      }
      if ($firstItem.PSObject.Properties.Name -contains "task_id") {
        Ok "Timeline items have task_id field"
      } else {
        Fail "Timeline items missing task_id field"
        $failures++
      }
    } else {
      Info "Timeline empty (missions not linked if employee not in memory at submit)"
    }
  } else {
    Fail "Cannot retrieve 360 view"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 6 : History endpoint — basic ───────────────────────
Step "6/12 — History endpoint (default limit)"

if ($testEmployeeId) {
  $history = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId/history"

  if ($history -and $history.ok) {
    Ok "History retrieved"
    Info "events         : $($history.events.Count)"
    Info "total_events   : $($history.meta.total_events)"
    Info "limit          : $($history.meta.limit)"
    Info "missions group : $($history.grouped.missions.Count)"
    Info "tasks group    : $($history.grouped.tasks.Count)"
    Info "documents group: $($history.grouped.documents.Count)"
    Info "logs group     : $($history.grouped.logs.Count)"

    if ($null -ne $history.employee) {
      Ok "employee field present in history response"
    } else {
      Fail "employee field missing from history response"
      $failures++
    }

    if ($null -ne $history.grouped) {
      Ok "grouped field present in history response"
    } else {
      Fail "grouped field missing from history response"
      $failures++
    }
  } else {
    Fail "Cannot retrieve history"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 7 : History endpoint — custom limit ─────────────────
Step "7/12 — History endpoint with custom limit"

if ($testEmployeeId) {
  $historyLimited = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId/history?limit=5"

  if ($historyLimited -and $historyLimited.ok) {
    Ok "History with limit=5 retrieved"
    Info "events returned : $($historyLimited.events.Count)"
    Info "limit in meta   : $($historyLimited.meta.limit)"

    if ($historyLimited.meta.limit -eq 5) {
      Ok "limit correctly reflected in meta"
    } else {
      Fail "limit mismatch — expected 5, got $($historyLimited.meta.limit)"
      $failures++
    }

    if ($historyLimited.events.Count -le 5) {
      Ok "events count respects limit"
    } else {
      Fail "events count exceeds limit — got $($historyLimited.events.Count)"
      $failures++
    }
  } else {
    Fail "Cannot retrieve history with limit"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 8 : PATCH employee ──────────────────────────────────
Step "8/12 — PATCH employee"

if ($testEmployeeId) {
  $patched = Invoke-Pierre -Method PATCH -Path "/api/pierre/use/employees/$testEmployeeId" -Body @{
    status     = "onboarding"
    department = "Formation - Integration"
  }

  if ($patched -and $patched.ok) {
    Ok "Patch applied"
    Info "new status     : $($patched.employee.status)"
    Info "new department : $($patched.employee.department)"
  } else {
    Fail "Patch failed"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 9 : 360 view after patch ───────────────────────────
Step "9/12 — 360 view after patch — verify insights updated"

if ($testEmployeeId) {
  $view360b = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId"

  if ($view360b -and $view360b.ok) {
    Ok "360 view retrieved (post-patch)"
    Info "employee status     : $($view360b.employee.status)"
    Info "employee department : $($view360b.employee.department)"

    if ($view360b.insights) {
      Ok "insights present after patch"
      Info "recommended_next_action : $($view360b.insights.recommended_next_action)"
    }

    if ($view360b.summary.last_activity_at) {
      Ok "last_activity_at set : $($view360b.summary.last_activity_at)"
    } else {
      Info "last_activity_at is null (no linked activity yet)"
    }
  } else {
    Fail "Cannot retrieve 360 view (post-patch)"
    $failures++
  }
} else {
  Info "Step skipped — no employee ID available"
}

# ─── STEP 10 : History 404 for unknown employee ───────────────
Step "10/12 — History 404 for unknown employee"

try {
  $gone = Invoke-RestMethod -Method GET `
    -Uri "$BaseUrl/api/pierre/use/employee/nonexistent-id-bloc7/history" `
    -Headers $headers -ErrorAction Stop
  if ($gone -and $gone.ok -eq $false) {
    Ok "Route returned ok:false for unknown employee"
  } else {
    Fail "Route did not return error for unknown employee"
    $failures++
  }
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  if ($statusCode -eq 404) {
    Ok "HTTP 404 returned for unknown employee in history"
  } else {
    Info "HTTP $statusCode returned — check route behavior"
  }
}

# ─── STEP 11 : DELETE employee ────────────────────────────────
Step "11/12 — DELETE employee"

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

# ─── STEP 12 : Verify 404 after deletion ─────────────────────
Step "12/12 — Verify 404 after deletion"

if ($testEmployeeId) {
  try {
    $goneEmployee = Invoke-RestMethod -Method GET `
      -Uri "$BaseUrl/api/pierre/use/employee/$testEmployeeId" `
      -Headers $headers -ErrorAction Stop
    if ($goneEmployee -and $goneEmployee.ok -eq $false) {
      Ok "Route returned ok:false as expected after deletion"
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
Write-Host "  SUMMARY — Bloc 7 Employee 360 Operational History" -ForegroundColor Cyan
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
