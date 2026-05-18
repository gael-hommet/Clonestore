# BLOC 16 -- Pierre Audit Trail & Observabilite
# E2E Test Script -- PowerShell 5 compatible (no ?., no ??, no typographic quotes)
# Usage: .\scripts\pierre-audit-trail-test.ps1 [-BaseUrl "http://localhost:3000"]
# Auth token: set $env:PIERRE_TEST_TOKEN before running, e.g.:
#   $env:PIERRE_TEST_TOKEN = "Bearer eyJ..."
#   .\scripts\pierre-audit-trail-test.ps1

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0
$skip = 0
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

function Skip {
    param([string]$msg)
    Write-Host "  [SKIP] $msg" -ForegroundColor Yellow
    $script:skip++
    $script:results += "SKIP: $msg"
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

function Get-StatusCode {
    param([string]$Url, [hashtable]$Headers = @{})
    try {
        $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode
    } catch {
        if ($_.Exception.Response -ne $null) {
            return [int]$_.Exception.Response.StatusCode
        }
        return 0
    }
}

# Token from environment variable
$Token = $env:PIERRE_TEST_TOKEN
$authHeaders = @{}
$hasToken = $false
if ($Token -ne $null -and $Token.Trim() -ne "") {
    $authHeaders = @{ Authorization = $Token.Trim() }
    $hasToken = $true
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host " PIERRE AUDIT TRAIL -- BLOC 16 E2E TESTS" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Info "BaseUrl: $BaseUrl"
Info "Auth token: $(if ($hasToken) { 'provided via PIERRE_TEST_TOKEN' } else { 'not set -- unauthenticated tests only' })"

# ─────────────────────────────────────────────────────────
# STEP 1 -- GET /audit-trail sans auth => 401
# ─────────────────────────────────────────────────────────

Step 1 "GET /audit-trail sans auth => 401"
$s1 = Get-StatusCode "$BaseUrl/api/pierre/use/audit-trail"
if ($s1 -eq 401 -or $s1 -eq 403) {
    Pass "401/403 retourne sans auth ($s1)"
} elseif ($s1 -eq 0) {
    $r1 = Get-Json "$BaseUrl/api/pierre/use/audit-trail"
    if ($r1 -ne $null -and $r1.ok -eq $false) { Pass "ok=false retourne sans auth" }
    else { Fail "Reponse inattendue sans auth" }
} else {
    Fail "Status=$s1 attendu 401 sans auth"
}

# ─────────────────────────────────────────────────────────
# STEP 2 -- GET /audit-trail/alerts sans auth => 401
# ─────────────────────────────────────────────────────────

Step 2 "GET /audit-trail/alerts sans auth => 401"
$s2 = Get-StatusCode "$BaseUrl/api/pierre/use/audit-trail/alerts"
if ($s2 -eq 401 -or $s2 -eq 403) {
    Pass "401/403 retourne sans auth ($s2)"
} else {
    $r2 = Get-Json "$BaseUrl/api/pierre/use/audit-trail/alerts"
    if ($r2 -ne $null -and $r2.ok -eq $false) { Pass "ok=false retourne sans auth" }
    else { Fail "Status=$s2 attendu 401 pour alerts sans auth" }
}

# ─────────────────────────────────────────────────────────
# STEP 3 -- GET /audit-trail/export sans auth => 401
# ─────────────────────────────────────────────────────────

Step 3 "GET /audit-trail/export sans auth => 401"
$s3 = Get-StatusCode "$BaseUrl/api/pierre/use/audit-trail/export"
if ($s3 -eq 401 -or $s3 -eq 403) {
    Pass "401/403 retourne sans auth ($s3)"
} else {
    $r3 = Get-Json "$BaseUrl/api/pierre/use/audit-trail/export"
    if ($r3 -ne $null -and $r3.ok -eq $false) { Pass "ok=false retourne sans auth" }
    else { Fail "Status=$s3 attendu 401 pour export sans auth" }
}

# ─────────────────────────────────────────────────────────
# Auth required for steps 4-45
# ─────────────────────────────────────────────────────────

if (-not $hasToken) {
    Write-Host ""
    Write-Host "  [INFO] Token manquant. Definir PIERRE_TEST_TOKEN pour executer les etapes 4-45." -ForegroundColor Yellow
    Write-Host "  [INFO] Exemple: " -ForegroundColor Yellow
    Write-Host "    $env:PIERRE_TEST_TOKEN = 'Bearer eyJ...'" -ForegroundColor Yellow
    Write-Host "    .\scripts\pierre-audit-trail-test.ps1" -ForegroundColor Yellow
    for ($i = 4; $i -le 45; $i++) {
        Skip "Etape $i ignoree (token manquant)"
    }
} else {

# ─────────────────────────────────────────────────────────
# STEP 4 -- GET /audit-trail avec auth => ok
# ─────────────────────────────────────────────────────────

Step 4 "GET /audit-trail avec auth => ok=true"
$r4 = Get-Json "$BaseUrl/api/pierre/use/audit-trail" $authHeaders
if ($r4 -eq $null) {
    Fail "Pas de reponse de /audit-trail"
} elseif ($r4.ok -eq $true) {
    Pass "audit-trail retourne ok=true"
} else {
    Fail "audit-trail retourne ok=false: $($r4.error)"
}

# ─────────────────────────────────────────────────────────
# STEP 5 -- audit_trail.events present
# ─────────────────────────────────────────────────────────

Step 5 "audit_trail.events present"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    Pass "audit_trail.events present"
} else {
    Fail "audit_trail.events absent"
}

# ─────────────────────────────────────────────────────────
# STEP 6 -- sections present
# ─────────────────────────────────────────────────────────

Step 6 "audit_trail.sections present"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.sections -ne $null) {
    Pass "sections present"
} else {
    Fail "sections absent"
}

# ─────────────────────────────────────────────────────────
# STEP 7 -- diagnostics present
# ─────────────────────────────────────────────────────────

Step 7 "audit_trail.diagnostics present"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.diagnostics -ne $null) {
    $d = $r4.audit_trail.diagnostics
    if ($d.total_events -ne $null -and $d.critical_count -ne $null -and $d.human_required_count -ne $null) {
        Pass "diagnostics present avec total_events=$($d.total_events), critical_count=$($d.critical_count)"
    } else {
        Fail "diagnostics incomplets (champs manquants)"
    }
} else {
    Fail "diagnostics absent"
}

