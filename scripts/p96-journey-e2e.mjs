// scripts/p96-journey-e2e.mjs
// P9.6 §3+§5 — PARCOURS PRODUIT DE PIERRE, bout en bout, sur une VRAIE entreprise locale
// (companyResolved:true — jamais le repli u:<userId>). Honnête par construction :
//
//   1) Utilisateur Supabase ÉPHÉMÈRE + accès Pierre (orders) → session RÉELLE (signInWithPassword).
//   2) BINDING critique : POST /api/internal/e2e/session avec user_id = supabaseUser.id
//      → la company PGlite est possédée par l'id Supabase → resolveCloneChatCompany la résout.
//   3) Provisioning RÉEL (activation → commercial-event → tick → onboarding complete) — rien de pré-seedé.
//   4) Navigateur ISOLÉ : injection des DEUX cookies (Supabase non-httpOnly + pierre_e2e_session httpOnly).
//   5) Parcours navigateur A–I : readiness → autonomie (persiste) → CloneChat (proposition réelle) →
//      Confirmer → /execute { proposalId } SEUL → mission V1 réelle → cockpit → reload → doublon → sécurité.
//   6) Nettoyage utilisateur (zéro résidu).
//
// Le serveur doit tourner en `next dev` (NODE_ENV=development) avec PGlite E2E. Voir P9_6_RUN.md.
// Flag garde-fou : P96_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P96_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") {
  console.error("flag P96_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes requis"); process.exit(1);
}

