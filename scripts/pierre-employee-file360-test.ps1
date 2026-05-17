# ============================================================
# Pierre — Employee File 360 E2E Test Script
# Compatible PowerShell 5 (pas de ?., pas de ??, pas de ??=)
# ============================================================

param(
    [string]$BaseUrl   = "http://localhost:3000",
    [string]$AuthToken = $env:PIERRE_TEST_TOKEN,
    [string]$TestEmployeeId = "emp-test-e2e-001"
)

$ErrorActionPreference = "Continue"
$PassCount = 0
$FailCount = 0
$Results   = @()

function Write-Step([string]$Label) {
    Write-Host "`n[$Label]" -ForegroundColor Cyan
}

function Pass([string]$Label) {
    $script:PassCount++
    $script:Results += [PSCustomObject]@{ Step = $Label; Status = "PASS" }
    Write-Host "  PASS  $Label" -ForegroundColor Green
}

function Fail([string]$Label, [string]$Detail) {
    $script:FailCount++
    $script:Results += [PSCustomObject]@{ Step = $Label; Status = "FAIL : $Detail" }
    Write-Host "  FAIL  $Label — $Detail" -ForegroundColor Red
}

function Invoke-Api {
    param(
        [string]$Method  = "GET",
        [string]$Path,
        [hashtable]$Body = $null,
        [string]$Token   = $AuthToken
    )
    $Uri     = "$BaseUrl$Path"
    $Headers = @{ "Content-Type" = "application/json" }
    if ($Token -ne $null -and $Token -ne "") {
        $Headers["Authorization"] = "Bearer $Token"
    }
    try {
        if ($Method -eq "POST" -and $Body -ne $null) {
            $BodyJson = $Body | ConvertTo-Json -Depth 10
            $Resp = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $Headers -Body $BodyJson -UseBasicParsing -ErrorAction Stop
        } else {
            $Resp = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $Headers -UseBasicParsing -ErrorAction Stop
        }
        return [PSCustomObject]@{
            StatusCode = $Resp.StatusCode
            Body       = $Resp.Content | ConvertFrom-Json
            Raw        = $Resp.Content
            Error      = $null
        }
    } catch {
        $StatusCode = 0
        if ($_.Exception.Response -ne $null) {
            $StatusCode = [int]$_.Exception.Response.StatusCode
        }
        $ErrorBody = $null
        try {
            $Stream = $_.Exception.Response.GetResponseStream()
            $Reader = New-Object System.IO.StreamReader($Stream)
            $ErrorText = $Reader.ReadToEnd()
            $ErrorBody = $ErrorText | ConvertFrom-Json
        } catch {}
        return [PSCustomObject]@{
            StatusCode = $StatusCode
            Body       = $ErrorBody
            Raw        = $null
            Error      = $_.Exception.Message
        }
    }
}

# ============================================================
# STEP 1 — GET /employees/files sans token → 401
# ============================================================
Write-Step "1 — GET /employees/files sans token"
$R1 = Invoke-Api -Method "GET" -Path "/api/pierre/use/employees/files" -Token ""
if ($R1.StatusCode -eq 401) {
    Pass "401 returned when no token"
} else {
    Fail "401 returned when no token" "Got $($R1.StatusCode)"
}

# ============================================================
# STEP 2 — GET /employees/files avec token → 200 ou 403
# ============================================================
Write-Step "2 — GET /employees/files avec token"
if ($AuthToken -eq $null -or $AuthToken -eq "") {
    Fail "Auth token present" "PIERRE_TEST_TOKEN not set — skipping authenticated tests"
    Write-Host "`nSet PIERRE_TEST_TOKEN env var to run authenticated steps." -ForegroundColor Yellow
    # Print summary and exit early
    Write-Host "`n============================================================" -ForegroundColor White
    Write-Host " SUMMARY   PASS: $PassCount   FAIL: $FailCount" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor White
    exit 0
}

$R2 = Invoke-Api -Method "GET" -Path "/api/pierre/use/employees/files"
if ($R2.StatusCode -eq 200 -or $R2.StatusCode -eq 403) {
    Pass "GET /employees/files responded ($($R2.StatusCode))"
} else {
    Fail "GET /employees/files responded" "Got $($R2.StatusCode)"
}

