# Pierre HR Engine — Employee Actions API Test Script (Bloc 17)
# PS5 compatible: no ?., no ??, no typographic quotes
# Usage: $env:PIERRE_TEST_TOKEN = "your-bearer-token"; .\scripts\pierre-employee-actions-test.ps1

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$EmployeeId = "emp-test-001",
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$Token = $env:PIERRE_TEST_TOKEN
if (-not $Token) {
  Write-Host "[SKIP] PIERRE_TEST_TOKEN not set. Skipping live API tests." -ForegroundColor Yellow
  exit 0
}

$Headers = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }
$Passed = 0
$Failed = 0
$Skipped = 0
$Results = @()

function Assert-Step {
  param([string]$Name, [scriptblock]$Body)
  try {
    $result = & $Body
    if ($result -eq $false) {
      $script:Failed++
      $script:Results += "[FAIL] $Name"
      Write-Host "[FAIL] $Name" -ForegroundColor Red
    } else {
      $script:Passed++
      $script:Results += "[PASS] $Name"
      if ($Verbose) { Write-Host "[PASS] $Name" -ForegroundColor Green }
    }
  } catch {
    $script:Failed++
    $msg = $_.Exception.Message
    $script:Results += "[FAIL] $Name — $msg"
    Write-Host "[FAIL] $Name — $msg" -ForegroundColor Red
  }
}

function Invoke-PierreGet {
  param([string]$Path)
  $uri = "$BaseUrl$Path"
  $resp = Invoke-WebRequest -Uri $uri -Headers $Headers -Method GET -UseBasicParsing
  return $resp
}

function Invoke-PierrePost {
  param([string]$Path, [string]$Body)
  $uri = "$BaseUrl$Path"
  $resp = Invoke-WebRequest -Uri $uri -Headers $Headers -Method POST -Body $Body -UseBasicParsing
  return $resp
}

function Parse-Json {
  param([string]$Json)
  return $Json | ConvertFrom-Json
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pierre Employee Actions — API Tests   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Base URL : $BaseUrl"
Write-Host "  EmployeeId: $EmployeeId"
Write-Host ""

# ══════════════════════════════════════════════════════════
# 1. GET /api/pierre/use/employee/[employeeId]/actions
# ══════════════════════════════════════════════════════════

Write-Host "--- 1. GET employee actions ---" -ForegroundColor Yellow

Assert-Step "GET employee actions returns 200" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  return $r.StatusCode -eq 200
}

Assert-Step "GET employee actions returns ok:true" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  return $j.ok -eq $true
}

Assert-Step "GET employee actions response has suggested_actions array" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  return $j.suggested_actions -ne $null
}

Assert-Step "GET employee actions response has summary object" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  return $j.summary -ne $null
}

Assert-Step "GET employee actions summary has total_actions field" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  $total = $j.summary.total_actions
  return $total -ne $null
}

Assert-Step "GET employee actions has employee_actions_endpoint" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  return $j.employee_actions_endpoint -ne $null
}

Assert-Step "GET employee actions endpoint path contains employee id" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  return ($j.employee_actions_endpoint -like "*$EmployeeId*")
}

Assert-Step "GET employee actions with domain=onboarding filter returns only onboarding" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions?domain=onboarding"
  $j = Parse-Json $r.Content
  if ($j.suggested_actions.Count -eq 0) { return $true }
  $nonOnboarding = $j.suggested_actions | Where-Object { $_.domain -ne "onboarding" }
  return ($nonOnboarding.Count -eq 0)
}

Assert-Step "GET employee actions with governance=auto_safe returns only auto_safe" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions?governance=auto_safe"
  $j = Parse-Json $r.Content
  if ($j.suggested_actions.Count -eq 0) { return $true }
  $nonSafe = $j.suggested_actions | Where-Object { $_.governance -ne "auto_safe" }
  return ($nonSafe.Count -eq 0)
}

Assert-Step "GET employee actions suggestion has required fields (action_type, domain, label_fr, risk, governance, confidence)" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  if ($j.suggested_actions.Count -eq 0) { return $true }
  $first = $j.suggested_actions[0]
  return ($first.action_type -ne $null -and
          $first.domain -ne $null -and
          $first.label_fr -ne $null -and
          $first.risk -ne $null -and
          $first.governance -ne $null -and
          $first.confidence -ne $null)
}

