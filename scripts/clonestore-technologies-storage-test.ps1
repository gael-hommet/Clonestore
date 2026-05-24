# CloneStore Technologies Storage Migration — Integration Test Script (Bloc 18.1)
# PowerShell 5.1 compatible: no ?., no ??, no typographic quotes
# Usage: $env:PIERRE_TEST_TOKEN = "<your_jwt>"; .\scripts\clonestore-technologies-storage-test.ps1
# Tests the new clonestore_company_technologies storage layer:
# - New table read/write (platform_table source)
# - Legacy JSON fallback behavior
# - meta.storage_source field in responses
# - PATCH now writes to platform table, not pierre_company_memory

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Token = $env:PIERRE_TEST_TOKEN
)

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
    Write-Host "[FAIL] $Label -- $Reason" -ForegroundColor Red
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        if ($Body -ne $null) {
            $json = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $json -UseBasicParsing -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -UseBasicParsing -ErrorAction Stop
        }
        return $response.Content | ConvertFrom-Json
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return [PSCustomObject]@{ ok = $false; _httpStatus = $status; error = $_.Exception.Message }
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
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
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
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return [PSCustomObject]@{ StatusCode = $status; Body = $null }
    }
}

# ── Section 1: meta.storage_source present in GET all ─────────────────────────

Write-Host ""
Write-Host "=== Section 1: meta.storage_source in GET /api/clonestore/technologies ===" -ForegroundColor Cyan

$r = Invoke-Api -Path "/api/clonestore/technologies"

# Step 1
if ($r.ok -eq $true) { Assert-Pass "GET /api/clonestore/technologies returns ok=true" }
else { Assert-Fail "GET /api/clonestore/technologies returns ok=true" "ok=$($r.ok), error=$($r.error)" }

# Step 2
if ($r.meta -ne $null -and $r.meta.PSObject.Properties.Name -contains "storage_source") {
    Assert-Pass "Response meta contains storage_source field"
} else { Assert-Fail "Response meta contains storage_source field" "storage_source missing from meta" }

# Step 3
$validSources = @("platform_table", "legacy_json", "defaults")
if ($r.meta -ne $null -and $validSources -contains $r.meta.storage_source) {
    Assert-Pass "meta.storage_source has valid value ($($r.meta.storage_source))"
} else { Assert-Fail "meta.storage_source has valid value" "got: $($r.meta.storage_source)" }

# Step 4
if ($r.meta -ne $null -and $r.meta.PSObject.Properties.Name -contains "storage_note") {
    Assert-Pass "Response meta contains storage_note field"
} else { Assert-Fail "Response meta contains storage_note field" "storage_note missing" }

# Step 5
if ($r.registry -ne $null -and $r.registry.definitions.Count -eq 12) {
    Assert-Pass "Registry still returns all 12 definitions regardless of storage source"
} else { Assert-Fail "Registry returns 12 definitions" "count=$($r.registry.definitions.Count)" }

# ── Section 2: meta.storage_source in GET single technology ───────────────────

Write-Host ""
Write-Host "=== Section 2: meta.storage_source in GET /api/clonestore/technologies/[slug] ===" -ForegroundColor Cyan

$rg = Invoke-Api -Path "/api/clonestore/technologies/cloneguard"

# Step 6
if ($rg.ok -eq $true) { Assert-Pass "GET /cloneguard returns ok=true" }
else { Assert-Fail "GET /cloneguard returns ok=true" "error=$($rg.error)" }

# Step 7
if ($rg.meta -ne $null -and $rg.meta.PSObject.Properties.Name -contains "storage_source") {
    Assert-Pass "Single tech response meta contains storage_source"
} else { Assert-Fail "Single tech response meta contains storage_source" "field missing" }

# Step 8
if ($rg.meta -ne $null -and $validSources -contains $rg.meta.storage_source) {
    Assert-Pass "Single tech meta.storage_source has valid value ($($rg.meta.storage_source))"
} else { Assert-Fail "Single tech meta.storage_source has valid value" "got: $($rg.meta.storage_source)" }

# Step 9
if ($rg.setting -ne $null -and $rg.setting.technology_slug -eq "cloneguard") {
    Assert-Pass "Setting returned with correct technology_slug"
} else { Assert-Fail "Setting technology_slug is cloneguard" "got: $($rg.setting.technology_slug)" }

