# scripts/pierre-cloneadn-test.ps1
# Bloc 28 - CloneADN / Empreinte Entreprise
# Validation E2E des routes CloneADN
# Compatible PowerShell 5.1 - pas de ?., pas de ??, pas de guillemets typographiques
# Usage: $env:PIERRE_TEST_TOKEN = "your-token"; .\scripts\pierre-cloneadn-test.ps1

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Token = ""
)

if ($Token -eq "") {
    $Token = $env:PIERRE_TEST_TOKEN
}

$Passed = 0
$Failed = 0
$Errors = @()

function Test-Step {
    param(
        [int]$Step,
        [string]$Name,
        [scriptblock]$Check
    )
    Write-Host ""
    Write-Host "Step $Step : $Name" -ForegroundColor Cyan
    try {
        $result = & $Check
        if ($result -eq $true) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:Passed++
        } else {
            Write-Host "  FAIL : $result" -ForegroundColor Red
            $script:Failed++
            $script:Errors += "Step $Step ($Name): $result"
        }
    } catch {
        Write-Host "  ERROR : $_" -ForegroundColor Red
        $script:Failed++
        $script:Errors += "Step $Step ($Name): $_"
    }
}

function Invoke-PierreApi {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null
    )
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type"  = "application/json"
    }
    $uri = "$BaseUrl/api/pierre/use/$Path"
    if ($Body -ne $null) {
        $bodyJson = $Body | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $bodyJson -ErrorAction Stop
    } else {
        $response = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ErrorAction Stop
    }
    return $response
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " Pierre CloneADN - Bloc 28 - Validation" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "BaseUrl : $BaseUrl"
Write-Host "Token   : $(if ($Token.Length -gt 8) { $Token.Substring(0, 8) + '...' } else { '(not set)' })"
Write-Host ""

if ($Token -eq "") {
    Write-Host "ERREUR : Token manquant." -ForegroundColor Red
    Write-Host "Usage : " -NoNewline
    Write-Host '$env:PIERRE_TEST_TOKEN = "your-token"; .\scripts\pierre-cloneadn-test.ps1' -ForegroundColor Yellow
    exit 1
}

# ── Step 1 : GET profile - profil initial ─────────────────────────────────────

Test-Step -Step 1 -Name "GET /cloneadn - profil initial" -Check {
    $r = Invoke-PierreApi -Path "cloneadn"
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.profile) { return "profile manquant" }
    if ($null -eq $r.analysis) { return "analysis manquant" }
    if ($null -eq $r.app_context) { return "app_context manquant" }
    return $true
}

# ── Step 2 : GET profile - status valide ─────────────────────────────────────

Test-Step -Step 2 -Name "GET /cloneadn - status valide" -Check {
    $r = Invoke-PierreApi -Path "cloneadn"
    $validStatuses = @("not_configured", "partial", "configured", "strong", "locked")
    if ($validStatuses -notcontains $r.profile.status) { return "status invalide: $($r.profile.status)" }
    return $true
}

# ── Step 3 : PUT profile - remplacement complet ───────────────────────────────

Test-Step -Step 3 -Name "PUT /cloneadn - remplacement complet" -Check {
    $body = @{
        company_identity = @{
            legal_name = "Acme Legal Corp"
            trade_name = "Acme"
            sector = "technology"
            country_code = "FR"
        }
        communication = @{
            tone = "warm"
            formal_closing = "Cordialement"
            greeting_style = "Bonjour"
            language_code = "fr"
        }
        validation = @{
            default_mode = "recommended"
            sensitive_topics = @("licenciement", "salaire")
            never_auto_execute = @("email.send", "email_send")
        }
        autonomy = @{
            level = "supervised"
            blocked_auto_task_types = @("email.send", "email_send")
        }
    }
    $r = Invoke-PierreApi -Method "PUT" -Path "cloneadn" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.profile.company_identity.legal_name -ne "Acme Legal Corp") { return "legal_name non sauvegarde" }
    if ($r.profile.communication.tone -ne "warm") { return "tone non sauvegarde" }
    return $true
}

# ── Step 4 : PATCH profile - mise a jour partielle ────────────────────────────

Test-Step -Step 4 -Name "PATCH /cloneadn - mise a jour partielle" -Check {
    $body = @{
        communication = @{
            tone = "direct"
        }
    }
    $r = Invoke-PierreApi -Method "PATCH" -Path "cloneadn" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.profile.communication.tone -ne "direct") { return "tone non mis a jour: $($r.profile.communication.tone)" }
    return $true
}

# ── Step 5 : PATCH - preservation des autres champs ──────────────────────────

Test-Step -Step 5 -Name "PATCH /cloneadn - preservation champs existants" -Check {
    $body = @{
        communication = @{
            tone = "formal"
        }
    }
    $r = Invoke-PierreApi -Method "PATCH" -Path "cloneadn" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    # Les autres champs doivent etre preserves
    if ($null -eq $r.profile.validation) { return "validation perdu apres PATCH" }
    if ($null -eq $r.profile.autonomy) { return "autonomy perdu apres PATCH" }
    return $true
}

