$ErrorActionPreference = "Stop"

# ============================================================
# Pierre Bloc 9 - Workflow Engine E2E Test
# Tests the HR Workflow Engine V1 integration in submit/route.ts
# Compatible PowerShell 5/7
# ============================================================

$BaseUrl = $env:PIERRE_BASE_URL
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = "http://localhost:3000"
}

$Token = $env:PIERRE_TEST_TOKEN
if ([string]::IsNullOrWhiteSpace($Token)) {
  $Token = $env:PIERRE_TEST_JWT
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Host "[FATAL] Token manquant. Definis PIERRE_TEST_TOKEN avant de lancer le script." -ForegroundColor Red
  exit 1
}

$Token = [string]$Token
$Token = $Token.Replace("`r", "").Replace("`n", "").Trim()

$QuoteChars = [char[]]@(
  [char]0x22,
  [char]0x27,
  [char]0x201C,
  [char]0x201D,
  [char]0x2018,
  [char]0x2019,
  [char]0x20
)

$Token = $Token.Trim($QuoteChars)

$DotCount = @($Token.ToCharArray() | Where-Object { $_ -eq "." }).Count

Write-Host "BASE URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "TOKEN LENGTH: $($Token.Length)" -ForegroundColor Cyan
Write-Host "DOTS: $DotCount" -ForegroundColor Cyan

if (-not $Token.StartsWith("eyJ")) {
  Write-Host "[FATAL] Token invalide : il ne commence pas par eyJ." -ForegroundColor Red
  exit 1
}

if ($DotCount -ne 2) {
  Write-Host "[FATAL] Token invalide : un JWT doit avoir exactement 2 points." -ForegroundColor Red
  exit 1
}

$AuthHeaders = @{
  Authorization = "Bearer $Token"
}

$Pass = 0
$Fail = 0

function Get-Prop {
  param(
    [object]$Object,
    [string]$Name
  )
  if ($null -eq $Object) { return $null }
  $Property = $Object.PSObject.Properties[$Name]
  if ($null -eq $Property) { return $null }
  return $Property.Value
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==== $Message ====" -ForegroundColor Cyan
}

function Write-Pass {
  param([string]$Message)
  Write-Host "[PASS] $Message" -ForegroundColor Green
  $script:Pass = $script:Pass + 1
}

function Write-Fail {
  param([string]$Message)
  Write-Host "[FAIL] $Message" -ForegroundColor Red
  $script:Fail = $script:Fail + 1
}

function Write-Info {
  param([string]$Message)
  Write-Host "  $Message" -ForegroundColor Gray
}

function Invoke-Pierre {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $Uri = "$BaseUrl$Path"
  try {
    if ($null -ne $Body) {
      $Json = $Body | ConvertTo-Json -Depth 30
      return Invoke-RestMethod `
        -Uri $Uri `
        -Method $Method `
        -Headers $AuthHeaders `
        -ContentType "application/json" `
        -Body $Json `
        -ErrorAction Stop
    }
    return Invoke-RestMethod `
      -Uri $Uri `
      -Method $Method `
      -Headers $AuthHeaders `
      -ErrorAction Stop
  }
  catch {
    Write-Host ""
    Write-Host "[HTTP ERROR] $Method $Path" -ForegroundColor Red
    $ResponseObject = $_.Exception.Response
    if ($null -ne $ResponseObject) {
      try {
        $StatusCode = [int]$ResponseObject.StatusCode
        Write-Host "STATUS: $StatusCode" -ForegroundColor Red
        $Stream = $ResponseObject.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($Stream)
        $RawBody = $Reader.ReadToEnd()
        Write-Host "BODY:" -ForegroundColor Yellow
        Write-Host $RawBody
        try { return $RawBody | ConvertFrom-Json }
        catch {
          return [pscustomobject]@{ ok = $false; error = $RawBody; status = $StatusCode }
        }
      }
      catch {
        return [pscustomobject]@{ ok = $false; error = $_.Exception.Message; status = 0 }
      }
    }
    Write-Host "MESSAGE: $($_.Exception.Message)" -ForegroundColor Yellow
    return [pscustomobject]@{ ok = $false; error = $_.Exception.Message; status = 0 }
  }
}