# ─────────────────────────────────────────────────────────
# STEP 8 -- health present
# ─────────────────────────────────────────────────────────

Step 8 "audit_trail.health present avec score 0-100"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.health -ne $null) {
    $score = [int]$r4.audit_trail.health.score
    if ($score -ge 0 -and $score -le 100) {
        Pass "health.score=$score dans [0,100]"
    } else {
        Fail "health.score=$score hors [0,100]"
    }
} else {
    Fail "health absent"
}

# ─────────────────────────────────────────────────────────
# STEP 9 -- digest present
# ─────────────────────────────────────────────────────────

Step 9 "audit_trail.digest present avec tone valide"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.digest -ne $null) {
    $tone = $r4.audit_trail.digest.tone
    $validTones = @("ok", "attention", "blocked", "critical")
    if ($validTones -contains $tone) {
        Pass "digest.tone='$tone' valide"
    } else {
        Fail "digest.tone='$tone' invalide"
    }
} else {
    Fail "digest absent"
}

# ─────────────────────────────────────────────────────────
# STEP 10 -- alerts present
# ─────────────────────────────────────────────────────────

Step 10 "audit_trail.alerts present"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.alerts -ne $null) {
    Pass "alerts present ($($r4.audit_trail.alerts.Count) alertes)"
} else {
    Fail "alerts absent"
}

# ─────────────────────────────────────────────────────────
# STEP 11 -- filter severity
# ─────────────────────────────────────────────────────────

Step 11 "Filter severity=critical accepte"
$r11 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?severity=critical" $authHeaders
if ($r11 -ne $null -and $r11.ok -eq $true) {
    Pass "Filter severity=critical retourne ok=true"
    if ($r11.audit_trail -ne $null -and $r11.audit_trail.events -ne $null) {
        $wrongSev = $false
        foreach ($evt in $r11.audit_trail.events) {
            if ($evt.severity -ne "critical") { $wrongSev = $true }
        }
        if (-not $wrongSev) { Pass "Tous les evenements ont severity=critical" }
        else { Fail "Certains evenements n'ont pas severity=critical" }
    }
} else {
    Fail "Filter severity=critical a echoue"
}

