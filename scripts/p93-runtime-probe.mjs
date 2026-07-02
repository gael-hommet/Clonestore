// P9.3 — Sonde runtime LOCAL (test-mode PGlite). Pilote le plan de contrôle E2E
// pour provisionner un tenant réel, soumettre une mission, faire tourner le worker,
// puis lire les endpoints V1 que le cockpit consomme. AUCUN provider réel.
// Usage: node scripts/p93-runtime-probe.mjs [port]

const PORT = process.argv[2] ?? "3222";
const BASE = `http://localhost:${PORT}`;
const SECRET = "p93-local-secret";
const cp = { "x-pierre-e2e-secret": SECRET, "content-type": "application/json" };

let cookie = "";
async function call(method, path, { headers = {}, body, useCookie = true } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (useCookie && cookie) h["cookie"] = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const setc = res.headers.get("set-cookie");
  if (setc) { const m = setc.match(/pierre_e2e_session=[^;]+/); if (m) cookie = m[0]; }
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const H = (companyId) => ({ "x-pierre-company": companyId });
const log = (label, v) => console.log(`\n### ${label}\n` + JSON.stringify(v, null, 2).slice(0, 1400));

async function provision(ref, name) {
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
  const access = (await call("GET", "/api/pierre/v1/product-access", { headers: H(companyId) })).json;
  return { user_id, email, companyId, access };
}

(async () => {
  const health = await call("GET", "/api/pierre/v1/health", { useCookie: false });
  log("health", health);
  const t = await provision("P93REF1", "Cockpit QA Co");
  log("provisioned", { companyId: t.companyId, access: t.access?.access?.decision });

  const missions = ["Prépare le contrat CDI de Marie Dupont, chargée RH, début 1er septembre.",
                    "Rédige un e-mail de relance pour les candidats sans réponse depuis 10 jours."];
  for (const instruction of missions) {
    const sub = await call("POST", "/api/pierre/v1/missions", { headers: H(t.companyId), body: { instruction, source: "cockpit", idempotency_key: `probe|${instruction.slice(0, 12)}` } });
    log("submit → " + instruction.slice(0, 30), { status: sub.status, mission_id: sub.json?.mission_id, mstatus: sub.json?.status, tasks: (sub.json?.tasks ?? []).map((x) => ({ type: x.type, status: x.status, approval_required: x.approval_required })), approvals: sub.json?.approvals });
  }
  // Faire tourner le worker plusieurs fois.
  for (let i = 0; i < 4; i++) {
    const rt = await call("POST", "/api/internal/e2e/runtime-tick", { headers: cp, body: { company_id: t.companyId }, useCookie: false });
    if (i === 3) log("runtime-tick x4 (last)", rt.json);
  }
  const list = (await call("GET", "/api/pierre/v1/missions?limit=20", { headers: H(t.companyId) })).json;
  log("missions list", { count: list?.items?.length, items: (list?.items ?? []).map((m) => ({ id: m.id?.slice(0, 8), status: m.status, risk: m.risk, summary: m.summary?.slice(0, 40) })) });
  const first = list?.items?.[0]?.id;
  if (first) {
    const detail = (await call("GET", `/api/pierre/v1/missions/${first}`, { headers: H(t.companyId) })).json;
    log("mission detail", { status: detail?.status, tasks: (detail?.tasks ?? []).map((x) => ({ type: x.type, status: x.status, approval_required: x.approval_required })), approvals: detail?.approvals, next_action: detail?.next_action });
    const vals = (await call("GET", `/api/pierre/v1/missions/${first}/validations`, { headers: H(t.companyId) })).json;
    log("validations", vals);
    const tl = (await call("GET", `/api/pierre/v1/missions/${first}/timeline`, { headers: H(t.companyId) })).json;
    log("timeline (first 6)", (Array.isArray(tl) ? tl : tl?.items ?? []).slice(0, 6).map((e) => ({ type: e.type, actor: e.actor_type, at: e.created_at })));
  }
  const emps = (await call("GET", "/api/pierre/v1/employees?limit=10", { headers: H(t.companyId) })).json;
  log("employees", { shape: Array.isArray(emps) ? "array" : Object.keys(emps ?? {}), sample: (emps?.items ?? emps ?? []).slice(0, 3) });
})().catch((e) => { console.error("PROBE ERROR:", e.message); process.exit(1); });
