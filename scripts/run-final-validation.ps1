# scripts/run-final-validation.ps1 -- P8.6 final global validation, STRICTLY SEQUENTIAL (no parallelism).
$ErrorActionPreference = "Continue"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$root = "C:\Users\homme\clonestore"
$results = Join-Path $root "validation-results.txt"
$logDir = Join-Path $root ".validation-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"P8.6 FINAL VALIDATION -- $(Get-Date)" | Out-File -FilePath $results -Encoding utf8

$steps = @(
  @{ name = "npm-test";                    cmd = "npm test" },
  @{ name = "pfinal01";                    cmd = "npm run test:pfinal01" },
  @{ name = "pfinal02";                    cmd = "npm run test:pfinal02" },
  @{ name = "build";                       cmd = "npm run build" },
  @{ name = "check-p83-b2f-preflight";     cmd = "npm run check:p83-b2f-preflight" },
  @{ name = "check-p83-b3-live-signature"; cmd = "npm run check:p83-b3-live-signature" },
  @{ name = "check-p84-live-comms";        cmd = "npm run check:p84-live-communications" },
  @{ name = "check-p85-runtime-smoke";     cmd = "npm run check:p85-runtime-smoke" },
  @{ name = "check-p85-runtime-infra";     cmd = "npm run check:p85-runtime-infrastructure" },
  @{ name = "check-p86-customer-smoke";    cmd = "npm run check:p86-customer-lifecycle-smoke" },
  @{ name = "check-p86-billing-infra";     cmd = "npm run check:p86-billing-infrastructure" },
  @{ name = "check-p86-migration";         cmd = "npm run check:p86-migration" }
)

foreach ($s in $steps) {
  $log = Join-Path $logDir ("$($s.name).log")
  "=== $($s.name) :: $($s.cmd) :: start $(Get-Date -Format HH:mm:ss) ===" | Add-Content $results
  $out = Invoke-Expression "$($s.cmd) 2>&1" | Out-String
  $code = $LASTEXITCODE
  $clean = ($out -replace '\x1b\[[0-9;]*m','')
  $clean | Out-File -FilePath $log -Encoding utf8
  $summary = (($clean -split "`n") | Select-String -Pattern "Test Files|Tests |Duration|\d+ failed|\d+ passed|Compiled|compiled successfully|Checking validity|Generating static|PASS|SKIP|SKIPPED|Error:|Cannot|idempot|v28|exit 0" | Select-Object -Last 10) -join "`n"
  "exit=$code" | Add-Content $results
  $summary | Add-Content $results
  "" | Add-Content $results
  # run all steps and report all (a failure in one does not skip the rest).
}
"ALL DONE -- $(Get-Date)" | Add-Content $results
