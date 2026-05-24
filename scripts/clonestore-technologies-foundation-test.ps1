# CloneStore Technologies Foundation — Integration Test Script (Bloc 18)
# PowerShell 5.1 compatible: no ?., no ??, no typographic quotes
# Usage: $env:PIERRE_TEST_TOKEN = "<your_jwt>"; .\scripts\clonestore-technologies-foundation-test.ps1

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Token = $env:PIERRE_TEST_TOKEN
)

# ── Setup ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0
$total = 0

function Assert-Pass {
    param([string]$Label)
    $script:pass++
    $script:total++
    Write-Host "[PASS] $Label" -ForegroundColor Green
}

function Assert-Fail {
    param([string]$Label, [string]$Reason)
    $script:fail++
    $script:total++
    Write-Host "[FAIL] $Label — $Reason" -ForegroundColor Red
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    try {
        if ($Body -ne $null) {
            $json = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $json -UseBasicParsing -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -UseBasicParsing -ErrorAction Stop
        }
        return $response | ConvertFrom-Json
    } catch {
        $status = $null
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        return [PSCustomObject]@{
            ok = $false
            _httpStatus = $status
            error = $_.Exception.Message
        }
    }
}

function Invoke-ApiRaw {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    try {
        if ($Body -ne $null) {
            $json = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $json -UseBasicParsing -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -UseBasicParsing -ErrorAction Stop
        }
        return [PSCustomObject]@{ StatusCode = $response.StatusCode; Body = $response.Content | ConvertFrom-Json }
    } catch {
        $status = $null
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        return [PSCustomObject]@{ StatusCode = $status; Body = $null }
    }
}

# ── Section 1: GET /api/clonestore/technologies ───────────────────────────────

Write-Host ""
Write-Host "=== Section 1: GET /api/clonestore/technologies ===" -ForegroundColor Cyan

$r = Invoke-Api -Path "/api/clonestore/technologies"

# Step 1
if ($r.ok -eq $true) { Assert-Pass "GET /api/clonestore/technologies returns ok=true" }
else { Assert-Fail "GET /api/clonestore/technologies returns ok=true" "ok=$($r.ok), error=$($r.error)" }

# Step 2
if ($r.registry -ne $null) { Assert-Pass "Response contains registry object" }
else { Assert-Fail "Response contains registry object" "registry is null" }

# Step 3
if ($r.registry -ne $null -and $r.registry.definitions.Count -eq 12) { Assert-Pass "Registry contains exactly 12 definitions" }
else { Assert-Fail "Registry contains exactly 12 definitions" "count=$($r.registry.definitions.Count)" }

# Step 4
if ($r.registry -ne $null -and $r.registry.settings.Count -eq 12) { Assert-Pass "Registry contains exactly 12 settings" }
else { Assert-Fail "Registry contains exactly 12 settings" "count=$($r.registry.settings.Count)" }

# Step 5
if ($r.registry -ne $null -and $r.registry.runtime_states.Count -eq 12) { Assert-Pass "Registry contains exactly 12 runtime_states" }
else { Assert-Fail "Registry contains exactly 12 runtime_states" "count=$($r.registry.runtime_states.Count)" }

# Step 6
if ($r.registry -ne $null -and $r.registry.summary -ne $null -and $r.registry.summary.total -eq 12) { Assert-Pass "Registry summary.total is 12" }
else { Assert-Fail "Registry summary.total is 12" "total=$($r.registry.summary.total)" }

# Step 7
$expectedSlugs = @("cloneos","cloneadn","cloneguard","clonetrace","clonecontinuum","clonetrust","clonereview","clonesignals","clonelearn","clonevoice","clonechat","clonebrief")
$actualSlugs = $r.registry.definitions | ForEach-Object { $_.slug }
$missing = $expectedSlugs | Where-Object { $actualSlugs -notcontains $_ }
if ($missing.Count -eq 0) { Assert-Pass "All 12 expected slugs present in definitions" }
else { Assert-Fail "All 12 expected slugs present in definitions" "missing: $($missing -join ',')" }

# Step 8
if ($r.digest -ne $null -and $r.digest.Length -gt 0) { Assert-Pass "Response contains non-empty digest string" }
else { Assert-Fail "Response contains non-empty digest string" "digest is empty or null" }

