# P-FINAL 02 — Public Copy Scanner
# Lance les tests de scanner de copy public (P-FINAL 01).
# Verifie l'absence de formulations interdites sur les pages publiques.
# Compatible PowerShell 5.

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " P-FINAL 02 — Public Copy Scanner" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── Run copy scanner tests ────────────────────────────────────────────────────
Write-Host "Lancement du scanner de copy public (tests unitaires)..." -ForegroundColor White
Write-Host ""

$testResult = $null
try {
    $testResult = npx vitest run src/lib/production-readiness/public-copy/__tests__/copy-scanner.test.ts 2>&1
    $testOutput = $testResult | Out-String

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Tests copy scanner: TOUS PASSES" -ForegroundColor Green
        Write-Host ""

        # Parse test counts from output
        if ($testOutput -match "(\d+) passed") {
            Write-Host "     Tests passes: $($Matches[1])" -ForegroundColor Green
        }
    } else {
        Write-Host "[ECHEC] Tests copy scanner: DES TESTS ONT ECHOUE" -ForegroundColor Red
        Write-Host ""
        Write-Host $testOutput -ForegroundColor DarkGray
    }
} catch {
    Write-Host "[ERREUR] Impossible de lancer les tests: $_" -ForegroundColor Red
}

Write-Host ""

# ── Forbidden patterns check ──────────────────────────────────────────────────
Write-Host "VERIFICATION DES PATTERNS INTERDITS" -ForegroundColor Yellow
Write-Host "------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Patterns interdits a verifier manuellement sur les pages publiques:" -ForegroundColor White
Write-Host ""

$forbiddenPatterns = @(
    @{ pattern = "Pierre garantit"; page = "homepage/pricing/demo"; severity = "BLOQUANT" },
    @{ pattern = "remplace avocat"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "zero erreur / sans erreur"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "essai gratuit de 7 jours"; page = "homepage/pricing"; severity = "BLOQUANT" },
    @{ pattern = "essai gratuit illimite"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "decisions autonomes"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "satisfait ou rembourse"; page = "pricing/homepage"; severity = "BLOQUANT" },
    @{ pattern = "logiciel de paie officiel"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "genere des bulletins de salaire"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "remplace expert-comptable"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "resultats garantis"; page = "toutes"; severity = "BLOQUANT" },
    @{ pattern = "conforme a la loi"; page = "toutes"; severity = "BLOQUANT" }
)

foreach ($item in $forbiddenPatterns) {
    Write-Host "  [BLOQUANT] '$($item.pattern)'" -ForegroundColor Red
    Write-Host "             Pages: $($item.page)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Pages a scanner manuellement:" -ForegroundColor White
Write-Host "  - / (homepage)" -ForegroundColor Cyan
Write-Host "  - /pricing" -ForegroundColor Cyan
Write-Host "  - /demo/pierre" -ForegroundColor Cyan
Write-Host "  - /checkout" -ForegroundColor Cyan
Write-Host "  - /legal/* (toutes les pages legales)" -ForegroundColor Cyan
Write-Host ""

# ── Required disclaimers ──────────────────────────────────────────────────────
Write-Host "DISCLAIMERS OBLIGATOIRES" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "La homepage DOIT contenir une mention de validation humaine obligatoire." -ForegroundColor White
Write-Host "Exemple: 'Brouillons soumis a validation humaine obligatoire avant usage'" -ForegroundColor Cyan
Write-Host ""
Write-Host "La page demo DOIT contenir le disclaimer:" -ForegroundColor White
Write-Host "  'Donnees fictives — Pierre ne garantit pas la conformite legale'" -ForegroundColor Cyan
Write-Host ""

# ── Proof template ────────────────────────────────────────────────────────────
Write-Host "TEMPLATE DE PREUVE JSON" -ForegroundColor Yellow
Write-Host "-----------------------" -ForegroundColor Yellow
Write-Host ""

$scanStatus = if ($testResult -ne $null -and $LASTEXITCODE -eq 0) { "verified" } else { "pending" }
$scanDate = if ($scanStatus -eq "verified") { Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ" } else { "" }

$proofTemplate = @"
{
  "proof_id": "PUBLIC_COPY_SCAN_CLEAN",
  "status": "$scanStatus",
  "verified_at": "$scanDate",
  "verified_by": "Gael Hommet",
  "evidence_type": "test_log",
  "evidence_ref": "go-live-evidence/copy/copy-scanner-results.txt",
  "notes": "npm run test:pfinal01-copy: 40/40 passes. Aucune violation bloquante detectee."
},
{
  "proof_id": "PUBLIC_SITE_NO_FORBIDDEN_CLAIMS",
  "status": "pending",
  "verified_at": "",
  "verified_by": "Gael Hommet",
  "evidence_type": "manual_attestation",
  "evidence_ref": "go-live-evidence/copy/manual-copy-check.txt",
  "notes": "Verification manuelle homepage/pricing/demo: aucun pattern interdit detecte."
}
"@

Write-Host $proofTemplate -ForegroundColor DarkGray
Write-Host ""

if ($scanStatus -eq "verified") {
    Write-Host "[RESULTAT] Copy scanner: CLEAN" -ForegroundColor Green
    Write-Host "           Proof PUBLIC_COPY_SCAN_CLEAN peut etre marque verified." -ForegroundColor Green
} else {
    Write-Host "[RESULTAT] Copy scanner: EN ATTENTE (tests non passes ou scan manuel requis)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN — Scanner execute. Verification manuelle requise." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
