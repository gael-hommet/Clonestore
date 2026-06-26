# GO-LIVE 03 -- Legal & Public Copy Final Scan
# Lance legal-public-copy-scan.mjs apres verification Node.js.
# Ne fait aucun appel API. Ne modifie pas go-live-proofs.local.json.
# Ne fait aucun paiement reel. Ne contacte pas OpenAI ni Stripe.
# Compatible PowerShell 5 -- pas de ?. ni ?? ni operateurs modernes.
#
# CORRECTIONS GO-LIVE 03 :
# - Scan pages publiques pour promesses interdites
# - Scan pages legales pour placeholders actifs
# - Verifie les informations societe manquantes
# - Genere evidence file et proof templates (tous PENDING)
# - Ne marque JAMAIS proof verified automatiquement

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " GO-LIVE 03 -- Legal & Public Copy Final Scan" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ce script verifie les pages legales et publiques." -ForegroundColor White
Write-Host "Il ne fait aucun appel API externe." -ForegroundColor White
Write-Host "Il ne modifie pas go-live-proofs.local.json." -ForegroundColor White
Write-Host ""

# ── ETAPE 1 : Verifier Node.js ────────────────────────────────────────────────

Write-Host "ETAPE 1 -- Verification Node.js" -ForegroundColor Yellow
Write-Host "-------------------------------" -ForegroundColor Yellow
Write-Host ""

$nodeVersion = $null
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Node.js present : $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Node.js introuvable. Installer Node.js 18+." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Node.js non disponible : $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ── ETAPE 2 : Verifier le script mjs ─────────────────────────────────────────

Write-Host "ETAPE 2 -- Verification du script" -ForegroundColor Yellow
Write-Host "---------------------------------" -ForegroundColor Yellow
Write-Host ""

$scriptPath = "scripts\legal-public-copy-scan.mjs"
if (-not (Test-Path $scriptPath)) {
    Write-Host "[ERREUR] Script introuvable : $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Script present : $scriptPath" -ForegroundColor Green
Write-Host ""

# ── ETAPE 3 : Pages legales attendues ────────────────────────────────────────

Write-Host "ETAPE 3 -- Verification pages legales" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow
Write-Host ""

$legalPages = @(
    @{ path = "src\app\legal\cgu\page.tsx"; route = "/legal/cgu"; required = $true },
    @{ path = "src\app\legal\cgv\page.tsx"; route = "/legal/cgv"; required = $true },
    @{ path = "src\app\legal\dpa\page.tsx"; route = "/legal/dpa"; required = $true },
    @{ path = "src\app\legal\mentions\page.tsx"; route = "/legal/mentions"; required = $true },
    @{ path = "src\app\legal\confidentialite\page.tsx"; route = "/legal/confidentialite"; required = $true }
)

$missingPages = 0
foreach ($page in $legalPages) {
    if (Test-Path $page.path) {
        Write-Host "[OK]      $($page.route) -> $($page.path)" -ForegroundColor Green
    } else {
        Write-Host "[MANQUANT] $($page.route) -- page legale manquante !" -ForegroundColor Red
        $missingPages++
    }
}

Write-Host ""
if ($missingPages -gt 0) {
    Write-Host "[ALERTE] $missingPages page(s) legale(s) manquante(s)." -ForegroundColor Red
} else {
    Write-Host "[OK] Toutes les pages legales sont presentes." -ForegroundColor Green
}

Write-Host ""

# ── ETAPE 4 : Scan placeholders mentions legales ──────────────────────────────

Write-Host "ETAPE 4 -- Scan placeholders mentions legales" -ForegroundColor Yellow
Write-Host "---------------------------------------------" -ForegroundColor Yellow
Write-Host ""

$mentionsPath = "src\app\legal\mentions\page.tsx"
if (Test-Path $mentionsPath) {
    $mentionsContent = Get-Content $mentionsPath -Raw -ErrorAction SilentlyContinue
    $placeholderMarkers = @(
        "Placeholder -- a completer",
        "Placeholder -- a renseigner",
        "A renseigner",
        "A preciser",
        "Placeholder a valider juridiquement"
    )
    $placeholderCount = 0
    foreach ($marker in $placeholderMarkers) {
        if ($mentionsContent -match [regex]::Escape($marker)) {
            $placeholderCount++
            Write-Host "[PENDING] Placeholder detecte : '$marker'" -ForegroundColor Yellow
        }
    }
    if ($placeholderCount -eq 0) {
        Write-Host "[OK] Aucun placeholder detecte dans mentions legales." -ForegroundColor Green
        Write-Host "     Verifier manuellement sur /legal/mentions." -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] $placeholderCount type(s) de placeholders actifs dans mentions." -ForegroundColor Yellow
        Write-Host "            Completer avant lancement public." -ForegroundColor White
    }
} else {
    Write-Host "[MANQUANT] $mentionsPath introuvable." -ForegroundColor Red
}