# ── Section 3: PATCH writes to platform table (meta.storage) ──────────────────

Write-Host ""
Write-Host "=== Section 3: PATCH meta.storage field ===" -ForegroundColor Cyan

$patchBody = @{ autonomy_level = "supervised"; risk_mode = "guarded" }
$rp = Invoke-Api -Method "PATCH" -Path "/api/clonestore/technologies/clonechat" -Body $patchBody

# Step 10
if ($rp.ok -eq $true) { Assert-Pass "PATCH /clonechat returns ok=true" }
else { Assert-Fail "PATCH /clonechat returns ok=true" "error=$($rp.error)" }

# Step 11
if ($rp.meta -ne $null -and $rp.meta.PSObject.Properties.Name -contains "storage") {
    Assert-Pass "PATCH response meta contains storage field"
} else { Assert-Fail "PATCH response meta contains storage field" "missing" }

# Step 12
if ($rp.meta -ne $null -and $rp.meta.storage -eq "clonestore_company_technologies") {
    Assert-Pass "PATCH meta.storage = 'clonestore_company_technologies'"
} else { Assert-Fail "PATCH meta.storage = 'clonestore_company_technologies'" "got: $($rp.meta.storage)" }

# Step 13: after PATCH, GET should reflect updated values
$rAfterPatch = Invoke-Api -Path "/api/clonestore/technologies/clonechat"
if ($rAfterPatch.ok -eq $true -and $rAfterPatch.setting.autonomy_level -eq "supervised") {
    Assert-Pass "After PATCH, GET reflects updated autonomy_level=supervised"
} else { Assert-Fail "After PATCH, GET reflects updated autonomy_level" "got: $($rAfterPatch.setting.autonomy_level)" }

# Step 14: after PATCH, source should be platform_table
if ($rAfterPatch.meta -ne $null -and $rAfterPatch.meta.storage_source -eq "platform_table") {
    Assert-Pass "After PATCH, source is platform_table"
} else { Assert-Fail "After PATCH, source is platform_table" "got: $($rAfterPatch.meta.storage_source)" }

# ── Section 4: Platform isolation — no agent_slug dependency ──────────────────

Write-Host ""
Write-Host "=== Section 4: Platform isolation ===" -ForegroundColor Cyan

# Step 15: all 12 slugs are present regardless of storage source
$slugs = $r.registry.definitions | ForEach-Object { $_.slug }
$expectedSlugs = @("cloneos","cloneadn","cloneguard","clonetrace","clonecontinuum","clonetrust","clonereview","clonesignals","clonelearn","clonevoice","clonechat","clonebrief")
$missing = $expectedSlugs | Where-Object { $slugs -notcontains $_ }
if ($missing.Count -eq 0) { Assert-Pass "All 12 technology slugs present after storage migration" }
else { Assert-Fail "All 12 slugs present" "missing: $($missing -join ',')" }

# Step 16: CloneVoice still disabled by default
$voice = $r.registry.settings | Where-Object { $_.technology_slug -eq "clonevoice" } | Select-Object -First 1
if ($voice -ne $null -and $voice.status -eq "disabled") {
    Assert-Pass "CloneVoice still defaults to disabled after migration"
} else { Assert-Fail "CloneVoice defaults to disabled" "status=$($voice.status)" }

# Step 17: platform core technologies still enabled
$coreOk = $true
$coreSlugs = @("cloneos", "cloneguard", "clonetrace", "clonecontinuum")
foreach ($coreSlug in $coreSlugs) {
    $s = $r.registry.settings | Where-Object { $_.technology_slug -eq $coreSlug } | Select-Object -First 1
    if ($s -eq $null -or $s.status -ne "enabled") { $coreOk = $false; break }
}
if ($coreOk) { Assert-Pass "All platform core technologies enabled after migration" }
else { Assert-Fail "All platform core technologies enabled" "one or more core technologies not enabled" }

# Step 18: settings_loaded field exists in meta
if ($r.meta -ne $null -and $r.meta.PSObject.Properties.Name -contains "settings_loaded") {
    Assert-Pass "meta.settings_loaded field present"
} else { Assert-Fail "meta.settings_loaded field present" "missing" }

# ── Section 5: PATCH — multiple technologies independently ────────────────────