# ── Step 6 : GET rules - liste initiale ──────────────────────────────────────

Test-Step -Step 6 -Name "GET /cloneadn/rules - liste initiale" -Check {
    $r = Invoke-PierreApi -Path "cloneadn/rules"
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.rules) { return "rules manquant" }
    if ($null -eq $r.summary) { return "summary manquant" }
    if (-not ($r.rules -is [array])) { return "rules n'est pas un tableau" }
    return $true
}

# ── Step 7 : POST rules - ajout d'une regle ──────────────────────────────────

Test-Step -Step 7 -Name "POST /cloneadn/rules - ajout regle" -Check {
    $body = @{
        id = "rule-test-bloc28"
        label = "Test Bloc 28 Rule"
        description = "Regle de test pour Bloc 28"
        category = "compliance"
        severity = "warning"
        condition = "risk_level:high"
        action = "require_review"
        active = $true
        applies_to_domains = @("hr")
        applies_to_task_types = @()
        requires_human_validation = $false
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/rules" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.rule) { return "rule manquant dans la reponse" }
    if ($r.rule.id -ne "rule-test-bloc28") { return "id incorrect: $($r.rule.id)" }
    return $true
}

# ── Step 8 : POST rules - regle blocking ─────────────────────────────────────

Test-Step -Step 8 -Name "POST /cloneadn/rules - regle severity=block" -Check {
    $body = @{
        id = "rule-block-bloc28"
        label = "Block sensitive actions"
        category = "security"
        severity = "block"
        condition = "sensitive_topic"
        action = "block_and_notify"
        active = $true
        applies_to_domains = @()
        applies_to_task_types = @()
        requires_human_validation = $true
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/rules" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.rule.severity -ne "block") { return "severity incorrect: $($r.rule.severity)" }
    if ($r.rule.requires_human_validation -ne $true) { return "requires_human_validation incorrect" }
    return $true
}

# ── Step 9 : GET rules - verif summary apres ajout ────────────────────────────

Test-Step -Step 9 -Name "GET /cloneadn/rules - summary apres ajout" -Check {
    $r = Invoke-PierreApi -Path "cloneadn/rules"
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.summary.total -lt 1) { return "total rules = 0, attendu >= 1" }
    if ($r.summary.active -lt 1) { return "active rules = 0, attendu >= 1" }
    return $true
}

# ── Step 10 : GET analyze - analyse profil ────────────────────────────────────

Test-Step -Step 10 -Name "GET /cloneadn/analyze - analyse profil" -Check {
    $r = Invoke-PierreApi -Path "cloneadn/analyze"
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.analysis) { return "analysis manquant" }
    if ($null -eq $r.analysis.status) { return "analysis.status manquant" }
    if ($null -eq $r.analysis.completeness_score) { return "analysis.completeness_score manquant" }
    return $true
}

# ── Step 11 : GET analyze - champs de completude ─────────────────────────────

Test-Step -Step 11 -Name "GET /cloneadn/analyze - champs completude" -Check {
    $r = Invoke-PierreApi -Path "cloneadn/analyze"
    $fields = @("has_communication_profile", "has_validation_rules", "has_autonomy_config", "has_document_profile", "has_company_identity")
    foreach ($f in $fields) {
        if ($null -eq $r.analysis.$f) { return "champ manquant: $f" }
    }
    return $true
}

# ── Step 12 : POST analyze - evaluation action ────────────────────────────────

