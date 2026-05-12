# ============================================================
# Pierre — Employee 360 Terminal Workflow Test
# ============================================================
#
# Usage :
#   $env:PIERRE_TEST_JWT = "eyJ..."
#   .\scripts\pierre-employee360-terminal-test.ps1
#
# Options :
#   $env:PIERRE_BASE_URL = "http://localhost:3000"  (défaut)
#
# Ce script ne contient aucun secret en dur.
# ============================================================

param(
  [string]$BaseUrl = $env:PIERRE_BASE_URL
)

if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000" }

# ─── Vérification JWT ───────────────────────────────────────
$jwt = $env:PIERRE_TEST_JWT
if (-not $jwt) {
  Write-Host ""
  Write-Host "[ERREUR] Variable d'environnement PIERRE_TEST_JWT non définie." -ForegroundColor Red
  Write-Host ""
  Write-Host "Définissez-la avant de lancer le script :"
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
      Write-Host "  Réponse : $errorBody" -ForegroundColor DarkRed
    } catch {}
    return $null
  }
}

function Step {
  param([string]$Label)
  Write-Host ""
  Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host "  $Label" -ForegroundColor Cyan
  Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Ok   { param([string]$Msg) Write-Host "  ✓ $Msg" -ForegroundColor Green }
function Fail { param([string]$Msg) Write-Host "  ✗ $Msg" -ForegroundColor Red }
function Info { param([string]$Msg) Write-Host "  · $Msg" -ForegroundColor Gray }

$testEmployeeId   = $null
$testMissionId    = $null
$testEmployeeName = "Amandine Leroy (test)"

# ─── ÉTAPE 1 : Créer un salarié ─────────────────────────────
Step "1/5 — Créer un salarié de test"

$createBody = @{
  employee = @{
    full_name     = $testEmployeeName
    email         = "amandine.leroy.test@example.com"
    job_title     = "Responsable RH Test"
    department    = "Ressources Humaines"
    contract_type = "cdi"
    date_entree   = "2024-01-15"
    status        = "active"
    tags          = @("test", "pierre-e2e")
  }
}

$created = Invoke-Pierre -Method POST -Path "/api/pierre/use/employees" -Body $createBody

if ($created -and $created.ok) {
  $testEmployeeId = $created.employee.id
  Ok "Salarié créé : $testEmployeeName"
  Info "id       : $testEmployeeId"
  Info "mode     : $($created.mode)"
  Info "count    : $($created.count) salarié(s) en mémoire"
} else {
  Fail "Impossible de créer le salarié."
  Info "Vérifiez que le serveur tourne sur $BaseUrl et que le JWT est valide."
  exit 1
}

# ─── ÉTAPE 2 : Lister les salariés ──────────────────────────
Step "2/5 — Lister les salariés"

$list = Invoke-Pierre -Method GET -Path "/api/pierre/use/employees"

if ($list -and $list.ok) {
  Ok "$($list.count) salarié(s) dans le registre"
  $found = $list.employees | Where-Object { $_.id -eq $testEmployeeId }
  if ($found) {
    Ok "Le salarié de test apparaît bien dans la liste"
  } else {
    Fail "Le salarié créé n'apparaît pas dans la liste — problème de persistance"
  }
} else {
  Fail "Échec de la lecture de la liste des salariés."
}

# ─── ÉTAPE 3 : Soumettre une mission rattachée au salarié ────
Step "3/5 — Soumettre une mission Pierre rattachée au salarié"

$submitBody = @{
  input       = "Prépare un email de bienvenue pour $testEmployeeName, elle rejoint notre équipe RH. Ton professionnel."
  employee_id = $testEmployeeId
  source      = "terminal_test_e2e"
}

$mission = Invoke-Pierre -Method POST -Path "/api/pierre/use/submit" -Body $submitBody

if ($mission -and $mission.ok) {
  $testMissionId = $mission.meta.missionId
  Ok "Mission créée : $testMissionId"
  Info "status     : $($mission.mission.status)"
  Info "intent     : $($mission.interpretation.intent)"
  Info "tasks      : $($mission.meta.counts.tasks)"
  Info "autonomy   : $($mission.meta.autonomyLevel)"

  $enrichedTask = $mission.tasks | Where-Object {
    $_.payload_json -and $_.payload_json.employee_context
  } | Select-Object -First 1

  if ($enrichedTask) {
    Ok "employee_context injecté dans au moins une tâche"
    Info "employee_id : $($enrichedTask.payload_json.employee_context.employee_id)"
    Info "employee_name : $($enrichedTask.payload_json.employee_context.employee_name)"
  } else {
    Info "Aucune tâche avec employee_context (normal si le salarié n'était pas en mémoire au moment de l'interprétation)"
  }
} else {
  Fail "Impossible de créer la mission."
  Info "Vérifiez que l'utilisateur a un accès Pierre actif dans la table orders."
}

# ─── ÉTAPE 4 : Vue 360 du salarié ───────────────────────────
Step "4/5 — Vue 360 du salarié ($testEmployeeId)"

if ($testEmployeeId) {
  $view360 = Invoke-Pierre -Method GET -Path "/api/pierre/use/employee/$testEmployeeId"

  if ($view360 -and $view360.ok) {
    Ok "Vue 360 récupérée"
    Info "missions   : $($view360.summary.total_missions)"
    Info "tasks      : $($view360.summary.total_tasks)"
    Info "documents  : $($view360.summary.total_documents)"
    Info "status     : $($view360.employee.status)"
    if ($view360.summary.total_tasks -gt 0) {
      Ok "Des tâches sont liées à ce salarié — enrichissement fonctionnel"
    } else {
      Info "Aucune tâche liée encore (normal : l'employee_context n'était pas en mémoire lors du submit)"
    }
  } else {
    Fail "Impossible de récupérer la vue 360."
  }
} else {
  Info "Étape ignorée — pas d'ID salarié disponible"
}

# ─── ÉTAPE 5 : Patch + GET unitaire ─────────────────────────
Step "5/5 — PATCH puis GET unitaire sur le salarié"

if ($testEmployeeId) {
  $patch = @{
    status     = "onboarding"
    department = "RH - Intégration"
  }

  $patched = Invoke-Pierre -Method PATCH -Path "/api/pierre/use/employees/$testEmployeeId" -Body $patch

  if ($patched -and $patched.ok) {
    Ok "Patch appliqué"
    Info "status nouveau     : $($patched.employee.status)"
    Info "department nouveau : $($patched.employee.department)"
    Info "full_name conservé : $($patched.employee.full_name)"
  } else {
    Fail "Patch échoué."
  }

  $single = Invoke-Pierre -Method GET -Path "/api/pierre/use/employees/$testEmployeeId"

  if ($single -and $single.ok) {
    Ok "GET unitaire OK : $($single.employee.full_name)"
  } else {
    Fail "GET unitaire échoué."
  }
} else {
  Info "Étape ignorée — pas d'ID salarié disponible"
}

# ─── RÉSUMÉ ─────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
if ($testEmployeeId)  { Info "employee_id  : $testEmployeeId" }
if ($testMissionId)   { Info "mission_id   : $testMissionId" }
Write-Host ""
Write-Host "Pour nettoyer le salarié de test :" -ForegroundColor Yellow
if ($testEmployeeId) {
  Write-Host "  Invoke-RestMethod -Method DELETE -Uri '$BaseUrl/api/pierre/use/employees/$testEmployeeId' -Headers @{ Authorization = `"Bearer `$env:PIERRE_TEST_JWT`" }" -ForegroundColor DarkYellow
}
Write-Host ""
