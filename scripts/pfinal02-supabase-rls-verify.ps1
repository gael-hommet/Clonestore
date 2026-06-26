# P-FINAL 02 - Supabase RLS Verification Script
# Guide Gael etape par etape pour verifier le RLS en staging puis production.
# Ce script ne touche pas Supabase directement. Il affiche les commandes a executer.
# Compatible PowerShell 5 - pas de ?. ni ?? ni operateurs modernes.
#
# GO-LIVE 01C UPDATE:
# Si l'erreur "public.companies does not exist" s'est produite, utiliser:
#   docs/sql/GO_LIVE_01C_SCHEMA_INTROSPECTION.sql  (read-only, a executer en premier)
#   docs/sql/GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql     (pack adaptatif avec to_regclass guards)
# Ne PAS creer la table companies -- elle n'est pas utilisee par ce codebase.
# Voir docs/GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md pour le guide complet.
#
# GO-LIVE 01D UPDATE:
# Introspection reelle effectuee. Schema mixte user_id/client_id confirme.
# Avant d'appliquer un pack cible, verifier le mapping client_id :
#   docs/sql/GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql (read-only, verifier les valeurs)
# Si client_id text = auth.uid() confirme :
#   docs/sql/GO_LIVE_01D_TARGETED_RLS_PACK.sql
# Si client_id text non confirme :
#   docs/sql/GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql  (recommande en premier)
# Guide complet : docs/GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " P-FINAL 02 -- Supabase RLS Verification Guide" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ce script guide la verification manuelle du RLS Supabase." -ForegroundColor White
Write-Host "Il ne modifie rien. Il ne se connecte pas a Supabase." -ForegroundColor White
Write-Host ""

# ── GO-LIVE 01C: Erreur companies? ───────────────────────────────────────────
Write-Host "ATTENTION -- SI VOUS AVEZ EU L'ERREUR : public.companies does not exist" -ForegroundColor Red
Write-Host "-----------------------------------------------------------------------" -ForegroundColor Red
Write-Host ""
Write-Host "  Ne PAS creer la table companies." -ForegroundColor Yellow
Write-Host "  Ne PAS utiliser PFINAL01_RLS_PRODUCTION_PACK.sql directement." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Etape 1 : Executer l'introspection (read-only) :" -ForegroundColor White
Write-Host "    docs/sql/GO_LIVE_01C_SCHEMA_INTROSPECTION.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Etape 2 : Appliquer le pack adaptatif (avec to_regclass guards) :" -ForegroundColor White
Write-Host "    docs/sql/GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Guide complet : docs/GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "  AVERTISSEMENT : Ne cochez aucune preuve RLS tant que l'adaptive pack" -ForegroundColor Red
Write-Host "  n'est pas applique et verifie sur staging." -ForegroundColor Red
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── GO-LIVE 01D: Schema mixte user_id/client_id ───────────────────────────────
Write-Host "GO-LIVE 01D -- Schema reel identifie (user_id + client_id mixte)" -ForegroundColor Green
Write-Host "------------------------------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "  Introspection reelle confirme un schema mixte." -ForegroundColor White
Write-Host "  Tables user_id uuid  : pierre_missions, pierre_tasks, pierre_documents," -ForegroundColor White
Write-Host "                         pierre_company_memory, pierre_outbound_emails," -ForegroundColor White
Write-Host "                         pierre_task_logs, agent_onboarding_pierre, agent_runs," -ForegroundColor White
Write-Host "                         orders" -ForegroundColor White
Write-Host "  Tables client_id uuid: agents_owned, api_tokens, router_logs" -ForegroundColor White
Write-Host "  Tables client_id text: agent_configs, audit_log, deadlines, documents," -ForegroundColor White
Write-Host "                         employees, hr_events, pierre_jobs, pierre_queue" -ForegroundColor White
Write-Host "  Tables id seulement  : clients, profiles" -ForegroundColor White
Write-Host "  VIEW (pas de policy) : pierre_queue_view" -ForegroundColor White
Write-Host ""
Write-Host "  ETAPE 1 : Executer la verification mapping client_id (read-only) :" -ForegroundColor White
Write-Host "    docs/sql/GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Interpreter les resultats de Query 5 :" -ForegroundColor White
Write-Host "    uuid_like = total_rows ET matched_auth_users = total_rows" -ForegroundColor DarkGray
Write-Host "      -> client_id IS un UUID Supabase auth -> appliquer TARGETED pack" -ForegroundColor Green
Write-Host "    uuid_like < total_rows OU matched_auth_users < uuid_like" -ForegroundColor DarkGray
Write-Host "      -> client_id NON confirme -> appliquer MINIMAL SAFE pack" -ForegroundColor Yellow
Write-Host "    total_rows = 0 -> table vide, impossible a verifier -> MINIMAL SAFE" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ETAPE 2A : Si client_id text = auth.uid() CONFIRME par mapping check :" -ForegroundColor White
Write-Host "    docs/sql/GO_LIVE_01D_TARGETED_RLS_PACK.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ETAPE 2B : Si client_id text NON CONFIRME (recommande en premier) :" -ForegroundColor White
Write-Host "    docs/sql/GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Guide complet : docs/GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "  AVERTISSEMENT : Ne cochez pas SUPABASE_RLS_STAGING_VERIFIED" -ForegroundColor Red
Write-Host "  tant que le test anon et l'isolation user ne sont pas confirmes." -ForegroundColor Red
Write-Host "  Ne pas creer public.companies -- elle n'existe pas dans ce schema." -ForegroundColor Red
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# -- STEP 1: Check env vars ---------------------------------------------------
Write-Host "ETAPE 1 -- Verification des variables d'environnement" -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow

