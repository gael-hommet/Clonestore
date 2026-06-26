#!/usr/bin/env node
// scripts/check-global-onboarding-readiness.mjs
// PHASE 3.6 — Global Onboarding Safe Apply — Check script
//
// Vérifie l'état de la persistence onboarding côté env/Supabase.
// NE fait aucune écriture (pas de insert/update/delete/upsert).
// NE modifie pas la RLS existante.
// NE déploie pas de migration SQL automatiquement.
//
// Usage : npm run check:global-onboarding-readiness
//         node scripts/check-global-onboarding-readiness.mjs

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
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }
function fail(msg) { console.log(`${RED}✗${RESET} ${msg}`); }
function info(msg) { console.log(`${CYAN}ℹ${RESET} ${msg}`); }
function header(msg) { console.log(`\n${BOLD}${msg}${RESET}`); }

// ── 1. Vérification SQL draft ──────────────────────────────────────────────────

header("=== 1. SQL Draft ===");
const sqlFile = resolve(root, "supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql");
if (existsSync(sqlFile)) {
  ok(`SQL draft trouvé : supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql`);
  const sql = readFileSync(sqlFile, "utf-8");
  if (sql.includes("enable row level security")) ok("RLS définie dans SQL draft");
  else warn("RLS non trouvée dans SQL draft — à vérifier");
  if (sql.includes("select_own_global_onboarding")) ok("Policy select_own définie");
  else warn("Policy select_own non trouvée");
  if (sql.includes("insert_own_global_onboarding")) ok("Policy insert_own définie");
  else warn("Policy insert_own non trouvée");
  if (sql.includes("update_own_global_onboarding")) ok("Policy update_own définie");
  else warn("Policy update_own non trouvée");
} else {
  fail("SQL draft introuvable : supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql");
}

// ── 2. Vérification env vars ──────────────────────────────────────────────────

header("=== 2. Variables d'environnement ===");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const persistenceFlag = process.env.NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED;

if (supabaseUrl) {
  ok(`NEXT_PUBLIC_SUPABASE_URL : ${supabaseUrl.slice(0, 30)}…`);
} else {
  warn("NEXT_PUBLIC_SUPABASE_URL : non défini (Supabase non configuré)");
}

if (supabaseAnon) {
  ok(`NEXT_PUBLIC_SUPABASE_ANON_KEY : défini (${supabaseAnon.length} chars)`);
} else {
  warn("NEXT_PUBLIC_SUPABASE_ANON_KEY : non défini");
}

if (persistenceFlag === "true") {
  ok(`NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED : true → Persistence serveur ACTIVÉE`);
} else if (persistenceFlag) {
  warn(`NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED : "${persistenceFlag}" (attendu "true")`);
} else {
  info(`NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED : non défini → défaut FALSE → localStorage uniquement`);
}

// ── 3. Test select read-only Supabase ─────────────────────────────────────────

header("=== 3. Vérification table Supabase (select read-only) ===");

if (!supabaseUrl || !supabaseAnon) {
  warn("Variables Supabase absentes — impossible de vérifier la table.");
  info("Pour vérifier : ajouter NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local");
} else {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseAnon);

    // Select read-only — JAMAIS insert/update/delete/upsert dans ce script
    const { data, error } = await supabase
      .from("clonestore_global_onboarding_drafts")
      .select("id")
      .limit(1);

    if (error) {
      const code = String(error.code ?? "");
      const msg = String(error.message ?? "").toLowerCase();
      if (
        code === "42P01" ||
        msg.includes("does not exist") ||
        msg.includes("relation")
      ) {
        fail("Table clonestore_global_onboarding_drafts : ABSENTE");
        info("Appliquer le SQL manuellement dans Supabase Dashboard :");
        info("  Dashboard → SQL Editor → Coller supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql");
      } else if (code === "42501" || msg.includes("permission denied") || msg.includes("rls")) {
        warn("Table présente mais RLS SELECT bloquée (attendu pour clé anon sans userId).");
        ok("Ceci est le comportement normal si RLS est activée — vérification via l'UI authentifiée.");
      } else {
        warn(`Erreur select : [${code}] ${error.message}`);
        info("Vérifier les logs Supabase pour plus de détails.");
      }
    } else {
      ok("Table clonestore_global_onboarding_drafts : ACCESSIBLE");
      ok(`RLS select : OK (${Array.isArray(data) ? data.length : 0} ligne(s) visibles avec clé anon)`);
    }
  } catch (err) {
    warn(`Exception lors de la vérification Supabase : ${err.message ?? err}`);
    info("Vérifier que @supabase/supabase-js est installé et que les env vars sont corrects.");
  }
}

// ── 4. Résumé et prochaines étapes ────────────────────────────────────────────

header("=== 4. Résumé et prochaines étapes ===");

if (persistenceFlag === "true") {
  info("Persistence serveur onboarding : ACTIVÉE");
  info("→ Le runtime bridge écrira en DB si table/RLS/userId OK.");
  info("→ localStorage reste le fallback prioritaire.");
} else {
  info("Persistence serveur onboarding : désactivée (localStorage uniquement).");
  info("→ Pour activer : ajouter NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true dans .env.local");
  info("→ Après avoir appliqué le SQL et vérifié la RLS.");
}

console.log("");
info("Docs PHASE 3.6 : docs/PHASE_3_6_GLOBAL_ONBOARDING_SAFE_APPLY.md");
info("SQL draft      : supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql");
info("Tests          : npm run test:phase3-6");
