# scripts/run-p87-step2-validation.ps1 -- P8.7.2 automatable validation, STRICTLY SEQUENTIAL (no remote writes).
$ErrorActionPreference = "Continue"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$root = "C:\Users\homme\clonestore"
$results = Join-Path $root "p87-step2-results.txt"
$logDir = Join-Path $root ".validation-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"P8.7.2 VALIDATION -- $(Get-Date)" | Out-File -FilePath $results -Encoding utf8
function Step($name, $cmd) {
  "=== $name :: $cmd :: $(Get-Date -Format HH:mm:ss) ===" | Add-Content $results
  $out = Invoke-Expression "$cmd 2>&1" | Out-String
  $code = $LASTEXITCODE
  ($out -replace '\x1b\[[0-9;]*m','') | Out-File -FilePath (Join-Path $logDir "p87step2-$name.log") -Encoding utf8
  $sum = ((($out -replace '\x1b\[[0-9;]*m','') -split "`n") | Select-String -Pattern "Test Files|Tests |\d+ failed|\d+ passed|compiled successfully|Generating static|PASS|SKIPPED|ready:|BLOCKED|exit" | Select-Object -Last 8) -join "`n"
  "exit=$code" | Add-Content $results; $sum | Add-Content $results; "" | Add-Content $results
}
Step "tsc" "npx tsc --noEmit"
Step "vitest-p87-step2" "npx vitest run --config vitest.integration.config.ts p87-step2"
Step "vitest-p87-preflight" "npx vitest run --config vitest.integration.config.ts p87-live-infrastructure-preflight"
Step "test-phase8-6" "npm run test:phase8-6"
Step "check-p86-migration" "npm run check:p86-migration"
Step "build" "npm run build"
# live checks WITHOUT remote contact (config-only) -- prove fail-closed wiring; strict exits non-zero (blocked)
Step "preflight-strict-noprobe" "node scripts/check-p87-live-infrastructure-preflight.mjs --strict --no-probe --json"
Step "runtime-billing-strict-noprobe" "node scripts/check-p87-runtime-billing-live.mjs --strict --no-probe --json"
"ALL DONE -- $(Get-Date)" | Add-Content $results
