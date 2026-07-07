// scripts/p942-browser-auth.mjs
// P9.4.2 r2 §7 — BROWSER-AUTHENTIFIÉ honnête. Session Supabase RÉELLE : utilisateur éphémère
// (script autorisé + nettoyé) → connexion via le VRAI `signInWithPassword` (@supabase/ssr,
// côté Node qui atteint Supabase) → capture des cookies EXACTS que l'app utilise → injection
// dans un chromium ISOLÉ (n'affecte pas la session P8). Le serveur Next valide le VRAI JWT
// (getUser, même chemin d'auth qu'en production). L'utilisateur a l'accès Pierre mais AUCUNE
// entreprise réelle ⇒ CloneChat DOIT fail-closed (company_required, jamais de fausse entreprise,
// aucune action à effet). Prouve : auth navigateur réelle, état fail-closed, a11y, mobile 390/360,
// zéro erreur console inattendue, aucune injection client. Nettoie l'utilisateur (zéro résidu).
// Flag: P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes requis"); process.exit(1); }
function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const BASE = process.env.P942_BASE ?? "http://127.0.0.1:3222";
const RUN = process.env.P942_RUN ?? "p942-final";
const proofDir = resolve(process.cwd(), ".p942-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-4-2");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));
const host = new URL(BASE).hostname;

// 1) Utilisateur éphémère + accès Pierre (orders), comme les scripts autorisés existants.
const runId = "p942auth" + randomUUID().slice(0, 8).replace(/-/g, "");
const email = `p942-e2e-${runId}@example.invalid`;
const password = "Qa!" + randomBytes(18).toString("base64url");
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p942-browser-auth", run_id: runId } });
if (ue) { console.error("createUser:", ue.message); process.exit(2); }
const userId = u.user.id;
await admin.from("profiles").upsert({ id: userId, email, full_name: `p942-${runId}` }, { onConflict: "id" });
await admin.from("orders").upsert({ user_id: userId, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });

async function cleanup() {
  try { await admin.from("orders").delete().eq("user_id", userId); } catch { /* */ }
  try { await admin.from("profiles").delete().eq("id", userId); } catch { /* */ }
  try { await admin.auth.admin.deleteUser(userId); } catch { /* */ }
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE";
}

// 2) Connexion RÉELLE + capture des cookies EXACTS d'@supabase/ssr (mêmes que l'app).
const captured = [];
const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } },
});
const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
if (se || !si?.session) { console.error("signIn:", se?.message); console.log("cleanup:", await cleanup()); process.exit(3); }
// Cookies auth NON-httpOnly (le client navigateur @supabase/ssr les lit via document.cookie).
const pwCookies = captured.map((c) => ({
  name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/",
  httpOnly: false, secure: false, sameSite: "Lax",
  expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1,
}));

const report = { runId, userId, email, sessionMinted: !!si.session, cookieNames: captured.map((c) => c.name), viewports: {}, verdict: "PENDING" };

