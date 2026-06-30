#!/usr/bin/env node
// scripts/p87-vercel-sync.mjs — P8.7.3 secret-safe Vercel Production env sync for clonestore-xcwi.
// Resolves values from local gitignored files + literals (generates any missing internal CSPRNG secret),
// then upserts each var in Production via the Vercel CLI, passing the VALUE over stdin (never in argv/logs).
// Reports only CREATED/UPDATED/FAILED per variable. Never prints a value. Requires --apply + VERCEL_TOKEN.
import { resolve } from "path";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import { randomBytes } from "crypto";
const APPLY = process.argv.includes("--apply");
const TOKEN = process.env.VERCEL_TOKEN || "";
if (!TOKEN) { process.stderr.write("REFUSED — VERCEL_TOKEN required\n"); process.exit(2); }
const ROOT = process.cwd();
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function parseEnv(p) { const m = {}; if (!existsSync(p)) return m; for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) { const i = line.indexOf("="); if (i < 0 || line.startsWith("#")) continue; let v = line.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); m[line.slice(0, i).trim()] = v; } return m; }
const local = parseEnv(resolve(ROOT, ".env.local"));
const runtime = parseEnv(resolve(ROOT, ".env.p87-runtime.local"));
const hooks = parseEnv(resolve(ROOT, ".env.p87-webhooks.local"));
const pick = (k) => local[k] ?? runtime[k] ?? hooks[k] ?? null;

// generate + persist any missing internal secret into .env.p87-runtime.local
function ensureSecret(k) {
  let v = pick(k);
  if (v) return v;
  v = b64url(randomBytes(48));
  const file = resolve(ROOT, ".env.p87-runtime.local");
  const lines = existsSync(file) ? readFileSync(file, "utf-8").split(/\r?\n/).filter((l) => l && !l.startsWith(k + "=")) : [];
  lines.push(`${k}=${v}`); writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
  runtime[k] = v; return v;
}

const LITERALS = {
  CLONESTORE_COMMUNICATION_PROVIDER: "resend", CLONESTORE_EMAIL_FROM: "pierre@clonestore.pro",
  CLONESTORE_SIGNATURE_PROVIDER: "yousign",
  NEXT_PUBLIC_APP_URL: "https://www.clonestore.pro", CLONESTORE_PUBLIC_APP_URL: "https://www.clonestore.pro", CLONESTORE_BASE_URL: "https://www.clonestore.pro",
  FILE_STORAGE_PROVIDER: "supabase", SUPABASE_STORAGE_BUCKET: "pierre-private-documents",
};
const FROM_FILES = ["RESEND_API_KEY", "CLONESTORE_EMAIL_WEBHOOK_SECRET", "PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL",
  "CLONESTORE_SIGNATURE_API_URL", "CLONESTORE_SIGNATURE_API_KEY", "CLONESTORE_SIGNATURE_WEBHOOK_SECRET", "CLONESTORE_PIERRE_WEBHOOK_DATABASE_URL"];
const GENERATED = ["CLONESTORE_COMMUNICATION_LINK_SECRET", "PIERRE_COMMUNICATION_SYSTEM_SECRET"];

const values = {};
for (const [k, v] of Object.entries(LITERALS)) values[k] = v;
for (const k of FROM_FILES) { const v = pick(k); if (v) values[k] = v; else process.stderr.write(`[sync] MISSING source ${k}\n`); }
for (const k of GENERATED) values[k] = ensureSecret(k);

const vercel = (args, input) => spawnSync("npx", ["--yes", "vercel", ...args, "--token", TOKEN], { input, shell: true, encoding: "utf-8", env: { ...process.env, CI: "1" } });
const report = {};
if (!APPLY) { process.stderr.write(`[sync] DRY RUN — would sync ${Object.keys(values).length} vars to Production. No writes.\n`); console.log(JSON.stringify({ dry_run: true, vars: Object.keys(values) }, null, 2)); process.exit(0); }
for (const [k, v] of Object.entries(values)) {
  const rm = vercel(["env", "rm", k, "production", "--yes"]);
  const existed = rm.status === 0;
  const add = vercel(["env", "add", k, "production"], v + "\n");
  report[k] = add.status === 0 ? (existed ? "UPDATED" : "CREATED") : "FAILED";
}
console.log(JSON.stringify(report, null, 2));
const failed = Object.entries(report).filter(([, s]) => s === "FAILED").map(([k]) => k);
if (failed.length) { process.stderr.write(`[sync] FAILED: ${failed.join(", ")}\n`); process.exit(1); }