Assert-Step "GET employee actions summary has_sensitive is boolean" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  $hs = $j.summary.has_sensitive
  return ($hs -eq $true -or $hs -eq $false)
}

Assert-Step "GET employee actions summary domains_active is array" {
  $r = Invoke-PierreGet "/api/pierre/use/employee/$EmployeeId/actions"
  $j = Parse-Json $r.Content
  return ($j.summary.domains_active -ne $null)
}

# ══════════════════════════════════════════════════════════
# 2. GET /api/pierre/use/employees/actions
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 2. GET employees actions (global) ---" -ForegroundColor Yellow

Assert-Step "GET global employee actions returns 200" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  return $r.StatusCode -eq 200
}

Assert-Step "GET global employee actions returns ok:true" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return $j.ok -eq $true
}

Assert-Step "GET global employee actions has actions_index object" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return $j.actions_index -ne $null
}

Assert-Step "GET global employee actions has global_summary" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return $j.global_summary -ne $null
}

Assert-Step "GET global employee actions global_summary has total_employees" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return ($j.global_summary.total_employees -ne $null)
}

Assert-Step "GET global employee actions global_summary has total_actions" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return ($j.global_summary.total_actions -ne $null)
}

Assert-Step "GET global employee actions has urgent_employees array" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return ($j.urgent_employees -ne $null)
}

Assert-Step "GET global employee actions has employee_actions_endpoint" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions"
  $j = Parse-Json $r.Content
  return ($j.employee_actions_endpoint -ne $null)
}

Assert-Step "GET global employee actions with governance=auto_safe filter returns only auto_safe" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions?governance=auto_safe"
  $j = Parse-Json $r.Content
  $plans = $j.actions_index.PSObject.Properties
  foreach ($prop in $plans) {
    $actions = $prop.Value.suggested_actions
    if ($actions.Count -gt 0) {
      $nonSafe = $actions | Where-Object { $_.governance -ne "auto_safe" }
      if ($nonSafe.Count -gt 0) { return $false }
    }
  }
  return $true
}

Assert-Step "GET global employee actions with catalog=true returns catalog" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions?catalog=true"
  $j = Parse-Json $r.Content
  return ($j.catalog -ne $null)
}

Assert-Step "GET global employee actions catalog has at least 30 items" {
  $r = Invoke-PierreGet "/api/pierre/use/employees/actions?catalog=true"
  $j = Parse-Json $r.Content
  return ($j.catalog.Count -ge 30)
}

# ══════════════════════════════════════════════════════════
# 3. GET /api/pierre/use/workflows/rh
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 3. GET workflows/rh ---" -ForegroundColor Yellow

Assert-Step "GET workflows/rh returns 200" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  return $r.StatusCode -eq 200
}

Assert-Step "GET workflows/rh returns ok:true" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  return $j.ok -eq $true
}

Assert-Step "GET workflows/rh has catalog array" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  return ($j.catalog -ne $null)
}

Assert-Step "GET workflows/rh catalog has at least 5 entries" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  return ($j.catalog.Count -ge 5)
}

Assert-Step "GET workflows/rh has safety_matrix" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  return ($j.safety_matrix -ne $null)
}

Assert-Step "GET workflows/rh safety_matrix has onboarding entry" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  return ($j.safety_matrix.onboarding -ne $null)
}

Assert-Step "GET workflows/rh safety_matrix onboarding has risk_baseline" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  return ($j.safety_matrix.onboarding.risk_baseline -ne $null)
}

Assert-Step "GET workflows/rh catalog entry has required fields" {
  $r = Invoke-PierreGet "/api/pierre/use/workflows/rh"
  $j = Parse-Json $r.Content
  if ($j.catalog.Count -eq 0) { return $true }
  $first = $j.catalog[0]
  return ($first.domain -ne $null -and
          $first.label_fr -ne $null -and
          $first.risk_baseline -ne $null -and
          $first.approval_required -ne $null)
}