# Step 9
if ($r.report -ne $null) { Assert-Pass "Response contains report object" }
else { Assert-Fail "Response contains report object" "report is null" }

# Step 10
if ($r.meta -ne $null -and $r.meta.userId -ne $null) { Assert-Pass "Meta contains userId" }
else { Assert-Fail "Meta contains userId" "meta.userId is null" }

# Step 11
if ($r.meta -ne $null -and $r.meta.definitions_count -eq 12) { Assert-Pass "Meta.definitions_count is 12" }
else { Assert-Fail "Meta.definitions_count is 12" "definitions_count=$($r.meta.definitions_count)" }

# Step 12: matrix not included by default
if ($r.matrix -eq $null) { Assert-Pass "Matrix not included by default (no ?matrix=true)" }
else { Assert-Fail "Matrix not included by default" "matrix was present" }

# ── Section 2: GET /api/clonestore/technologies?matrix=true ──────────────────

Write-Host ""
Write-Host "=== Section 2: GET /api/clonestore/technologies?matrix=true ===" -ForegroundColor Cyan

$rm = Invoke-Api -Path "/api/clonestore/technologies?matrix=true"

# Step 13
if ($rm.ok -eq $true -and $rm.matrix -ne $null) { Assert-Pass "matrix=true includes matrix object" }
else { Assert-Fail "matrix=true includes matrix object" "matrix=$($rm.matrix)" }

# Step 14
if ($rm.matrix -ne $null -and $rm.matrix.rows -ne $null) { Assert-Pass "Matrix contains rows array" }
else { Assert-Fail "Matrix contains rows array" "rows is null" }

# Step 15
if ($rm.matrix -ne $null -and $rm.matrix.employee_slugs -ne $null) { Assert-Pass "Matrix contains employee_slugs array" }
else { Assert-Fail "Matrix contains employee_slugs array" "employee_slugs is null" }

# Step 16: custom employee slugs
$rme = Invoke-Api -Path "/api/clonestore/technologies?matrix=true&employee_slugs=pierre,sophie"
if ($rme.ok -eq $true -and $rme.matrix -ne $null) { Assert-Pass "Custom employee_slugs param accepted" }
else { Assert-Fail "Custom employee_slugs param accepted" "ok=$($rme.ok)" }

# ── Section 3: GET /api/clonestore/technologies/[slug] ───────────────────────

Write-Host ""
Write-Host "=== Section 3: GET /api/clonestore/technologies/[slug] ===" -ForegroundColor Cyan

$rg = Invoke-Api -Path "/api/clonestore/technologies/cloneguard"

# Step 17
if ($rg.ok -eq $true) { Assert-Pass "GET /cloneguard returns ok=true" }
else { Assert-Fail "GET /cloneguard returns ok=true" "error=$($rg.error)" }

# Step 18
if ($rg.technology -ne $null -and $rg.technology.slug -eq "cloneguard") { Assert-Pass "Response technology.slug is 'cloneguard'" }
else { Assert-Fail "Response technology.slug is 'cloneguard'" "slug=$($rg.technology.slug)" }

# Step 19
if ($rg.setting -ne $null -and $rg.setting.technology_slug -eq "cloneguard") { Assert-Pass "Response setting.technology_slug is 'cloneguard'" }
else { Assert-Fail "Response setting.technology_slug is 'cloneguard'" "setting=$($rg.setting)" }

# Step 20
if ($rg.runtime_state -ne $null) { Assert-Pass "Response contains runtime_state" }
else { Assert-Fail "Response contains runtime_state" "runtime_state is null" }

# Step 21
if ($rg.validation -ne $null) { Assert-Pass "Response contains validation object" }
else { Assert-Fail "Response contains validation object" "validation is null" }

# Step 22: CloneVoice default disabled
$rv = Invoke-Api -Path "/api/clonestore/technologies/clonevoice"
if ($rv.ok -eq $true -and $rv.setting.status -eq "disabled") { Assert-Pass "CloneVoice setting.status is 'disabled' by default" }
else { Assert-Fail "CloneVoice setting.status is 'disabled' by default" "status=$($rv.setting.status)" }

# Step 23: enabled_for_pierre field present
if ($rg.PSObject.Properties.Name -contains "enabled_for_pierre") { Assert-Pass "Response contains enabled_for_pierre field" }
else { Assert-Fail "Response contains enabled_for_pierre field" "field missing" }

