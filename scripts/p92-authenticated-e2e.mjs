// P9.2 — Utilitaire QA authentifié (éphémère, autorisé pour cette passe uniquement).
//
// Crée/supprime DEUX utilisateurs QA éphémères dans le Supabase configuré, via la
// service role, UNIQUEMENT sur les tables V0 `profiles` et `orders`. Garde-fous
// stricts : refuse sans service role, sans URL, sans le flag explicite, avec un
// email non préfixé, ou sur toute autre table. Ne touche jamais pierre_rt_*, P8,
// Stripe/Resend/Yousign, migrations, secrets. Aucune donnée réelle modifiée.
//
// Sous-commandes :
//   probe                         (lecture seule, aucune écriture) — vérifie la connectivité
//   setup <run_id>                crée users A/B + profiles ; écrit les creds en scratchpad
//   order <run_id> <status>       upsert l'order pierre de A (active|incomplete|past_due|canceled)
//   order-clear <run_id>          supprime l'order pierre de A
//   cleanup <run_id>              supprime orders/profiles/auth users A&B + vérifie zéro résidu
//   verify <run_id>               vérifie zéro résidu

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { dirname } from "node:path";

const FLAG = "P92_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES";
const REPO = "C:/Users/homme/clonestore";
const CREDS_PATH =
  "C:/Users/homme/AppData/Local/Temp/claude/c--Users-homme-clonestore/53e6a6da-9fba-4b13-ae30-b1b3a58295a6/scratchpad/p92-e2e-creds.json";

function loadEnvLocal() {
  const text = readFileSync(`${REPO}/.env.local`, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

function adminClient() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("REFUS: NEXT_PUBLIC_SUPABASE_URL vide.");
  if (!key) throw new Error("REFUS: SUPABASE_SERVICE_ROLE_KEY absente.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function requireWriteFlag() {
  if (process.env[FLAG] !== "yes") {
    throw new Error(`REFUS: écriture Supabase sans le flag ${FLAG}=yes.`);
  }
}

function emailFor(kind, runId) {
  const email = `p92-e2e-${kind}-${runId}@example.invalid`;
  if (!email.startsWith("p92-e2e-") || !email.endsWith("@example.invalid")) {
    throw new Error("REFUS: email QA non conforme.");
  }
  return email;
}

const ALLOWED_TABLES = new Set(["profiles", "orders"]);
function assertTable(t) {
  if (!ALLOWED_TABLES.has(t)) throw new Error(`REFUS: table interdite ${t}`);
}

function randomPassword() {
  return "Qa!" + randomBytes(18).toString("base64url");
}

// ── Sous-commandes ──────────────────────────────────────────────────────────

async function probe() {
  const sb = adminClient();
  const ZERO = "00000000-0000-0000-0000-000000000000";
  // getUserById sur un uuid nul → not found (prouve l'admin sans lire de vrais users).
  const u = await sb.auth.admin.getUserById(ZERO);
  const adminOk = !!u.error || !u.data?.user;
  // select non-matching → prouve connectivité + tables, sans lire de vraies données.
  const p = await sb.from("profiles").select("id").eq("id", ZERO).limit(1);
  const o = await sb.from("orders").select("id").eq("user_id", ZERO).limit(1);
  const profilesOk = !p.error;
  const ordersOk = !o.error;
  console.log(JSON.stringify({
    adminAuth: adminOk ? "ok" : "FAIL",
    profilesTable: profilesOk ? "ok" : (p.error?.message ?? "FAIL"),
    ordersTable: ordersOk ? "ok" : (o.error?.message ?? "FAIL"),
    reachable: profilesOk && ordersOk && adminOk,
  }, null, 2));
  if (!(profilesOk && ordersOk && adminOk)) process.exit(2);
}

async function createUser(sb, kind, runId) {
  const email = emailFor(kind, runId);
  const password = randomPassword();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: "p92-e2e", run_id: runId, kind },
  });
  if (error) throw new Error(`createUser ${kind}: ${error.message}`);
  const id = data.user.id;
  // profile minimal (schéma réel : id, email, full_name).
  assertTable("profiles");
  const pr = await sb.from("profiles").upsert({ id, email, full_name: `p92-e2e-${kind}-${runId}` }, { onConflict: "id" });
  if (pr.error) throw new Error(`profile ${kind}: ${pr.error.message}`);
  return { kind, id, email, password };
}