# ============================================================
# STEP 3 — index.files present
# ============================================================
Write-Step "3 — index.files present in response"
if ($R2.StatusCode -eq 200) {
    $HasIndex = ($R2.Body -ne $null) -and ($R2.Body.index -ne $null)
    if ($HasIndex) {
        Pass "index object present"
    } else {
        Fail "index object present" "index field missing from response"
    }
} else {
    Write-Host "  SKIP (no 200 response)" -ForegroundColor Yellow
}

# ============================================================
# STEP 4 — index.totals present
# ============================================================
Write-Step "4 — index.totals present"
if ($R2.StatusCode -eq 200 -and $R2.Body -ne $null -and $R2.Body.index -ne $null) {
    if ($R2.Body.index.totals -ne $null) {
        Pass "index.totals present"
    } else {
        Fail "index.totals present" "totals missing"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 5 — GET /employee/[id]/file → 200 or 404
# ============================================================
Write-Step "5 — GET /employee/$TestEmployeeId/file"
$R5 = Invoke-Api -Method "GET" -Path "/api/pierre/use/employee/$TestEmployeeId/file"
if ($R5.StatusCode -eq 200 -or $R5.StatusCode -eq 404) {
    Pass "GET /employee/file responded ($($R5.StatusCode))"
} else {
    Fail "GET /employee/file responded" "Got $($R5.StatusCode)"
}

# ============================================================
# STEP 6 — file.profile present (if 200)
# ============================================================
Write-Step "6 — file.profile present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    if ($R5.Body.file.profile -ne $null) {
        Pass "file.profile present"
    } else {
        Fail "file.profile present" "profile field missing"
    }
} else {
    Write-Host "  SKIP (employee not found or no file)" -ForegroundColor Yellow
}

