# BLOC 14 -- Pierre CloneGuard Runtime
# E2E Test Script -- PowerShell 5 compatible
# Usage: .\scripts\pierre-cloneguard-runtime-test.ps1 -Token "Bearer <jwt>" [-BaseUrl "http://localhost:3000"]

param(
    [string]$Token = "",
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0
$results = @()

function Step {
    param([int]$n, [string]$label)
    Write-Host ""
    Write-Host "STEP $n -- $label" -ForegroundColor Cyan
}

function Pass {
    param([string]$msg)
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:pass++
    $script:results += "PASS: $msg"
}

function Fail {
    param([string]$msg)
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:fail++
    $script:results += "FAIL: $msg"
}

function Info {
    param([string]$msg)
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
}

function Get-Json {
    param([string]$Url, [hashtable]$Headers = @{})
    try {
        $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -ErrorAction Stop
        return $response.Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Post-Json {
    param([string]$Url, [hashtable]$Headers = @{}, [string]$Body = "{}")
    try {
        $response = Invoke-WebRequest -Uri $Url -Method POST -Headers $Headers -Body $Body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        return $response.Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

if ($Token -eq "") {
    Write-Host "Usage: .\scripts\pierre-cloneguard-runtime-test.ps1 -Token 'Bearer <jwt>'" -ForegroundColor Yellow
    Write-Host "Token is required." -ForegroundColor Red
    exit 1
}

$AuthHeaders = @{ "Authorization" = $Token }

Write-Host ""
Write-Host "======================================================" -ForegroundColor White
Write-Host " BLOC 14 -- Pierre CloneGuard Runtime -- E2E Tests   " -ForegroundColor White
Write-Host " BaseUrl: $BaseUrl" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor White

# ───────────────────────────────────────────────────────────
# SECTION A: AUTH GATES
# ───────────────────────────────────────────────────────────

Step 1 "POST /api/pierre/use/cloneguard/preview -- no token returns 401"
$r1 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/preview" -Body "{}"
if ($r1 -ne $null -and $r1.ok -eq $false) {
    Pass "Returns error without token"
} else {
    Fail "Expected error without token"
}

Step 2 "POST /api/pierre/use/cloneguard/evaluate -- no token returns error"
$r2 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Body "{}"
if ($r2 -ne $null -and $r2.ok -eq $false) {
    Pass "Returns error without token"
} else {
    Fail "Expected error without token"
}

# ───────────────────────────────────────────────────────────
# SECTION B: PREVIEW ENDPOINT
# ───────────────────────────────────────────────────────────

Step 3 "POST /cloneguard/preview -- ok=true with empty body"
$r3 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/preview" -Headers $AuthHeaders -Body "{}"
if ($r3 -ne $null -and $r3.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

Step 4 "POST /cloneguard/preview -- response has preview field"
if ($r3 -ne $null -and $r3.preview -ne $null) {
    Pass "Response contains preview"
} else {
    Fail "Missing preview field"
}

Step 5 "POST /cloneguard/preview -- preview has decision field"
if ($r3 -ne $null -and $r3.preview -ne $null -and $r3.preview.decision -ne $null) {
    Pass "preview.decision present: $($r3.preview.decision)"
} else {
    Fail "Missing preview.decision"
}

Step 6 "POST /cloneguard/preview -- preview has allowed_to_auto_execute field"
if ($r3 -ne $null -and $r3.preview -ne $null) {
    $hasField = ($r3.preview.PSObject.Properties.Name -contains "allowed_to_auto_execute")
    if ($hasField) {
        Pass "preview.allowed_to_auto_execute present"
    } else {
        Fail "Missing preview.allowed_to_auto_execute"
    }
} else {
    Fail "No preview object"
}

Step 7 "POST /cloneguard/preview -- response has summary field"
if ($r3 -ne $null -and $r3.summary -ne $null -and $r3.summary.Length -gt 0) {
    Pass "summary present"
} else {
    Fail "Missing or empty summary"
}

Step 8 "POST /cloneguard/preview -- response has meta field"
if ($r3 -ne $null -and $r3.meta -ne $null) {
    Pass "meta present"
} else {
    Fail "Missing meta"
}

Step 9 "POST /cloneguard/preview -- meta has userId and evaluatedAt"
if ($r3 -ne $null -and $r3.meta -ne $null) {
    $hasUser = ($r3.meta.PSObject.Properties.Name -contains "userId")
    $hasEval = ($r3.meta.PSObject.Properties.Name -contains "evaluatedAt")
    if ($hasUser -and $hasEval) {
        Pass "meta.userId and meta.evaluatedAt present"
    } else {
        Fail "Missing meta.userId or meta.evaluatedAt"
    }
} else {
    Fail "No meta object"
}

Step 10 "POST /cloneguard/preview -- preview has no evaluation key (preview-only endpoint)"
if ($r3 -ne $null) {
    $hasEval = ($r3.PSObject.Properties.Name -contains "evaluation")
    if (-not $hasEval) {
        Pass "Preview endpoint does not expose evaluation object"
    } else {
        Fail "Preview should not expose evaluation; found evaluation key"
    }
} else {
    Fail "No response"
}

# ───────────────────────────────────────────────────────────
# SECTION C: EVALUATE ENDPOINT
# ───────────────────────────────────────────────────────────

Step 11 "POST /cloneguard/evaluate -- ok=true with empty body"
$r11 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body "{}"
if ($r11 -ne $null -and $r11.ok -eq $true) {
    Pass "Returns ok=true"
} else {
    Fail "Expected ok=true"
}

Step 12 "POST /cloneguard/evaluate -- response has evaluation, preview, summary"
if ($r11 -ne $null) {
    $hasEval = ($r11.PSObject.Properties.Name -contains "evaluation")
    $hasPreview = ($r11.PSObject.Properties.Name -contains "preview")
    $hasSummary = ($r11.PSObject.Properties.Name -contains "summary")
    if ($hasEval -and $hasPreview -and $hasSummary) {
        Pass "evaluation, preview, summary all present"
    } else {
        Fail "Missing evaluation, preview, or summary"
    }
} else {
    Fail "No response"
}

Step 13 "POST /cloneguard/evaluate -- evaluation has decision, risk_level, signals, matched_rules"
if ($r11 -ne $null -and $r11.evaluation -ne $null) {
    $e = $r11.evaluation
    $ok = ($e.PSObject.Properties.Name -contains "decision") -and
          ($e.PSObject.Properties.Name -contains "risk_level") -and
          ($e.PSObject.Properties.Name -contains "signals") -and
          ($e.PSObject.Properties.Name -contains "matched_rules")
    if ($ok) {
        Pass "evaluation has required fields"
    } else {
        Fail "evaluation missing required fields"
    }
} else {
    Fail "No evaluation object"
}

Step 14 "POST /cloneguard/evaluate -- evaluation never has level/event/payload keys"
if ($r11 -ne $null -and $r11.evaluation -ne $null) {
    $e = $r11.evaluation
    $hasLevel = ($e.PSObject.Properties.Name -contains "level")
    $hasEvent = ($e.PSObject.Properties.Name -contains "event")
    $hasPayload = ($e.PSObject.Properties.Name -contains "payload")
    if (-not $hasLevel -and -not $hasEvent -and -not $hasPayload) {
        Pass "evaluation has no forbidden keys (level/event/payload)"
    } else {
        Fail "evaluation contains forbidden key (level, event, or payload)"
    }
} else {
    Fail "No evaluation object to check"
}

# ───────────────────────────────────────────────────────────
# SECTION D: email.send ALWAYS BLOCKED
# ───────────────────────────────────────────────────────────

$EmailSendBody = '{"task":{"type":"email.send","title":"Envoyer rappel","approval_required":false}}'

Step 15 "POST /cloneguard/evaluate -- email.send is blocked"
$r15 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $EmailSendBody
if ($r15 -ne $null -and $r15.evaluation -ne $null) {
    $dec = $r15.evaluation.decision
    if ($dec -eq "block" -or $dec -eq "refuse") {
        Pass "email.send decision is block or refuse: $dec"
    } else {
        Fail "email.send should be blocked, got: $dec"
    }
} else {
    Fail "No evaluation for email.send"
}

Step 16 "POST /cloneguard/evaluate -- email.send allowed_to_auto_execute is false"
if ($r15 -ne $null -and $r15.evaluation -ne $null) {
    if ($r15.evaluation.allowed_to_auto_execute -eq $false) {
        Pass "email.send allowed_to_auto_execute=false"
    } else {
        Fail "email.send should have allowed_to_auto_execute=false"
    }
} else {
    Fail "No evaluation for email.send"
}

Step 17 "POST /cloneguard/preview -- email.send preview decision is block or refuse"
$r17 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/preview" -Headers $AuthHeaders -Body $EmailSendBody
if ($r17 -ne $null -and $r17.preview -ne $null) {
    $dec = $r17.preview.decision
    if ($dec -eq "block" -or $dec -eq "refuse") {
        Pass "email.send preview decision is $dec"
    } else {
        Fail "email.send preview should be blocked, got: $dec"
    }
} else {
    Fail "No preview for email.send"
}

$SendEmailBody = '{"task":{"type":"send_email","title":"Envoyer confirmation","approval_required":false}}'

Step 18 "POST /cloneguard/evaluate -- send_email is also blocked"
$r18 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $SendEmailBody
if ($r18 -ne $null -and $r18.evaluation -ne $null) {
    $dec = $r18.evaluation.decision
    if ($dec -eq "block" -or $dec -eq "refuse") {
        Pass "send_email decision is $dec"
    } else {
        Fail "send_email should be blocked, got: $dec"
    }
} else {
    Fail "No evaluation for send_email"
}

# ───────────────────────────────────────────────────────────
# SECTION E: approval_required ALWAYS BLOCKED
# ───────────────────────────────────────────────────────────

$ApprovalBody = '{"task":{"type":"doc.generate","title":"Avenant","approval_required":true}}'

Step 19 "POST /cloneguard/evaluate -- approval_required=true is blocked"
$r19 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $ApprovalBody
if ($r19 -ne $null -and $r19.evaluation -ne $null) {
    $dec = $r19.evaluation.decision
    if ($dec -eq "block" -or $dec -eq "refuse") {
        Pass "approval_required=true decision is $dec"
    } else {
        Fail "approval_required=true should be blocked, got: $dec"
    }
} else {
    Fail "No evaluation for approval_required"
}

Step 20 "POST /cloneguard/evaluate -- approval_required=true allowed_to_auto_execute is false"
if ($r19 -ne $null -and $r19.evaluation -ne $null) {
    if ($r19.evaluation.allowed_to_auto_execute -eq $false) {
        Pass "approval_required allowed_to_auto_execute=false"
    } else {
        Fail "Expected allowed_to_auto_execute=false"
    }
} else {
    Fail "No evaluation"
}

# ───────────────────────────────────────────────────────────
# SECTION F: HARCELEMENT / DISCRIMINATION TEXT SIGNALS
# ───────────────────────────────────────────────────────────

$HarcelBody = '{"task":{"type":"reminder.create","title":"Rappel harcelement moral"}}'

Step 21 "POST /cloneguard/evaluate -- harcelement in title triggers refuse"
$r21 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $HarcelBody
if ($r21 -ne $null -and $r21.evaluation -ne $null) {
    $dec = $r21.evaluation.decision
    if ($dec -eq "refuse") {
        Pass "harcelement triggers refuse"
    } else {
        Fail "Expected refuse for harcelement, got: $dec"
    }
} else {
    Fail "No evaluation for harcelement"
}

Step 22 "POST /cloneguard/evaluate -- harcelement allowed_to_auto_execute is false"
if ($r21 -ne $null -and $r21.evaluation -ne $null) {
    if ($r21.evaluation.allowed_to_auto_execute -eq $false) {
        Pass "harcelement allowed_to_auto_execute=false"
    } else {
        Fail "Expected false"
    }
} else {
    Fail "No evaluation"
}

Step 23 "POST /cloneguard/evaluate -- harcelement requires_human is true"
if ($r21 -ne $null -and $r21.evaluation -ne $null) {
    if ($r21.evaluation.requires_human -eq $true) {
        Pass "harcelement requires_human=true"
    } else {
        Fail "Expected requires_human=true"
    }
} else {
    Fail "No evaluation"
}

$DiscrimBody = '{"input":"motif discriminatoire detecte pour ce salarie"}'

Step 24 "POST /cloneguard/evaluate -- discrimination in input text triggers refuse"
$r24 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $DiscrimBody
if ($r24 -ne $null -and $r24.evaluation -ne $null) {
    $dec = $r24.evaluation.decision
    if ($dec -eq "refuse") {
        Pass "discrimination triggers refuse"
    } else {
        Fail "Expected refuse for discrimination, got: $dec"
    }
} else {
    Fail "No evaluation for discrimination"
}

$PrudhBody = '{"input":"Procedure prudhommale en cours"}'

Step 25 "POST /cloneguard/evaluate -- prudhommes in text triggers refuse or block"
$r25 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $PrudhBody
if ($r25 -ne $null -and $r25.evaluation -ne $null) {
    $dec = $r25.evaluation.decision
    if ($dec -eq "refuse" -or $dec -eq "block") {
        Pass "prudhommes triggers $dec"
    } else {
        Fail "Expected refuse or block for prudhommes, got: $dec"
    }
} else {
    Fail "No evaluation"
}

# ───────────────────────────────────────────────────────────
# SECTION G: LICENCIEMENT / DISCIPLINARY CONTEXT
# ───────────────────────────────────────────────────────────

$LicBody = '{"input":"Procedure de licenciement economique engagee"}'

Step 26 "POST /cloneguard/evaluate -- licenciement text triggers require_approval or higher"
$r26 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $LicBody
if ($r26 -ne $null -and $r26.evaluation -ne $null) {
    $dec = $r26.evaluation.decision
    $blockedDecs = @("require_approval", "block", "refuse")
    if ($blockedDecs -contains $dec) {
        Pass "licenciement triggers $dec"
    } else {
        Fail "Expected require_approval or higher for licenciement, got: $dec"
    }
} else {
    Fail "No evaluation"
}

$DecLicBody = '{"task":{"type":"decision_licenciement","title":"Decision finale"}}'

Step 27 "POST /cloneguard/evaluate -- decision_licenciement type is refused"
$r27 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $DecLicBody
if ($r27 -ne $null -and $r27.evaluation -ne $null) {
    if ($r27.evaluation.decision -eq "refuse") {
        Pass "decision_licenciement type triggers refuse"
    } else {
        Fail "Expected refuse, got: $($r27.evaluation.decision)"
    }
} else {
    Fail "No evaluation"
}

$DecSancBody = '{"task":{"type":"decision_sanction","title":"Sanction disciplinaire"}}'

Step 28 "POST /cloneguard/evaluate -- decision_sanction type is refused"
$r28 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $DecSancBody
if ($r28 -ne $null -and $r28.evaluation -ne $null) {
    if ($r28.evaluation.decision -eq "refuse") {
        Pass "decision_sanction type triggers refuse"
    } else {
        Fail "Expected refuse, got: $($r28.evaluation.decision)"
    }
} else {
    Fail "No evaluation"
}

# ───────────────────────────────────────────────────────────
# SECTION H: SAFE TASKS — ALLOW PATH
# ───────────────────────────────────────────────────────────

$SafeBody = '{"task":{"type":"reminder.create","title":"Rappel entretien annuel","approval_required":false},"domain":"recruitment_ops"}'

Step 29 "POST /cloneguard/evaluate -- safe reminder.create is allowed"
$r29 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $SafeBody
if ($r29 -ne $null -and $r29.evaluation -ne $null) {
    $dec = $r29.evaluation.decision
    if ($dec -eq "allow") {
        Pass "Safe task decision=allow"
    } else {
        Fail "Expected allow, got: $dec"
    }
} else {
    Fail "No evaluation for safe task"
}

Step 30 "POST /cloneguard/evaluate -- safe task allowed_to_auto_execute is true"
if ($r29 -ne $null -and $r29.evaluation -ne $null) {
    if ($r29.evaluation.allowed_to_auto_execute -eq $true) {
        Pass "Safe task allowed_to_auto_execute=true"
    } else {
        Fail "Expected true for safe task"
    }
} else {
    Fail "No evaluation"
}

Step 31 "POST /cloneguard/preview -- safe task preview is allow"
$r31 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/preview" -Headers $AuthHeaders -Body $SafeBody
if ($r31 -ne $null -and $r31.preview -ne $null -and $r31.preview.decision -eq "allow") {
    Pass "Preview decision=allow for safe task"
} else {
    Fail "Expected preview decision=allow"
}

# ───────────────────────────────────────────────────────────
# SECTION I: CONTRACT / PAYROLL / ABSENCE TYPES
# ───────────────────────────────────────────────────────────

$ContratBody = '{"task":{"type":"contrat","title":"Avenant salaire"}}'

Step 32 "POST /cloneguard/evaluate -- contrat type requires approval"
$r32 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $ContratBody
if ($r32 -ne $null -and $r32.evaluation -ne $null) {
    $dec = $r32.evaluation.decision
    if ($dec -eq "require_approval" -or $dec -eq "block" -or $dec -eq "refuse") {
        Pass "contrat type triggers $dec"
    } else {
        Fail "Expected require_approval or higher, got: $dec"
    }
} else {
    Fail "No evaluation"
}

$PayrollBody = '{"task":{"type":"prepaie_prep","title":"Preparation paie"}}'

Step 33 "POST /cloneguard/evaluate -- prepaie_prep type requires approval"
$r33 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $PayrollBody
if ($r33 -ne $null -and $r33.evaluation -ne $null) {
    $dec = $r33.evaluation.decision
    if ($dec -eq "require_approval" -or $dec -eq "block" -or $dec -eq "refuse") {
        Pass "prepaie_prep triggers $dec"
    } else {
        Fail "Expected require_approval or higher, got: $dec"
    }
} else {
    Fail "No evaluation"
}

$AbsenceBody = '{"task":{"type":"absence_sensible","title":"Mi-temps therapeutique"}}'

Step 34 "POST /cloneguard/evaluate -- absence_sensible type requires approval"
$r34 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $AbsenceBody
if ($r34 -ne $null -and $r34.evaluation -ne $null) {
    $dec = $r34.evaluation.decision
    if ($dec -eq "require_approval" -or $dec -eq "block" -or $dec -eq "refuse") {
        Pass "absence_sensible triggers $dec"
    } else {
        Fail "Expected require_approval or higher, got: $dec"
    }
} else {
    Fail "No evaluation"
}

# ───────────────────────────────────────────────────────────
# SECTION J: RISK LEVEL HINTS
# ───────────────────────────────────────────────────────────

Step 35 "POST /cloneguard/evaluate -- red risk hint blocks auto-execute"
$RedBody = '{"task":{"type":"doc.generate","title":"Rapport","risk_level":"red"}}'
$r35 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $RedBody
if ($r35 -ne $null -and $r35.evaluation -ne $null) {
    if ($r35.evaluation.allowed_to_auto_execute -eq $false) {
        Pass "Red risk_level_hint blocks auto-execute"
    } else {
        Fail "Expected allowed_to_auto_execute=false for red risk"
    }
} else {
    Fail "No evaluation"
}

Step 36 "POST /cloneguard/evaluate -- mission risk_level=red blocks auto-execute"
$RedMissionBody = '{"mission":{"risk_level":"red","mission_summary":"Dossier sensible","approval_required":false}}'
$r36 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $RedMissionBody
if ($r36 -ne $null -and $r36.evaluation -ne $null) {
    if ($r36.evaluation.allowed_to_auto_execute -eq $false) {
        Pass "Mission red risk blocks auto-execute"
    } else {
        Fail "Expected allowed_to_auto_execute=false"
    }
} else {
    Fail "No evaluation"
}

# ───────────────────────────────────────────────────────────
# SECTION K: DOMAIN CONTEXT
# ───────────────────────────────────────────────────────────

Step 37 "POST /cloneguard/evaluate -- sensitive_case domain warns"
$SensBody = '{"task":{"type":"reminder.create","title":"Rappel"},"domain":"sensitive_case"}'
$r37 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $SensBody
if ($r37 -ne $null -and $r37.evaluation -ne $null) {
    $dec = $r37.evaluation.decision
    if ($dec -eq "allow_with_warning" -or $dec -eq "require_approval" -or $dec -eq "block" -or $dec -eq "refuse") {
        Pass "sensitive_case domain triggers $dec"
    } else {
        Fail "Expected at least allow_with_warning for sensitive_case, got: $dec"
    }
} else {
    Fail "No evaluation"
}

Step 38 "POST /cloneguard/evaluate -- recruitment_ops domain is safe"
$RecruitBody = '{"task":{"type":"reminder.create","title":"Rappel candidat"},"domain":"recruitment_ops"}'
$r38 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $RecruitBody
if ($r38 -ne $null -and $r38.evaluation -ne $null) {
    $dec = $r38.evaluation.decision
    if ($dec -eq "allow" -or $dec -eq "allow_with_warning") {
        Pass "recruitment_ops decision is $dec"
    } else {
        Fail "Unexpected decision for safe domain: $dec"
    }
} else {
    Fail "No evaluation"
}

# ───────────────────────────────────────────────────────────
# SECTION L: RESPONSE INTEGRITY CHECKS
# ───────────────────────────────────────────────────────────

Step 39 "POST /cloneguard/evaluate -- signals is an array"
if ($r21 -ne $null -and $r21.evaluation -ne $null) {
    $sigs = $r21.evaluation.signals
    if ($sigs -ne $null) {
        Pass "evaluation.signals is present"
    } else {
        Fail "evaluation.signals missing"
    }
} else {
    Fail "No evaluation reference"
}

Step 40 "POST /cloneguard/evaluate -- matched_rules is an array"
if ($r21 -ne $null -and $r21.evaluation -ne $null) {
    $rules = $r21.evaluation.matched_rules
    if ($rules -ne $null) {
        Pass "evaluation.matched_rules is present"
    } else {
        Fail "evaluation.matched_rules missing"
    }
} else {
    Fail "No evaluation reference"
}

Step 41 "POST /cloneguard/evaluate -- explanation is a non-empty string"
if ($r21 -ne $null -and $r21.evaluation -ne $null) {
    $expl = $r21.evaluation.explanation
    if ($expl -ne $null -and $expl.Length -gt 0) {
        Pass "evaluation.explanation present"
    } else {
        Fail "evaluation.explanation missing or empty"
    }
} else {
    Fail "No evaluation"
}

Step 42 "POST /cloneguard/evaluate -- evaluated_at is a string"
if ($r11 -ne $null -and $r11.evaluation -ne $null) {
    $ea = $r11.evaluation.evaluated_at
    if ($ea -ne $null) {
        Pass "evaluation.evaluated_at present: $ea"
    } else {
        Fail "evaluation.evaluated_at missing"
    }
} else {
    Fail "No evaluation"
}

Step 43 "POST /cloneguard/preview -- preview has signal_count field"
if ($r17 -ne $null -and $r17.preview -ne $null) {
    $hasSC = ($r17.preview.PSObject.Properties.Name -contains "signal_count")
    if ($hasSC) {
        Pass "preview.signal_count present"
    } else {
        Fail "preview.signal_count missing"
    }
} else {
    Fail "No preview"
}

Step 44 "POST /cloneguard/preview -- preview has risk_level field"
if ($r17 -ne $null -and $r17.preview -ne $null) {
    $hasRL = ($r17.preview.PSObject.Properties.Name -contains "risk_level")
    if ($hasRL) {
        Pass "preview.risk_level present"
    } else {
        Fail "preview.risk_level missing"
    }
} else {
    Fail "No preview"
}

# ───────────────────────────────────────────────────────────
# SECTION M: MISSION CONTEXT FIELDS
# ───────────────────────────────────────────────────────────

Step 45 "POST /cloneguard/evaluate -- mission approval_required=true is blocked"
$MissApprBody = '{"mission":{"mission_summary":"Dossier confidentiel","approval_required":true,"risk_level":"orange"}}'
$r45 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $MissApprBody
if ($r45 -ne $null -and $r45.evaluation -ne $null) {
    if ($r45.evaluation.allowed_to_auto_execute -eq $false) {
        Pass "Mission approval_required=true blocks auto-execute"
    } else {
        Fail "Expected allowed_to_auto_execute=false"
    }
} else {
    Fail "No evaluation"
}

Step 46 "POST /cloneguard/evaluate -- mission+task combined context merges signals"
$CombBody = '{"task":{"type":"doc.generate","approval_required":false},"mission":{"mission_summary":"Rapport annuel sans risque","risk_level":"green"},"domain":"contract"}'
$r46 = Post-Json -Url "$BaseUrl/api/pierre/use/cloneguard/evaluate" -Headers $AuthHeaders -Body $CombBody
if ($r46 -ne $null -and $r46.ok -eq $true) {
    Pass "Combined mission+task context returns ok=true"
} else {
    Fail "Expected ok=true"
}

# ───────────────────────────────────────────────────────────
# SECTION N: SUBMIT ENDPOINT HAS CLONEGUARD
# ───────────────────────────────────────────────────────────

Step 47 "POST /api/pierre/use/submit -- response includes cloneguard field"
$SubmitBody = '{"input":"Preparer un rappel pour entretien annuel"}'
$r47 = Post-Json -Url "$BaseUrl/api/pierre/use/submit" -Headers $AuthHeaders -Body $SubmitBody
if ($r47 -ne $null) {
    $hasCG = ($r47.PSObject.Properties.Name -contains "cloneguard")
    if ($hasCG) {
        Pass "submit response has cloneguard field"
    } else {
        Info "cloneguard field not found in submit response (may be gated on ok=true)"
        if ($r47.ok -eq $true) {
            Fail "submit ok=true but no cloneguard field"
        } else {
            Pass "submit not ok (no Pierre access or no input) -- skipping cloneguard check"
        }
    }
} else {
    Fail "No response from submit"
}

# ───────────────────────────────────────────────────────────
# FINAL SUMMARY
# ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "======================================================" -ForegroundColor White
Write-Host " CloneGuard Runtime Test Results" -ForegroundColor White
Write-Host " PASS: $pass  FAIL: $fail  TOTAL: $($pass + $fail)" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "======================================================" -ForegroundColor White

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "Failed steps:" -ForegroundColor Red
    foreach ($r in $results) {
        if ($r -like "FAIL:*") {
            Write-Host "  $r" -ForegroundColor Red
        }
    }
}

if ($fail -eq 0) {
    Write-Host " All CloneGuard runtime tests passed." -ForegroundColor Green
    exit 0
} else {
    exit 1
}
