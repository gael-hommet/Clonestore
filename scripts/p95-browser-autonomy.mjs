// scripts/p95-browser-autonomy.mjs
// P9.5 — Preuve NAVIGATEUR de la surface d'autonomie de Pierre dans le cockpit. Session Supabase
// RÉELLE (utilisateur éphémère injecté). Navigue /agents/pierre/use?view=autonomy et vérifie :
//  - l'onglet « Autonomie » + le panneau se rendent ;
//  - le cadrage produit « Pierre — votre employé IA RH » (jamais « assistant ») ;
//  - les 5 modes d'autonomie (radiogroup accessible) ;
//  - la matrice « ce que Pierre fait seul / valide / réservé humain » (dérivée du moteur) ;
//  - accessibilité (radiogroup, boutons nommés, focus), pas de débordement, mobile 390 ;
//  - zéro erreur console inattendue.
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
const BASE = process.env.P95_BASE ?? "http://127.0.0.1:3242";
const RUN = process.env.P95_RUN ?? "p95-run1";
const proofDir = resolve(process.cwd(), ".p95-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-5");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const host = new URL(BASE).hostname;
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i, /Cross origin request/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const runId = "p95a" + randomUUID().slice(0, 8).replace(/-/g, "");
const email = `p95-${runId}@example.invalid`; const password = "Qa!" + randomBytes(18).toString("base64url");
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p95-autonomy", run_id: runId } });
if (ue) { console.error("createUser:", ue.message); process.exit(2); }
const userId = u.user.id;
await admin.from("profiles").upsert({ id: userId, email, full_name: `p95-${runId}` }, { onConflict: "id" });
await admin.from("orders").upsert({ user_id: userId, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
async function cleanup() { try { await admin.from("orders").delete().eq("user_id", userId); } catch { /* */ } try { await admin.from("profiles").delete().eq("id", userId); } catch { /* */ } try { await admin.auth.admin.deleteUser(userId); } catch { /* */ } const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 }); return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE"; }

const captured = [];
const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
if (se || !si?.session) { console.error("signIn:", se?.message); console.log(await cleanup()); process.exit(3); }
const pwCookies = captured.map((c) => ({ name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/", httpOnly: false, secure: false, sameSite: "Lax", expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1 }));

const report = { runId, email, viewports: {}, verdict: "PENDING" };
const browser = await chromium.launch();
try {
  for (const vp of [{ name: "desktop-1280", w: 1280, h: 900 }, { name: "mobile-390", w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: "reduce" });
    await ctx.addCookies(pwCookies);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

    // Preuve API : le point d'autonomie renvoie les 5 modes + matrice dérivée (depuis le vrai navigateur authentifié).
    await page.goto(`${BASE}/agents/pierre/use?view=autonomy`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    const api = await page.evaluate(async () => {
      try { const r = await fetch("/api/assistant/autonomy", { credentials: "same-origin" }); const j = await r.json(); return { status: r.status, modes: (j.modes ?? []).length, matrixEntries: (j.matrix?.entries ?? []).length, framing: j.framing?.headline ?? null, companyResolved: j.companyResolved ?? null, hasHardFloor: (j.matrix?.entries ?? []).some((e) => e.key === "termination" && e.bucket === "human_only") }; } catch (e) { return { error: String(e?.message ?? e) }; }
    });

    const dom = await page.evaluate(() => {
      const text = document.body.innerText;
      const radiogroup = document.querySelector('[role="radiogroup"]');
      const radios = Array.from(document.querySelectorAll('[role="radio"]'));
      const namedRadios = radios.filter((r) => (r.textContent || "").trim().length > 0).length;
      const controls = Array.from(document.querySelectorAll("button, a[href], [role='button'], [role='radio']"));
      const unnamed = controls.filter((c) => !(c.getAttribute("aria-label") || c.getAttribute("title") || (c.textContent || "").trim() || c.getAttribute("aria-labelledby"))).length;
      return {
        framingPresent: /employ[eé] IA RH|[eé]quipe RH op[eé]rationnelle/i.test(text),
        noAssistantFraming: !/assistant RH|copilote/i.test(text),
        autonomyNav: /Autonomie/.test(text),
        radiogroup: !!radiogroup, radioCount: radios.length, namedRadios,
        matrixMentions: /Pierre le fait seul|propose|R[eé]serv[eé] [aà] une d[eé]cision humaine|d[eé]cide/i.test(text),
        unnamedControls: unnamed,
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      };
    });
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => { const a = document.activeElement; return { interactive: !!a && ["BUTTON", "A", "TEXTAREA", "INPUT", "SELECT"].includes(a.tagName) || a?.getAttribute("role") === "radio" }; });
    await page.screenshot({ path: resolve(shotDir, `p95-autonomy-${vp.name}.png`), fullPage: false });

    const pass = api.status === 200 && api.modes === 5 && api.hasHardFloor && dom.framingPresent && dom.noAssistantFraming && dom.autonomyNav && dom.radiogroup && dom.radioCount === 5 && dom.namedRadios === 5 && dom.unnamedControls === 0 && dom.noHorizontalOverflow && consoleErrors.length === 0;
    report.viewports[vp.name] = { size: `${vp.w}x${vp.h}`, api, dom, keyboardFocusInteractive: focus.interactive, consoleErrors, pass };
    await ctx.close();
  }
} finally { await browser.close(); }

report.cleanup = await cleanup();
report.verdict = Object.values(report.viewports).every((v) => v.pass) && report.cleanup.includes("ZERO RESIDUE") ? "P95_AUTONOMY_UI_OK" : "P95_AUTONOMY_UI_CHECK";
writeFileSync(resolve(proofDir, "ui-proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, cleanup: report.cleanup, viewports: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { pass: v.pass, api: v.api, framing: v.dom.framingPresent, radios: v.dom.radioCount, unnamed: v.dom.unnamedControls, console: v.consoleErrors.length }])) }, null, 2));
if (report.verdict !== "P95_AUTONOMY_UI_OK") process.exit(1);