Write-Host ""
Write-Host "=== Section 5: PATCH multiple technologies independently ===" -ForegroundColor Cyan

# Step 19: PATCH clonebrief
$rb = Invoke-Api -Method "PATCH" -Path "/api/clonestore/technologies/clonebrief" -Body @{ risk_mode = "guarded" }
if ($rb.ok -eq $true -and $rb.setting.technology_slug -eq "clonebrief") {
    Assert-Pass "PATCH /clonebrief succeeds independently"
} else { Assert-Fail "PATCH /clonebrief succeeds" "error=$($rb.error)" }

# Step 20: PATCH clonelearn (has requires_human_validation)
$rl = Invoke-Api -Method "PATCH" -Path "/api/clonestore/technologies/clonelearn" -Body @{ risk_mode = "strict" }
if ($rl.ok -eq $true) { Assert-Pass "PATCH /clonelearn with risk_mode=strict succeeds" }
else { Assert-Fail "PATCH /clonelearn with risk_mode=strict" "error=$($rl.error)" }

# Step 21: clonelearn autonomous is rejected (requires_human_validation)
$rawLearnAuto = Invoke-ApiRaw -Method "PATCH" -Path "/api/clonestore/technologies/clonelearn" -Body @{ autonomy_level = "autonomous" }
if ($rawLearnAuto.StatusCode -eq 400) {
    Assert-Pass "PATCH clonelearn autonomy_level=autonomous rejected (requires_human_validation)"
} else { Assert-Fail "PATCH clonelearn autonomous rejected" "status=$($rawLearnAuto.StatusCode)" }

# Step 22: cloneguard allows risk_mode update (is_customer_configurable)
$rcg = Invoke-Api -Method "PATCH" -Path "/api/clonestore/technologies/cloneguard" -Body @{ risk_mode = "strict" }
if ($rcg.ok -eq $true -and $rcg.setting.risk_mode -eq "strict") {
    Assert-Pass "PATCH cloneguard risk_mode=strict accepted"
} else { Assert-Fail "PATCH cloneguard risk_mode=strict" "error=$($rcg.error), risk_mode=$($rcg.setting.risk_mode)" }

# Step 23: after independent PATCH clonebrief, GET clonechat is unchanged
$rchat = Invoke-Api -Path "/api/clonestore/technologies/clonechat"
if ($rchat.ok -eq $true -and $rchat.setting.technology_slug -eq "clonechat") {
    Assert-Pass "GET clonechat unaffected after PATCH on different technology"
} else { Assert-Fail "GET clonechat unaffected" "error=$($rchat.error)" }

# ── Section 6: Auth protection (unchanged) ────────────────────────────────────

Write-Host ""
Write-Host "=== Section 6: Auth protection ===" -ForegroundColor Cyan

function Invoke-NoAuth { param([string]$Path, [string]$Method = "GET")
    try {
        $r2 = Invoke-WebRequest -Uri "$BaseUrl$Path" -Method $Method -Headers @{ "Content-Type" = "application/json" } -UseBasicParsing -ErrorAction Stop
        return [int]$r2.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

# Step 24
$s24 = Invoke-NoAuth -Path "/api/clonestore/technologies"
if ($s24 -eq 401) { Assert-Pass "GET /api/clonestore/technologies without token returns 401" }
else { Assert-Fail "No-auth GET returns 401" "status=$s24" }

# Step 25
$s25 = Invoke-NoAuth -Path "/api/clonestore/technologies/cloneguard"
if ($s25 -eq 401) { Assert-Pass "GET /api/clonestore/technologies/cloneguard without token returns 401" }
else { Assert-Fail "No-auth GET single returns 401" "status=$s25" }

# Step 26
$s26 = Invoke-NoAuth -Path "/api/clonestore/technologies/cloneguard" -Method "PATCH"
if ($s26 -eq 401) { Assert-Pass "PATCH without token returns 401" }
else { Assert-Fail "No-auth PATCH returns 401" "status=$s26" }

# ── Final Summary ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "CloneStore Technologies Storage Migration Tests" -ForegroundColor Cyan
Write-Host "TOTAL : $total | PASS : $pass | FAIL : $fail" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

if ($fail -eq 0) { Write-Host "All tests passed." -ForegroundColor Green; exit 0 }
else { Write-Host "$fail test(s) failed." -ForegroundColor Red; exit 1 }
