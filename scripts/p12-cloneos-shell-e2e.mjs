// scripts/p12-cloneos-shell-e2e.mjs
// P12 §13.8 — Preuve navigateur de la console CloneOS. Session Supabase RÉELLE (client éphémère
// avec accès Pierre → passe le gate cockpit ; non-client → redirigé). Vérifie sur desktop 1280 /
// tablette 768 / mobile 390 : surfaces du shell, invariant no-page-scroll, pas de débordement
// horizontal, cadrage Pierre (employé IA RH, jamais assistant), CloneRoom (participants+composer),
// Mon CloneStore distinct, redirections. Nettoie les utilisateurs (zéro résidu).
// Flag: P12_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P12_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag P12_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes requis"); process.exit(1); }
function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const BASE = process.env.P12_BASE ?? "http://127.0.0.1:3272";
const proofDir = resolve(process.cwd(), ".p12-proofs", "p12-run1");
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p12");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const host = new URL(BASE).hostname;
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i, /\[Fast Refresh\]/i, /Invalid or unexpected token/i, /Unexpected end of JSON input/i, /hydrat/i, /webpack/i, /__next/i, /ResizeObserver/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const out = { runId: "p12-run1", base: BASE, surfaces: {}, redirects: {}, verdict: "PENDING" };
const users = [];
async function mkUser(withOrder) {
  const runId = "p12" + randomUUID().slice(0, 8).replace(/-/g, "");
  const email = `p12-e2e-${runId}@example.invalid`;
  const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p12-shell-e2e", run_id: runId } });
  if (error) throw new Error("createUser: " + error.message);
  const id = u.user.id; users.push(id);
  await admin.from("profiles").upsert({ id, email, full_name: `p12-${runId}` }, { onConflict: "id" });
  if (withOrder) await admin.from("orders").upsert({ user_id: id, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
  const captured = [];
  const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
  const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
  if (se || !si?.session) throw new Error("signIn: " + (se?.message ?? "no session"));
  const cookies = captured.map((c) => ({ name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/", httpOnly: false, secure: false, sameSite: "Lax", expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1 }));
  return { id, cookies };
}
async function cleanup() {
  for (const id of users) { try { await admin.from("orders").delete().eq("user_id", id); } catch {} try { await admin.from("profiles").delete().eq("id", id); } catch {} try { await admin.auth.admin.deleteUser(id); } catch {} }
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return (data?.users ?? []).some((x) => users.includes(x.id)) ? "RESIDUE" : "DELETED — ZERO RESIDUE";
}

try {
  const client = await mkUser(true);
  const nonClient = await mkUser(false);

  const browser = await chromium.launch();
  const consoleErrors = [];

  // ── Surfaces sur 3 viewports ─────────────────────────────────────────────────
  for (const vp of [{ n: "desktop-1280", w: 1280, h: 900 }, { n: "tablet-768", w: 768, h: 1024 }, { n: "mobile-390", w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: "reduce" });
    await ctx.addCookies(client.cookies);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(`[${vp.n}] ${m.text()}`); });
    page.on("pageerror", (e) => { if (!isBenign(e.message)) consoleErrors.push(`[${vp.n}] pageerror: ${e.message}`); });

    // /cockpit — Global Cockpit
    await page.goto(`${BASE}/cockpit`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-cloneos-shell]", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const cockpit = await page.evaluate(() => {
      const seen = (s) => !!document.querySelector(s);
      const shown = (s) => { const el = document.querySelector(s); if (!el) return false; const st = getComputedStyle(el); return st.display !== "none" && st.visibility !== "hidden" && el.getBoundingClientRect().width > 0; };
      window.scrollTo(0, 5000); const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 2; window.scrollTo(0, 0);
      return {
        cosRoot: !!document.querySelector("[data-cloneos-shell]"),
        noPageScroll: !scrolled, // la PAGE ne défile pas (seuls les panneaux internes défilent)
        noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        topbar: seen("[data-testid='cos-topbar']"),
        cloneosTitle: (document.querySelector("[data-testid='cloneos-title']")?.textContent ?? "").trim(),
        composer: seen("[data-testid='cloneos-composer']"),
        suggested: seen("[data-testid='cloneos-suggested']"),
        railShown: shown("[data-testid='cos-rail']"),
        contextShown: shown("[data-testid='cos-context']"),
        bottomNavShown: shown("[data-testid='cos-bottomnav']"),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `p12-cockpit-${vp.n}.png`), fullPage: false });

    // /cockpit/room — CloneRoom
    await page.goto(`${BASE}/cockpit/room`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='cloneroom-console']", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const room = await page.evaluate(() => {
      window.scrollTo(0, 5000); const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 2; window.scrollTo(0, 0);
      return {
        cosRoot: !!document.querySelector("[data-cloneos-shell]"),
        noPageScroll: !scrolled,
        noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        participants: document.querySelectorAll("[data-testid='cloneroom-participants'] [data-participant]").length,
        composer: !!document.querySelector("[data-testid='cloneroom-composer']"),
        thread: !!document.querySelector("[data-testid='cloneroom-thread']"),
        // le footer public NE fuit PAS dans la console (sinon il chevauche/intercepte la zone de travail)
        noPublicFooter: !document.querySelector(".cs-footer"),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `p12-room-${vp.n}.png`), fullPage: false });

    // /cockpit/pierre — Pierre Cockpit
    await page.goto(`${BASE}/cockpit/pierre`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='pierre-cockpit-console']", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const pierre = await page.evaluate(() => {
      window.scrollTo(0, 5000); const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 2; window.scrollTo(0, 0);
      return {
        cosRoot: !!document.querySelector("[data-cloneos-shell]"),
        noPageScroll: !scrolled,
        noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        framing: (document.querySelector("[data-testid='pierre-framing']")?.textContent ?? "").trim(),
        noAssistantFraming: !/assistant\s+rh|copilote|chatbot/i.test(document.body.innerText.toLowerCase()),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `p12-pierre-${vp.n}.png`), fullPage: false });

    // /mon-clonestore — distinct admin (may scroll; not a cos-root)
    await page.goto(`${BASE}/mon-clonestore`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='mon-clonestore-shell']", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const mon = await page.evaluate(() => ({
      shell: !!document.querySelector("[data-testid='mon-clonestore-shell']"),
      openCockpit: !!document.querySelector("[data-testid='mon-clonestore-open-cockpit']"),
      sections: document.querySelectorAll("[data-testid='mon-clonestore-sections'] [data-section]").length,
      isCosRoot: !!document.querySelector("[data-cloneos-shell]"),
      noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }));
    await page.screenshot({ path: resolve(shotDir, `p12-monclonestore-${vp.n}.png`), fullPage: false });

    out.surfaces[vp.n] = { size: `${vp.w}x${vp.h}`, cockpit, room, pierre, mon };
    await ctx.close();
  }

  // ── Redirections (gate) ──────────────────────────────────────────────────────
  // non-client connecté → /cockpit : middleware laisse passer (session) puis le garde client
  // route vers l'achat (/agents/pierre).
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(nonClient.cookies);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/cockpit`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/agents\/pierre/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    out.redirects.nonClient = { finalUrl: new URL(page.url()).pathname };
    await ctx.close();
  }
  // visiteur non connecté → /cockpit : middleware redirige (307) vers /login.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/cockpit`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/(login|)$/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    out.redirects.visitor = { finalUrl: new URL(page.url()).pathname };
    await ctx.close();
  }

  // ── Extraction d'action RÉELLE (CloneRoom → composer RÉEL de Pierre) ──────────
  // Prouve que le contenu du message est réellement transporté (pas une route statique) :
  // (A) /cockpit/pierre/missions?compose=<texte> ouvre le composer pré-rempli avec <texte>.
  // (B) Dans CloneRoom, un message → « Créer une mission RH » navigue avec ?compose=<message>.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(client.cookies);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(`[extraction] ${m.text()}`); });
    page.on("pageerror", (e) => { if (!isBenign(e.message)) consoleErrors.push(`[extraction] pageerror: ${e.message}`); });

    out.extraction = { directSeed: { ok: false }, cloneRoomFlow: { ok: false } };

    // (A) seed direct : /cockpit/pierre/missions?compose=<texte> → composer RÉEL pré-rempli
    try {
      const probeA = "Prépare le contrat CDI de Probe-" + randomUUID().slice(0, 6);
      await page.goto(`${BASE}/cockpit/pierre/missions?compose=${encodeURIComponent(probeA)}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[role='dialog'] textarea", { timeout: 20000 });
      await page.waitForFunction((p) => document.querySelector("[role='dialog'] textarea")?.value === p, probeA, { timeout: 8000 }).catch(() => {});
      const seededValue = await page.evaluate(() => document.querySelector("[role='dialog'] textarea")?.value ?? "");
      out.extraction.directSeed = { probe: probeA, composerValue: seededValue, ok: seededValue === probeA };
    } catch (e) { out.extraction.directSeed = { ok: false, error: e?.message ?? String(e) }; }

    // (B) flux CloneRoom : écrire un message → « Créer une mission RH » → composer pré-rempli du message
    try {
      const probeB = "Recrutement urgent Probe-" + randomUUID().slice(0, 6);
      await page.goto(`${BASE}/cockpit/room`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const composer = page.locator("[data-testid='cloneroom-composer'] textarea");
      await composer.waitFor({ timeout: 20000 });
      const submit = page.locator("[data-testid='cloneroom-composer'] button[type='submit']");
      // La frappe doit attendre l'hydratation React (sinon onChange n'est pas encore branché →
      // draft reste vide → bouton désactivé). On retape jusqu'à ce que le bouton s'active.
      let enabled = false;
      for (let k = 0; k < 6 && !enabled; k++) {
        await composer.click();
        await composer.fill("");
        await composer.pressSequentially(probeB, { delay: 12 });
        enabled = await submit.isEnabled().catch(() => false);
        if (!enabled) await page.waitForTimeout(700);
      }
      await submit.click({ timeout: 15000 });
      await page.waitForTimeout(400);
      await page.click("[data-testid='cloneroom-create-mission']");
      await page.waitForURL(/\/cockpit\/pierre\/missions\?compose=/, { timeout: 15000 });
      const roomComposeParam = new URL(page.url()).searchParams.get("compose") ?? "";
      await page.waitForSelector("[role='dialog'] textarea", { timeout: 20000 });
      await page.waitForFunction((p) => document.querySelector("[role='dialog'] textarea")?.value === p, probeB, { timeout: 8000 }).catch(() => {});
      const roomSeededValue = await page.evaluate(() => document.querySelector("[role='dialog'] textarea")?.value ?? "");
      out.extraction.cloneRoomFlow = { probe: probeB, composeParam: roomComposeParam, composerValue: roomSeededValue, ok: roomComposeParam === probeB && roomSeededValue === probeB };
    } catch (e) { out.extraction.cloneRoomFlow = { ok: false, error: e?.message ?? String(e) }; }

    await ctx.close();
  }

  await browser.close();
  out.consoleErrors = consoleErrors;

  // ── Verdict ───────────────────────────────────────────────────────────────────
  const d = out.surfaces["desktop-1280"], t = out.surfaces["tablet-768"], m = out.surfaces["mobile-390"];
  const pass =
    // desktop: 3-pane console, CloneOS first screen, no scroll/overflow
    d.cockpit.cosRoot && d.cockpit.topbar && d.cockpit.cloneosTitle === "CloneOS" && d.cockpit.composer && d.cockpit.suggested &&
    d.cockpit.railShown && d.cockpit.contextShown && d.cockpit.noPageScroll && d.cockpit.noHOverflow &&
    // tablet: rail (icon) shown, context pane not inline (drawer)
    t.cockpit.railShown && !t.cockpit.contextShown && t.cockpit.noPageScroll && t.cockpit.noHOverflow &&
    // mobile: bottom nav shown, rail/context hidden, composer reachable, no overflow
    m.cockpit.bottomNavShown && !m.cockpit.railShown && m.cockpit.composer && m.cockpit.noPageScroll && m.cockpit.noHOverflow &&
    // CloneRoom: participants + composer (desktop), internal thread, no public footer leak
    d.room.participants >= 4 && d.room.composer && d.room.thread && d.room.noPageScroll && m.room.noHOverflow &&
    d.room.noPublicFooter && m.room.noPublicFooter &&
    // Pierre: framed employé IA RH, never assistant
    d.pierre.framing === "Employé IA RH" && d.pierre.noAssistantFraming && m.pierre.noAssistantFraming && d.pierre.noPageScroll &&
    // Mon CloneStore distinct (not a cos-root console) + sections + open-cockpit link, no overflow
    d.mon.shell && d.mon.openCockpit && d.mon.sections >= 8 && !d.mon.isCosRoot && d.mon.noHOverflow && m.mon.noHOverflow &&
    // redirects
    out.redirects.nonClient.finalUrl === "/agents/pierre" &&
    (out.redirects.visitor.finalUrl === "/" || out.redirects.visitor.finalUrl === "/login") &&
    // action extraction is REAL: message content reaches Pierre's real composer (not a static route)
    out.extraction?.directSeed?.ok === true && out.extraction?.cloneRoomFlow?.ok === true &&
    consoleErrors.length === 0;
  out.pass = pass;
  out.verdict = pass ? "P12_SHELL_OK" : "P12_SHELL_ISSUES";
} catch (e) {
  out.error = e?.message ?? String(e);
  out.verdict = "P12_SHELL_ERROR";
} finally {
  out.cleanup = await cleanup();
}

writeFileSync(resolve(proofDir, "browser-shell.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ verdict: out.verdict, error: out.error ?? null, cleanup: out.cleanup, redirects: out.redirects, consoleErrors: out.consoleErrors, surfaces: out.surfaces }, null, 2));
if (out.verdict !== "P12_SHELL_OK") process.exitCode = 1;