function Submit-Mission {
  param([string]$Input, [string]$Source)
  return Invoke-Pierre -Method "POST" -Path "/api/pierre/use/submit" -Body @{
    input        = $Input
    source       = $Source
    autonomy_level = "validation_smart"
  }
}

function Assert-WorkflowField {
  param(
    [object]$Plan,
    [string]$FieldName,
    [object]$ExpectedValue,
    [string]$Label
  )
  $Actual = Get-Prop $Plan $FieldName
  if ($Actual -eq $ExpectedValue) {
    Write-Pass "${Label}: ${FieldName} = ${ExpectedValue}"
  }
  else {
    Write-Fail "${Label}: expected ${FieldName} = ${ExpectedValue}, got = ${Actual}"
  }
}

# ============================================================
# 1 - General HR document (no employee, no email)
# ============================================================

Write-Step "1 - General HR document (general_hr domain)"

$Result1 = Submit-Mission `
  -Input "Pierre, genere un document RH recapitulatif interne sur les regles d'onboarding de l'entreprise. Aucun email a envoyer, aucun salarie specifique, aucun risque sensible." `
  -Source "workflow_engine_test_1"

if ((Get-Prop $Result1 "ok") -eq $true) {
  Write-Pass "Mission 1 creee"
  $Plan1 = Get-Prop $Result1 "workflow_plan"
  if ($null -ne $Plan1) {
    Write-Pass "workflow_plan present dans la reponse"
    $Domain1 = Get-Prop $Plan1 "domain"
    Write-Info "domain = $Domain1"
    Write-Info "risk_level = $(Get-Prop $Plan1 'risk_level')"
    Write-Info "approval_required = $(Get-Prop $Plan1 'approval_required')"
    $Tasks1 = Get-Prop $Result1 "tasks"
    if ($null -ne $Tasks1) {
      Write-Info "tasks count = $(@($Tasks1).Count)"
    }
    $Logs1 = Get-Prop $Result1 "logs"
    if ($null -ne $Logs1) {
      Write-Info "logs count = $(@($Logs1).Count)"
      $HasWorkflowAnalyzed = @($Logs1) | Where-Object { (Get-Prop $_ "event_type") -eq "workflow_analyzed" }
      if ($HasWorkflowAnalyzed.Count -gt 0) {
        Write-Pass "Log workflow_analyzed present"
      }
      else {
        Write-Fail "Log workflow_analyzed manquant"
      }
    }
  }
  else {
    Write-Fail "workflow_plan absent de la reponse"
  }
}
else {
  $Err = Get-Prop $Result1 "error"
  Write-Fail "Mission 1 echouee : $Err"
}

# ============================================================
# 2 - Onboarding domain
# ============================================================

Write-Step "2 - Onboarding domain"

$Result2 = Submit-Mission `
  -Input "Preparer l'onboarding d'un nouveau salarie qui arrive lundi. Premier jour, integration, badge, materiel informatique." `
  -Source "workflow_engine_test_2"