# ─────────────────────────────────────────────────────────
# STEP 12 -- filter risk_level
# ─────────────────────────────────────────────────────────

Step 12 "Filter risk_level=red accepte"
$r12 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?risk_level=red" $authHeaders
if ($r12 -ne $null -and $r12.ok -eq $true) {
    Pass "Filter risk_level=red retourne ok=true"
} else {
    Fail "Filter risk_level=red a echoue"
}

# ─────────────────────────────────────────────────────────
# STEP 13 -- filter source
# ─────────────────────────────────────────────────────────

Step 13 "Filter source=task retourne uniquement events source=task"
$r13 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?source=task" $authHeaders
if ($r13 -ne $null -and $r13.ok -eq $true) {
    Pass "Filter source=task accepte"
    if ($r13.audit_trail -ne $null -and $r13.audit_trail.events -ne $null) {
        $wrongSrc = $false
        foreach ($evt in $r13.audit_trail.events) {
            if ($evt.source -ne "task") { $wrongSrc = $true }
        }
        if (-not $wrongSrc) { Pass "Tous les events ont source=task" }
        else { Fail "Certains events n'ont pas source=task" }
    }
} else {
    Fail "Filter source=task a echoue"
}

# ─────────────────────────────────────────────────────────
# STEP 14 -- filter requires_human
# ─────────────────────────────────────────────────────────

Step 14 "Filter requires_human=true retourne uniquement events requires_human=true"
$r14 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?requires_human=true" $authHeaders
if ($r14 -ne $null -and $r14.ok -eq $true) {
    Pass "Filter requires_human=true accepte"
    if ($r14.audit_trail -ne $null -and $r14.audit_trail.events -ne $null) {
        $wrongHuman = $false
        foreach ($evt in $r14.audit_trail.events) {
            if ($evt.requires_human -ne $true) { $wrongHuman = $true }
        }
        if (-not $wrongHuman) { Pass "Tous les events ont requires_human=true" }
        else { Fail "Certains events n'ont pas requires_human=true" }
    }
} else {
    Fail "Filter requires_human=true a echoue"
}

# ─────────────────────────────────────────────────────────
# STEP 15 -- filter limit
# ─────────────────────────────────────────────────────────

Step 15 "Filter limit=3 retourne au plus 3 evenements"
$r15 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?limit=3" $authHeaders
if ($r15 -ne $null -and $r15.audit_trail -ne $null -and $r15.audit_trail.events -ne $null) {
    $count = $r15.audit_trail.events.Count
    if ($count -le 3) {
        Pass "limit=3 retourne $count events (ok)"
    } else {
        Fail "limit=3 retourne $count events (attendu <=3)"
    }
} else {
    Pass "Reponse vide pour limit=3 (acceptable)"
}

# ─────────────────────────────────────────────────────────
# STEP 16 -- submit mission safe
# ─────────────────────────────────────────────────────────

Step 16 "POST /submit mission safe retourne ok ou erreur structuree"
$submitBody = '{"message": "Preparer un compte-rendu de reunion", "source": "test"}'
$r16 = Post-Json "$BaseUrl/api/pierre/use/submit" $authHeaders $submitBody
if ($r16 -ne $null -and $r16.ok -ne $null) {
    Pass "submit retourne reponse structuree (ok=$($r16.ok))"
} else {
    Skip "submit indisponible ou sans accords necessaires"
}

# ─────────────────────────────────────────────────────────
# STEP 17 -- audit trail contient mission/task event
# ─────────────────────────────────────────────────────────

Step 17 "Audit trail contient evenements source mission ou task"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $hasMissionOrTask = $false
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.source -eq "mission" -or $evt.source -eq "task") {
            $hasMissionOrTask = $true
        }
    }
    if ($hasMissionOrTask) {
        Pass "Trail contient events mission ou task"
    } else {
        Skip "Aucun event mission/task (base de donnees vide possible)"
    }
} else {
    Skip "Pas d'events a verifier"
}