# ══════════════════════════════════════════════════════════
# 4. POST /api/pierre/use/workflows/rh
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 4. POST workflows/rh ---" -ForegroundColor Yellow

Assert-Step "POST workflows/rh dry_run returns 200" {
  $body = '{"input":"Planifier la formation pour un nouveau salarie","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/workflows/rh" $body
  return $r.StatusCode -eq 200
}

Assert-Step "POST workflows/rh dry_run returns ok:true" {
  $body = '{"input":"Planifier la formation pour un nouveau salarie","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/workflows/rh" $body
  $j = Parse-Json $r.Content
  return $j.ok -eq $true
}

Assert-Step "POST workflows/rh returns plan object" {
  $body = '{"input":"Planifier la formation pour un nouveau salarie","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/workflows/rh" $body
  $j = Parse-Json $r.Content
  return ($j.plan -ne $null)
}

Assert-Step "POST workflows/rh plan has domain field" {
  $body = '{"input":"Planifier la formation pour un nouveau salarie","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/workflows/rh" $body
  $j = Parse-Json $r.Content
  return ($j.plan.domain -ne $null)
}

Assert-Step "POST workflows/rh plan has risk_level field" {
  $body = '{"input":"Planifier la formation pour un nouveau salarie","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/workflows/rh" $body
  $j = Parse-Json $r.Content
  return ($j.plan.risk_level -ne $null)
}

Assert-Step "POST workflows/rh missing input returns 400" {
  try {
    $body = '{"dry_run":true}'
    $r = Invoke-PierrePost "/api/pierre/use/workflows/rh" $body
    return $r.StatusCode -eq 400
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    return $statusCode -eq 400
  }
}

# ══════════════════════════════════════════════════════════
# 5. POST /api/pierre/use/employee/[employeeId]/actions (dry_run)
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 5. POST employee actions (dry_run) ---" -ForegroundColor Yellow

Assert-Step "POST employee actions dry_run=true returns 200" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  return $r.StatusCode -eq 200
}

Assert-Step "POST employee actions dry_run returns ok:true" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return $j.ok -eq $true
}

Assert-Step "POST employee actions dry_run returns task_draft not null" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft -ne $null)
}

Assert-Step "POST employee actions dry_run task_draft has execute_at (not scheduled_for)" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  $draft = $j.task_draft
  $hasExecuteAt = $draft.PSObject.Properties.Name -contains "execute_at"
  $hasScheduledFor = $draft.PSObject.Properties.Name -contains "scheduled_for"
  return ($hasExecuteAt -and -not $hasScheduledFor)
}

Assert-Step "POST employee actions dry_run task_draft has status=ready for auto_safe" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft.status -eq "ready")
}

Assert-Step "POST employee actions dry_run auto_safe returns allowed_to_auto_execute=true" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.allowed_to_auto_execute -eq $true)
}

Assert-Step "POST employee actions dry_run approval_required has task_draft with approval_required=true" {
  $body = '{"action_type":"onboarding.contract_send","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  if ($j.task_draft -eq $null) { return $true }
  return ($j.task_draft.approval_required -eq $true)
}

Assert-Step "POST employee actions dry_run manual_only returns allowed_to_auto_execute=false" {
  $body = '{"action_type":"offboarding.termination_letter_draft","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.allowed_to_auto_execute -eq $false)
}

Assert-Step "POST employee actions dry_run manual_only task_draft is null" {
  $body = '{"action_type":"offboarding.termination_letter_draft","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft -eq $null)
}

Assert-Step "POST employee actions missing action_type returns 400" {
  try {
    $body = '{"dry_run":true}'
    $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
    return $r.StatusCode -eq 400
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    return $statusCode -eq 400
  }
}

Assert-Step "POST employee actions invalid action_type returns 400" {
  try {
    $body = '{"action_type":"totally.unknown.action","dry_run":true}'
    $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
    return $r.StatusCode -eq 400
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    return $statusCode -eq 400
  }
}

Assert-Step "POST employee actions dry_run task_draft payload_json has employee_id" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  if ($j.task_draft -eq $null) { return $true }
  return ($j.task_draft.payload_json.employee_id -ne $null)
}

