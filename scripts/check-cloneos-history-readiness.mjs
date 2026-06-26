#!/usr/bin/env node
// scripts/check-cloneos-history-readiness.mjs
// PHASE 3.3 — CloneOS History Readiness Check Script
//
// Vérifie la disponibilité de la table clonestore_cloneos_history et les variables.
// Read-only : aucun insert, update, delete, upsert, service role.
// Si env absent → sort proprement avec message clair.
//
// Usage :
//   npm run check:cloneos-history-readiness
//   ou
//   node scripts/check-cloneos-history-readiness.mjs

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Charger .env.local si présent ─────────────────────────────────────────────

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// ── Variables nécessaires ─────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PERSISTENCE_ENABLED = process.env.NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED;
const TABLE_NAME = "clonestore_cloneos_history";

// ── Rapport ───────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════");
console.log("  CloneOS History Readiness Check — PHASE 3.3");
console.log("═══════════════════════════════════════════════════\n");

// Check 1 — Variables Supabase
console.log("1. Variables Supabase :");
if (SUPABASE_URL) {
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_URL présente (${SUPABASE_URL.slice(0, 30)}...)`);
} else {
  console.log("   ⚠️  NEXT_PUBLIC_SUPABASE_URL absente — check impossible");
}
if (SUPABASE_ANON_KEY) {
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY présente`);
} else {
  console.log("   ⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY absente — check impossible");
}

// Check 2 — Flag persistence
console.log("\n2. Feature flag persistence :");
if (PERSISTENCE_ENABLED === "true") {
  console.log("   ✅ NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = true");
  console.log("   ℹ️  Écriture DB activée (si table + RLS OK)");
} else {
  console.log(`   ℹ️  NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = ${PERSISTENCE_ENABLED ?? "non défini"}`);
  console.log("   ℹ️  Mode localStorage uniquement (fallback safe)");
}

// Check 3 — SQL draft
console.log("\n3. SQL draft :");
const sqlPath = resolve(process.cwd(), "supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql");
if (existsSync(sqlPath)) {
  console.log(`   ✅ supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql existe`);
} else {
  console.log("   ❌ SQL draft absent — voir PHASE 3.3 docs");
}

// Check 4 — Connexion Supabase (read-only select si env configuré)
console.log("\n4. Test de connexion Supabase (read-only) :");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log("   ⏭️  Ignoré — variables Supabase absentes");
} else {
  try {
    // Dynamic import pour éviter dépendance dans les tests
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // Read-only select limité — JAMAIS d'insert/update/delete
    const { error } = await client
      .from(TABLE_NAME)
      .select("id")
      .limit(1);

    if (error) {
      if (error.code === "42P01" || (error.message && error.message.includes("does not exist"))) {
        console.log(`   ⚠️  Table ${TABLE_NAME} non trouvée`);
        console.log("   ℹ️  Appliquer supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql d'abord");
        console.log("   ℹ️  L'app fonctionne quand même en localStorage");
      } else if (error.code === "42501" || error.code === "PGRST301") {
        console.log(`   ⚠️  RLS bloque le select — vérifier policies`);
        console.log("   ℹ️  Vérifier cloneos_history_select_own policy");
      } else {
        console.log(`   ❌ Erreur : ${error.message} (code: ${error.code})`);
      }
    } else {
      console.log(`   ✅ Table ${TABLE_NAME} accessible`);
      console.log("   ✅ RLS select OK");
      if (PERSISTENCE_ENABLED === "true") {
        console.log("   ✅ Server persistence prête");
      } else {
        console.log("   ℹ️  Pour activer : NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true");
      }
    }
  } catch (err) {
    console.log(`   ❌ Erreur de connexion : ${err instanceof Error ? err.message : err}`);
    console.log("   ℹ️  L'app fonctionne quand même en localStorage");
  }
}

// Résumé
console.log("\n───────────────────────────────────────────────────");
console.log("Prochaines étapes :");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log("  → Configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
console.log("  → Voir docs/PHASE_3_3_CLONEOS_HISTORY_SAFE_APPLY.md pour les instructions complètes");
console.log("  → Public launch reste NO-GO externe (conditions humaines requises)\n");