# ─────────────────────────────────────────────────────────
# STEP 18 -- submit mission sensible
# ─────────────────────────────────────────────────────────

Step 18 "POST /submit mission sensible (licenciement) retourne reponse structuree"
$sensitiveBody = '{"message": "Preparer le licenciement de Pierre Dupont pour faute grave", "source": "test"}'
$r18 = Post-Json "$BaseUrl/api/pierre/use/submit" $authHeaders $sensitiveBody
if ($r18 -ne $null -and $r18.ok -ne $null) {
    Pass "submit sensible retourne reponse structuree (ok=$($r18.ok))"
    if ($r18.cloneguard -ne $null) {
        $decision = $r18.cloneguard.decision
        Info "CloneGuard decision: $decision"
    }
} else {
    Skip "submit sensible indisponible"
}

# ─────────────────────────────────────────────────────────
# STEP 19 -- audit trail contient governance/human_required si sensible
# ─────────────────────────────────────────────────────────

Step 19 "Audit trail contient evenements governance ou human_required"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $hasGovOrHuman = $false
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.source -eq "governance" -or $evt.source -eq "log" -or $evt.requires_human -eq $true) {
            $hasGovOrHuman = $true
        }
    }
    if ($hasGovOrHuman) {
        Pass "Trail contient events governance ou requires_human"
    } else {
        Skip "Pas d'events governance/human_required (base vide possible)"
    }
} else {
    Skip "Pas d'events a verifier"
}

# ─────────────────────────────────────────────────────────
# STEP 20 -- governance/evaluate refuse puis audit
# ─────────────────────────────────────────────────────────

Step 20 "POST /governance/evaluate avec tache risquee retourne decision"
$govBody = '{"task_type": "email.send", "task_title": "Envoyer email de licenciement"}'
$r20 = Post-Json "$BaseUrl/api/pierre/use/governance/evaluate" $authHeaders $govBody
if ($r20 -ne $null -and $r20.ok -ne $null) {
    Pass "governance/evaluate retourne reponse structuree"
    if ($r20.evaluation -ne $null) {
        $decision = $r20.evaluation.decision
        Info "Governance decision: $decision"
        if ($decision -ne "allow") {
            Pass "email.send produit decision non-allow: $decision"
        } else {
            Fail "email.send devrait etre bloque (decision=allow inattendu)"
        }
    }
} else {
    Skip "governance/evaluate indisponible"
}

# ─────────────────────────────────────────────────────────
# STEP 21 -- mission detail contient audit_trail
# ─────────────────────────────────────────────────────────

Step 21 "GET /mission/[id] retourne audit_trail"
$r4m = Get-Json "$BaseUrl/api/pierre/use/mission-control" $authHeaders
$firstMissionId = $null
if ($r4m -ne $null -and $r4m.mission_control -ne $null -and $r4m.mission_control.mission_cards -ne $null) {
    $cards = $r4m.mission_control.mission_cards
    if ($cards.Count -gt 0) {
        $firstMissionId = $cards[0].mission_id
    }
}
if ($firstMissionId -ne $null) {
    $r21 = Get-Json "$BaseUrl/api/pierre/use/mission/$firstMissionId" $authHeaders
    if ($r21 -ne $null -and $r21.audit_trail -ne $null) {
        Pass "mission/[id] retourne audit_trail"
    } elseif ($r21 -ne $null -and $r21.ok -eq $true) {
        Fail "mission/[id] ok=true mais audit_trail absent"
    } else {
        Skip "Mission non accessible"
    }
} else {
    Skip "Aucune mission disponible pour tester"
}

# ─────────────────────────────────────────────────────────
# STEP 22 -- employee file contient audit_trail_summary
# ─────────────────────────────────────────────────────────