$envFile = ".env.local"
if (Test-Path $envFile) {
    Write-Host "[OK] Fichier .env.local present" -ForegroundColor Green
} else {
    Write-Host "[WARN] Fichier .env.local introuvable. Assurez-vous d'avoir les variables d'env." -ForegroundColor Yellow
}

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseAnon = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$supabaseService = $env:SUPABASE_SERVICE_ROLE_KEY

if ($supabaseUrl) {
    Write-Host "[OK] NEXT_PUBLIC_SUPABASE_URL est defini" -ForegroundColor Green
} else {
    Write-Host "[MANQUANT] NEXT_PUBLIC_SUPABASE_URL non defini" -ForegroundColor Red
}

if ($supabaseAnon) {
    Write-Host "[OK] NEXT_PUBLIC_SUPABASE_ANON_KEY est defini" -ForegroundColor Green
} else {
    Write-Host "[MANQUANT] NEXT_PUBLIC_SUPABASE_ANON_KEY non defini" -ForegroundColor Red
}

if ($supabaseService) {
    Write-Host "[OK] SUPABASE_SERVICE_ROLE_KEY est defini (non affiche pour securite)" -ForegroundColor Green
} else {
    Write-Host "[MANQUANT] SUPABASE_SERVICE_ROLE_KEY non defini" -ForegroundColor Red
}

Write-Host ""

# -- STEP 2: Check SQL files --------------------------------------------------
Write-Host "ETAPE 2 -- Verification des fichiers SQL" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow

$rlsSql = "docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql"
if (Test-Path $rlsSql) {
    Write-Host "[OK] Script RLS present: $rlsSql" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] Script RLS introuvable: $rlsSql" -ForegroundColor Red
    Write-Host "         Verifiez que P-FINAL 01 a bien ete applique." -ForegroundColor Red
}

Write-Host ""

# -- STEP 3: Staging ----------------------------------------------------------
Write-Host "ETAPE 3 -- Application sur STAGING (obligatoire avant prod)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Actions a realiser dans le Dashboard Supabase STAGING :" -ForegroundColor White
Write-Host ""
Write-Host "  1. Aller sur https://supabase.com/dashboard" -ForegroundColor Cyan
Write-Host "  2. Selectionner le projet STAGING" -ForegroundColor Cyan
Write-Host "  3. Ouvrir SQL Editor" -ForegroundColor Cyan
Write-Host "  4. Copier le contenu de: $rlsSql" -ForegroundColor Cyan
Write-Host "  5. Coller et executer" -ForegroundColor Cyan
Write-Host "  6. Verification post-application:" -ForegroundColor Cyan
Write-Host ""
Write-Host "     SQL de verification:" -ForegroundColor White
Write-Host "     SELECT schemaname, tablename, policyname, cmd" -ForegroundColor DarkGray
Write-Host "     FROM pg_policies" -ForegroundColor DarkGray
Write-Host "     WHERE schemaname = 'public'" -ForegroundColor DarkGray
Write-Host "     ORDER BY tablename, policyname;" -ForegroundColor DarkGray
Write-Host ""
Write-Host "     Attendu: 23 politiques pour 10 tables" -ForegroundColor White
Write-Host ""

# -- STEP 4: Test isolation cross-company -------------------------------------
Write-Host "ETAPE 4 -- Test d'isolation cross-company (staging)" -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Creer 2 comptes de test appartenant a 2 companies distinctes." -ForegroundColor White
Write-Host ""
Write-Host "Test User A (company_A):" -ForegroundColor White
Write-Host "  - Se connecter avec les identifiants de User A" -ForegroundColor Cyan
Write-Host "  - Executer: SELECT * FROM employees" -ForegroundColor DarkGray
Write-Host "  - Attendu: uniquement les employes de company_A" -ForegroundColor Cyan
Write-Host "  - Verification: 0 employes de company_B" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test User B (company_B):" -ForegroundColor White
Write-Host "  - Se connecter avec les identifiants de User B" -ForegroundColor Cyan
Write-Host "  - Executer: SELECT * FROM employees" -ForegroundColor DarkGray
Write-Host "  - Attendu: uniquement les employes de company_B" -ForegroundColor Cyan
Write-Host "  - Verification: 0 employes de company_A" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test acces anon:" -ForegroundColor White
Write-Host "  - Utiliser la cle ANON uniquement" -ForegroundColor Cyan
Write-Host "  - Executer: SELECT * FROM employees" -ForegroundColor DarkGray
Write-Host "  - Attendu: 0 rows (RLS bloque tout acces anon)" -ForegroundColor Cyan
Write-Host ""

