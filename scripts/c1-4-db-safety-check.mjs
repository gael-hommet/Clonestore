#!/usr/bin/env node
// scripts/c1-4-db-safety-check.mjs
// C1.4 §10 — Prouve que la base CIBLE de CloneChat est LOCALE/TEST avant tout provisioning.
// N'imprime JAMAIS l'URL, l'hôte exact, l'utilisateur ni le mot de passe : uniquement des
// CATÉGORIES et des booléens. Sortie JSON. Code 0 = sûr à provisionner, 1 = NE PAS TOUCHER.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const env = {};
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(ROOT, f), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* fichier absent */ }
}

// MÊME ordre de résolution que src/lib/clonechat/durable (CLONECHAT_DB_URL puis DATABASE_URL).
const rawClonechat = process.env.CLONECHAT_DB_URL ?? env.CLONECHAT_DB_URL ?? "";
const rawDatabase = process.env.DATABASE_URL ?? env.DATABASE_URL ?? "";
const raw = rawClonechat.trim().length > 0 ? rawClonechat : rawDatabase;
const out = {
  resolvedFrom: rawClonechat.trim().length > 0 ? "CLONECHAT_DB_URL" : rawDatabase.trim().length > 0 ? "DATABASE_URL" : "none",
  clonechatDbUrlPresent: raw.trim().length > 0,
  hostCategory: "unknown",
  databaseNameCategory: "unknown",
  sslRequired: null,
  isLocalOrTest: false,
  productionSuspected: false,
  reasons: [],
};

if (!out.clonechatDbUrlPresent) {
  out.reasons.push("CLONECHAT_DB_URL absent → le store durable retombe en mémoire ; rien à provisionner.");
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

let u;
try {
  u = new URL(raw);
} catch {
  out.reasons.push("CLONECHAT_DB_URL illisible (forme invalide).");
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

const host = (u.hostname || "").toLowerCase();
const dbName = (u.pathname || "").replace(/^\//, "").toLowerCase();

// ── Catégorie d'hôte (jamais l'hôte réel) ────────────────────────────────────
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);
if (LOCAL_HOSTS.has(host)) out.hostCategory = "localhost";
else if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) out.hostCategory = "private_lan";
else if (/supabase\.(co|com|net)$/.test(host) || /\.pooler\./.test(host)) out.hostCategory = "managed_supabase_remote";
else if (/\.(rds\.amazonaws|neon\.tech|render\.com|railway\.app|azure|gcp)/.test(host)) out.hostCategory = "managed_cloud_remote";
else out.hostCategory = "remote_unknown";

// ── Catégorie de nom de base ─────────────────────────────────────────────────
if (/(^|[_-])(test|dev|local|ci|tmp|scratch)([_-]|$)/.test(dbName)) out.databaseNameCategory = "test_or_dev";
else if (/(^|[_-])(prod|production|live)([_-]|$)/.test(dbName)) out.databaseNameCategory = "production_named";
else if (dbName === "postgres" && out.hostCategory === "localhost") out.databaseNameCategory = "local_default";
else out.databaseNameCategory = "neutral";

out.sslRequired = /sslmode=require|ssl=true/i.test(raw);

// ── Décision (fail-closed) ───────────────────────────────────────────────────
const localHost = out.hostCategory === "localhost" || out.hostCategory === "private_lan";
const productionAuthorized = String(process.env.PRODUCTION_AUTHORIZED ?? env.PRODUCTION_AUTHORIZED ?? "false") === "true";
const nodeEnv = process.env.NODE_ENV ?? "development";

if (out.databaseNameCategory === "production_named") {
  out.productionSuspected = true;
  out.reasons.push("Le nom de base ressemble à une base de PRODUCTION.");
}
if (!localHost) {
  out.productionSuspected = true;
  out.reasons.push(`Hôte NON local (catégorie: ${out.hostCategory}) — impossible d'exclure la production.`);
}
if (productionAuthorized) {
  out.productionSuspected = true;
  out.reasons.push("PRODUCTION_AUTHORIZED=true.");
}

out.isLocalOrTest = localHost && !out.productionSuspected;
if (out.isLocalOrTest) {
  out.reasons.push(`Hôte local (${out.hostCategory}), base « ${out.databaseNameCategory} », NODE_ENV=${nodeEnv}, production non autorisée.`);
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.isLocalOrTest ? 0 : 1);