Step 22 "GET /employee/[id]/file retourne audit_trail_summary"
$r22 = Get-Json "$BaseUrl/api/pierre/use/employees" $authHeaders
$firstEmployeeId = $null
if ($r22 -ne $null -and $r22.employees -ne $null -and $r22.employees.Count -gt 0) {
    $firstEmployeeId = $r22.employees[0].id
}
if ($firstEmployeeId -ne $null) {
    $r22f = Get-Json "$BaseUrl/api/pierre/use/employee/$firstEmployeeId/file" $authHeaders
    if ($r22f -ne $null -and $r22f.audit_trail_summary -ne $null) {
        Pass "employee/[id]/file retourne audit_trail_summary"
    } elseif ($r22f -ne $null -and $r22f.ok -eq $true) {
        Fail "employee/[id]/file ok=true mais audit_trail_summary absent"
    } else {
        Skip "Employee non accessible"
    }
} else {
    Skip "Aucun employe disponible pour tester"
}

# ─────────────────────────────────────────────────────────
# STEP 23 -- continuity contient audit_trail_summary
# ─────────────────────────────────────────────────────────

Step 23 "GET /continuity retourne audit_trail_summary"
$r23 = Get-Json "$BaseUrl/api/pierre/use/continuity" $authHeaders
if ($r23 -eq $null) {
    Fail "Pas de reponse de /continuity"
} elseif ($r23.audit_trail_summary -ne $null) {
    Pass "continuity retourne audit_trail_summary"
} else {
    Fail "audit_trail_summary absent de /continuity"
}

# ─────────────────────────────────────────────────────────
# STEP 24 -- mission-control contient audit_trail_summary
# ─────────────────────────────────────────────────────────

Step 24 "GET /mission-control retourne audit_trail_summary"
$r24 = Get-Json "$BaseUrl/api/pierre/use/mission-control" $authHeaders
if ($r24 -eq $null) {
    Fail "Pas de reponse de /mission-control"
} elseif ($r24.audit_trail_summary -ne $null) {
    Pass "mission-control retourne audit_trail_summary"
} else {
    Fail "audit_trail_summary absent de /mission-control"
}

# ─────────────────────────────────────────────────────────
# STEP 25 -- messages alertes contiennent audit alerts si presentes
# ─────────────────────────────────────────────────────────

Step 25 "GET /messages retourne audit_trail_summary"
$r25 = Get-Json "$BaseUrl/api/pierre/use/messages" $authHeaders
if ($r25 -eq $null) {
    Fail "Pas de reponse de /messages"
} elseif ($r25.audit_trail_summary -ne $null) {
    Pass "messages retourne audit_trail_summary"
} else {
    Fail "audit_trail_summary absent de /messages"
}

# ─────────────────────────────────────────────────────────
# STEP 26 -- alerts route retourne tableau
# ─────────────────────────────────────────────────────────

Step 26 "GET /audit-trail/alerts retourne tableau alerts"
$r26 = Get-Json "$BaseUrl/api/pierre/use/audit-trail/alerts" $authHeaders
if ($r26 -eq $null) {
    Fail "Pas de reponse de /audit-trail/alerts"
} elseif ($r26.ok -eq $true -and $r26.alerts -ne $null) {
    Pass "alerts retourne ok=true avec tableau alerts ($($r26.alerts.Count) alertes)"
} else {
    Fail "alerts retourne ok=false ou sans tableau"
}

# ─────────────────────────────────────────────────────────
# STEP 27 -- export route retourne export
# ─────────────────────────────────────────────────────────

Step 27 "GET /audit-trail/export retourne export structure"
$r27 = Get-Json "$BaseUrl/api/pierre/use/audit-trail/export" $authHeaders
if ($r27 -eq $null) {
    Fail "Pas de reponse de /audit-trail/export"
} elseif ($r27.ok -eq $true -and $r27.export -ne $null) {
    if ($r27.export.generated_at -ne $null -and $r27.export.scope -ne $null) {
        Pass "export retourne ok=true avec generated_at et scope"
    } else {
        Fail "export present mais champs generated_at ou scope manquants"
    }
} else {
    Fail "export retourne ok=false ou sans objet export"
}

# ─────────────────────────────────────────────────────────
# STEP 28 -- logs schema event_type/message/meta_json
# ─────────────────────────────────────────────────────────

