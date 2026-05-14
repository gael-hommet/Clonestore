$ErrorActionPreference = "Stop"

# ============================================================
# Pierre Bloc 8 - Real Execution Test
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

  if ($null -eq $Object) {
    return $null
  }

  $Property = $Object.PSObject.Properties[$Name]

  if ($null -eq $Property) {
    return $null
  }

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

        try {
          return $RawBody | ConvertFrom-Json
        }
        catch {
          return [pscustomobject]@{
            ok = $false
            error = $RawBody
            status = $StatusCode
          }
        }
      }
      catch {
        return [pscustomobject]@{
          ok = $false
          error = $_.Exception.Message
          status = 0
        }
      }
    }

    Write-Host "MESSAGE: $($_.Exception.Message)" -ForegroundColor Yellow

    return [pscustomobject]@{
      ok = $false
      error = $_.Exception.Message
      status = 0
    }
  }
}

# ============================================================
# 1 - Submit mission
# ============================================================

Write-Step "1 - Submit mission"

$SubmitBody = @{
  input = "Pierre, genere un document RH recapitulatif interne sur les regles d'onboarding de l'entreprise. Aucun email a envoyer, aucun salarie specifique, aucun risque sensible."
  source = "terminal_bloc8_execution_test"
  autonomy_level = "validation_smart"
}

$SubmitResult = Invoke-Pierre -Method "POST" -Path "/api/pierre/use/submit" -Body $SubmitBody

$MissionId = $null
$Tasks = @()

if ($SubmitResult -and (Get-Prop $SubmitResult "ok") -eq $true) {
  $Mission = Get-Prop $SubmitResult "mission"

  if ($null -ne $Mission) {
    $MissionId = Get-Prop $Mission "id"
  }

  if ([string]::IsNullOrWhiteSpace($MissionId)) {
    $MissionId = Get-Prop $SubmitResult "missionId"
  }

  $TasksRaw = Get-Prop $SubmitResult "tasks"

  if ($null -ne $TasksRaw) {
    $Tasks = @($TasksRaw)
  }

  Write-Pass "Mission creee. Mission ID: $MissionId"
  Write-Host "Tasks count from submit: $($Tasks.Count)" -ForegroundColor Gray
}
else {
  $ErrorText = Get-Prop $SubmitResult "error"
  Write-Fail "Mission non creee. $ErrorText"
}

# ============================================================
# 2 - Fetch mission tasks if needed
# ============================================================

Write-Step "2 - Check tasks"

if ($Tasks.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($MissionId)) {
  $MissionResult = Invoke-Pierre -Method "GET" -Path "/api/pierre/use/mission/$MissionId"

  if ($MissionResult -and (Get-Prop $MissionResult "ok") -eq $true) {
    $TasksRaw = Get-Prop $MissionResult "tasks"

    if ($null -ne $TasksRaw) {
      $Tasks = @($TasksRaw)
    }

    Write-Host "Tasks count from mission route: $($Tasks.Count)" -ForegroundColor Gray
  }
}

$TaskToRun = $null

if ($Tasks.Count -gt 0) {
  foreach ($Task in $Tasks) {
    $Status = Get-Prop $Task "status"

    if ($Status -eq "ready" -or $Status -eq "scheduled" -or $Status -eq "draft") {
      $TaskToRun = $Task
      break
    }
  }

  if ($null -eq $TaskToRun) {
    $TaskToRun = $Tasks[0]
  }

  $TaskId = Get-Prop $TaskToRun "id"
  $TaskType = Get-Prop $TaskToRun "type"
  $TaskStatus = Get-Prop $TaskToRun "status"

  Write-Pass "Task trouvee: $TaskId / type=$TaskType / status=$TaskStatus"
}
else {
  Write-Fail "Aucune task trouvee"
}

# ============================================================
# 3 - Run task
# ============================================================

Write-Step "3 - Run first task"

$RunResult = $null
$TaskIdToRun = $null

if ($null -ne $TaskToRun) {
  $TaskIdToRun = Get-Prop $TaskToRun "id"
}

if (-not [string]::IsNullOrWhiteSpace($TaskIdToRun)) {
  $RunResult = Invoke-Pierre -Method "POST" -Path "/api/pierre/use/task/$TaskIdToRun/run"

  if ($RunResult -and (Get-Prop $RunResult "ok") -eq $true) {
    $Outcome = Get-Prop $RunResult "outcome"
    Write-Pass "Task executee. outcome=$Outcome"

    $Artifact = Get-Prop $RunResult "artifact"
    if ($null -ne $Artifact) {
      $ArtifactKind = Get-Prop $Artifact "kind"
      $ArtifactStatus = Get-Prop $Artifact "status"
      Write-Host "Artifact: kind=$ArtifactKind / status=$ArtifactStatus" -ForegroundColor Gray
    }

    $ExecutionResult = Get-Prop $RunResult "execution_result"
    if ($null -ne $ExecutionResult) {
      $Quality = Get-Prop $ExecutionResult "quality"
      if ($null -ne $Quality) {
        $Score = Get-Prop $Quality "score"
        Write-Host "Quality score: $Score" -ForegroundColor Gray
      }
    }
  }
  else {
    $ErrorText = Get-Prop $RunResult "error"
    $ErrorCode = Get-Prop $RunResult "error_code"

    if ([string]::IsNullOrWhiteSpace($ErrorCode)) {
      $ErrorCode = Get-Prop $RunResult "code"
    }

    Write-Fail "Run task echoue. code=$ErrorCode error=$ErrorText"
  }
}
else {
  Write-Fail "Pas de task a executer"
}

# ============================================================
# 4 - Reload task
# ============================================================

Write-Step "4 - Reload task"

if (-not [string]::IsNullOrWhiteSpace($TaskIdToRun)) {
  $ReloadResult = Invoke-Pierre -Method "GET" -Path "/api/pierre/use/task/$TaskIdToRun"

  if ($ReloadResult -and (Get-Prop $ReloadResult "ok") -eq $true) {
    Write-Pass "Task rechargee"

    $ReloadTask = Get-Prop $ReloadResult "task"
    if ($null -ne $ReloadTask) {
      $ReloadStatus = Get-Prop $ReloadTask "status"
      Write-Host "Reload status: $ReloadStatus" -ForegroundColor Gray
    }

    $Logs = Get-Prop $ReloadResult "logs"
    if ($null -ne $Logs) {
      $LogCount = @($Logs).Count
      Write-Host "Logs count: $LogCount" -ForegroundColor Gray
    }
  }
  else {
    $ErrorText = Get-Prop $ReloadResult "error"
    Write-Fail "Reload task echoue. $ErrorText"
  }
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