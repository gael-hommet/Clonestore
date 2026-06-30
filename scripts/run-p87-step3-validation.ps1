# scripts/run-p87-step3-validation.ps1 -- P8.7.2 validation remainder + full gates, STRICTLY SEQUENTIAL.
# Solders the battery not run at P8.7.2 closure (full integration glob, npm test, pfinal01/02) before any
# P8.7.3 provider activation. Each step records its exit code + a summary; the runner continues through all so
# the full matrix is captured, then a final PASS/FAIL roll-up. No external side effects (local tests + build +
# the read-only remote strict check).
$ErrorActionPreference = "Continue"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$root = "C:\Users\homme\clonestore"
Set-Location $root
$results = Join-Path $root "p87-step3-results.txt"
$logDir = Join-Path $root ".validation-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"P8.7.3 PRE-ACTIVATION VALIDATION -- $(Get-Date)" | Out-File -FilePath $results -Encoding utf8
$script:fails = @()
function Step($name, $cmd) {
  "=== $name :: $cmd :: START $(Get-Date -Format HH:mm:ss) ===" | Add-Content $results
  $out = Invoke-Expression "$cmd 2>&1" | Out-String
  $code = $LASTEXITCODE
  $clean = ($out -replace '\x1b\[[0-9;]*m','')
  $clean | Out-File -FilePath (Join-Path $logDir "step3-$name.log") -Encoding utf8
  $sum = ((($clean -split "`n") | Select-String -Pattern "Test Files|Tests |Test Suites|\d+ failed|\d+ passed|compiled successfully|Compiled successfully|Generating static|PASS|FAIL|ready:|exit|error TS|Error:" | Select-Object -Last 10) -join "`n")
  "exit=$code  END $(Get-Date -Format HH:mm:ss)" | Add-Content $results
  $sum | Add-Content $results
  "" | Add-Content $results
  if ($code -ne 0) { $script:fails += "$name (exit $code)" }
}
Step "tsc" "npx tsc --noEmit"
Step "test_phase8_6" "npm run test:phase8-6"
Step "full_integration_glob" "npm run test:phase8-1"
Step "npm_test" "npm test"
Step "pfinal01" "npm run test:pfinal01"
Step "pfinal02" "npm run test:pfinal02"
Step "build" "npm run build"
Step "check_runtime_billing_live" "npm run check:p87-runtime-billing-live"
"" | Add-Content $results
if ($script:fails.Count -eq 0) { "ROLLUP: ALL GREEN -- $(Get-Date)" | Add-Content $results }
else { ("ROLLUP: FAILURES -- " + ($script:fails -join "; ")) | Add-Content $results }
"DONE -- $(Get-Date)" | Add-Content $results