# -- STEP 5: Service role -----------------------------------------------------
Write-Host "ETAPE 5 -- Verification service_role" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "La SERVICE_ROLE_KEY doit etre utilisee UNIQUEMENT cote serveur (routes API)." -ForegroundColor White
Write-Host ""
Write-Host "Verification:" -ForegroundColor White
Write-Host "  - INSERT INTO audit_logs avec cle ANON -> doit retourner erreur RLS" -ForegroundColor Cyan
Write-Host "  - INSERT INTO ai_cost_events avec cle ANON -> doit retourner erreur RLS" -ForegroundColor Cyan
Write-Host "  - La SERVICE_ROLE_KEY ne doit JAMAIS etre dans le code client" -ForegroundColor Cyan
Write-Host "  - Verifier que src/lib/supabase.ts n'exporte pas la service_role_key" -ForegroundColor Cyan
Write-Host ""

# -- STEP 6: Production -------------------------------------------------------
Write-Host "ETAPE 6 -- Application sur PRODUCTION (apres validation staging)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "PREREQUIS OBLIGATOIRES avant d'appliquer en production:" -ForegroundColor Red
Write-Host "  [x] Backup production effectue et verifie" -ForegroundColor Red
Write-Host "  [x] Script teste et valide sur staging" -ForegroundColor Red
Write-Host "  [x] Isolation cross-company verifiee sur staging" -ForegroundColor Red
Write-Host ""
Write-Host "Application en production:" -ForegroundColor White
Write-Host "  1. Selectionner le projet PRODUCTION dans Supabase" -ForegroundColor Cyan
Write-Host "  2. Effectuer le backup: Settings -> Database -> Backups" -ForegroundColor Cyan
Write-Host "  3. SQL Editor: commencer par BEGIN;" -ForegroundColor Cyan
Write-Host "  4. Coller le contenu de: $rlsSql" -ForegroundColor Cyan
Write-Host "  5. Verifier: SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'" -ForegroundColor Cyan
Write-Host "  6. Si OK: COMMIT; sinon: ROLLBACK;" -ForegroundColor Cyan
Write-Host ""

# -- STEP 7: Proof template ---------------------------------------------------
Write-Host "ETAPE 7 -- Template de preuve JSON" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Coller ces proof IDs dans go-live-proofs.local.json apres verification:" -ForegroundColor White
Write-Host ""

$proofTemplate = @'
[
  {
    "proof_id": "SUPABASE_RLS_STAGING_APPLIED",
    "status": "verified",
    "verified_at": "YYYY-MM-DDTHH:mm:ss.000Z",
    "verified_by": "Gael Hommet",
    "evidence_type": "screenshot",
    "evidence_ref": "go-live-evidence/supabase/rls-staging-policies.png",
    "notes": "23 politiques appliquees sur staging. Screenshot de pg_policies."
  },
  {
    "proof_id": "SUPABASE_RLS_STAGING_VERIFIED",
    "status": "verified",
    "verified_at": "YYYY-MM-DDTHH:mm:ss.000Z",
    "verified_by": "Gael Hommet",
    "evidence_type": "test_log",
    "evidence_ref": "go-live-evidence/supabase/cross-company-test-staging.txt",
    "notes": "Test User A / User B: 0 rows cross-company. Test anon: 0 rows."
  },
  {
    "proof_id": "SUPABASE_RLS_PRODUCTION_APPLIED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "screenshot",
    "evidence_ref": "",
    "notes": ""
  },
  {
    "proof_id": "SUPABASE_RLS_PRODUCTION_VERIFIED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "test_log",
    "evidence_ref": "",
    "notes": ""
  },
  {
    "proof_id": "SUPABASE_USER_A_CANNOT_READ_USER_B",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "test_log",
    "evidence_ref": "",
    "notes": ""
  },
  {
    "proof_id": "SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED",
    "status": "pending",
    "verified_at": "",
    "verified_by": "",
    "evidence_type": "manual_attestation",
    "evidence_ref": "",
    "notes": ""
  }
]
'@

Write-Host $proofTemplate -ForegroundColor DarkGray
Write-Host ""
Write-Host "Proof IDs a valider:" -ForegroundColor White
Write-Host "  - SUPABASE_RLS_STAGING_APPLIED" -ForegroundColor Green
Write-Host "  - SUPABASE_RLS_STAGING_VERIFIED" -ForegroundColor Green
Write-Host "  - SUPABASE_RLS_PRODUCTION_APPLIED" -ForegroundColor Yellow
Write-Host "  - SUPABASE_RLS_PRODUCTION_VERIFIED" -ForegroundColor Yellow
Write-Host "  - SUPABASE_USER_A_CANNOT_READ_USER_B" -ForegroundColor Yellow
Write-Host "  - SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED" -ForegroundColor Yellow
Write-Host ""
Write-Host "Documentation complete: docs/PFINAL02_SUPABASE_RLS_REAL_VERIFICATION.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN DU GUIDE -- Aucune modification effectuee" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
