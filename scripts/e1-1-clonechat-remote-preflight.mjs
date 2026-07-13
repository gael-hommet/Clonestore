#!/usr/bin/env node
// scripts/e1-1-clonechat-remote-preflight.mjs
// E1.1 §9 — PRÉVOL LECTURE SEULE de la migration P9.4.1 (`clonechat_app` + tables durables).
//
// CE SCRIPT NE MUTE RIEN. Il n'exécute que des requêtes de CATALOGUE (pg_roles, pg_class,
// information_schema). Aucun CREATE / ALTER / GRANT / DROP / INSERT / UPDATE / DELETE.
// Il n'imprime JAMAIS l'URL de la base, ni identifiants, ni secrets — uniquement une
// CATÉGORIE d'hôte et des booléens de conformité.
//
// Usage (opérateur autorisé uniquement) :
//   node scripts/e1-1-clonechat-remote-preflight.mjs            → classe la cible, n'ouvre AUCUNE connexion
//   node scripts/e1-1-clonechat-remote-preflight.mjs --connect  → exécute les requêtes de catalogue en LECTURE SEULE
//
// Sortie : .e1-1-proofs/repository-reconciliation/p941-remote-preflight.json

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const CONNECT = process.argv.includes("--connect");

// ── Résolution de la cible : MÊME ordre que le runtime (jamais deviné) ────────
function readEnvFile() {
  const out = {};
  for (const f of [".env.local", ".env"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
const env = { ...readEnvFile(), ...process.env };
const url = env.CLONECHAT_DB_URL || env.DATABASE_URL || "";
const source = env.CLONECHAT_DB_URL ? "CLONECHAT_DB_URL" : env.DATABASE_URL ? "DATABASE_URL" : null;

/** Classe l'hôte SANS jamais le divulguer. */
function classify(dsn) {
  if (!dsn) return "absent";
  let host = "";
  try { host = new URL(dsn).hostname.toLowerCase(); } catch { return "unparseable"; }
  if (/^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/.test(host)) return "local";
  if (/supabase\.(co|com|net)$/.test(host)) return "managed_supabase_remote";
  if (/\.(neon|render|railway|rds\.amazonaws|azure|googleapis)\./.test(host)) return "managed_remote";
  return "unknown_remote";
}
const category = classify(url);
const productionSuspected = category !== "local" && category !== "absent";

const out = {
  runId: "repository-reconciliation",
  readOnly: true,
  mutationsExecuted: 0,
  target: {
    configured: Boolean(url),
    source, // NOM de la variable, jamais sa valeur
    category, // local | managed_supabase_remote | managed_remote | unknown_remote | absent
    productionSuspected,
    urlPrinted: false,
  },
  connected: false,
  checks: null,
  migrationState: "UNKNOWN", // UNAPPLIED | PARTIAL | COMPLETE | UNKNOWN
  notes: [],
};

if (!CONNECT) {
  out.notes.push("Exécuté SANS --connect : aucune connexion ouverte. La cible est seulement CLASSÉE.");
  out.notes.push("L'existence d'un fichier de migration NE PROUVE PAS son application distante : seul --connect, lancé par un opérateur autorisé, peut l'établir.");
  emit();
} else {
  if (!url) { out.notes.push("Aucune base configurée : rien à sonder."); emit(); }
  else await probe();
}

async function probe() {
  const { default: pg } = await import("pg");
  // Ceinture ET bretelles : la session elle-même est mise en LECTURE SEULE.
  const pool = new pg.Pool({ connectionString: url, max: 1, application_name: "e1-1-readonly-preflight" });
  try {
    const c = await pool.connect();
    try {
      await c.query("set session characteristics as transaction read only");
      await c.query("begin read only");
      out.connected = true;

      const role = await c.query(
        `select rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolbypassrls, rolreplication
           from pg_roles where rolname = 'clonechat_app'`,
      );
      const roleExists = role.rowCount > 0;
      const r = role.rows[0] ?? {};

      const tables = await c.query(
        `select c.relname, c.relrowsecurity, c.relforcerowsecurity
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where c.relkind = 'r' and n.nspname = 'public' and c.relname like 'clonechat\\_%'
          order by c.relname`,
      );
      const fns = await c.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like 'clonechat\\_budget\\_%' order by p.proname`,
      );
      const grants = await c.query(
        `select table_name, string_agg(distinct privilege_type, ',' order by privilege_type) as privs
           from information_schema.role_table_grants
          where grantee = 'clonechat_app' group by table_name order by table_name`,
      );

      const grantedTables = grants.rows.map((g) => g.table_name);
      const outsideClonechat = grantedTables.filter((t) => !t.startsWith("clonechat_"));

      out.checks = {
        roleExists,
        roleLeastPrivilege: roleExists
          ? !r.rolsuper && !r.rolcreatedb && !r.rolcreaterole && !r.rolcanlogin && !r.rolreplication
          : false,
        roleBypassesRls: roleExists ? Boolean(r.rolbypassrls) : null, // DOIT être false
        clonechatTables: tables.rows.length,
        rlsEnabledOnAllTables: tables.rows.length > 0 && tables.rows.every((t) => t.relrowsecurity),
        rlsForcedOnAllTables: tables.rows.length > 0 && tables.rows.every((t) => t.relforcerowsecurity),
        budgetFunctions: fns.rows.map((f) => f.proname),
        budgetFunctionsPresent: fns.rows.length >= 3,
        grantedTableCount: grantedTables.length,
        grantsOutsideClonechatPerimeter: outsideClonechat, // DOIT être vide
        leastPrivilegeGrantPerimeter: outsideClonechat.length === 0,
      };

      const k = out.checks;
      if (!k.roleExists && k.clonechatTables === 0) out.migrationState = "UNAPPLIED";
      else if (k.roleExists && k.clonechatTables > 0 && k.budgetFunctionsPresent && k.rlsEnabledOnAllTables && k.leastPrivilegeGrantPerimeter && k.roleBypassesRls === false) out.migrationState = "COMPLETE";
      else out.migrationState = "PARTIAL";

      if (k.roleBypassesRls) out.notes.push("ALERTE : clonechat_app possède BYPASSRLS — l'isolation tenant est contournable. À corriger AVANT tout déploiement.");
      if (outsideClonechat.length > 0) out.notes.push("ALERTE : clonechat_app détient des droits HORS du périmètre clonechat_* — à révoquer.");

      await c.query("rollback"); // aucune écriture, on referme proprement
    } finally {
      c.release();
    }
  } catch (e) {
    // Jamais l'URL ni les identifiants : uniquement le code d'erreur du pilote.
    out.notes.push(`Connexion/sonde impossible (code: ${String(e?.code ?? "unknown")}).`);
  } finally {
    await pool.end().catch(() => {});
  }
  emit();
}

function emit() {
  const dir = resolve(ROOT, ".e1-1-proofs", "repository-reconciliation");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "p941-remote-preflight.json"), JSON.stringify(out, null, 2));
  const safe = JSON.stringify(out, null, 2);
  if (url && safe.includes(url)) { console.error("REFUS : l'URL a fuité dans la sortie."); process.exit(3); }
  console.log(safe);
}
