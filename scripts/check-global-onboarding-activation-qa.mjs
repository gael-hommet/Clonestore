#!/usr/bin/env node
// scripts/check-global-onboarding-activation-qa.mjs
// PHASE 3.7 — Global Onboarding Manual Activation QA — Script de vérification
//
// Guide Gael dans l'activation manuelle de la persistence onboarding.
// NE fait aucune écriture (pas de insert/update/delete/upsert).
// NE modifie pas .env.local.
// NE déploie pas de migration SQL.
// NE modifie pas la RLS existante.
// NE contient pas de service role.
//
// Usage : npm run check:global-onboarding-activation-qa

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Helpers console ───────────────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }
function fail(msg) { console.log(`${RED}✗${RESET} ${msg}`); }
function info(msg) { console.log(`${CYAN}ℹ${RESET} ${msg}`); }
function dim(msg) { console.log(`${DIM}  ${msg}${RESET}`); }
function header(msg) { console.log(`\n${BOLD}${msg}${RESET}`); }
function sep() { console.log(`${DIM}${"─".repeat(60)}${RESET}`); }

header("╔══════════════════════════════════════════════════════╗");
header("║  PHASE 3.7 — Onboarding Activation QA               ║");
header("╚══════════════════════════════════════════════════════╝");

// ── 1. Prérequis — fichiers repo ──────────────────────────────────────────────

header("=== 1. Fichiers repo PHASE 3.5 / 3.6 ===");

const checks = [
  ["supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql", "SQL draft PHASE 3.5"],
  ["docs/PHASE_3_5_GLOBAL_ONBOARDING_PERSISTENCE_DRAFT.md", "Doc PHASE 3.5"],
  ["docs/PHASE_3_6_GLOBAL_ONBOARDING_SAFE_APPLY.md", "Doc PHASE 3.6"],
  ["docs/PHASE_3_7_GLOBAL_ONBOARDING_MANUAL_ACTIVATION_QA.md", "Doc PHASE 3.7"],
  ["src/lib/clonestore/onboarding/global-onboarding-health.ts", "Health check"],
  ["src/lib/clonestore/onboarding/global-onboarding-runtime.ts", "Runtime bridge"],
  ["src/lib/clonestore/onboarding/global-onboarding-activation-qa.ts", "QA checklist"],
  ["scripts/check-global-onboarding-readiness.mjs", "Check readiness script"],
];

for (const [path, label] of checks) {
  if (existsSync(resolve(root, path))) {
    ok(`${label} : OK`);
  } else {
    fail(`${label} : MANQUANT (${path})`);
  }
}

// ── 2. Vérification SQL draft ──────────────────────────────────────────────────

header("=== 2. SQL Draft PHASE 3.5 ===");
const sqlFile = resolve(root, "supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql");
if (existsSync(sqlFile)) {
  const sql = readFileSync(sqlFile, "utf-8");
  const sqlChecks = [
    ["clonestore_global_onboarding_drafts", "Nom de table"],
    ["enable row level security", "RLS activée"],
    ["select_own_global_onboarding", "Policy SELECT own"],
    ["insert_own_global_onboarding", "Policy INSERT own"],
    ["update_own_global_onboarding", "Policy UPDATE own"],
    ["unique (user_id, company_id)", "Contrainte unique user/company"],
    ["completion_score between 0 and 100", "Contrainte score"],
  ];
  for (const [pattern, label] of sqlChecks) {
    if (sql.toLowerCase().includes(pattern.toLowerCase())) {
      ok(`SQL : ${label}`);
    } else {
      warn(`SQL : ${label} — non trouvé (vérifier le fichier SQL)`);
    }
  }
  // Vérifier absence de DELETE policy
  if (!sql.match(/create\s+policy\s+"[^"]*"\s+on\s+\S+\s+for\s+delete/i)) {
    ok("SQL : Pas de policy DELETE (OK)");
  } else {
    fail("SQL : Policy DELETE détectée — à vérifier");
  }
} else {
  fail("SQL draft introuvable");
}

// ── 3. Vérification env vars ──────────────────────────────────────────────────

header("=== 3. Variables d'environnement ===");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const persistenceFlag = process.env.NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED;

if (supabaseUrl) {
  ok(`NEXT_PUBLIC_SUPABASE_URL : ${supabaseUrl.slice(0, 32)}…`);
} else {
  warn("NEXT_PUBLIC_SUPABASE_URL : non défini (pas de test Supabase possible)");
}

if (supabaseAnon) {
  ok(`NEXT_PUBLIC_SUPABASE_ANON_KEY : défini`);
} else {
  warn("NEXT_PUBLIC_SUPABASE_ANON_KEY : non défini");
}

