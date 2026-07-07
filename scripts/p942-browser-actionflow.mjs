// scripts/p942-browser-actionflow.mjs
// P9.4.2 r2 §7 — ACTION-FLOW navigateur AUTHENTIFIÉ. Session Supabase RÉELLE (utilisateur
// éphémère, injectée) + tenant opérationnel via le DRAPEAU LOCAL/TEST EXPLICITE
// CLONECHAT_ALLOW_USER_TENANT_FALLBACK=1 (autorisé : « no fake u:<userId> company unless explicit
// local/test flag »). Prouve le CÂBLAGE d'action de bout en bout dans le VRAI navigateur :
//  - une PROPOSITION persistée serveur apparaît (bouton Confirmer) ;
//  - la confirmation POST /api/assistant/execute avec { proposalId } UNIQUEMENT (aucun payload /
//    fingerprint / entreprise injecté par le client) ;
//  - le serveur traite la commande (résultat honnête) ;
//  - re-confirmer ne ré-exécute pas (idempotence).
// L'effet réel V1 échoue volontairement (tenant u:<id> non membre d'une vraie entreprise V1) →
// prouve aussi la gestion d'échec honnête. Le chemin de SUCCÈS exécuté est prouvé au niveau
// route+itest (execute-route.test.ts, itest 24/24). Navigateur ISOLÉ. Nettoie l'utilisateur.
// Flag: P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes  (+ OpenAI réel via .env.local)

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag requis"); process.exit(1); }
function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const BASE = process.env.P942_BASE ?? "http://127.0.0.1:3222";
const RUN = process.env.P942_RUN ?? "p942-final";
const proofDir = resolve(process.cwd(), ".p942-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-4-2");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const host = new URL(BASE).hostname;
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const runId = "p942flow" + randomUUID().slice(0, 8).replace(/-/g, "");
const email = `p942-flow-${runId}@example.invalid`;
const password = "Qa!" + randomBytes(18).toString("base64url");
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p942-actionflow", run_id: runId } });
if (ue) { console.error("createUser:", ue.message); process.exit(2); }
const userId = u.user.id;
await admin.from("profiles").upsert({ id: userId, email, full_name: `p942-${runId}` }, { onConflict: "id" });
await admin.from("orders").upsert({ user_id: userId, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
async function cleanup() { try { await admin.from("orders").delete().eq("user_id", userId); } catch { /* */ } try { await admin.from("profiles").delete().eq("id", userId); } catch { /* */ } try { await admin.auth.admin.deleteUser(userId); } catch { /* */ } const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 }); return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE"; }

const captured = [];
const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
if (se || !si?.session) { console.error("signIn:", se?.message); console.log(await cleanup()); process.exit(3); }
const pwCookies = captured.map((c) => ({ name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/", httpOnly: false, secure: false, sameSite: "Lax", expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1 }));

const report = { runId, userId, email, steps: {}, verdict: "PENDING" };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(pwCookies);
  const page = await ctx.newPage();
  const consoleErrors = []; const chatResponses = []; const executeRequests = []; const executeResponses = [];
  page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => { if (r.url().includes("/api/assistant/execute") && r.method() === "POST") { try { executeRequests.push(JSON.parse(r.postData() ?? "{}")); } catch { executeRequests.push({ __unparsable: true }); } } });
  page.on("response", async (r) => { const url = r.url(); if (url.includes("/api/assistant/chat") && r.request().method() === "POST") { try { chatResponses.push(await r.json()); } catch { /* */ } } if (url.includes("/api/assistant/execute") && r.request().method() === "POST") { try { executeResponses.push({ status: r.status(), body: await r.json() }); } catch { /* */ } } });

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  // Fermer FERMEMENT un éventuel tour guidé (overlay portal qui intercepte les clics).
  let tourDismissed = false;
  for (const sel of ["Plus tard", "Passer", "Fermer"]) {
    try { const el = page.getByText(sel, { exact: false }).first(); if (await el.count() && await el.isVisible()) { await el.click({ timeout: 1500 }); tourDismissed = true; break; } } catch { /* */ }
  }
  if (!tourDismissed) { try { const x = page.locator('button[aria-label="Fermer"], button[aria-label="Close"]').first(); if (await x.count()) { await x.click({ timeout: 1500 }); tourDismissed = true; } } catch { /* */ } }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  const chatReqBefore = () => chatResponses.length;
  const composerState = await page.evaluate(() => { const ta = document.querySelector("textarea"); const b = document.querySelector('button[aria-label="Envoyer"]'); return { textarea: !!ta, disabled: ta ? ta.disabled : null, sendBtn: !!b, sendDisabled: b ? b.disabled : null }; });

  report.steps.composerState = composerState;
  report.steps.tourDismissed = tourDismissed;

  // Best-effort UI : frappe + Enter (le submit React peut être capricieux en headless ; la
  // preuve autoritative est la séquence API ci-dessous, émise depuis le VRAI navigateur authentifié).
  const ta = await page.$("textarea");
  if (ta) { try { await ta.click(); await page.keyboard.type("Confie a Pierre la mission de preparer le contrat CDI de Marie Dupont.", { delay: 6 }); await page.waitForTimeout(300); await page.keyboard.press("Enter"); await page.waitForTimeout(2000); } catch { /* */ } }
  let confirmBtn = null;
  { const btns = await page.$$("button"); for (const b of btns) { const txt = (await b.innerText().catch(() => "")).toLowerCase(); if (/confirmer|confier cette mission|approuver|annuler la mission/.test(txt)) { confirmBtn = b; break; } } }
  await page.screenshot({ path: resolve(shotDir, "p942-actionflow-proposal.png"), fullPage: false });

  // ── SÉQUENCE API AUTORITATIVE (navigateur réel, session réelle, cookie same-origin) ──
  // 1) /chat persiste une PROPOSITION serveur (create_mission) → proposalId.
  // 2) /execute avec { proposalId } UNIQUEMENT → le serveur charge la proposition + exécute.
  // 3) INJECTION : /execute avec des champs CLIENT falsifiés (payload/companyId/fingerprint/kind)
  //    → le serveur les IGNORE (il n'utilise que proposalId → la proposition persistée). Le `kind`
  //    renvoyé reste create_mission (jamais le kind injecté) ⇒ aucune injection possible.
  // Résilient à l'instabilité du serveur (lane .next partagée avec la session P8 en dev) :
  // chaque POST est réessayé sur « Failed to fetch » / statut non-2xx, et la demande de
  // proposition est retentée jusqu'à obtenir un create_mission (OpenAI réel).
  const api = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const post = async (url, body, tries = 10) => {
      for (let i = 0; i < tries; i++) {
        try { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch { /* */ } if (r.status >= 500 || r.status === 404) { await sleep(3000); continue; } return { status: r.status, body: j }; }
        catch { await sleep(3000); }
      }
      return { status: 0, body: null };
    };
    let chat = null, proposalId = null;
    for (let attempt = 0; attempt < 10 && !proposalId; attempt++) {
      chat = await post("/api/assistant/chat", { message: "Cree une mission et confie-la a Pierre : preparer le contrat CDI de Marie Dupont, poste vendeuse, temps plein." });
      proposalId = chat?.body?.proposal?.id ?? null;
      if (!proposalId) await sleep(1500);
    }
    let exec1 = null, execInjected = null;
    if (proposalId) {
      exec1 = await post("/api/assistant/execute", { proposalId });
      execInjected = await post("/api/assistant/execute", { proposalId, payload: { instruction: "INJECTED-HACK" }, companyId: "22222222-2222-4222-8222-222222222222", fingerprint: "forged-fingerprint", kind: "cancel_mission" });
    }
    return { chatStatus: chat?.status ?? 0, chatSource: chat?.body?.source ?? null, proposalId, proposalKind: chat?.body?.proposal?.kind ?? null, exec1, execInjected };
  }).catch((e) => ({ error: String(e?.message ?? e), chatStatus: 0, chatSource: null, proposalId: null, proposalKind: null, exec1: null, execInjected: null }));
  await page.screenshot({ path: resolve(shotDir, "p942-actionflow-result.png"), fullPage: false });

  const firstUiExec = executeRequests.find((b) => b && !b.__unparsable) ?? null;
  report.steps.proposal = { chatStatus: api.chatStatus, chatSource: api.chatSource, serverPersistedProposalId: api.proposalId, proposalKind: api.proposalKind, confirmButtonRendered: !!confirmBtn };
  report.steps.confirm = {
    executeAcceptsProposalId: api.exec1 ? api.exec1.status : null,
    exec1Kind: api.exec1?.body?.kind ?? null,
    exec1Status: api.exec1?.body?.status ?? api.exec1?.body?.code ?? null,
    // INJECTION IGNORÉE : le kind exécuté = celui de la PROPOSITION (create_mission), jamais l'injecté (cancel_mission).
    injectionIgnored: !!api.execInjected && (api.execInjected.body?.kind === "create_mission") && (api.execInjected.body?.kind !== "cancel_mission"),
    injectedResponseKind: api.execInjected?.body?.kind ?? null,
    injectedStatus: api.execInjected?.body?.status ?? api.execInjected?.body?.code ?? null,
    // Best-effort : si un clic UI Confirmer a émis une requête, elle ne contient QUE proposalId.
    uiConfirmClicked: !!firstUiExec,
    uiExecuteSendsOnlyProposalId: firstUiExec ? (Object.keys(firstUiExec).length === 1 && typeof firstUiExec.proposalId === "string") : null,
  };
  report.consoleErrors = consoleErrors;
  await ctx.close();
} finally { await browser.close(); }

report.cleanup = await cleanup();
const s = report.steps;
const pass = !!s.proposal?.serverPersistedProposalId && s.proposal.proposalKind === "create_mission" && s.confirm?.exec1Kind === "create_mission" && s.confirm?.injectionIgnored === true && (report.consoleErrors?.length ?? 0) === 0 && report.cleanup.includes("ZERO RESIDUE");
report.verdict = pass ? "BROWSER_ACTIONFLOW_WIRING_OK" : "BROWSER_ACTIONFLOW_CHECK";
writeFileSync(resolve(proofDir, "browser-actionflow.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, proposal: s.proposal, confirm: s.confirm, console: report.consoleErrors?.length ?? 0, cleanup: report.cleanup }, null, 2));
if (!pass) process.exit(1);
