// P9.4 — E2E GOUVERNÉ continu (headless, chemin de production réel).
// Prouve le pipeline complet de CloneChat :
//   texte → route authentifiée (Supabase) → OpenAI RÉEL propose prepare_mission
//   (gouverné, NON exécuté) → exécution confirmée = contrat V1 réel (POST missions,
//   idempotent) → relecture serveur → deep-link cockpit → isolation A/B.
// Double identité : Supabase (accès/route) + runtime PGlite test-mode (données V1).
// Flags REQUIS : P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes ET P94_REAL_OPENAI=yes
// Serveur : PIERRE_E2E_TEST_MODE=1 PIERRE_E2E_SECRET=p93-local-secret CLONECHAT_ENABLED=true
// Usage : node scripts/p94-e2e-governed.mjs [port]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";

const PORT = process.argv[2] ?? "3223";
const BASE = `http://localhost:${PORT}`;
const SECRET = "p93-local-secret";
if (process.env.P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes" || process.env.P94_REAL_OPENAI !== "yes") {
  console.error("REFUS: exige les deux flags =yes."); process.exit(1);
}
function env() {
  const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {};
  for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e;
}
const E = env();
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const cp = { "x-pierre-e2e-secret": SECRET, "content-type": "application/json" };

// ── Client V1 test-mode (cookie e2e signé, isolé par identité) ──────────────
function makeSession() {
  let cookie = "";
  async function call(method, path, { headers = {}, body, useCookie = true } = {}) {
    const h = { "content-type": "application/json", ...headers };
    if (useCookie && cookie) h["cookie"] = cookie;
    const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const setc = res.headers.get("set-cookie");
    if (setc) { const m = setc.match(/pierre_e2e_session=[^;]+/); if (m) cookie = m[0]; }
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json, cookie };
  }
  return { call, getCookie: () => cookie };
}
const H = (companyId) => ({ "x-pierre-company": companyId });

async function provision(sess, ref, name) {
  const { call } = sess;
  await call("POST", "/api/internal/e2e/reset", { headers: cp, useCookie: false });
  const su = await call("POST", "/api/internal/e2e/seed-user", { headers: cp, body: {}, useCookie: false });
  const { user_id, email } = su.json;
  await call("POST", "/api/internal/e2e/session", { headers: cp, body: { user_id, email }, useCookie: false });
  await call("POST", "/api/pierre/v1/activation", { body: { test_commercial_reference: ref, company_name: name } });
  await call("POST", "/api/internal/e2e/commercial-event", { headers: cp, body: { provider_event_id: `evt_${ref}`, event_key: "commercial.payment_confirmed", subscription_reference: ref }, useCookie: false });
  const tick = await call("POST", "/api/internal/e2e/activation-tick", { headers: cp, useCookie: false });
  const companyId = tick.json?.provisioned?.[0];
  if (!companyId) throw new Error("no company provisioned: " + JSON.stringify(tick.json));
  await call("PATCH", "/api/pierre/v1/company", { headers: H(companyId), body: { registration_country: "FR", legal_name: `${name} SAS`, registration_number: `RCS-${ref}`, version: 1 } });
  const onb = (await call("GET", "/api/pierre/v1/onboarding", { headers: H(companyId) })).json;
  const sessionId = onb.session.id;
  for (const step of (onb.steps ?? []).filter((s) => s.required)) {
    await call("PATCH", `/api/pierre/v1/onboarding/steps/${step.step_key}`, { headers: H(companyId), body: { session_id: sessionId, data: { no_employees_for_now: true } } });
  }
  await call("POST", "/api/pierre/v1/onboarding/complete", { headers: H(companyId), body: { session_id: sessionId } });
  return { companyId };
}