if (persistenceFlag === "true") {
  ok("NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED : true → Persistence serveur ACTIVÉE");
} else {
  info("NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED : non défini → false (localStorage uniquement)");
  dim("Pour activer : ajouter NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true dans .env.local");
}

// ── 4. Test select read-only Supabase ─────────────────────────────────────────

header("=== 4. Vérification Supabase (select read-only) ===");

if (!supabaseUrl || !supabaseAnon) {
  warn("Variables Supabase absentes — impossible de vérifier la table.");
  info("Pour vérifier : ajouter NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local");
} else {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseAnon);

    // select read-only — JAMAIS insert/update/delete/upsert/service-role
    const { data, error } = await supabase
      .from("clonestore_global_onboarding_drafts")
      .select("id")
      .limit(1);

    if (error) {
      const code = String(error.code ?? "");
      const msg = String(error.message ?? "").toLowerCase();
      if (code === "42P01" || msg.includes("does not exist") || msg.includes("relation")) {
        fail("Table clonestore_global_onboarding_drafts : ABSENTE");
        dim("Appliquer le SQL dans Supabase Dashboard → SQL Editor :");
        dim("  Coller supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql");
      } else if (code === "42501" || msg.includes("permission denied") || msg.includes("rls")) {
        warn(`Table présente, RLS bloquée avec clé anon (code ${code}).`);
        info("Comportement normal pour une clé anonyme sans userId authentifié.");
        ok("Table existe (vérification indirecte via erreur RLS).");
      } else {
        warn(`Erreur inattendue [${code}] : ${error.message}`);
        dim("Vérifier les logs Supabase pour plus de détails.");
      }
    } else {
      ok("Table clonestore_global_onboarding_drafts : ACCESSIBLE");
      ok(`RLS select : OK (${Array.isArray(data) ? data.length : 0} lignes visibles avec clé anon)`);
    }
  } catch (err) {
    warn(`Exception Supabase : ${err.message ?? err}`);
    dim("Vérifier que @supabase/supabase-js est installé et que les env vars sont corrects.");
  }
}

// ── 5. Requêtes SQL de vérification manuelle ──────────────────────────────────

header("=== 5. Requêtes SQL de vérification manuelle ===");
info("Lancer ces requêtes dans Supabase Dashboard → SQL Editor :");
sep();

console.log(`${DIM}-- 1. Vérifier que la table existe${RESET}`);
console.log("SELECT tablename, rowsecurity");
console.log("FROM pg_tables");
console.log("WHERE tablename = 'clonestore_global_onboarding_drafts';\n");

console.log(`${DIM}-- 2. Vérifier les policies RLS${RESET}`);
console.log("SELECT policyname, cmd, permissive");
console.log("FROM pg_policies");
console.log("WHERE tablename = 'clonestore_global_onboarding_drafts'\n");
console.log("ORDER BY cmd;\n");

console.log(`${DIM}-- 3. Vérifier le contenu (après test QA)${RESET}`);
console.log("SELECT company_id, current_step, completion_score, updated_at");
console.log("FROM clonestore_global_onboarding_drafts");
console.log("ORDER BY updated_at DESC");
console.log("LIMIT 5;\n");
sep();

// ── 6. Instructions QA manuelle ───────────────────────────────────────────────

header("=== 6. Étapes QA manuelle pour Gael ===");
const steps = [
  "1. Vérifier table + RLS dans Supabase (SQL ci-dessus)",
  "2. Ajouter NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true dans .env.local",
  "3. Redémarrer : npm run dev",
  "4. Se connecter sur /login",
  "5. Aller sur /profile/onboarding",
  "6. Remplir l'entreprise (nom, secteur, taille)",
  "7. Observer badge : 'Brouillon local + serveur'",
  "8. Vérifier ligne dans Supabase (SQL #3 ci-dessus)",
  "9. Faire F5 — vérifier restauration automatique",
  "10. Rollback : retirer le flag de .env.local → redémarrer → vérifier localStorage",
];
steps.forEach(s => info(s));

// ── 7. Résumé ──────────────────────────────────────────────────────────────────

header("=== 7. Résumé ===");

if (persistenceFlag === "true") {
  ok("Mode : Persistence serveur ACTIVÉE");
  info("→ /profile/onboarding tente d'écrire en DB si table/RLS/auth OK.");
} else {
  info("Mode : localStorage uniquement (flag non activé).");
  dim("→ Aucune écriture DB. Rollback immédiat disponible.");
}

console.log("");
info("Doc QA     : docs/PHASE_3_7_GLOBAL_ONBOARDING_MANUAL_ACTIVATION_QA.md");
info("Readiness  : npm run check:global-onboarding-readiness");
info("Tests      : npm run test:phase3-7");
