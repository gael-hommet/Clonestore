param(
  [int]$PartsCount = 4
)

$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$OutDir = Join-Path $Root "_clonestore_export"

Write-Host "Racine détectée : $Root"

if (-not (Test-Path (Join-Path $Root "src"))) {
  Write-Host ""
  Write-Host "ERREUR : je ne vois pas de dossier src ici."
  Write-Host "Va d'abord à la racine du projet avec cd chemin\vers\ton\projet"
  exit 1
}

if (Test-Path $OutDir) {
  Remove-Item $OutDir -Recurse -Force
}

New-Item -ItemType Directory -Path $OutDir | Out-Null

$IncludeExtensions = @(
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".css",
  ".scss",
  ".json",
  ".mjs",
  ".cjs",
  ".md"
)

$RootFiles = @(
  "package.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "tsconfig.json",
  "components.json"
)

$ExcludedDirNames = @(
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
  "coverage"
)

$ExcludedFragments = @(
  "\src\app\api\",
  "\src\lib\pierre\",
  "\src\lib\assistant\"
)

function Normalize-PathText {
  param([string]$Value)
  return $Value.Replace("/", "\")
}

function Is-ExcludedFile {
  param([System.IO.FileInfo]$File)

  $full = Normalize-PathText $File.FullName

  foreach ($dir in $ExcludedDirNames) {
    if ($full -like "*\$dir\*") {
      return $true
    }
  }

  foreach ($fragment in $ExcludedFragments) {
    if ($full -like "*$fragment*") {
      return $true
    }
  }

  return $false
}

function Is-FrontFile {
  param([System.IO.FileInfo]$File)

  if (Is-ExcludedFile $File) {
    return $false
  }

  $ext = $File.Extension.ToLowerInvariant()

  if ($IncludeExtensions -notcontains $ext) {
    return $false
  }

  $relative = Normalize-PathText ($File.FullName.Substring($Root.Length).TrimStart("\", "/"))

  if ($RootFiles -contains $File.Name -and $File.DirectoryName -eq $Root) {
    return $true
  }

  if ($relative -like "src\app\*") {
    return $true
  }

  if ($relative -like "src\components\*") {
    return $true
  }

  if ($relative -like "src\styles\*") {
    return $true
  }

  if ($relative -like "src\data\*") {
    return $true
  }

  if ($relative -like "src\config\*") {
    return $true
  }

  if ($relative -like "src\lib\*") {
    return $true
  }

  return $false
}

Write-Host "Recherche des fichiers front..."

$Files = Get-ChildItem -LiteralPath $Root -Recurse -File |
  Where-Object { Is-FrontFile $_ } |
  Sort-Object Length -Descending

if (-not $Files -or $Files.Count -eq 0) {
  Write-Host "ERREUR : aucun fichier front trouvé."
  exit 1
}

Write-Host "Fichiers trouvés : $($Files.Count)"

$Buckets = @()
for ($i = 0; $i -lt $PartsCount; $i++) {
  $Buckets += ,(New-Object System.Collections.Generic.List[object])
}

$Sizes = New-Object long[] $PartsCount

foreach ($file in $Files) {
  $minIndex = 0

  for ($i = 1; $i -lt $PartsCount; $i++) {
    if ($Sizes[$i] -lt $Sizes[$minIndex]) {
      $minIndex = $i
    }
  }

  [void]$Buckets[$minIndex].Add($file)
  $Sizes[$minIndex] += $file.Length
}

for ($i = 0; $i -lt $PartsCount; $i++) {
  $partNumber = $i + 1
  $outFile = Join-Path $OutDir ("clonestore-front-part-{0}.txt" -f $partNumber)

  $encoding = New-Object System.Text.UTF8Encoding($false)
  $writer = New-Object System.IO.StreamWriter($outFile, $false, $encoding)

  try {
    $writer.WriteLine("============================================================")
    $writer.WriteLine("CLONESTORE FRONT EXPORT - PART $partNumber/$PartsCount")
    $writer.WriteLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $writer.WriteLine("Root: $Root")
    $writer.WriteLine("Files: $($Buckets[$i].Count)")
    $writer.WriteLine("Approx size: $([Math]::Round($Sizes[$i] / 1KB, 1)) KB")
    $writer.WriteLine("============================================================")
    $writer.WriteLine("")
    $writer.WriteLine("============================================================")
    $writer.WriteLine("FILES IN THIS PART")
    $writer.WriteLine("============================================================")

    foreach ($file in ($Buckets[$i] | Sort-Object FullName)) {
      $relative = $file.FullName.Substring($Root.Length).TrimStart("\", "/")
      $writer.WriteLine($relative)
    }

    $writer.WriteLine("")
    $writer.WriteLine("============================================================")
    $writer.WriteLine("FILES CONTENT")
    $writer.WriteLine("============================================================")

    foreach ($file in ($Buckets[$i] | Sort-Object FullName)) {
      $relative = $file.FullName.Substring($Root.Length).TrimStart("\", "/")

      $writer.WriteLine("")
      $writer.WriteLine("")
      $writer.WriteLine("============================================================")
      $writer.WriteLine("FILE: $relative")
      $writer.WriteLine("============================================================")
      $writer.WriteLine("")

      try {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
        $writer.WriteLine($content)
      } catch {
        $writer.WriteLine("[READ_ERROR] Impossible de lire ce fichier : $($_.Exception.Message)")
      }
    }
  } finally {
    $writer.Close()
  }

  Write-Host "Créé : $outFile"
}

Write-Host ""
Write-Host "EXPORT TERMINÉ."
Write-Host "Dossier : $OutDir"
Write-Host ""
Get-ChildItem -LiteralPath $OutDir -Filter "*.txt" | Select-Object Name, Length | Format-Table -AutoSize