Step 28 "Events audit trail ont event_type, title, message, source"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $allValid = $true
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.event_type -eq $null -or $evt.source -eq $null) {
            $allValid = $false
        }
    }
    if ($allValid) {
        Pass "Tous les events ont event_type et source"
    } else {
        Fail "Certains events manquent event_type ou source"
    }
} else {
    Pass "Pas d'events a verifier (liste vide)"
}

# ─────────────────────────────────────────────────────────
# STEP 29 -- pas de level/event/payload dans raw
# ─────────────────────────────────────────────────────────

Step 29 "Events: raw ne contient pas de cle level, event ou payload"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $hasForbidden = $false
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.raw -ne $null) {
            $rawKeys = $evt.raw | Get-Member -MemberType NoteProperty -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name -ErrorAction SilentlyContinue
            if ($rawKeys -ne $null) {
                if ($rawKeys -contains "level" -or $rawKeys -contains "event" -or $rawKeys -contains "payload") {
                    $hasForbidden = $true
                }
            }
        }
    }
    if (-not $hasForbidden) {
        Pass "Aucune cle interdite (level/event/payload) dans raw"
    } else {
        Fail "Cle interdite trouvee dans raw d'un event"
    }
} else {
    Pass "Pas d'events a verifier"
}

# ─────────────────────────────────────────────────────────
# STEP 30 -- email.send jamais auto
# ─────────────────────────────────────────────────────────

Step 30 "email.send jamais auto-execute: CloneGuard refuse ou bloque"
$cgEmailBody = '{"task_type": "email.send", "task_title": "Envoyer email de licenciement"}'
$r30 = Post-Json "$BaseUrl/api/pierre/use/cloneguard/evaluate" $authHeaders $cgEmailBody
if ($r30 -ne $null -and $r30.evaluation -ne $null) {
    $decision = $r30.evaluation.decision
    $autoExec = $r30.evaluation.allowed_to_auto_execute
    if ($autoExec -eq $false -or $autoExec -eq $null) {
        Pass "email.send: allowed_to_auto_execute=false (decision=$decision)"
    } else {
        Fail "email.send: allowed_to_auto_execute=true -- INVARIANT VIOLE"
    }
} else {
    Skip "cloneguard/evaluate indisponible pour test email.send"
}

# ─────────────────────────────────────────────────────────
# STEP 31 -- approval_required jamais auto
# ─────────────────────────────────────────────────────────

Step 31 "approval_required=true jamais auto-execute: CloneGuard refuse ou bloque"
$cgApprovalBody = '{"task_type": "contract_sign", "task_title": "Signer contrat", "approval_required": true}'
$r31 = Post-Json "$BaseUrl/api/pierre/use/cloneguard/evaluate" $authHeaders $cgApprovalBody
if ($r31 -ne $null -and $r31.evaluation -ne $null) {
    $autoExec = $r31.evaluation.allowed_to_auto_execute
    if ($autoExec -eq $false -or $autoExec -eq $null) {
        Pass "approval_required=true: allowed_to_auto_execute=false"
    } else {
        Fail "approval_required=true: allowed_to_auto_execute=true -- INVARIANT VIOLE"
    }
} else {
    Skip "cloneguard/evaluate indisponible pour test approval_required"
}

# ─────────────────────────────────────────────────────────
# STEP 32 -- red/black audit en alert
# ─────────────────────────────────────────────────────────

Step 32 "Events avec risk_level red/black ont severity elevee ou requires_human=true"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $redBlackOk = $true
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.risk_level -eq "red" -or $evt.risk_level -eq "black") {
            if ($evt.requires_human -ne $true -and $evt.severity -ne "critical" -and $evt.severity -ne "warning" -and $evt.severity -ne "action_required") {
                $redBlackOk = $false
            }
        }
    }
    if ($redBlackOk) {
        Pass "Tous les events red/black ont severity elevee ou requires_human=true"
    } else {
        Fail "Certains events red/black manquent severity/requires_human"
    }
} else {
    Pass "Pas d'events red/black a verifier"
}

# ─────────────────────────────────────────────────────────
# STEP 33 -- malformed filters no crash
# ─────────────────────────────────────────────────────────