async function chatRoute(message, token, cookie) {
  const res = await fetch(`${BASE}/api/assistant/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ message }),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const runId = "p94g" + randomUUID().slice(0, 8).replace(/-/g, "");
const emailA = `p94-e2e-a-${runId}@example.invalid`;
const emailB = `p94-e2e-b-${runId}@example.invalid`;
const password = "Qa!" + randomBytes(18).toString("base64url");
const out = { runId, steps: {} };
let userIdA = null, userIdB = null;

async function makeSupabaseUser(email) {
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p94-e2e", run_id: runId } });
  if (ue) throw new Error("createUser: " + ue.message);
  const id = u.user.id;
  await admin.from("profiles").upsert({ id, email, full_name: `p94-${runId}` }, { onConflict: "id" });
  await admin.from("orders").upsert({ user_id: id, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
  const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se) throw new Error("signIn: " + se.message);
  return { id, token: s.session.access_token };
}

try {
  // ── Tenant A : identité Supabase + runtime PGlite ──
  const sessA = makeSession();
  const a = await makeSupabaseUser(emailA); userIdA = a.id;
  const provA = await provision(sessA, "P94REFA", "CloneChat QA A");
  out.steps.provision_A = { companyId: provA.companyId.slice(0, 8) };

  // 1) PROPOSITION gouvernée (OpenAI réel) — jamais exécutée par le modèle.
  const propose = await chatRoute("Prépare le contrat CDI de Marie Dupont, chargée RH, début 1er septembre.", a.token, sessA.getCookie());
  out.steps.governed_proposal = {
    source: propose.json?.source,
    tool: propose.json?.structured?.tool_call?.name ?? null,
    honesty: propose.json?.structured?.honesty,
    tokens: propose.json?.usageTokens ?? 0,
    answer: (propose.json?.structured?.answer ?? "").slice(0, 90),
  };
  const instruction = propose.json?.structured?.tool_call?.arguments?.instruction
    ?? "Prépare le contrat CDI de Marie Dupont, chargée RH, début 1er septembre.";

  // 2) EXÉCUTION confirmée = contrat V1 réel (exactement ce que submitPierreMission fait).
  const idem = `clonechat|${runId}|create`;
  const exec1 = await sessA.call("POST", "/api/pierre/v1/missions", { headers: H(provA.companyId), body: { instruction, source: "clonechat", idempotency_key: idem } });
  const missionId = exec1.json?.mission_id ?? exec1.json?.id;
  out.steps.real_execution = { status: exec1.status, mission_id: (missionId ?? "").slice(0, 8), mstatus: exec1.json?.status };

  // 3) IDEMPOTENCE serveur : même clé → même mission (aucune 2e mission).
  const exec2 = await sessA.call("POST", "/api/pierre/v1/missions", { headers: H(provA.companyId), body: { instruction, source: "clonechat", idempotency_key: idem } });
  const missionId2 = exec2.json?.mission_id ?? exec2.json?.id;
  out.steps.idempotency = { same_mission: missionId === missionId2, id2: (missionId2 ?? "").slice(0, 8) };

  // 4) RELECTURE serveur (continuité) : la mission existe réellement.
  const list = (await sessA.call("GET", "/api/pierre/v1/missions?limit=20", { headers: H(provA.companyId) })).json;
  const items = list?.items ?? [];
  out.steps.server_reread = { count: items.length, contains: items.some((m) => m.id === missionId) };
  out.steps.cockpit_deeplink = `/agents/pierre/use?view=missions&mission=${missionId}`;

  // ── Tenant B : isolation ──
  const sessB = makeSession();
  const b = await makeSupabaseUser(emailB); userIdB = b.id;
  const provB = await provision(sessB, "P94REFB", "CloneChat QA B");
  const listB = (await sessB.call("GET", "/api/pierre/v1/missions?limit=20", { headers: H(provB.companyId) })).json;
  const itemsB = listB?.items ?? [];
  const leak = itemsB.some((m) => m.id === missionId) || JSON.stringify(itemsB).includes("Marie Dupont");
  out.steps.isolation_AB = { tenantB_missions: itemsB.length, sees_A_mission_or_marie: leak };

  console.log(JSON.stringify(out, null, 2));
  const ok = out.steps.governed_proposal.tool === "prepare_mission"
    && out.steps.governed_proposal.source === "openai"
    && out.steps.real_execution.status === 200 && !!missionId
    && out.steps.idempotency.same_mission === true
    && out.steps.server_reread.contains === true
    && out.steps.isolation_AB.sees_A_mission_or_marie === false;
  console.log(ok ? "P94 GOVERNED E2E — VERIFIED" : "P94 GOVERNED E2E — FAILED");
  if (!ok) process.exitCode = 3;
} catch (e) {
  console.error("E2E ERROR:", e.message); process.exitCode = 2;
} finally {
  for (const id of [userIdA, userIdB]) {
    if (!id) continue;
    try { await admin.from("orders").delete().eq("user_id", id); } catch {}
    try { await admin.from("profiles").delete().eq("id", id); } catch {}
    try { await admin.auth.admin.deleteUser(id); } catch {}
  }
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const remaining = (data?.users ?? []).filter((x) => x.user_metadata?.run_id === runId).length;
  console.log(remaining === 0 ? "P94 GOVERNED E2E CLEANUP — VERIFIED ZERO RESIDUE" : `RESIDUE: ${remaining}`);
}