if ((Get-Prop $Result2 "ok") -eq $true) {
  Write-Pass "Mission 2 creee"
  $Plan2 = Get-Prop $Result2 "workflow_plan"
  if ($null -ne $Plan2) {
    $Domain2 = Get-Prop $Plan2 "domain"
    Write-Info "domain = $Domain2"
    if ($Domain2 -eq "onboarding") {
      Write-Pass "Domaine onboarding detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = onboarding, obtenu = $Domain2"
    }
    $Approval2 = Get-Prop $Plan2 "approval_required"
    Write-Info "approval_required = $Approval2"
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result2 "error"
  Write-Fail "Mission 2 echouee : $Err"
}

# ============================================================
# 3 - Hiring domain
# ============================================================

Write-Step "3 - Hiring domain"

$Result3 = Submit-Mission `
  -Input "Nouvelle embauche en CDI. Dossier a preparer, DPAE, checklist administrative. Prise de poste prevue le 02/06/2026." `
  -Source "workflow_engine_test_3"

if ((Get-Prop $Result3 "ok") -eq $true) {
  Write-Pass "Mission 3 creee"
  $Plan3 = Get-Prop $Result3 "workflow_plan"
  if ($null -ne $Plan3) {
    $Domain3 = Get-Prop $Plan3 "domain"
    Write-Info "domain = $Domain3"
    if ($Domain3 -eq "hiring") {
      Write-Pass "Domaine hiring detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = hiring, obtenu = $Domain3"
    }
    $Tasks3 = Get-Prop $Result3 "tasks"
    if ($null -ne $Tasks3) {
      $TaskCount3 = @($Tasks3).Count
      Write-Info "tasks count = $TaskCount3"
      if ($TaskCount3 -ge 2) {
        Write-Pass "Au moins 2 taches creees pour hiring"
      }
      else {
        Write-Fail "Trop peu de taches pour hiring : $TaskCount3"
      }
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result3 "error"
  Write-Fail "Mission 3 echouee : $Err"
}

# ============================================================
# 4 - Absence domain
# ============================================================

Write-Step "4 - Absence domain"

$Result4 = Submit-Mission `
  -Input "Un salarie est absent depuis lundi sans justificatif. Demander le justificatif, noter l'absence, preparer un suivi." `
  -Source "workflow_engine_test_4"

if ((Get-Prop $Result4 "ok") -eq $true) {
  Write-Pass "Mission 4 creee"
  $Plan4 = Get-Prop $Result4 "workflow_plan"
  if ($null -ne $Plan4) {
    $Domain4 = Get-Prop $Plan4 "domain"
    Write-Info "domain = $Domain4"
    if ($Domain4 -eq "absence") {
      Write-Pass "Domaine absence detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = absence, obtenu = $Domain4"
    }
    $Missing4 = Get-Prop $Plan4 "missing_info"
    if ($null -ne $Missing4) {
      Write-Info "missing_info count = $(@($Missing4).Count)"
    }
    $Logs4 = Get-Prop $Result4 "logs"
    if ($null -ne $Logs4) {
      $MissingLog4 = @($Logs4) | Where-Object { (Get-Prop $_ "event_type") -eq "missing_info_detected" }
      if ($MissingLog4.Count -gt 0) {
        Write-Pass "Log missing_info_detected present"
      }
      else {
        Write-Info "Pas de log missing_info_detected (informations completes ou non requises)"
      }
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result4 "error"
  Write-Fail "Mission 4 echouee : $Err"
}

# ============================================================
# 5 - Payroll prep domain
# ============================================================

Write-Step "5 - Payroll prep domain"

$Result5 = Submit-Mission `
  -Input "Preparer la synthese de pre-paie pour le mois de mai 2026. Elements variables : primes, heures supplementaires, absences. Validation obligatoire avant transmission." `
  -Source "workflow_engine_test_5"

if ((Get-Prop $Result5 "ok") -eq $true) {
  Write-Pass "Mission 5 creee"
  $Plan5 = Get-Prop $Result5 "workflow_plan"
  if ($null -ne $Plan5) {
    $Domain5 = Get-Prop $Plan5 "domain"
    Write-Info "domain = $Domain5"
    if ($Domain5 -eq "payroll_prep") {
      Write-Pass "Domaine payroll_prep detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = payroll_prep, obtenu = $Domain5"
    }
    $Approval5 = Get-Prop $Plan5 "approval_required"
    Write-Info "approval_required = $Approval5"
    if ($Approval5 -eq $true) {
      Write-Pass "approval_required = true pour payroll_prep"
    }
    else {
      Write-Fail "payroll_prep doit avoir approval_required = true"
    }
    $Logs5 = Get-Prop $Result5 "logs"
    if ($null -ne $Logs5) {
      $HumanLog5 = @($Logs5) | Where-Object { (Get-Prop $_ "event_type") -eq "human_validation_required" }
      if ($HumanLog5.Count -gt 0) {
        Write-Pass "Log human_validation_required present"
      }
      else {
        Write-Fail "Log human_validation_required manquant pour payroll_prep"
      }
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result5 "error"
  Write-Fail "Mission 5 echouee : $Err"
}

# ============================================================
# 6 - Sensitive case domain
# ============================================================

Write-Step "6 - Sensitive case domain (harcelement / licenciement)"

$Result6 = Submit-Mission `
  -Input "Procedure disciplinaire pour harcelement moral au sein de l'equipe. Dossier a constituer avant toute decision. Validation humaine obligatoire." `
  -Source "workflow_engine_test_6"

if ((Get-Prop $Result6 "ok") -eq $true) {
  Write-Pass "Mission 6 creee"
  $Plan6 = Get-Prop $Result6 "workflow_plan"
  if ($null -ne $Plan6) {
    $Domain6 = Get-Prop $Plan6 "domain"
    Write-Info "domain = $Domain6"
    if ($Domain6 -eq "sensitive_case") {
      Write-Pass "Domaine sensitive_case detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = sensitive_case, obtenu = $Domain6"
    }

    $Approval6 = Get-Prop $Plan6 "approval_required"
    if ($Approval6 -eq $true) {
      Write-Pass "approval_required = true pour sensitive_case"
    }
    else {
      Write-Fail "sensitive_case doit avoir approval_required = true"
    }

    $BlockedActions6 = Get-Prop $Plan6 "blocked_actions"
    if ($null -ne $BlockedActions6) {
      $BlockedCount6 = @($BlockedActions6).Count
      Write-Info "blocked_actions count = $BlockedCount6"
      if ($BlockedCount6 -ge 3) {
        Write-Pass "Au moins 3 blocked_actions pour sensitive_case"
      }
      else {
        Write-Fail "Trop peu de blocked_actions : $BlockedCount6"
      }
    }
    else {
      Write-Fail "blocked_actions absent du plan"
    }

    $ValidationPolicy6 = Get-Prop $Plan6 "validation_policy"
    if ($null -ne $ValidationPolicy6) {
      $Blocked6 = Get-Prop $ValidationPolicy6 "blocked"
      if ($Blocked6 -eq $true) {
        Write-Pass "validation_policy.blocked = true pour sensitive_case"
      }
      else {
        Write-Fail "validation_policy.blocked doit etre true pour sensitive_case"
      }
    }

    $Logs6 = Get-Prop $Result6 "logs"
    if ($null -ne $Logs6) {
      $SensitiveLog6 = @($Logs6) | Where-Object { (Get-Prop $_ "event_type") -eq "sensitive_case_detected" }
      if ($SensitiveLog6.Count -gt 0) {
        Write-Pass "Log sensitive_case_detected present"
      }
      else {
        Write-Fail "Log sensitive_case_detected manquant pour sensitive_case"
      }
    }

    $Tasks6 = Get-Prop $Result6 "tasks"
    if ($null -ne $Tasks6) {
      $AllApproval6 = $true
      foreach ($T6 in @($Tasks6)) {
        $Tst6 = Get-Prop $T6 "status"
        if ($Tst6 -ne "awaiting_approval") {
          $AllApproval6 = $false
          break
        }
      }
      if ($AllApproval6) {
        Write-Pass "Toutes les taches sensitive_case sont en awaiting_approval"
      }
      else {
        Write-Fail "Certaines taches sensitive_case ne sont pas en awaiting_approval"
      }
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result6 "error"
  Write-Fail "Mission 6 echouee : $Err"
}

# ============================================================
# 7 - Contract domain
# ============================================================

Write-Step "7 - Contract domain"

$Result7 = Submit-Mission `
  -Input "Preparer un avenant au contrat CDI pour modification de la remuneration. Document contractuel a valider avant envoi." `
  -Source "workflow_engine_test_7"

if ((Get-Prop $Result7 "ok") -eq $true) {
  Write-Pass "Mission 7 creee"
  $Plan7 = Get-Prop $Result7 "workflow_plan"
  if ($null -ne $Plan7) {
    $Domain7 = Get-Prop $Plan7 "domain"
    Write-Info "domain = $Domain7"
    if ($Domain7 -eq "contract") {
      Write-Pass "Domaine contract detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = contract, obtenu = $Domain7"
    }
    $Approval7 = Get-Prop $Plan7 "approval_required"
    if ($Approval7 -eq $true) {
      Write-Pass "approval_required = true pour contract"
    }
    else {
      Write-Fail "contract doit avoir approval_required = true"
    }
    $BlockedActions7 = Get-Prop $Plan7 "blocked_actions"
    if ($null -ne $BlockedActions7) {
      Write-Info "blocked_actions count = $(@($BlockedActions7).Count)"
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result7 "error"
  Write-Fail "Mission 7 echouee : $Err"
}

# ============================================================
# 8 - Offboarding domain
# ============================================================

Write-Step "8 - Offboarding domain"

$Result8 = Submit-Mission `
  -Input "Salarie qui demissionne. Preparer la checklist de sortie, les documents de fin de contrat, le solde tout compte." `
  -Source "workflow_engine_test_8"

if ((Get-Prop $Result8 "ok") -eq $true) {
  Write-Pass "Mission 8 creee"
  $Plan8 = Get-Prop $Result8 "workflow_plan"
  if ($null -ne $Plan8) {
    $Domain8 = Get-Prop $Plan8 "domain"
    Write-Info "domain = $Domain8"
    if ($Domain8 -eq "offboarding") {
      Write-Pass "Domaine offboarding detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = offboarding, obtenu = $Domain8"
    }
    $RiskLevel8 = Get-Prop $Plan8 "risk_level"
    Write-Info "risk_level = $RiskLevel8"
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result8 "error"
  Write-Fail "Mission 8 echouee : $Err"
}

# ============================================================
# 9 - Interview domain
# ============================================================

Write-Step "9 - Interview domain"

$Result9 = Submit-Mission `
  -Input "Convoquer un salarie pour son entretien annuel la semaine prochaine. Preparer la trame et la convocation officielle." `
  -Source "workflow_engine_test_9"

if ((Get-Prop $Result9 "ok") -eq $true) {
  Write-Pass "Mission 9 creee"
  $Plan9 = Get-Prop $Result9 "workflow_plan"
  if ($null -ne $Plan9) {
    $Domain9 = Get-Prop $Plan9 "domain"
    Write-Info "domain = $Domain9"
    if ($Domain9 -eq "interview") {
      Write-Pass "Domaine interview detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = interview, obtenu = $Domain9"
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result9 "error"
  Write-Fail "Mission 9 echouee : $Err"
}

# ============================================================
# 10 - Verify task run still works on a ready task
# ============================================================

Write-Step "10 - Execute a ready task from mission 1 (general_hr)"

$MissionId1 = $null
$TaskToRun10 = $null

if ((Get-Prop $Result1 "ok") -eq $true) {
  $Mission1 = Get-Prop $Result1 "mission"
  if ($null -ne $Mission1) {
    $MissionId1 = Get-Prop $Mission1 "id"
  }
  if ([string]::IsNullOrWhiteSpace($MissionId1)) {
    $MissionId1 = Get-Prop $Result1 "missionId"
  }
  $Tasks1Raw = Get-Prop $Result1 "tasks"
  if ($null -ne $Tasks1Raw) {
    foreach ($T10 in @($Tasks1Raw)) {
      $Tst10 = Get-Prop $T10 "status"
      if ($Tst10 -eq "ready") {
        $TaskToRun10 = $T10
        break
      }
    }
  }
}

if ($null -eq $TaskToRun10) {
  Write-Info "Pas de tache 'ready' dans mission 1 — etape ignoree"
}
else {
  $TaskId10 = Get-Prop $TaskToRun10 "id"
  Write-Info "Execution de la tache : $TaskId10"
  $RunResult10 = Invoke-Pierre -Method "POST" -Path "/api/pierre/use/task/$TaskId10/run"

  if ((Get-Prop $RunResult10 "ok") -eq $true) {
    $Outcome10 = Get-Prop $RunResult10 "outcome"
    Write-Pass "Tache executee. outcome = $Outcome10"
    $Artifact10 = Get-Prop $RunResult10 "artifact"
    if ($null -ne $Artifact10) {
      $ArtifactKind10 = Get-Prop $Artifact10 "kind"
      Write-Info "artifact.kind = $ArtifactKind10"
    }
  }
  else {
    $ErrCode10 = Get-Prop $RunResult10 "error_code"
    $ErrMsg10 = Get-Prop $RunResult10 "error"
    if ([string]::IsNullOrWhiteSpace($ErrCode10)) {
      $ErrCode10 = Get-Prop $RunResult10 "code"
    }
    Write-Fail "Execution tache echouee : code=$ErrCode10 error=$ErrMsg10"
  }
}

# ============================================================
# 11 - Verify backward-compatible interpretation field
# ============================================================

Write-Step "11 - Verification champ interpretation (compat)"

if ((Get-Prop $Result2 "ok") -eq $true) {
  $Interp2 = Get-Prop $Result2 "interpretation"
  if ($null -ne $Interp2) {
    Write-Pass "Champ interpretation present dans la reponse"
    $InterpSummary2 = Get-Prop $Interp2 "summary"
    $InterpApproval2 = Get-Prop $Interp2 "approval_required"
    $InterpMissing2 = Get-Prop $Interp2 "missing_info"
    Write-Info "interpretation.summary = $($InterpSummary2 -replace '.{80}$','')"
    Write-Info "interpretation.approval_required = $InterpApproval2"
    if ($null -ne $InterpMissing2) {
      Write-Info "interpretation.missing_info count = $(@($InterpMissing2).Count)"
    }
    if (-not [string]::IsNullOrWhiteSpace($InterpSummary2)) {
      Write-Pass "interpretation.summary non vide"
    }
    else {
      Write-Fail "interpretation.summary vide"
    }
  }
  else {
    Write-Fail "Champ interpretation absent"
  }
}
else {
  Write-Info "Etape ignoree (mission 2 echouee)"
}

# ============================================================
# 12 - Verify logs schema (event_type, not level/event/payload)
# ============================================================

Write-Step "12 - Verification schema logs (event_type + meta_json)"

if ((Get-Prop $Result5 "ok") -eq $true) {
  $Logs12 = Get-Prop $Result5 "logs"
  if ($null -ne $Logs12) {
    $AllValid12 = $true
    foreach ($Log12 in @($Logs12)) {
      $EventType12 = Get-Prop $Log12 "event_type"
      $MetaJson12 = Get-Prop $Log12 "meta_json"
      if ([string]::IsNullOrWhiteSpace($EventType12)) {
        $AllValid12 = $false
        Write-Fail "Un log n'a pas de event_type"
        break
      }
      # Verify forbidden columns are not returned as top-level fields
      $LevelField12 = Get-Prop $Log12 "level"
      $EventField12 = Get-Prop $Log12 "event"
      $PayloadField12 = Get-Prop $Log12 "payload"
      if ($null -ne $LevelField12 -or $null -ne $EventField12 -or $null -ne $PayloadField12) {
        Write-Info "Attention : colonnes legacy detectees (level/event/payload) dans un log"
      }
    }
    if ($AllValid12) {
      Write-Pass "Tous les logs ont un event_type valide"
    }
  }
  else {
    Write-Fail "Pas de logs retournes par mission 5"
  }
}
else {
  Write-Info "Etape ignoree (mission 5 echouee)"
}

# ============================================================
# 13 - Verify no scheduled_for in task DB rows
# ============================================================

Write-Step "13 - Verification absence de scheduled_for dans les taches DB"

if ((Get-Prop $Result3 "ok") -eq $true) {
  $Tasks13 = Get-Prop $Result3 "tasks"
  if ($null -ne $Tasks13) {
    $AllNoScheduledFor = $true
    foreach ($T13 in @($Tasks13)) {
      $SF13 = Get-Prop $T13 "scheduled_for"
      if ($null -ne $SF13) {
        $AllNoScheduledFor = $false
        Write-Fail "Tache avec scheduled_for detectee : cela ne doit pas arriver"
        break
      }
      $EA13 = Get-Prop $T13 "execute_at"
      if ($null -ne $EA13) {
        Write-Info "execute_at = $EA13 (correct)"
      }
    }
    if ($AllNoScheduledFor) {
      Write-Pass "Aucune tache n'a de champ scheduled_for (colonne DB invalide)"
    }
  }
  else {
    Write-Fail "Pas de taches retournees par mission 3"
  }
}
else {
  Write-Info "Etape ignoree (mission 3 echouee)"
}

# ============================================================
# 14 - Training domain
# ============================================================

Write-Step "14 - Training domain"

$Result14 = Submit-Mission `
  -Input "Organiser une formation habilitation securite pour les nouveaux salaries. Plan de formation et convocation a preparer." `
  -Source "workflow_engine_test_14"

if ((Get-Prop $Result14 "ok") -eq $true) {
  Write-Pass "Mission 14 creee"
  $Plan14 = Get-Prop $Result14 "workflow_plan"
  if ($null -ne $Plan14) {
    $Domain14 = Get-Prop $Plan14 "domain"
    Write-Info "domain = $Domain14"
    if ($Domain14 -eq "training") {
      Write-Pass "Domaine training detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = training, obtenu = $Domain14"
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result14 "error"
  Write-Fail "Mission 14 echouee : $Err"
}

# ============================================================
# 15 - Employee file domain
# ============================================================

Write-Step "15 - Employee file domain"

$Result15 = Submit-Mission `
  -Input "Dossier salarie incomplet, pieces manquantes a recuperer. Synthese de la completude du dossier a generer." `
  -Source "workflow_engine_test_15"

if ((Get-Prop $Result15 "ok") -eq $true) {
  Write-Pass "Mission 15 creee"
  $Plan15 = Get-Prop $Result15 "workflow_plan"
  if ($null -ne $Plan15) {
    $Domain15 = Get-Prop $Plan15 "domain"
    Write-Info "domain = $Domain15"
    if ($Domain15 -eq "employee_file") {
      Write-Pass "Domaine employee_file detecte correctement"
    }
    else {
      Write-Fail "Domaine attendu = employee_file, obtenu = $Domain15"
    }
  }
  else {
    Write-Fail "workflow_plan absent"
  }
}
else {
  $Err = Get-Prop $Result15 "error"
  Write-Fail "Mission 15 echouee : $Err"
}

# ============================================================
# Resume
# ============================================================

Write-Step "Resume"

Write-Host "PASS: $Pass" -ForegroundColor Green

if ($Fail -gt 0) {
  Write-Host "FAIL: $Fail" -ForegroundColor Red
  exit 1
}

Write-Host "FAIL: 0" -ForegroundColor Green
exit 0