Assert-Step "POST employee actions dry_run task_draft payload_json has action_type" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  if ($j.task_draft -eq $null) { return $true }
  return ($j.task_draft.payload_json.action_type -eq "onboarding.welcome_email")
}

Assert-Step "POST employee actions dry_run task_draft payload_json has action_domain" {
  $body = '{"action_type":"onboarding.welcome_email","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  if ($j.task_draft -eq $null) { return $true }
  return ($j.task_draft.payload_json.action_domain -eq "onboarding")
}

# ══════════════════════════════════════════════════════════
# 6. Mission-control employee_actions_summary
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 6. mission-control employee_actions_summary ---" -ForegroundColor Yellow

Assert-Step "GET mission-control returns 200" {
  $r = Invoke-PierreGet "/api/pierre/use/mission-control"
  return $r.StatusCode -eq 200
}

Assert-Step "GET mission-control has employee_actions_summary field" {
  $r = Invoke-PierreGet "/api/pierre/use/mission-control"
  $j = Parse-Json $r.Content
  $hasField = $j.PSObject.Properties.Name -contains "employee_actions_summary"
  return $hasField
}

Assert-Step "GET mission-control employee_actions_summary is null or has total_actions" {
  $r = Invoke-PierreGet "/api/pierre/use/mission-control"
  $j = Parse-Json $r.Content
  $eas = $j.employee_actions_summary
  if ($eas -eq $null) { return $true }
  return ($eas.total_actions -ne $null)
}

# ══════════════════════════════════════════════════════════
# 7. Security — blocked/manual_only gates
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 7. Security gate invariants ---" -ForegroundColor Yellow

Assert-Step "POST contract_termination_prep dry_run returns task_draft null" {
  $body = '{"action_type":"contract.termination_prep","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft -eq $null)
}

Assert-Step "POST payroll.salary_review_draft dry_run returns task_draft null" {
  $body = '{"action_type":"payroll.salary_review_draft","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft -eq $null)
}

Assert-Step "POST interview.disciplinary_prep dry_run returns task_draft null" {
  $body = '{"action_type":"interview.disciplinary_prep","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft -eq $null)
}

Assert-Step "POST communication.sensitive_communication_prep dry_run returns task_draft null" {
  $body = '{"action_type":"communication.sensitive_communication_prep","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.task_draft -eq $null)
}

Assert-Step "POST offboarding.termination_letter_draft returns allowed_to_auto_execute false" {
  $body = '{"action_type":"offboarding.termination_letter_draft","dry_run":true}'
  $r = Invoke-PierrePost "/api/pierre/use/employee/$EmployeeId/actions" $body
  $j = Parse-Json $r.Content
  return ($j.allowed_to_auto_execute -eq $false)
}

# ══════════════════════════════════════════════════════════
# 8. Auth protection
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "--- 8. Auth protection ---" -ForegroundColor Yellow

Assert-Step "GET employee actions without token returns 401" {
  try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/pierre/use/employee/$EmployeeId/actions" -Headers $noAuthHeaders -Method GET -UseBasicParsing
    return $r.StatusCode -eq 401
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    return $statusCode -eq 401
  }
}

Assert-Step "GET employees/actions without token returns 401" {
  try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/pierre/use/employees/actions" -Headers $noAuthHeaders -Method GET -UseBasicParsing
    return $r.StatusCode -eq 401
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    return $statusCode -eq 401
  }
}

Assert-Step "GET workflows/rh without token returns 401" {
  try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/pierre/use/workflows/rh" -Headers $noAuthHeaders -Method GET -UseBasicParsing
    return $r.StatusCode -eq 401
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    return $statusCode -eq 401
  }
}

# ══════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Passed : $Passed" -ForegroundColor Green
Write-Host "  Failed : $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Skipped: $Skipped" -ForegroundColor Yellow
Write-Host ""

if ($Failed -gt 0) {
  Write-Host "Failed steps:" -ForegroundColor Red
  $Results | Where-Object { $_ -like "[FAIL]*" } | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Host ""
  exit 1
}

Write-Host "All steps passed." -ForegroundColor Green
exit 0