# ============================================================
# STEP 7 — file.sections present (if 200)
# ============================================================
Write-Step "7 — file.sections present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    $Sections = $R5.Body.file.sections
    if ($Sections -ne $null -and $Sections.Count -ge 9) {
        Pass "file.sections present (count=$($Sections.Count))"
    } else {
        Fail "file.sections present" "sections missing or count < 9"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 8 — file.digest present
# ============================================================
Write-Step "8 — file.digest present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    if ($R5.Body.file.digest -ne $null -and $R5.Body.file.digest.text -ne $null) {
        Pass "file.digest present"
    } else {
        Fail "file.digest present" "digest or digest.text missing"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 9 — file.timeline present
# ============================================================
Write-Step "9 — file.timeline present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    if ($R5.Body.file.timeline -ne $null) {
        Pass "file.timeline present"
    } else {
        Fail "file.timeline present" "timeline missing"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 10 — file.missing_info present
# ============================================================
Write-Step "10 — file.missing_info present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    if ($R5.Body.file.missing_info -ne $null) {
        Pass "file.missing_info present"
    } else {
        Fail "file.missing_info present" "missing_info field absent"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 11 — file.risks present
# ============================================================
Write-Step "11 — file.risks present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    if ($R5.Body.file.risks -ne $null) {
        Pass "file.risks present"
    } else {
        Fail "file.risks present" "risks field absent"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 12 — POST submit mission liée à employee_id
# ============================================================
Write-Step "12 — POST /submit mission liée à l'employé test"
$SubmitBody = @{
    raw_input     = "Test e2e dossier salarié bloc 11 — onboarding $TestEmployeeId"
    employee_id   = $TestEmployeeId
    agent_slug    = "pierre"
}
$R12 = Invoke-Api -Method "POST" -Path "/api/pierre/use/submit" -Body $SubmitBody
if ($R12.StatusCode -eq 200 -or $R12.StatusCode -eq 201) {
    Pass "POST /submit responded ($($R12.StatusCode))"
} else {
    Fail "POST /submit responded" "Got $($R12.StatusCode) — $($R12.Error)"
}

# ============================================================
# STEP 13 — GET mission créée → employee_file present
# ============================================================
Write-Step "13 — GET mission → employee_file in response"
$MissionId = $null
if ($R12.StatusCode -eq 200 -or $R12.StatusCode -eq 201) {
    if ($R12.Body -ne $null) {
        if ($R12.Body.mission_id -ne $null) {
            $MissionId = $R12.Body.mission_id
        } elseif ($R12.Body.mission -ne $null -and $R12.Body.mission.id -ne $null) {
            $MissionId = $R12.Body.mission.id
        }
    }
}

if ($MissionId -ne $null -and $MissionId -ne "") {
    $R13 = Invoke-Api -Method "GET" -Path "/api/pierre/use/mission/$MissionId"
    if ($R13.StatusCode -eq 200) {
        if ($R13.Body -ne $null -and $R13.Body.employee_file -ne $null) {
            Pass "employee_file present in mission response"
        } else {
            Fail "employee_file present in mission response" "field absent in GET mission body"
        }
    } else {
        Fail "GET mission returned 200" "Got $($R13.StatusCode)"
    }
} else {
    Write-Host "  SKIP (no mission_id from submit)" -ForegroundColor Yellow
}

# ============================================================
# STEP 14 — GET /employee/[id] existant → file_snapshot present
# ============================================================
Write-Step "14 — GET /employee/[id] → file_snapshot present"
$R14 = Invoke-Api -Method "GET" -Path "/api/pierre/use/employee/$TestEmployeeId"
if ($R14.StatusCode -eq 200) {
    if ($R14.Body -ne $null -and $R14.Body.file_snapshot -ne $null) {
        Pass "file_snapshot present in employee route"
    } else {
        Fail "file_snapshot present in employee route" "field absent"
    }
} elseif ($R14.StatusCode -eq 404) {
    Write-Host "  SKIP (employee not found in memory)" -ForegroundColor Yellow
} else {
    Fail "GET /employee responded" "Got $($R14.StatusCode)"
}

# ============================================================
# STEP 15 — Verify logs use event_type + meta_json (not level/event/payload)
# ============================================================
Write-Step "15 — Logs schema validation (event_type + meta_json)"
if ($MissionId -ne $null -and $MissionId -ne "") {
    $R15 = Invoke-Api -Method "GET" -Path "/api/pierre/use/mission/$MissionId"
    if ($R15.StatusCode -eq 200 -and $R15.Body -ne $null -and $R15.Body.logs -ne $null) {
        $Logs = $R15.Body.logs
        $HasBadFields = $false
        foreach ($Log in $Logs) {
            if ($Log.level -ne $null -or $Log.event -ne $null -or $Log.payload -ne $null) {
                $HasBadFields = $true
                break
            }
        }
        if ($HasBadFields) {
            Fail "Logs use correct schema" "Found forbidden fields level/event/payload in logs"
        } else {
            Pass "Logs use event_type + meta_json schema"
        }
    } else {
        Write-Host "  SKIP (no logs available)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  SKIP (no mission_id)" -ForegroundColor Yellow
}

# ============================================================
# STEP 16 — Verify no response uses scheduled_for as DB reference
# ============================================================
Write-Step "16 — No response references scheduled_for as DB column"
if ($MissionId -ne $null -and $MissionId -ne "") {
    $R16 = Invoke-Api -Method "GET" -Path "/api/pierre/use/mission/$MissionId"
    if ($R16.StatusCode -eq 200 -and $R16.Raw -ne $null) {
        # Tasks should use execute_at, not scheduled_for at DB level
        if ($R16.Body -ne $null -and $R16.Body.tasks -ne $null) {
            $HasScheduledFor = $false
            foreach ($Task in $R16.Body.tasks) {
                # scheduled_for is allowed in artifact payload (non-DB), but execute_at should be the DB field
                if ($Task.scheduled_for -ne $null -and $Task.execute_at -eq $null) {
                    $HasScheduledFor = $true
                    break
                }
            }
            if ($HasScheduledFor) {
                Fail "Tasks use execute_at not scheduled_for" "Found task with scheduled_for but no execute_at"
            } else {
                Pass "Tasks use execute_at as DB column"
            }
        } else {
            Write-Host "  SKIP (no tasks)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  SKIP (no mission response)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  SKIP (no mission_id)" -ForegroundColor Yellow
}

# ============================================================
# STEP 17 — GET /employees/files index counts match
# ============================================================
Write-Step "17 — /employees/files index totals are consistent"
if ($R2.StatusCode -eq 200 -and $R2.Body -ne $null -and $R2.Body.index -ne $null) {
    $Totals = $R2.Body.index.totals
    $Files  = $R2.Body.index.files
    if ($Totals -ne $null -and $Files -ne $null) {
        if ($Totals.employees -eq $Files.Count) {
            Pass "index.totals.employees matches index.files.Count"
        } else {
            Fail "index.totals.employees matches index.files.Count" "totals.employees=$($Totals.employees) files.Count=$($Files.Count)"
        }
    } else {
        Write-Host "  SKIP (totals or files missing)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 18 — Snapshot has required fields
# ============================================================
Write-Step "18 — Snapshot structure validation"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.snapshot -ne $null) {
    $Snap = $R5.Body.snapshot
    $RequiredFields = @("employee_id","employee_name","health_score","risk_level","status","digest_text")
    $MissingFields = @()
    foreach ($Field in $RequiredFields) {
        $Val = $Snap | Select-Object -ExpandProperty $Field -ErrorAction SilentlyContinue
        if ($Val -eq $null) {
            $MissingFields += $Field
        }
    }
    if ($MissingFields.Count -eq 0) {
        Pass "Snapshot has all required fields"
    } else {
        Fail "Snapshot has all required fields" "Missing: $($MissingFields -join ', ')"
    }
} else {
    Write-Host "  SKIP (no snapshot in response)" -ForegroundColor Yellow
}

# ============================================================
# STEP 19 — file.health present with numeric score
# ============================================================
Write-Step "19 — file.health present and numeric score"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    $Health = $R5.Body.file.health
    if ($Health -ne $null -and $Health.score -ne $null) {
        $Score = [int]$Health.score
        if ($Score -ge 0 -and $Score -le 100) {
            Pass "file.health.score in [0, 100] (score=$Score)"
        } else {
            Fail "file.health.score in [0, 100]" "Score out of bounds: $Score"
        }
    } else {
        Fail "file.health present" "health or health.score missing"
    }
} else {
    Write-Host "  SKIP (no file in response)" -ForegroundColor Yellow
}

# ============================================================
# STEP 20 — file.next_actions present
# ============================================================
Write-Step "20 — file.next_actions present"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.file -ne $null) {
    if ($R5.Body.file.next_actions -ne $null) {
        Pass "file.next_actions present"
    } else {
        Fail "file.next_actions present" "next_actions field absent"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 21 — snapshot.health_score is numeric 0-100
# ============================================================
Write-Step "21 — snapshot.health_score valid range"
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.snapshot -ne $null) {
    $SnapScore = $R5.Body.snapshot.health_score
    if ($SnapScore -ne $null) {
        $SScore = [int]$SnapScore
        if ($SScore -ge 0 -and $SScore -le 100) {
            Pass "snapshot.health_score valid (score=$SScore)"
        } else {
            Fail "snapshot.health_score valid" "Out of bounds: $SScore"
        }
    } else {
        Fail "snapshot.health_score present" "Field absent"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 22 — snapshot.risk_level valid value
# ============================================================
Write-Step "22 — snapshot.risk_level is valid value"
$ValidRiskLevels = @("green","orange","red","black")
if ($R5.StatusCode -eq 200 -and $R5.Body -ne $null -and $R5.Body.snapshot -ne $null) {
    $RL = $R5.Body.snapshot.risk_level
    if ($RL -ne $null -and $ValidRiskLevels -contains $RL) {
        Pass "snapshot.risk_level is valid ($RL)"
    } else {
        Fail "snapshot.risk_level is valid" "Got: $RL"
    }
} else {
    Write-Host "  SKIP" -ForegroundColor Yellow
}

# ============================================================
# STEP 23 — Summary
# ============================================================
Write-Host "`n============================================================" -ForegroundColor White
Write-Host " BLOC 11.1 — Employee File 360 Premium E2E RESULTS" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White
$Results | Format-Table -AutoSize
Write-Host "------------------------------------------------------------" -ForegroundColor White
Write-Host " PASS: $PassCount   FAIL: $FailCount" -ForegroundColor White

if ($FailCount -eq 0) {
    Write-Host " ALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host " SOME TESTS FAILED — review output above" -ForegroundColor Red
    exit 1
}