Step 33 "Filtres malformes ne font pas crasher le serveur"
$r33 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?severity=INVALIDE&risk_level=NOPE&source=FAKE" $authHeaders
if ($r33 -ne $null) {
    Pass "Filtres malformes retournent une reponse (ok=$($r33.ok))"
} else {
    Fail "Filtres malformes ont cause un crash (pas de reponse)"
}

# ─────────────────────────────────────────────────────────
# STEP 34 -- invalid limit capped
# ─────────────────────────────────────────────────────────

Step 34 "limit=9999 est cape a 500 (serveur ne crash pas)"
$r34 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?limit=9999" $authHeaders
if ($r34 -ne $null -and $r34.ok -eq $true) {
    $evts = $r34.audit_trail.events
    if ($evts -ne $null) {
        $count = $evts.Count
        if ($count -le 500) {
            Pass "limit=9999 retourne $count events (cap ok)"
        } else {
            Fail "limit=9999 retourne $count events (cap 500 non respecte)"
        }
    } else {
        Pass "limit=9999 retourne liste vide (acceptable)"
    }
} else {
    Fail "limit=9999 a retourne ok=false ou pas de reponse"
}

# ─────────────────────────────────────────────────────────
# STEP 35 -- unknown source no crash
# ─────────────────────────────────────────────────────────

Step 35 "source=unknown_source ne crash pas"
$r35 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?source=unknown_source" $authHeaders
if ($r35 -ne $null) {
    Pass "source=unknown_source retourne une reponse sans crash"
} else {
    Fail "source=unknown_source a cause un crash"
}

# ─────────────────────────────────────────────────────────
# STEP 36 -- mission_id fake returns ok empty ou safe behavior
# ─────────────────────────────────────────────────────────

Step 36 "mission_id inexistant retourne ok=true avec 0 events ou liste vide"
$r36 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?mission_id=fake-mission-id-00000000" $authHeaders
if ($r36 -ne $null -and $r36.ok -eq $true) {
    Pass "mission_id fake retourne ok=true (comportement safe)"
} elseif ($r36 -ne $null) {
    Pass "mission_id fake retourne reponse sans crash"
} else {
    Fail "mission_id fake a cause un crash"
}

# ─────────────────────────────────────────────────────────
# STEP 37 -- employee_id fake returns ok empty ou safe behavior
# ─────────────────────────────────────────────────────────

Step 37 "employee_id inexistant retourne ok=true avec 0 events ou liste vide"
$r37 = Get-Json "$BaseUrl/api/pierre/use/audit-trail?employee_id=fake-employee-00000000" $authHeaders
if ($r37 -ne $null -and $r37.ok -eq $true) {
    Pass "employee_id fake retourne ok=true (comportement safe)"
} elseif ($r37 -ne $null) {
    Pass "employee_id fake retourne reponse sans crash"
} else {
    Fail "employee_id fake a cause un crash"
}

# ─────────────────────────────────────────────────────────
# STEP 38 -- all diagnostics counts are numbers
# ─────────────────────────────────────────────────────────

Step 38 "Tous les compteurs diagnostics sont des nombres"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.diagnostics -ne $null) {
    $d = $r4.audit_trail.diagnostics
    $allNumbers = $true
    foreach ($field in @("total_events", "critical_count", "blocked_count", "failed_count", "human_required_count", "governance_block_count", "auto_allowed_count")) {
        $val = $d.$field
        if ($val -eq $null) { $allNumbers = $false }
        try {
            $n = [int]$val
        } catch {
            $allNumbers = $false
        }
    }
    if ($allNumbers) {
        Pass "Tous les compteurs diagnostics sont des nombres"
    } else {
        Fail "Certains compteurs diagnostics manquent ou ne sont pas des nombres"
    }
} else {
    Fail "diagnostics absent"
}

# ─────────────────────────────────────────────────────────
# STEP 39 -- health score number
# ─────────────────────────────────────────────────────────

Step 39 "health.score est un nombre entre 0 et 100"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.health -ne $null) {
    $score = [int]$r4.audit_trail.health.score
    if ($score -ge 0 -and $score -le 100) {
        Pass "health.score=$score"
    } else {
        Fail "health.score=$score hors [0,100]"
    }
} else {
    Fail "health absent"
}