# Step 24: 404 for unknown slug
$raw404 = Invoke-ApiRaw -Path "/api/clonestore/technologies/unknownslug"
if ($raw404.StatusCode -eq 404) { Assert-Pass "Unknown slug returns 404" }
else { Assert-Fail "Unknown slug returns 404" "status=$($raw404.StatusCode)" }

# ── Section 4: PATCH /api/clonestore/technologies/[slug] — valid updates ──────

Write-Host ""
Write-Host "=== Section 4: PATCH /api/clonestore/technologies/clonechat ===" -ForegroundColor Cyan

$patchBody = @{
    status = "enabled"
    autonomy_level = "supervised"
    risk_mode = "guarded"
}

$rp = Invoke-Api -Method "PATCH" -Path "/api/clonestore/technologies/clonechat" -Body $patchBody

# Step 25
if ($rp.ok -eq $true) { Assert-Pass "PATCH /clonechat with valid fields returns ok=true" }
else { Assert-Fail "PATCH /clonechat with valid fields returns ok=true" "error=$($rp.error)" }

# Step 26
if ($rp.setting -ne $null -and $rp.setting.technology_slug -eq "clonechat") { Assert-Pass "PATCH response setting.technology_slug is 'clonechat'" }
else { Assert-Fail "PATCH response setting.technology_slug is 'clonechat'" "slug=$($rp.setting.technology_slug)" }

# Step 27
if ($rp.validation -ne $null -and $rp.validation.ok -eq $true) { Assert-Pass "PATCH response validation.ok is true" }
else { Assert-Fail "PATCH response validation.ok is true" "validation=$($rp.validation)" }

# Step 28: employee slugs update
$patchSlugs = @{
    enabled_for_employee_slugs = @("pierre", "sophie")
}
$rps = Invoke-Api -Method "PATCH" -Path "/api/clonestore/technologies/clonechat" -Body $patchSlugs
if ($rps.ok -eq $true) { Assert-Pass "PATCH with enabled_for_employee_slugs succeeds" }
else { Assert-Fail "PATCH with enabled_for_employee_slugs succeeds" "error=$($rps.error)" }

# ── Section 5: PATCH — invalid / rejected updates ────────────────────────────

Write-Host ""
Write-Host "=== Section 5: PATCH invalid/rejected updates ===" -ForegroundColor Cyan

# Step 29: empty body returns 400
$rawEmpty = Invoke-ApiRaw -Method "PATCH" -Path "/api/clonestore/technologies/clonechat" -Body @{}
if ($rawEmpty.StatusCode -eq 400) { Assert-Pass "PATCH with empty body returns 400" }
else { Assert-Fail "PATCH with empty body returns 400" "status=$($rawEmpty.StatusCode)" }

# Step 30: invalid status value returns 400
$rawBadStatus = Invoke-ApiRaw -Method "PATCH" -Path "/api/clonestore/technologies/clonechat" -Body @{ status = "flying" }
if ($rawBadStatus.StatusCode -eq 400) { Assert-Pass "PATCH with invalid status returns 400" }
else { Assert-Fail "PATCH with invalid status returns 400" "status=$($rawBadStatus.StatusCode)" }

# Step 31: platform core cannot be disabled (CloneOS)
$rawCoreDisable = Invoke-ApiRaw -Method "PATCH" -Path "/api/clonestore/technologies/cloneos" -Body @{ status = "disabled" }
# Either 400 (validation failure) or 200 with silent ignore and enabled still true
if ($rawCoreDisable.StatusCode -eq 400 -or ($rawCoreDisable.StatusCode -eq 200 -and $rawCoreDisable.Body.setting.status -ne "disabled")) {
    Assert-Pass "Platform core (CloneOS) cannot be disabled"
} else {
    Assert-Fail "Platform core (CloneOS) cannot be disabled" "status=$($rawCoreDisable.StatusCode), setting.status=$($rawCoreDisable.Body.setting.status)"
}

