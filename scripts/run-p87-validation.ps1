# scripts/run-p87-validation.ps1 -- P8.7.1 final validation sequence, STRICTLY SEQUENTIAL.
$ErrorActionPreference = "Continue"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$root = "C:\Users\homme\clonestore"
$results = Join-Path $root "p87-validation-results.txt"
$logDir = Join-Path $root ".validation-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"P8.7.1 VALIDATION -- $(Get-Date)" | Out-File -FilePath $results -Encoding utf8

function Step($name, $cmd) {
  $log = Join-Path $logDir ("p87-$name.log")
  "=== $name :: $cmd :: start $(Get-Date -Format HH:mm:ss) ===" | Add-Content $results
  $out = Invoke-Expression "$cmd 2>&1" | Out-String
  $code = $LASTEXITCODE
  $clean = ($out -replace '\x1b\[[0-9;]*m','')
  $clean | Out-File -FilePath $log -Encoding utf8
  $summary = (($clean -split "`n") | Select-String -Pattern "Test Files|Tests |\d+ failed|\d+ passed|compiled successfully|Generating static|PASS|SKIPPED|RESULTAT|ready_for_p87_2|BLOCKED|READY_" | Select-Object -Last 10) -join "`n"
  "exit=$code" | Add-Content $results
  $summary | Add-Content $results
  "" | Add-Content $results
}

Step "tsc" "npx tsc --noEmit"
Step "vitest-p87" "npx vitest run --config vitest.integration.config.ts p87-live-infrastructure-preflight"
Step "test-phase8-6" "npm run test:phase8-6"
Step "build" "npm run build"
# report mode: capture clean JSON (loads .env.local; real read-only probes). exit 0 even with blockers.
"=== report-json (saved to p87-report.json) ===" | Add-Content $results
node scripts/check-p87-live-infrastructure-preflight.mjs --json 2>$null | Out-File -FilePath (Join-Path $root "p87-report.json") -Encoding utf8
"report exit=$LASTEXITCODE" | Add-Content $results; "" | Add-Content $results
Step "check-p87-strict" "npm run check:p87-live-infrastructure-preflight"
Step "check-p83-b3-live-signature" "npm run check:p83-b3-live-signature"
Step "check-p84-live-communications" "npm run check:p84-live-communications"
Step "check-p85-runtime-infrastructure" "npm run check:p85-runtime-infrastructure"
Step "check-p86-billing-infrastructure" "npm run check:p86-billing-infrastructure"
"ALL DONE -- $(Get-Date)" | Add-Content $results