const browser = await chromium.launch();
try {
  for (const vp of [{ name: "auth-1280", width: 1280, height: 800 }, { name: "auth-mobile-390", width: 390, height: 844 }, { name: "auth-narrow-360", width: 360, height: 740 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    await ctx.addCookies(pwCookies);
    const page = await ctx.newPage();
    const consoleErrors = [];
    const chatResponses = [];
    const chatRequests = [];
    const executeBodies = [];
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("request", (r) => { if (r.url().includes("/api/assistant/chat") && r.method() === "POST") chatRequests.push(r.url()); if (r.url().includes("/api/assistant/execute") && r.method() === "POST") { try { executeBodies.push(JSON.parse(r.postData() ?? "{}")); } catch { /* */ } } });
    page.on("response", async (r) => { if (r.url().includes("/api/assistant/chat") && r.request().method() === "POST") { try { chatResponses.push({ status: r.status(), body: await r.json() }); } catch { /* */ } } });

    await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500); // laisse la détection de mode (session) + hydratation se stabiliser

    // Authentifié ? le client passe en mode opérationnel quand une session Supabase existe.
    const modeText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    const authenticated = /op[eé]rationnel|connect[eé]|votre entreprise/i.test(modeText);

    // Diagnostic composer (état) + tentative d'envoi UI.
    const composerState = await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      const btn = document.querySelector('button[aria-label="Envoyer"]');
      return { textarea: !!ta, textareaDisabled: ta ? ta.disabled : null, sendButton: !!btn, sendDisabled: btn ? btn.disabled : null };
    });
    const ta = await page.$("textarea");
    if (ta && composerState.textareaDisabled === false) {
      await ta.click();
      await page.keyboard.type("Bonjour Pierre, ou en sont mes missions ?", { delay: 8 });
      await page.waitForTimeout(200);
      const sendBtn = await page.$('button[aria-label="Envoyer"]');
      if (sendBtn) { try { await sendBtn.click({ timeout: 2000 }); } catch { await page.keyboard.press("Enter"); } }
      else await page.keyboard.press("Enter");
      await page.waitForTimeout(4000);
    }

    // Preuve AUTORITATIVE : une requête AUTHENTIFIÉE émise depuis le VRAI navigateur (cookie de
    // session réel) vers l'API. Le serveur Next valide le VRAI JWT (getUser) et résout le tenant :
    // sans entreprise réelle → fail-closed (company_required), jamais une fausse entreprise.
    const apiProbe = await page.evaluate(async () => {
      const post = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch { /* */ } return { status: r.status, body: j }; };
      const get = async (url) => { const r = await fetch(url, { credentials: "same-origin" }); let j = null; try { j = await r.json(); } catch { /* */ } return { status: r.status, body: j }; };
      return { chat: await post("/api/assistant/chat", { message: "Bonjour Pierre, ou en sont mes missions ?" }), conversations: await get("/api/assistant/conversations") };
    });

    const chat = chatResponses.map((x) => x.body).find((x) => x && (x.source || x.code)) ?? apiProbe.chat.body ?? null;
    const companyRequired = chat?.source === "company_required" || chat?.code === "MEMBERSHIP_REQUIRED" || chat?.code === "COMPANY_UNAVAILABLE";

    // Aucune action à effet proposée (pas d'entreprise) + aucun envoi execute avec payload client.
    const effectButtons = await page.$$eval("button", (bs) => bs.filter((b) => /confirmer|confier|annuler la mission|approuver|rejeter/i.test(b.textContent || "")).length);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    // a11y : focus clavier + boutons nommés.
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName ?? null, interactive: !!a && ["BUTTON", "A", "TEXTAREA", "INPUT", "SELECT"].includes(a.tagName) }; });
    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll("button, a[href], [role='button']")).filter((c) => !(c.getAttribute("aria-label") || c.getAttribute("title") || (c.textContent || "").trim() || c.getAttribute("aria-labelledby"))).length);

    await page.screenshot({ path: resolve(shotDir, `p942-${vp.name}.png`), fullPage: false });
    // Auth prouvée par le serveur : une requête non authentifiée renverrait 401 ; ici le serveur
    // a résolu l'identité (200 structuré company_required) ⇒ le JWT réel a été validé.
    const serverAuthValidated = apiProbe.chat.status === 200 && companyRequired;
    const pass = authenticated && serverAuthValidated && effectButtons === 0 && executeBodies.length === 0 && overflow && unnamed === 0 && consoleErrors.length === 0;
    report.viewports[vp.name] = { size: `${vp.width}x${vp.height}`, authenticated, serverAuthValidated, composerState, apiProbe: { chatStatus: apiProbe.chat.status, chatSource: apiProbe.chat.body?.source ?? apiProbe.chat.body?.code ?? null, conversationsStatus: apiProbe.conversations.status, conversationsSource: apiProbe.conversations.body?.source ?? apiProbe.conversations.body?.code ?? null }, chatRequestCount: chatRequests.length, chatSource: chat?.source ?? chat?.code ?? null, companyRequired, noFakeCompany: chat?.source !== "openai", effectfulButtons: effectButtons, clientExecuteCalls: executeBodies.length, noHorizontalOverflow: overflow, keyboardFocusInteractive: focus.interactive, unnamedControls: unnamed, consoleErrors, pass };
    await ctx.close();
  }
} finally {
  await browser.close();
}

report.cleanup = await cleanup();
report.verdict = Object.values(report.viewports).every((v) => v.pass) && report.cleanup.includes("ZERO RESIDUE") ? "BROWSER_AUTH_FAILCLOSED_OK" : "BROWSER_AUTH_ISSUES";
writeFileSync(resolve(proofDir, "browser-auth.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, cookieNames: report.cookieNames, cleanup: report.cleanup, viewports: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { pass: v.pass, authed: v.authenticated, serverAuthValidated: v.serverAuthValidated, apiChat: v.apiProbe.chatStatus + ":" + v.apiProbe.chatSource, composer: v.composerState, effectButtons: v.effectfulButtons, clientExec: v.clientExecuteCalls, console: v.consoleErrors.length }])) }, null, 2));
if (report.verdict !== "BROWSER_AUTH_FAILCLOSED_OK") process.exit(1);