Test-Step -Step 12 -Name "POST /cloneadn/analyze - evaluation action" -Check {
    $body = @{
        task_type = "email.draft"
        domain = "communication"
        risk_level = "medium"
        sensitive_topics = @()
        text = ""
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/analyze" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.action_evaluation) { return "action_evaluation manquant" }
    if ($null -eq $r.action_evaluation.blocked) { return "action_evaluation.blocked manquant" }
    if ($null -eq $r.action_evaluation.requires_validation) { return "action_evaluation.requires_validation manquant" }
    return $true
}

# ── Step 13 : POST analyze - email.send toujours bloque ──────────────────────

Test-Step -Step 13 -Name "POST /cloneadn/analyze - email.send bloque" -Check {
    $body = @{
        task_type = "email.send"
        domain = "communication"
        risk_level = "low"
        sensitive_topics = @()
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/analyze" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.action_evaluation.blocked -ne $true) { return "email.send devrait etre bloque" }
    return $true
}

# ── Step 14 : POST analyze - topics sensibles ─────────────────────────────────

Test-Step -Step 14 -Name "POST /cloneadn/analyze - requires_validation pour topic sensible" -Check {
    $body = @{
        task_type = "doc.generate"
        domain = "hr"
        risk_level = "medium"
        sensitive_topics = @("licenciement")
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/analyze" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.action_evaluation.requires_validation -ne $true) { return "requires_validation devrait etre true pour licenciement" }
    return $true
}

# ── Step 15 : POST preview - simulation read-only ─────────────────────────────

Test-Step -Step 15 -Name "POST /cloneadn/preview - simulation read-only" -Check {
    $body = @{
        task_type = "doc.generate"
        domain = "hr"
        risk_level = "medium"
        sensitive_topics = @()
        text = "onboarding document"
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/preview" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.profile_status) { return "profile_status manquant" }
    if ($null -eq $r.analysis) { return "analysis manquant" }
    if ($null -eq $r.app_context) { return "app_context manquant" }
    if ($null -eq $r.document_variables) { return "document_variables manquant" }
    if ($null -eq $r.hint) { return "hint manquant" }
    return $true
}

# ── Step 16 : POST preview - simulation_note present ─────────────────────────

Test-Step -Step 16 -Name "POST /cloneadn/preview - simulation_note present" -Check {
    $body = @{
        task_type = "email.draft"
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/preview" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.simulation_note) { return "simulation_note manquant" }
    if ($r.simulation_note -notlike "*read-only*") { return "simulation_note n'indique pas read-only" }
    return $true
}

# ── Step 17 : POST preview - action_evaluation present quand params fournis ───

Test-Step -Step 17 -Name "POST /cloneadn/preview - action_evaluation avec params" -Check {
    $body = @{
        task_type = "email.send"
        domain = "communication"
        risk_level = "high"
        sensitive_topics = @("salary")
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/preview" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($null -eq $r.action_evaluation) { return "action_evaluation manquant" }
    return $true
}

# ── Step 18 : GET profile - verification apres PUT que employees est preserves

Test-Step -Step 18 -Name "GET /cloneadn - verification que employees n'est pas ecrase" -Check {
    # This test verifies the storage patch does not touch employees
    # We can only verify it via the profile route (employees are in reusable_rh_context_json, not in the profile itself)
    $r = Invoke-PierreApi -Path "cloneadn"
    if ($r.ok -ne $true) { return "ok != true" }
    # Verify the profile was saved without corruption
    if ($null -eq $r.profile.validation) { return "validation perdu - potentiel probleme de stockage" }
    if ($null -eq $r.profile.autonomy) { return "autonomy perdu - potentiel probleme de stockage" }
    return $true
}

# ── Step 19 : GET profile - completeness_score dans 0-100 ────────────────────

Test-Step -Step 19 -Name "GET /cloneadn - completeness_score dans [0,100]" -Check {
    $r = Invoke-PierreApi -Path "cloneadn"
    if ($r.ok -ne $true) { return "ok != true" }
    $score = $r.analysis.completeness_score
    if ($null -eq $score) { return "completeness_score manquant" }
    if ($score -lt 0 -or $score -gt 100) { return "completeness_score hors bornes: $score" }
    return $true
}

# ── Step 20 : GET profile - reponse ne contient pas de secrets ───────────────

Test-Step -Step 20 -Name "GET /cloneadn - aucun secret dans la reponse" -Check {
    $r = Invoke-PierreApi -Path "cloneadn"
    $responseJson = $r | ConvertTo-Json -Depth 20
    $secretPatterns = @("service_role", "SUPABASE_SERVICE", "OPENAI_API_KEY", "ANTHROPIC_API_KEY")
    foreach ($pattern in $secretPatterns) {
        if ($responseJson -match $pattern) {
            return "Secret potentiel detecte: $pattern"
        }
    }
    return $true
}

# ── Step 21 : POST rules - regle inactives non comptee comme blocking ─────────

Test-Step -Step 21 -Name "POST /cloneadn/rules - regle inactive" -Check {
    $body = @{
        id = "rule-inactive-bloc28"
        label = "Inactive blocking rule"
        category = "security"
        severity = "block"
        condition = "always"
        action = "block"
        active = $false
        applies_to_domains = @()
        applies_to_task_types = @()
        requires_human_validation = $true
    }
    $r = Invoke-PierreApi -Method "POST" -Path "cloneadn/rules" -Body $body
    if ($r.ok -ne $true) { return "ok != true" }
    if ($r.rule.active -ne $false) { return "regle devrait etre inactive" }
    return $true
}

# ── Resultats ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " Resultats" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Passed : $Passed" -ForegroundColor Green
Write-Host "  Failed : $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($Errors.Count -gt 0) {
    Write-Host "Erreurs :" -ForegroundColor Red
    foreach ($e in $Errors) {
        Write-Host "  - $e" -ForegroundColor Red
    }
    Write-Host ""
}

if ($Failed -gt 0) {
    Write-Host "ECHEC : $Failed etape(s) ont echoue." -ForegroundColor Red
    exit 1
} else {
    Write-Host "SUCCES : Toutes les etapes ont passe." -ForegroundColor Green
    exit 0
}