async function setup(runId) {
  requireWriteFlag();
  const sb = adminClient();
  // Idempotence : refuser si des comptes de ce run existent déjà.
  const existing = await findByRun(sb, runId);
  if (existing.users.length) throw new Error(`REFUS: des comptes du run ${runId} existent déjà.`);
  const a = await createUser(sb, "a", runId);
  const b = await createUser(sb, "b", runId);
  if (!existsSync(dirname(CREDS_PATH))) mkdirSync(dirname(CREDS_PATH), { recursive: true });
  writeFileSync(CREDS_PATH, JSON.stringify({ runId, a, b }, null, 2), "utf8");
  // Ne JAMAIS logguer les mots de passe.
  console.log(JSON.stringify({ runId, a: { id: a.id, email: a.email }, b: { id: b.id, email: b.email }, credsFile: CREDS_PATH }, null, 2));
}

async function setOrder(runId, status) {
  requireWriteFlag();
  const allowed = ["active", "incomplete", "past_due", "canceled", "trialing"];
  if (!allowed.includes(status)) throw new Error(`REFUS: statut ${status} non autorisé.`);
  const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  if (creds.runId !== runId) throw new Error("REFUS: run_id ne correspond pas aux creds.");
  const sb = adminClient();
  assertTable("orders");
  const payload = {
    user_id: creds.a.id,
    agent_slug: "pierre",
    status,
    started_at: new Date().toISOString(),
    ended_at: status === "canceled" ? new Date().toISOString() : null,
  };
  const { error } = await sb.from("orders").upsert(payload, { onConflict: "user_id,agent_slug" });
  if (error) throw new Error(`order upsert: ${error.message}`);
  console.log(JSON.stringify({ runId, orderUser: "a", agent: "pierre", status }, null, 2));
}

async function clearOrder(runId) {
  requireWriteFlag();
  const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  const sb = adminClient();
  assertTable("orders");
  const { error } = await sb.from("orders").delete().eq("user_id", creds.a.id).eq("agent_slug", "pierre");
  if (error) throw new Error(`order clear: ${error.message}`);
  console.log(JSON.stringify({ runId, cleared: true }, null, 2));
}

async function findByRun(sb, runId) {
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = (data?.users ?? []).filter(
    (u) => u.user_metadata?.run_id === runId && u.user_metadata?.purpose === "p92-e2e",
  );
  return { users };
}

async function cleanup(runId) {
  requireWriteFlag();
  const sb = adminClient();
  const { users } = await findByRun(sb, runId);
  for (const u of users) {
    assertTable("orders");
    await sb.from("orders").delete().eq("user_id", u.id);
    assertTable("profiles");
    await sb.from("profiles").delete().eq("id", u.id);
    await sb.auth.admin.deleteUser(u.id);
  }
  try { if (existsSync(CREDS_PATH)) writeFileSync(CREDS_PATH, "{}", "utf8"); } catch {}
  await verify(runId, true);
}

async function verify(runId, fromCleanup = false) {
  const sb = adminClient();
  const { users } = await findByRun(sb, runId);
  let residueOrders = 0;
  let residueProfiles = 0;
  for (const u of users) {
    const o = await sb.from("orders").select("id").eq("user_id", u.id);
    const p = await sb.from("profiles").select("id").eq("id", u.id);
    residueOrders += o.data?.length ?? 0;
    residueProfiles += p.data?.length ?? 0;
  }
  const zero = users.length === 0 && residueOrders === 0 && residueProfiles === 0;
  console.log(JSON.stringify({ runId, remainingUsers: users.length, residueOrders, residueProfiles, zeroResidue: zero }, null, 2));
  if (zero && fromCleanup) console.log("P92 E2E CLEANUP — VERIFIED ZERO RESIDUE");
  if (!zero) process.exit(3);
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const [cmd, arg1, arg2] = process.argv.slice(2);
try {
  if (cmd === "probe") await probe();
  else if (cmd === "setup") await setup(requireArg(arg1, "run_id"));
  else if (cmd === "order") await setOrder(requireArg(arg1, "run_id"), requireArg(arg2, "status"));
  else if (cmd === "order-clear") await clearOrder(requireArg(arg1, "run_id"));
  else if (cmd === "cleanup") await cleanup(requireArg(arg1, "run_id"));
  else if (cmd === "verify") await verify(requireArg(arg1, "run_id"));
  else if (cmd === "gen-run-id") console.log("p92" + randomUUID().slice(0, 8).replace(/-/g, ""));
  else {
    console.error("Usage: node scripts/p92-authenticated-e2e.mjs <probe|setup|order|order-clear|cleanup|verify|gen-run-id> [args]");
    process.exit(1);
  }
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}

function requireArg(v, name) {
  if (!v) throw new Error(`REFUS: argument ${name} requis.`);
  return v;
}