# Step 32: non-configurable tech (CloneOS) status change silently ignored or 400
$rawNotConfig = Invoke-ApiRaw -Method "PATCH" -Path "/api/clonestore/technologies/cloneos" -Body @{ status = "degraded" }
if ($rawNotConfig.StatusCode -eq 400 -or ($rawNotConfig.StatusCode -eq 200)) { Assert-Pass "PATCH on non-configurable tech (CloneOS) handled" }
else { Assert-Fail "PATCH on non-configurable tech (CloneOS) handled" "status=$($rawNotConfig.StatusCode)" }

# ── Section 6: Auth protection ────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Section 6: Auth protection ===" -ForegroundColor Cyan

function Invoke-NoAuth {
    param([string]$Path)
    try {
        $r = Invoke-WebRequest -Uri "$BaseUrl$Path" -Method GET -Headers @{ "Content-Type" = "application/json" } -UseBasicParsing -ErrorAction Stop
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

# Step 33
$s33 = Invoke-NoAuth -Path "/api/clonestore/technologies"
if ($s33 -eq 401) { Assert-Pass "GET /api/clonestore/technologies without token returns 401" }
else { Assert-Fail "GET /api/clonestore/technologies without token returns 401" "status=$s33" }

# Step 34
$s34 = Invoke-NoAuth -Path "/api/clonestore/technologies/cloneguard"
if ($s34 -eq 401) { Assert-Pass "GET /api/clonestore/technologies/cloneguard without token returns 401" }
else { Assert-Fail "GET /api/clonestore/technologies/cloneguard without token returns 401" "status=$s34" }

# Step 35: bad token
try {
    $badResp = Invoke-WebRequest -Uri "$BaseUrl/api/clonestore/technologies" -Method GET -Headers @{ "Authorization" = "Bearer invalid.token.here"; "Content-Type" = "application/json" } -UseBasicParsing -ErrorAction Stop
    $s35 = [int]$badResp.StatusCode
} catch {
    if ($_.Exception.Response) { $s35 = [int]$_.Exception.Response.StatusCode } else { $s35 = 0 }
}
if ($s35 -eq 401) { Assert-Pass "Invalid Bearer token returns 401" }
else { Assert-Fail "Invalid Bearer token returns 401" "status=$s35" }

# ── Section 7: Registry structure coherence ───────────────────────────────────

Write-Host ""
Write-Host "=== Section 7: Registry structure coherence ===" -ForegroundColor Cyan

$r2 = Invoke-Api -Path "/api/clonestore/technologies"

# Step 36: platform core count
$coreCount = ($r2.registry.definitions | Where-Object { $_.is_platform_core -eq $true }).Count
if ($coreCount -eq 4) { Assert-Pass "Registry reports exactly 4 platform core technologies" }
else { Assert-Fail "Registry reports exactly 4 platform core technologies" "count=$coreCount" }

# Step 37: summary.platform_core matches
if ($r2.registry.summary.platform_core -eq 4) { Assert-Pass "summary.platform_core is 4" }
else { Assert-Fail "summary.platform_core is 4" "val=$($r2.registry.summary.platform_core)" }

# Step 38: CloneVoice disabled in default registry
$voiceState = $r2.registry.runtime_states | Where-Object { $_.technology_slug -eq "clonevoice" } | Select-Object -First 1
if ($voiceState -ne $null -and $voiceState.status -eq "disabled") { Assert-Pass "CloneVoice runtime_state.status is disabled in default registry" }
else { Assert-Fail "CloneVoice runtime_state.status is disabled in default registry" "status=$($voiceState.status)" }

# Step 39: report object has expected arrays
$rep = $r2.report
if ($rep -ne $null -and $rep.PSObject.Properties.Name -contains "urgent_actions") { Assert-Pass "Report contains urgent_actions" }
else { Assert-Fail "Report contains urgent_actions" "missing field" }

# Step 40: report has warnings array
if ($rep -ne $null -and $rep.PSObject.Properties.Name -contains "warnings") { Assert-Pass "Report contains warnings" }
else { Assert-Fail "Report contains warnings" "missing field" }

# Step 41: all definitions have non-empty slug
$emptySlug = $r2.registry.definitions | Where-Object { $_.slug -eq $null -or $_.slug -eq "" }
if ($emptySlug.Count -eq 0) { Assert-Pass "All definitions have non-empty slug" }
else { Assert-Fail "All definitions have non-empty slug" "found empty slug(s)" }

# Step 42: summary enabled + disabled <= total
$s = $r2.registry.summary
if (($s.enabled + $s.disabled + $s.degraded + $s.not_configured) -le $s.total) { Assert-Pass "Summary counts do not exceed total" }
else { Assert-Fail "Summary counts do not exceed total" "sum=$($s.enabled + $s.disabled + $s.degraded + $s.not_configured), total=$($s.total)" }

# ── Section 8: Individual technology spot-checks ─────────────────────────────

Write-Host ""
Write-Host "=== Section 8: Individual technology spot-checks ===" -ForegroundColor Cyan

# Step 43: CloneOS is platform core
$rcores = Invoke-Api -Path "/api/clonestore/technologies/cloneos"
if ($rcores.technology -ne $null -and $rcores.technology.is_platform_core -eq $true) { Assert-Pass "CloneOS is_platform_core=true" }
else { Assert-Fail "CloneOS is_platform_core=true" "val=$($rcores.technology.is_platform_core)" }

# Step 44: CloneOS is not customer configurable
if ($rcores.technology -ne $null -and $rcores.technology.is_customer_configurable -eq $false) { Assert-Pass "CloneOS is_customer_configurable=false" }
else { Assert-Fail "CloneOS is_customer_configurable=false" "val=$($rcores.technology.is_customer_configurable)" }

# Step 45: CloneReview requires_human_validation
$rrv = Invoke-Api -Path "/api/clonestore/technologies/clonereview"
if ($rrv.technology -ne $null -and $rrv.technology.requires_human_validation -eq $true) { Assert-Pass "CloneReview requires_human_validation=true" }
else { Assert-Fail "CloneReview requires_human_validation=true" "val=$($rrv.technology.requires_human_validation)" }

# Step 46: CloneLearn requires_human_validation
$rrl = Invoke-Api -Path "/api/clonestore/technologies/clonelearn"
if ($rrl.technology -ne $null -and $rrl.technology.requires_human_validation -eq $true) { Assert-Pass "CloneLearn requires_human_validation=true" }
else { Assert-Fail "CloneLearn requires_human_validation=true" "val=$($rrl.technology.requires_human_validation)" }

# Step 47: CloneGuard default_risk_mode is guarded
$rguard = Invoke-Api -Path "/api/clonestore/technologies/cloneguard"
if ($rguard.technology -ne $null -and $rguard.technology.default_risk_mode -eq "guarded") { Assert-Pass "CloneGuard default_risk_mode=guarded" }
else { Assert-Fail "CloneGuard default_risk_mode=guarded" "val=$($rguard.technology.default_risk_mode)" }

# Step 48: CloneTrace default_autonomy is autonomous
$rtrace = Invoke-Api -Path "/api/clonestore/technologies/clonetrace"
if ($rtrace.technology -ne $null -and $rtrace.technology.default_autonomy -eq "autonomous") { Assert-Pass "CloneTrace default_autonomy=autonomous" }
else { Assert-Fail "CloneTrace default_autonomy=autonomous" "val=$($rtrace.technology.default_autonomy)" }

# ── Section 9: No Pierre hardcoding verification ──────────────────────────────

Write-Host ""
Write-Host "=== Section 9: No Pierre hardcoding verification ===" -ForegroundColor Cyan

# Step 49: applies_to_employee_slugs is empty for all defs
$defsWithRestriction = $r2.registry.definitions | Where-Object { $_.applies_to_employee_slugs.Count -gt 0 }
if ($defsWithRestriction.Count -eq 0) { Assert-Pass "All definitions have empty applies_to_employee_slugs (platform-wide)" }
else { Assert-Fail "All definitions have empty applies_to_employee_slugs" "restricted=$($defsWithRestriction.Count)" }

# Step 50: digest string mentions 12
if ($r2.digest -match "12") { Assert-Pass "Public digest mentions technology count (12)" }
else { Assert-Fail "Public digest mentions technology count (12)" "digest=$($r2.digest)" }

# ── Final Summary ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "CloneStore Technologies Foundation Test Complete" -ForegroundColor Cyan
Write-Host "TOTAL : $total | PASS : $pass | FAIL : $fail" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

if ($fail -eq 0) {
    Write-Host "All tests passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$fail test(s) failed." -ForegroundColor Red
    exit 1
}
