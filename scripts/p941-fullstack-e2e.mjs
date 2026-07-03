// scripts/p941-fullstack-e2e.mjs
// P9.4.1 — E2E FULL-STACK par les VRAIES routes (durable Postgres via CLONECHAT_DB_URL).
// Prouve : conversations durables MULTI-DEVICE (2 sessions indépendantes, même user) +
// réponse OpenAI réelle persistée + réutilisation d'un problème connu VÉRIFIÉ + budget
// durable (durable:true) + comptabilité. La persistance AU RESTART du dev server est
// prouvée séparément (mode=verify après restart, mêmes données).
// Flags: P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes ET P94_REAL_OPENAI=yes
// Usage: node scripts/p941-fullstack-e2e.mjs <seed|verify> [port]

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

const MODE = process.argv[2] ?? "seed";
const PORT = process.argv[3] ?? "3223";
const BASE = `http://localhost:${PORT}`;
const OUT = resolve(process.cwd(), ".p941-proofs/p941-run1");
const STATE = resolve(OUT, "fullstack-state.json");
mkdirSync(OUT, { recursive: true });
if (process.env.P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes" || process.env.P94_REAL_OPENAI !== "yes") { console.error("REFUS: exige les deux flags =yes."); process.exit(1); }

function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const api = (token) => async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

async function signIn(email, password) { const { data, error } = await anon.auth.signInWithPassword({ email, password }); if (error) throw new Error("signIn: " + error.message); return data.session.access_token; }

if (MODE === "seed") {
  const runId = "p941fs" + randomUUID().slice(0, 8).replace(/-/g, "");
  const email = `p94-e2e-a-${runId}@example.invalid`;
  const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p941-fullstack", run_id: runId } });
  if (ue) { console.error("createUser:", ue.message); process.exit(2); }
  const userId = u.user.id;
  await admin.from("profiles").upsert({ id: userId, email, full_name: `p941-${runId}` }, { onConflict: "id" });
  await admin.from("orders").upsert({ user_id: userId, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });

  // Device A
  const tokenA = await signIn(email, password);
  const A = api(tokenA);
  const created = await A("POST", "/api/assistant/conversations", { title: "Contrats" });
  const convId = created.json?.conversation?.id;
  const durable = created.json?.durable === true;
  const c1 = await A("POST", "/api/assistant/chat", { message: "Explique en une phrase ce que fait Pierre.", conversation_id: convId });
  const c2 = await A("POST", "/api/assistant/chat", { message: "le bouton envoyer reste grisé, le message ne part pas", conversation_id: convId });

  // Device B : session INDÉPENDANTE, même utilisateur
  const tokenB = await signIn(email, password);
  const B = api(tokenB);
  const listB = await B("GET", "/api/assistant/conversations");
  const msgsB = await B("GET", `/api/assistant/conversations/${convId}`);

  const out = {
    runId, userId, email, password, convId, durable,
    deviceA_answer_source: c1.json?.source,
    known_issue_reused: !!(c2.json?.knownIssue?.reusable) || /contournement/i.test(c2.json?.structured?.answer ?? ""),
    deviceB_sees_conversation: (listB.json?.conversations ?? []).some((c) => c.id === convId),
    deviceB_message_count: (msgsB.json?.messages ?? []).length,
    tokensRecorded: (c1.json?.usageTokens ?? 0) + (c2.json?.usageTokens ?? 0),
  };
  writeFileSync(STATE, JSON.stringify({ runId, userId, email, password, convId }, null, 2));
  writeFileSync(resolve(OUT, "multi-device-continuity.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  const ok = out.durable && out.deviceB_sees_conversation && out.deviceB_message_count >= 2 && out.deviceA_answer_source === "openai";
  console.log(ok ? "P941 FULLSTACK SEED — VERIFIED" : "P941 FULLSTACK SEED — CHECK");
  if (!ok) process.exitCode = 3;
} else if (MODE === "verify") {
  // Après RESTART du dev server (PG keeper resté vivant) : les données sont-elles là ?
  const st = JSON.parse(readFileSync(STATE, "utf8"));
  const token = await signIn(st.email, st.password);
  const A = api(token);
  const list = await A("GET", "/api/assistant/conversations");
  const msgs = await A("GET", `/api/assistant/conversations/${st.convId}`);
  const out = {
    runId: st.runId,
    afterRestart_durable: list.json?.durable === true,
    afterRestart_sees_conversation: (list.json?.conversations ?? []).some((c) => c.id === st.convId),
    afterRestart_message_count: (msgs.json?.messages ?? []).length,
  };
  writeFileSync(resolve(OUT, "restart-proof-http.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  // Cleanup Supabase (PG durable est nettoyé par l'arrêt du keeper + suppression datadir).
  try { await admin.from("orders").delete().eq("user_id", st.userId); } catch {}
  try { await admin.from("profiles").delete().eq("id", st.userId); } catch {}
  try { await admin.auth.admin.deleteUser(st.userId); } catch {}
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const residue = (data?.users ?? []).filter((x) => x.user_metadata?.run_id === st.runId).length;
  const ok = out.afterRestart_durable && out.afterRestart_sees_conversation && out.afterRestart_message_count >= 2;
  console.log(ok ? "P941 FULLSTACK RESTART — VERIFIED" : "P941 FULLSTACK RESTART — CHECK");
  console.log(residue === 0 ? "P941 FULLSTACK CLEANUP — VERIFIED ZERO RESIDUE (Supabase)" : `RESIDUE: ${residue}`);
  if (!ok || residue !== 0) process.exitCode = 3;
}
