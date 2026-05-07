$ErrorActionPreference = "Continue"

$root = (Get-Location).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $root "audit-$stamp"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Section($name) {
  "`n============================================================" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  $name | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  "============================================================" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
}

Section "1. ROUTES APP QUI ONT PAGE.TSX ET ROUTE.TS AU MEME ENDROIT"
$dirs = Get-ChildItem ".\src\app" -Recurse -Directory
foreach ($d in $dirs) {
  $hasPage = Test-Path (Join-Path $d.FullName "page.tsx")
  $hasRoute = Test-Path (Join-Path $d.FullName "route.ts")
  if ($hasPage -and $hasRoute) {
    "CONFLIT: $($d.FullName.Replace($root, '.'))" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  }
}

Section "2. ROUTE.TS VIDES OU SANS EXPORT HTTP"
$routeFiles = Get-ChildItem ".\src\app" -Recurse -File -Include "route.ts","route.tsx"
foreach ($f in $routeFiles) {
  $txt = Get-Content $f.FullName -Raw
  $rel = $f.FullName.Replace($root, ".")
  if ([string]::IsNullOrWhiteSpace($txt)) {
    "VIDE: $rel" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  } elseif ($txt -notmatch "export\s+(async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)") {
    "SANS EXPORT HTTP: $rel" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  }
}

Section "3. IMPORTS AVEC ALIAS SUSPECT @/src"
Get-ChildItem ".\src" -Recurse -File -Include "*.ts","*.tsx" |
  Select-String -Pattern "@/src/" |
  ForEach-Object {
    "$($_.Path.Replace($root, '.')):$($_.LineNumber): $($_.Line.Trim())" |
      Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  }

Section "4. EXPORTS PIERRE IMPORTANTS"
$files = @(
  ".\src\components\pierre\PierreDocumentPanel.tsx",
  ".\src\components\pierre\PierreMissionUnderstanding.tsx",
  ".\src\components\pierre\PierreExecutionBoard.tsx",
  ".\src\hooks\pierre\usePierreMissionCenter.ts",
  ".\src\hooks\pierre\usePierreCompanyMemory.ts",
  ".\src\lib\pierre\tasks\create.ts",
  ".\src\lib\pierre\tasks\run.ts",
  ".\src\lib\pierre\tasks\executors.ts"
)

foreach ($file in $files) {
  Section "EXPORTS: $file"
  if (Test-Path $file) {
    Select-String -Path $file -Pattern "export " |
      ForEach-Object {
        "$($_.LineNumber): $($_.Line.Trim())" |
          Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
      }
  } else {
    "FICHIER INTROUVABLE" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
  }
}

Section "5. ESLINT COMPLET"
npx eslint . *>&1 | Tee-Object -FilePath "$outDir\eslint.log"

Section "6. TYPESCRIPT COMPLET"
npx tsc --noEmit --pretty false *>&1 | Tee-Object -FilePath "$outDir\tsc.log"

Section "7. NEXT BUILD COMPLET"
npm run build *>&1 | Tee-Object -FilePath "$outDir\build.log"

Section "AUDIT TERMINE"
"Rapport créé dans: $outDir" | Tee-Object -FilePath "$outDir\AUDIT.txt" -Append
