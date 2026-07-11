// scripts/p942-browser-actionflow-success.mjs
// P9.4.2 r2 §7 — ACTION-FLOW SUCCÈS en LIVE BROWSER. Session Supabase RÉELLE (utilisateur
// éphémère injecté) + tenant opérationnel via le drapeau LOCAL/TEST explicite
// CLONECHAT_ALLOW_USER_TENANT_FALLBACK=1. On pilote une action `create_support_case` : son
// EFFET est le store de support DURABLE (pas V1) → il RÉUSSIT réellement sous ce tenant, ce qui
// permet de prouver le flux COMPLET :
//   proposition serveur apparaît → confirmation envoie { proposalId } UNIQUEMENT →
//   /api/assistant/execute EXÉCUTE (SUCCÈS) → résultat rendu → RE-confirmer renvoie le
//   résultat EXISTANT (idempotent) → une injection de champs client est IGNORÉE.
// Preuve autoritative = séquence API depuis le VRAI navigateur authentifié ; le clic UI
// « Confirmer » est capturé en best-effort pour observer que le client n'envoie que proposalId.
// Serveur bâti/servi depuis un distDir ISOLÉ (aucun partage de .next avec la session P8).
// Flag: P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

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

const runId = "p942ok" + randomUUID().slice(0, 8).replace(/-/g, "");
const email = `p942-ok-${runId}@example.invalid`;
const password = "Qa!" + randomBytes(18).toString("base64url");
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p942-actionflow-success", run_id: runId } });
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
  const consoleErrors = []; const uiExecuteRequests = [];
  page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => { if (r.url().includes("/api/assistant/execute") && r.method() === "POST") { try { uiExecuteRequests.push(JSON.parse(r.postData() ?? "{}")); } catch { uiExecuteRequests.push({ __unparsable: true }); } } });

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  // Fermer le tour guidé.
  for (const sel of ["Plus tard", "Passer"]) { try { const el = page.getByText(sel, { exact: false }).first(); if (await el.count() && await el.isVisible()) { await el.click({ timeout: 1500 }); break; } } catch { /* */ } }
  await page.waitForTimeout(500);

  // ── Séquence API AUTORITATIVE (navigateur réel, session réelle) ──
  const api = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const post = async (url, body, tries = 8) => { for (let i = 0; i < tries; i++) { try { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch { /* */ } if (r.status >= 500 || r.status === 404) { await sleep(2000); continue; } return { status: r.status, body: j }; } catch { await sleep(2000); } } return { status: 0, body: null }; };
    let chat = null, proposalId = null;
    for (let a = 0; a < 8 && !proposalId; a++) { chat = await post("/api/assistant/chat", { message: "J'ai un bug: le bouton d'export des salaries ne repond pas et le message ne part pas. Ouvre un cas de support s'il te plait." }); proposalId = chat?.body?.proposal?.id ?? null; if (!proposalId) await sleep(1200); }
    let exec1 = null, execDup = null, execInjected = null;
    if (proposalId) {
      exec1 = await post("/api/assistant/execute", { proposalId });                       // SUCCÈS
      execDup = await post("/api/assistant/execute", { proposalId });                      // DOUBLON → résultat existant
      execInjected = await post("/api/assistant/execute", { proposalId, payload: { summary: "INJECTED-HACK" }, companyId: "22222222-2222-4222-8222-222222222222", fingerprint: "forged-fp", kind: "cancel_mission" }); // injection ignorée
    }
    return { chatStatus: chat?.status ?? 0, chatSource: chat?.body?.source ?? null, proposalId, proposalKind: chat?.body?.proposal?.kind ?? null, exec1, execDup, execInjected };
  }).catch((e) => ({ error: String(e?.message ?? e), chatStatus: 0, proposalId: null }));

  // ── Best-effort UI : la proposition rend un bouton Confirmer → clic → observer le corps envoyé ──
  let uiConfirmClicked = false, confirmButtonRendered = false;
  try {
    const btns = await page.$$("button");
    for (const b of btns) { const txt = (await b.innerText().catch(() => "")).toLowerCase(); if (/confirmer|ouvrir un cas|confier|approuver/.test(txt)) { confirmButtonRendered = true; await b.click({ timeout: 2000 }).catch(() => {}); uiConfirmClicked = true; await page.waitForTimeout(3000); break; } }
  } catch { /* */ }
  await page.screenshot({ path: resolve(shotDir, "p942-actionflow-success.png"), fullPage: false });

  const firstUiExec = uiExecuteRequests.find((b) => b && !b.__unparsable) ?? null;
  report.steps = {
    proposal: { chatStatus: api.chatStatus, chatSource: api.chatSource, serverPersistedProposalId: api.proposalId, proposalKind: api.proposalKind, confirmButtonRendered },
    execute: {
      exec1Status: api.exec1?.body?.status ?? null, exec1Kind: api.exec1?.body?.kind ?? null, exec1TargetRef: api.exec1?.body?.targetRef ?? null, exec1Href: api.exec1?.body?.href ?? null,
      duplicateStatus: api.execDup?.body?.status ?? null, duplicateTargetRef: api.execDup?.body?.targetRef ?? null,
      duplicateReturnsSameResult: !!api.exec1?.body?.targetRef && api.exec1?.body?.targetRef === api.execDup?.body?.targetRef && api.execDup?.body?.status === "duplicate",
      injectionIgnoredKind: api.execInjected?.body?.kind ?? null,
      injectionIgnored: api.execInjected?.body?.kind === "create_support_case" && api.execInjected?.body?.kind !== "cancel_mission",
    },
    ui: { confirmClicked: uiConfirmClicked, executeRequestBodies: uiExecuteRequests, uiSendsOnlyProposalId: firstUiExec ? (Object.keys(firstUiExec).length === 1 && typeof firstUiExec.proposalId === "string") : null },
    consoleErrors,
  };
  await ctx.close();
} finally { await browser.close(); }

report.cleanup = await cleanup();
const s = report.steps;
const pass = s.proposal?.serverPersistedProposalId && s.proposal.proposalKind === "create_support_case"
  && s.execute?.exec1Status === "executed" && typeof s.execute.exec1TargetRef === "string"
  && s.execute.duplicateReturnsSameResult === true && s.execute.injectionIgnored === true
  && (s.consoleErrors?.length ?? 0) === 0 && report.cleanup.includes("ZERO RESIDUE");
report.verdict = pass ? "BROWSER_ACTIONFLOW_SUCCESS_OK" : "BROWSER_ACTIONFLOW_CHECK";
writeFileSync(resolve(proofDir, "browser-actionflow-success.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, proposal: s.proposal, execute: s.execute, ui: { confirmClicked: s.ui?.confirmClicked, uiSendsOnlyProposalId: s.ui?.uiSendsOnlyProposalId, bodies: s.ui?.executeRequestBodies }, console: s.consoleErrors?.length ?? 0, cleanup: report.cleanup }, null, 2));
if (!pass) process.exit(1);