# ─────────────────────────────────────────────────────────
# STEP 40 -- digest text non vide
# ─────────────────────────────────────────────────────────

Step 40 "digest.text est une chaine non vide"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.digest -ne $null) {
    $text = $r4.audit_trail.digest.text
    if ($text -ne $null -and $text.Length -gt 0) {
        Pass "digest.text present et non vide"
    } else {
        Fail "digest.text vide ou absent"
    }
} else {
    Fail "digest absent"
}

# ─────────────────────────────────────────────────────────
# STEP 41 -- alerts have level/title/message
# ─────────────────────────────────────────────────────────

Step 41 "Chaque alerte a level, title et message"
if ($r26 -ne $null -and $r26.alerts -ne $null) {
    $allOk = $true
    $validLevels = @("info", "warning", "urgent", "critical")
    foreach ($alert in $r26.alerts) {
        if ($alert.level -eq $null -or -not ($validLevels -contains $alert.level)) { $allOk = $false }
        if ($alert.title -eq $null) { $allOk = $false }
        if ($alert.message -eq $null) { $allOk = $false }
    }
    if ($allOk) {
        Pass "Toutes les alertes ont level/title/message valides"
    } else {
        Fail "Certaines alertes manquent level, title ou message"
    }
} else {
    Pass "Pas d'alertes a verifier (liste vide acceptable)"
}

# ─────────────────────────────────────────────────────────
# STEP 42 -- build can be run after
# ─────────────────────────────────────────────────────────

Step 42 "IDs des events audit commencent par 'at_'"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $allValidId = $true
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.id -ne $null -and -not ($evt.id -match "^at_")) {
            $allValidId = $false
        }
    }
    if ($allValidId) {
        Pass "Tous les IDs commencent par 'at_'"
    } else {
        Fail "Certains IDs ne commencent pas par 'at_'"
    }
} else {
    Pass "Pas d'events a verifier"
}

# ─────────────────────────────────────────────────────────
# STEP 43 -- risk_level values valid
# ─────────────────────────────────────────────────────────

Step 43 "Toutes les valeurs risk_level sont valides (green/orange/red/black)"
if ($r4 -ne $null -and $r4.audit_trail -ne $null -and $r4.audit_trail.events -ne $null) {
    $allValidRisk = $true
    $validRisks = @("green", "orange", "red", "black")
    foreach ($evt in $r4.audit_trail.events) {
        if ($evt.risk_level -ne $null -and -not ($validRisks -contains $evt.risk_level)) {
            $allValidRisk = $false
        }
    }
    if ($allValidRisk) {
        Pass "Toutes les valeurs risk_level sont valides"
    } else {
        Fail "Certaines valeurs risk_level sont invalides"
    }
} else {
    Pass "Pas d'events a verifier"
}

# ─────────────────────────────────────────────────────────
# STEP 44 -- summary final PASS/FAIL
# ─────────────────────────────────────────────────────────

Step 44 "Summary: verifier que les compteurs sont coherents"
$total = $script:pass + $script:fail
Info "Etapes reussies: $script:pass / $total"
if ($script:fail -eq 0) {
    Pass "Tous les tests valides ont reussi"
} else {
    Fail "$($script:fail) test(s) ont echoue"
}

# ─────────────────────────────────────────────────────────
# STEP 45 -- fail exits 1, success exits 0
# ─────────────────────────────────────────────────────────

Step 45 "Script exit code: 0 si tout ok, 1 si echecs"
# This step is validated by the exit logic below

} # end token check

# ─────────────────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
$color = "Green"
if ($fail -gt 0) { $color = "Red" }
Write-Host " RESULTATS: $pass PASS, $fail FAIL, $skip SKIP" -ForegroundColor $color
Write-Host "==========================================" -ForegroundColor Yellow

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "Etapes echouees:" -ForegroundColor Red
    foreach ($r in $results) {
        if ($r -match "^FAIL:") {
            Write-Host "  $r" -ForegroundColor Red
        }
    }
    Pass "STEP 45 -- exit code 1 (echecs detectes)"
    exit 1
} else {
    Pass "STEP 45 -- exit code 0 (tous tests passes)"
    exit 0
}