Write-Host ""

# ── ETAPE 5 : Lancer legal-public-copy-scan.mjs ───────────────────────────────

Write-Host "ETAPE 5 -- Scan legal et public copy (Node.js)" -ForegroundColor Yellow
Write-Host "----------------------------------------------" -ForegroundColor Yellow
Write-Host ""

try {
    node scripts/legal-public-copy-scan.mjs
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Scan termine sans erreur Node.js." -ForegroundColor Green
    } else {
        Write-Host "[WARN] Scan termine avec code de sortie $LASTEXITCODE." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERREUR] Impossible de lancer le scan : $_" -ForegroundColor Red
}

Write-Host ""

# ── ETAPE 6 : Infos societe a remplir ────────────────────────────────────────

Write-Host "ETAPE 6 -- Informations societe a remplir" -ForegroundColor Yellow
Write-Host "-----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Les informations suivantes doivent etre renseignees dans /legal/mentions :" -ForegroundColor White
Write-Host ""
Write-Host "  1. Denomination sociale (ex. CloneStore SAS)" -ForegroundColor Cyan
Write-Host "  2. Forme juridique (SAS, SASU, auto-entrepreneur...)" -ForegroundColor Cyan
Write-Host "  3. Capital social (si applicable)" -ForegroundColor Cyan
Write-Host "  4. SIREN / SIRET / numero RCS" -ForegroundColor Cyan
Write-Host "  5. Adresse siege social complete" -ForegroundColor Cyan
Write-Host "  6. Directeur de la publication (nom et prenom)" -ForegroundColor Cyan
Write-Host "  7. Email de contact officiel" -ForegroundColor Cyan
Write-Host "  8. Hebergeur : nom, adresse (Vercel, Railway, etc.)" -ForegroundColor Cyan
Write-Host "  9. TVA intracommunautaire (si applicable)" -ForegroundColor Cyan
Write-Host " 10. Juridiction applicable (a valider par juriste)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Documentation complete : docs/GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md" -ForegroundColor White
Write-Host ""

# ── ETAPE 7 : Proof IDs ───────────────────────────────────────────────────────

Write-Host "ETAPE 7 -- Proof IDs GO-LIVE 03 (tous PENDING)" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Les 10 proof IDs suivants restent PENDING jusqu'a action manuelle de Gael :" -ForegroundColor White
Write-Host ""

$proofIds = @(
    "LEGAL_CGU_VALIDATED",
    "LEGAL_CGV_VALIDATED",
    "LEGAL_DPA_VALIDATED",
    "LEGAL_PRIVACY_VALIDATED",
    "LEGAL_MENTIONS_VALIDATED",
    "LEGAL_ENTITY_INFO_COMPLETED",
    "LEGAL_HUMAN_REVIEW_COMPLETED",
    "PUBLIC_COPY_SCAN_CLEAN",
    "PUBLIC_SITE_NO_FORBIDDEN_CLAIMS",
    "CHECKOUT_LEGAL_LINKS_PRESENT"
)

foreach ($id in $proofIds) {
    Write-Host "  [PENDING] $id" -ForegroundColor Yellow
}

Write-Host ""

# ── FIN ───────────────────────────────────────────────────────────────────────

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN GO-LIVE 03" -ForegroundColor Cyan
Write-Host " Aucun appel API. Aucune modification proofs." -ForegroundColor Cyan
Write-Host " Public launch : toujours NO-GO jusqu'a tous les proofs verifies." -ForegroundColor Cyan
Write-Host " Revue juridique humaine : REQUISE avant tout launch." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