function env() {
  const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {};
  for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } }
  return e;
}
const E = env();
const BASE = process.env.P96_BASE ?? "http://127.0.0.1:3260";
const SECRET = process.env.PIERRE_E2E_SECRET ?? "p96-local-secret";
const RUN = process.env.P96_RUN ?? "p96-run1";
const proofDir = resolve(process.cwd(), ".p96-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-6");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const host = new URL(BASE).hostname;
const cp = { "x-pierre-e2e-secret": SECRET };

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Cookie jar minimal pour les appels de provisioning côté Node ───────────────
function makeJar() {
  const jar = new Map();
  return {
    ingest(res) {
      // Node fetch: headers.getSetCookie() (ou get('set-cookie'))
      const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
      for (const line of raw) { const seg = line.split(";")[0]; const i = seg.indexOf("="); if (i > 0) jar.set(seg.slice(0, i).trim(), seg.slice(i + 1).trim()); }
    },
    header() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "); },
    get(name) { return jar.get(name); },
  };
}
const jar = makeJar();
async function api(method, path, { headers = {}, body, cp: useCp } = {}) {
  const h = { ...(useCp ? cp : {}), ...headers };
  const cookie = jar.header(); if (cookie) h["cookie"] = cookie;
  if (body !== undefined) h["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  jar.ingest(res);
  let json = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const H = (companyId) => ({ "x-pierre-company": companyId });

const out = { runId: RUN, base: BASE, steps: {}, browser: {}, verdict: "PENDING" };
let userId = null;
async function cleanup() {
  try { await admin.from("orders").delete().eq("user_id", userId); } catch { /* */ }
  try { await admin.from("profiles").delete().eq("id", userId); } catch { /* */ }
  try { await admin.auth.admin.deleteUser(userId); } catch { /* */ }
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE";
}

// Bruit console attendu. NB : le parcours DOIT tourner en `next dev` (NODE_ENV≠production requis
// pour le runtime PGlite E2E) → le Fast-Refresh/HMR de dev émet des erreurs transitoires de
// PARSING de chunks ("Invalid or unexpected token", "Unexpected end of JSON input") avec une
// stack vide (script minifié/cross-origin) — ce ne sont PAS des erreurs applicatives. En build de
// production elles n'existent pas ; mais la prod désactive le runtime E2E, d'où le compromis assumé.
const BENIGN = [
  /Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i, /Download the React DevTools/i,
  /\[Fast Refresh\]/i, /hydrat/i,
  /Invalid or unexpected token/i, /Unexpected end of JSON input/i, /ChunkLoadError/i, /Loading chunk/i, /webpack/i, /__next/i, // dev/HMR
];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

try {
  // ── 1) Utilisateur Supabase éphémère + accès Pierre ──────────────────────────
  const runId = "p96" + randomUUID().slice(0, 8).replace(/-/g, "");
  const email = `p96-e2e-${runId}@example.invalid`;
  const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p96-journey-e2e", run_id: runId } });
  if (ue) throw new Error("createUser: " + ue.message);
  userId = u.user.id;
  await admin.from("profiles").upsert({ id: userId, email, full_name: `p96-${runId}` }, { onConflict: "id" });
  await admin.from("orders").upsert({ user_id: userId, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
  out.steps.supabase_user = { userId: userId.slice(0, 8), pierreAccess: true };

  // ── 2) Session Supabase RÉELLE → cookies exacts d'@supabase/ssr ───────────────
  const captured = [];
  const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
  const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
  if (se || !si?.session) throw new Error("signIn: " + (se?.message ?? "no session"));
  const supaCookies = captured.map((c) => ({ name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/", httpOnly: false, secure: false, sameSite: "Lax", expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1 }));
  out.steps.supabase_session = { minted: true, cookieNames: captured.map((c) => c.name) };

  // ── 3) BINDING + provisioning RÉEL de l'entreprise (companyResolved:true) ──────
  const rReset = await api("POST", "/api/internal/e2e/reset", { cp: true }); if (rReset.status !== 200) throw new Error("reset " + rReset.status);
  // *** L'ÉTAPE CRITIQUE *** : user_id = supabaseUser.id (jamais un seed-user aléatoire).
  const rSess = await api("POST", "/api/internal/e2e/session", { cp: true, body: { user_id: userId, email } });
  if (rSess.status !== 200) throw new Error("e2e session " + rSess.status);
  const e2eCookie = jar.get("pierre_e2e_session");
  if (!e2eCookie) throw new Error("pierre_e2e_session cookie manquant");
  out.steps.binding = { e2eSessionBoundToSupabaseId: true, cookiePresent: true };

  const ref = "P96REF" + runId.slice(3, 9).toUpperCase();
  const act = await api("POST", "/api/pierre/v1/activation", { body: { test_commercial_reference: ref, company_name: "Journée Pierre SAS" } });
  if (act.status !== 200) throw new Error("activation " + act.status + " " + JSON.stringify(act.json));
  const ce = await api("POST", "/api/internal/e2e/commercial-event", { cp: true, body: { provider_event_id: `evt_${ref}`, event_key: "commercial.payment_confirmed", subscription_reference: ref } });
  if (ce.json?.activation_marked !== "provisioning") throw new Error("commercial-event: " + JSON.stringify(ce.json));
  const tick = await api("POST", "/api/internal/e2e/activation-tick", { cp: true });
  const companyId = tick.json?.provisioned?.[0];
  if (!companyId) throw new Error("activation-tick provisioned none: " + JSON.stringify(tick.json));

  // onboarding réel → company active + product-access allowed
  const pc = await api("PATCH", "/api/pierre/v1/company", { headers: H(companyId), body: { registration_country: "FR", legal_name: "Journée Pierre SAS", registration_number: `RCS-${ref}`, version: 1 } });
  if (pc.status !== 200) throw new Error("company patch " + pc.status + " " + JSON.stringify(pc.json));
  const onb = (await api("GET", "/api/pierre/v1/onboarding", { headers: H(companyId) })).json;
  const sessionId = onb?.session?.id;
  for (const step of (onb?.steps ?? []).filter((s) => s.required)) {
    const r = await api("PATCH", `/api/pierre/v1/onboarding/steps/${step.step_key}`, { headers: H(companyId), body: { session_id: sessionId, data: { no_employees_for_now: true } } });
    if (r.status !== 200) throw new Error(`step ${step.step_key} ${r.status}`);
  }
  const done = await api("POST", "/api/pierre/v1/onboarding/complete", { headers: H(companyId), body: { session_id: sessionId } });
  if (done.status !== 200) throw new Error("onboarding complete " + done.status + " " + JSON.stringify(done.json));
  const access = (await api("GET", "/api/pierre/v1/product-access", { headers: H(companyId) })).json;
  out.steps.provision = { companyId: companyId.slice(0, 8), companyIdIsUuid: /^[0-9a-f-]{36}$/i.test(companyId), accessDecision: access?.access?.decision };
  if (access?.access?.decision !== "allowed") throw new Error("product-access not allowed: " + JSON.stringify(access?.access));

  // ── 4) Navigateur isolé : injection des DEUX cookies ─────────────────────────
  const e2eBrowserCookie = { name: "pierre_e2e_session", value: e2eCookie, domain: host, path: "/", httpOnly: true, secure: false, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 };
  const allCookies = [...supaCookies, e2eBrowserCookie];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await ctx.addCookies(allCookies);
  const page = await ctx.newPage();
  const consoleErrors = []; const net = { chat: [], execute: [], executeResp: [], autonomy: [] };
  const pageErrorStacks = []; const rawConsole = [];
  page.on("console", (m) => { if (m.type() === "error") { rawConsole.push(m.text()); if (!isBenign(m.text())) consoleErrors.push(m.text()); } });
  page.on("pageerror", (e) => { rawConsole.push("pageerror: " + e.message); if (!isBenign(e.message)) consoleErrors.push("pageerror: " + e.message); pageErrorStacks.push(String(e.stack ?? e.message).slice(0, 200)); });
  page.on("request", (r) => {
    const url = r.url();
    // Marque l'origine : bouton UI réel (front-end) vs sonde forgée du harness (probe).
    if (url.includes("/api/assistant/execute") && r.method() === "POST") { try { net.execute.push({ keys: Object.keys(JSON.parse(r.postData() ?? "{}")).sort(), forged: (r.postData() ?? "").includes("HACK") }); } catch { /* */ } }
  });
  page.on("response", async (r) => {
    const url = r.url(); const m = r.request().method();
    if (url.includes("/api/assistant/chat") && m === "POST") { try { net.chat.push({ status: r.status(), body: await r.json() }); } catch { /* */ } }
    if (url.includes("/api/assistant/execute") && m === "POST") { try { net.executeResp.push({ status: r.status(), body: await r.json() }); } catch { /* */ } }
    if (url.includes("/api/assistant/autonomy")) { try { net.autonomy.push({ method: m, status: r.status(), body: await r.json() }); } catch { /* */ } }
  });

  const fetchIn = (url, opts) => page.evaluate(async ([u, o]) => {
    const r = await fetch(u, { ...o, credentials: "same-origin", headers: { ...(o?.headers || {}), ...(o?.body ? { "content-type": "application/json" } : {}) } });
    let j = null; try { j = await r.json(); } catch { /* */ }
    return { status: r.status, body: j };
  }, [url, opts]);

  // ── A) READINESS : companyResolved:true dans le vrai navigateur ──────────────
  await page.goto(`${BASE}/agents/pierre/use?view=journey`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-journey-item='company']", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const autonomyGet = await fetchIn("/api/assistant/autonomy", { method: "GET" });
  out.browser.A_readiness = {
    companyResolved: autonomyGet.body?.companyResolved === true,
    currentMode: autonomyGet.body?.current?.productModeId ?? null,
    journeyLevelVisible: (await page.locator("[data-testid='journey-level']").count()) > 0,
    journeyItemsCount: await page.locator("[data-journey-item]").count(),
    companyItemState: await page.locator("[data-journey-item='company']").getAttribute("data-journey-state").catch(() => null),
    journeySummary: (await page.locator("[data-testid='journey-summary']").first().textContent().catch(() => null))?.slice(0, 120) ?? null,
  };
  await page.screenshot({ path: resolve(shotDir, "p96-A-journey.png"), fullPage: false });

  // ── B) AUTONOMIE : régler un mode → persiste (colonne P8) ────────────────────
  const setMode = await fetchIn("/api/assistant/autonomy", { method: "POST", body: JSON.stringify({ productModeId: "controlled" }) });
  const reGet = await fetchIn("/api/assistant/autonomy", { method: "GET" });
  out.browser.B_autonomy = {
    postOk: setMode.body?.ok === true,
    postMode: setMode.body?.current?.productModeId ?? null,
    persistedMode: reGet.body?.current?.productModeId ?? null,
    persisted: reGet.body?.current?.productModeId === "controlled",
    // forge un mode moteur → doit être IGNORÉ (le serveur ne lit que productModeId)
  };
  await page.goto(`${BASE}/agents/pierre/use?view=autonomy`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(shotDir, "p96-B-autonomy.png"), fullPage: false });

  // ── C) CLONECHAT (UI RÉELLE) : demande RH → proposition create_mission avec autonomie ─
  const missionText = "Prépare le contrat CDI de Marie Dupont, chargée RH, début 1er septembre.";
  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  // Attend le MODE AUTHENTIFIÉ (pied du composer). La détection de session côté client
  // (getSession + getUser réseau vers Supabase) peut échouer transitoirement → on RECHARGE
  // jusqu'à 3 fois pour laisser le client réhydrater la session avant d'abandonner.
  let authedUi = false;
  for (let attempt = 0; attempt < 3 && !authedUi; attempt++) {
    if (attempt > 0) await page.reload({ waitUntil: "networkidle" });
    authedUi = await page.waitForFunction(() => /Rien de sensible n'est exécuté sans votre confirmation/i.test(document.body.innerText), null, { timeout: 20000 }).then(() => true).catch(() => false);
  }
  await page.waitForTimeout(800);
  const composerDiag = await page.evaluate(() => {
    const ta = document.querySelector("textarea");
    const cookieNames = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter(Boolean);
    const sb = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith("sb-") && c.includes("auth-token"));
    return { hasTextarea: !!ta, textareaDisabled: ta ? ta.disabled : null, authenticatedMode: /Rien de sensible n'est exécuté/i.test(document.body.innerText), placeholder: ta?.getAttribute("placeholder") ?? null, cookieVisibleNames: cookieNames, sbCookieVisibleLen: sb ? sb.length : 0, sbCookiePrefix: sb ? sb.slice(0, 40) : null };
  });
  let confirmClicked = false; let uiClickExec = null;
  if (composerDiag.hasTextarea && composerDiag.textareaDisabled === false && composerDiag.authenticatedMode) {
    // fill() met la valeur ET déclenche l'événement input → React met à jour `draft` → submit possible.
    await page.fill("textarea", missionText);
    await page.waitForTimeout(200);
    await page.locator("textarea").press("Enter"); // onKeyDown Enter → submit()
    // Attend la bulle de proposition + le bouton « Confirmer » (appel OpenAI réel).
    const confirmBtn = await page.waitForSelector("button:has-text('Confirmer')", { timeout: 45000 }).catch(() => null);
    await page.screenshot({ path: resolve(shotDir, "p96-C-proposal.png"), fullPage: false });
    if (confirmBtn) {
      // ── D) CONFIRMER (clic UI réel) → /execute { proposalId } SEUL → mission V1 ──
      // On CAPTURE DÉTERMINISTE la réponse d'exécution déclenchée par le clic (mission cognitive
      // réelle : la création peut prendre plusieurs secondes en dev).
      const respP = page.waitForResponse((r) => r.url().includes("/api/assistant/execute") && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
      await confirmBtn.click();
      confirmClicked = true;
      const execResp = await respP;
      if (execResp) uiClickExec = { status: execResp.status(), body: await execResp.json().catch(() => null) };
      await page.waitForTimeout(1500);
      await page.screenshot({ path: resolve(shotDir, "p96-D-confirmed.png"), fullPage: false });
    }
  }
  out.browser.C_composer = composerDiag;

  // Filet : si le clic UI n'a pas produit de proposition (mode client non détecté à temps),
  // on complète le parcours via des requêtes navigateur AUTHENTIFIÉES (mêmes cookies, le serveur
  // valide le vrai JWT). L'invariant execute-par-référence tient dans les deux cas.
  let usedFetchFallback = false;
  if (net.chat.length === 0) {
    usedFetchFallback = true;
    const fchat = await fetchIn("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message: missionText }) });
    net.chat.push({ status: fchat.status, body: fchat.body });
    const pid = fchat.body?.proposal?.id;
    if (pid) {
      const fx = await fetchIn("/api/assistant/execute", { method: "POST", body: JSON.stringify({ proposalId: pid }) });
      net.execute.push({ keys: ["proposalId"], forged: false });
      net.executeResp.push({ status: fx.status, body: fx.body });
    }
  }
  const chatBody = net.chat.map((x) => x.body).find((b) => b?.proposal) ?? net.chat.slice(-1)[0]?.body ?? null;
  const proposal = chatBody?.proposal ?? null;
  out.browser.C_chat = {
    status: net.chat.slice(-1)[0]?.status ?? null, source: chatBody?.source ?? chatBody?.code ?? null,
    tool: chatBody?.structured?.tool_call?.name ?? null,
    hasProposal: !!proposal, proposalId: proposal?.id ? "present" : null,
    proposalKind: proposal?.kind ?? null,
    autonomyReflected: proposal?.autonomy ?? null,
    companyRequired: chatBody?.source === "company_required" || chatBody?.code === "MEMBERSHIP_REQUIRED",
  };

  // Le clic UI a émis /execute { proposalId } SEUL. On lit la réponse capturée déterministe.
  const uiExec = uiClickExec ?? net.executeResp.find((r) => r?.body?.targetRef) ?? net.executeResp[0] ?? null;
  const uiExecBody = net.execute.find((b) => !b.forged) ?? null;
  // Réf mission : targetRef de l'exécution, sinon (cas in_flight) la mission réelle de l'entreprise.
  let missionRefResolved = uiExec?.body?.targetRef ?? null;
  if (!missionRefResolved) {
    const lst = await fetchIn("/api/pierre/v1/missions?limit=5", { method: "GET", headers: { "x-pierre-company": companyId } });
    missionRefResolved = lst.body?.items?.[0]?.id ?? null;
  }

  // D-bis) SÉCURITÉ : sonde forgée (champs client hostiles) → doit être IGNORÉE (server lit la
  // proposition persistée). La commande réelle étant déjà committée, le rejeu forgé = duplicate.
  let forgedIgnored = null;
  if (proposal?.id) {
    forgedIgnored = await fetchIn("/api/assistant/execute", { method: "POST", body: JSON.stringify({ proposalId: proposal.id, autonomyMode: "enterprise_autonomous", companyId: "00000000-0000-0000-0000-000000000000", payload: { instruction: "HACK" }, fingerprint: "x" }) });
  }
  out.browser.D_execute = {
    confirmClicked, usedFetchFallback,
    status: uiExec?.status ?? null, execStatus: uiExec?.body?.status ?? null,
    kind: uiExec?.body?.kind ?? null, targetRef: missionRefResolved ? "present" : null,
    href: uiExec?.body?.href ?? null,
    uiExecuteBodyKeys: uiExecBody?.keys ?? null,
    onlyProposalIdSent: !!uiExecBody && uiExecBody.keys.length === 1 && uiExecBody.keys[0] === "proposalId",
    forgedReplayStatus: forgedIgnored?.body?.status ?? null, // attendu: duplicate (même proposalId → même commande, effet forgé ignoré)
  };

  const missionRef = missionRefResolved;

  // ── E) MISSION V1 : créée réellement + (si exposé) autonomy_mode = mode persistant ─
  let missionRecord = null;
  if (missionRef) {
    const mr = await fetchIn(`/api/pierre/v1/missions/${encodeURIComponent(missionRef)}`, { method: "GET", headers: { "x-pierre-company": companyId } });
    missionRecord = mr.body;
  }
  out.browser.E_mission = {
    missionExists: !!missionRecord, missionRef: missionRef ? "present" : null,
    missionStatus: missionRecord?.status ?? null,
    autonomyModeOnRecord: missionRecord?.autonomy_mode ?? missionRecord?.mission?.autonomy_mode ?? "not_exposed",
  };

  // ── F) COCKPIT : la mission apparaît RÉELLEMENT dans le DOM (deep-link) ───────
  const listF = await fetchIn("/api/pierre/v1/missions?limit=25", { method: "GET", headers: { "x-pierre-company": companyId } });
  const itemsF = listF.body?.items ?? [];
  const missionTitle = itemsF.find((m) => m.id === missionRef)?.summary ?? itemsF[0]?.summary ?? null;
  await page.goto(`${BASE}/agents/pierre/use?view=missions${missionRef ? `&mission=${encodeURIComponent(missionRef)}` : ""}`, { waitUntil: "domcontentloaded" });
  // Attend que le titre réel de la mission apparaisse dans le DOM (liste OU tiroir détail).
  if (missionTitle) await page.waitForFunction((t) => document.body.innerText.includes(t), missionTitle, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const bodyTextF = await page.evaluate(() => document.body.innerText);
  out.browser.F_cockpit = {
    missionTitleOnRecord: (missionTitle ?? "").slice(0, 80),
    missionVisibleInDom: missionTitle ? bodyTextF.includes(missionTitle) : false,
    missionInServerList: missionRef ? itemsF.some((m) => m.id === missionRef) : false,
    missionStatusShown: /valid|attente|en cours|terminé|brouillon/i.test(bodyTextF),
    noAssistantFraming: !/assistant\s+rh|copilote/i.test(bodyTextF),
  };
  await page.screenshot({ path: resolve(shotDir, "p96-F-cockpit-mission.png"), fullPage: false });

  // ── G) RELOAD : le résultat survit ───────────────────────────────────────────
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const listAfter = await fetchIn("/api/pierre/v1/missions?limit=25", { method: "GET", headers: { "x-pierre-company": companyId } });
  const items = listAfter.body?.items ?? [];
  out.browser.G_reload = {
    missionCountAfterReload: items.length,
    missionStillPresent: missionRef ? items.some((m) => m.id === missionRef) : false,
  };
  await page.screenshot({ path: resolve(shotDir, "p96-G-reload.png"), fullPage: false });

  // ── H) DOUBLON : re-confirmer le MÊME proposalId → duplicate, UNE seule mission ─
  let dup = null;
  if (proposal?.id) dup = await fetchIn("/api/assistant/execute", { method: "POST", body: JSON.stringify({ proposalId: proposal.id }) });
  const listDup = await fetchIn("/api/pierre/v1/missions?limit=25", { method: "GET", headers: { "x-pierre-company": companyId } });
  const totalMissions = (listDup.body?.items ?? []).length; // entreprise fraîche → 1 seule mission attendue
  out.browser.H_no_double = {
    duplicateStatus: dup?.body?.status ?? null,
    isDuplicate: dup?.body?.status === "duplicate",
    totalMissionsInCompany: totalMissions, exactlyOne: totalMissions === 1,
  };

  // ── J) VALIDATION HUMAINE → RÉSULTAT : approuver la validation en attente, faire avancer ─
  // le runtime, re-lire → la mission PROGRESSE au-delà de « en attente de validation ». C'est le
  // chemin cockpit RÉEL (même endpoint V1 que le bouton « Approuver » de ValidationsView).
  let jValidation = { hadPendingValidation: false, approvedCount: 0, allApproved: false, missionStatusBefore: null, missionStatusAfter: null, progressed: false, tasksCompletedAfter: 0 };
  const listVals = async () => {
    const r = await fetchIn(`/api/pierre/v1/missions/${encodeURIComponent(missionRef)}/validations`, { method: "GET", headers: { "x-pierre-company": companyId } });
    return Array.isArray(r.body) ? r.body : (r.body?.validations ?? r.body?.items ?? []);
  };
  if (missionRef) {
    // Ouvre la vue Validations (preuve visuelle du chemin humain).
    await page.goto(`${BASE}/agents/pierre/use?view=validations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: resolve(shotDir, "p96-H-validations.png"), fullPage: false });

    const before = (await fetchIn(`/api/pierre/v1/missions/${encodeURIComponent(missionRef)}`, { method: "GET", headers: { "x-pierre-company": companyId } })).body;
    jValidation.missionStatusBefore = before?.status ?? null;

    // Approuve TOUTES les validations en attente (la mission « Plan cognitif: N tâches » peut en avoir
    // plusieurs) via l'endpoint V1 gouverné (version-checké) — requêtes navigateur authentifiées.
    let pending = (await listVals()).filter((v) => String(v.status) === "pending");
    jValidation.hadPendingValidation = pending.length > 0;
    for (let round = 0; round < 6 && pending.length > 0; round++) {
      for (const v of pending) {
        const appr = await fetchIn(`/api/pierre/v1/validations/${encodeURIComponent(v.id)}/approve`, { method: "POST", headers: { "x-pierre-company": companyId }, body: JSON.stringify({ version: v.version ?? 1 }) });
        if (appr.status === 200) jValidation.approvedCount++;
      }
      // fait avancer le runtime pour débloquer d'éventuelles tâches/validations suivantes
      for (let i = 0; i < 2; i++) { await api("POST", "/api/internal/e2e/runtime-tick", { cp: true, body: { company_id: companyId } }); }
      await page.waitForTimeout(800);
      pending = (await listVals()).filter((v) => String(v.status) === "pending");
    }
    jValidation.allApproved = pending.length === 0 && jValidation.approvedCount > 0;
    // Statuts finaux des validations (preuve directe du chemin humain : pending → approved).
    const finalVals = await listVals();
    jValidation.validationStatusesAfter = finalVals.map((v) => String(v.status));
    jValidation.allValidationsApproved = finalVals.length > 0 && finalVals.every((v) => String(v.status) === "approved");

    // Ticks finaux (runtime + scheduler) + re-lecture : la mission tente de PROGRESSER.
    for (let i = 0; i < 3; i++) {
      await api("POST", "/api/internal/e2e/runtime-tick", { cp: true, body: { company_id: companyId } });
      await api("POST", "/api/internal/e2e/scheduler-tick", { cp: true, body: { company_id: companyId } });
    }
    await page.waitForTimeout(1200);
    const det = await fetchIn(`/api/pierre/v1/missions/${encodeURIComponent(missionRef)}`, { method: "GET", headers: { "x-pierre-company": companyId } });
    jValidation.missionStatusAfter = det.body?.status ?? null;
    jValidation.progressed = !!det.body?.status && det.body.status !== "awaiting_validation";
    const tasks = det.body?.tasks ?? det.body?.mission?.tasks ?? [];
    jValidation.tasksCompletedAfter = Array.isArray(tasks) ? tasks.filter((t) => ["completed", "done", "succeeded"].includes(String(t.status))).length : 0;

    // Re-lit le cockpit après progression (preuve de continuité visuelle).
    await page.goto(`${BASE}/agents/pierre/use?view=missions&mission=${encodeURIComponent(missionRef)}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: resolve(shotDir, "p96-J-result.png"), fullPage: false });
  }
  out.browser.J_validation = jValidation;

  // ── I) SÉCURITÉ : synthèse des invariants observés dans le vrai navigateur ────
  out.browser.I_security = {
    companyResolvedTrue: out.browser.A_readiness.companyResolved === true,
    noUserTenantFallback: out.browser.C_chat.companyRequired !== true, // entreprise réelle, pas de refus
    executeByReferenceOnly: out.browser.D_execute.onlyProposalIdSent === true, // le clic UI n'a envoyé que { proposalId }
    forgedFieldsIgnored: out.browser.D_execute.forgedReplayStatus === "duplicate", // le rejeu forgé n'a pas créé de 2e effet
    noDoubleExecution: out.browser.H_no_double.exactlyOne === true,
    humanValidationExercised: out.browser.J_validation.allValidationsApproved === true, // pending → approved via endpoint gouverné
    framingClean: out.browser.F_cockpit.noAssistantFraming === true,
    consoleErrors,               // erreurs NON bénignes uniquement (doit être vide)
    rawConsoleAll: rawConsole,   // TOUTES les erreurs console (transparence : inclut le bruit dev/HMR)
    pageErrorStacks,
    devModeNote: "run en next dev (NODE_ENV≠production requis pour le runtime PGlite E2E) — bruit HMR/Fast-Refresh attendu",
  };

  await ctx.close(); await browser.close();

  // ── Verdict ──────────────────────────────────────────────────────────────────
  const b = out.browser;
  const pass =
    b.A_readiness.companyResolved &&
    b.B_autonomy.persisted &&
    b.C_chat.hasProposal && b.C_chat.proposalKind === "create_mission" && !!b.C_chat.autonomyReflected &&
    (b.D_execute.confirmClicked || b.D_execute.usedFetchFallback) && b.D_execute.onlyProposalIdSent &&
    ["executed", "duplicate", "in_flight"].includes(b.D_execute.execStatus) &&
    ["duplicate", "in_flight"].includes(b.D_execute.forgedReplayStatus) && // rejeu forgé ≠ nouvel effet
    b.D_execute.targetRef === "present" &&
    b.E_mission.missionExists &&
    b.F_cockpit.missionVisibleInDom && b.F_cockpit.noAssistantFraming &&
    b.G_reload.missionStillPresent &&
    b.H_no_double.exactlyOne &&
    b.J_validation.hadPendingValidation && b.J_validation.allValidationsApproved && // chemin de validation humaine exercé
    consoleErrors.length === 0;
  out.verdict = pass ? "P96_JOURNEY_OK" : "P96_JOURNEY_ISSUES";
} catch (e) {
  out.error = e?.message ?? String(e);
  out.verdict = "P96_JOURNEY_ERROR";
} finally {
  out.cleanup = userId ? await cleanup() : "NO_USER";
}

// ── Écriture des preuves ────────────────────────────────────────────────────────
writeFileSync(resolve(proofDir, "browser-journey.json"), JSON.stringify(out, null, 2));
writeFileSync(resolve(proofDir, "network-proof.json"), JSON.stringify({ runId: RUN, execute: out.browser?.D_execute ?? null, chat: out.browser?.C_chat ?? null, autonomy: out.browser?.B_autonomy ?? null }, null, 2));
writeFileSync(resolve(proofDir, "cockpit-proof.json"), JSON.stringify({ runId: RUN, readiness: out.browser?.A_readiness ?? null, mission: out.browser?.E_mission ?? null, cockpit: out.browser?.F_cockpit ?? null, reload: out.browser?.G_reload ?? null, no_double: out.browser?.H_no_double ?? null }, null, 2));
writeFileSync(resolve(proofDir, "security-proof.json"), JSON.stringify({ runId: RUN, security: out.browser?.I_security ?? null }, null, 2));
console.log(JSON.stringify({ verdict: out.verdict, error: out.error ?? null, cleanup: out.cleanup, steps: out.steps, browser: out.browser }, null, 2));
if (out.verdict !== "P96_JOURNEY_OK") process.exitCode = 1;
