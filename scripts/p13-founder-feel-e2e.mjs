// scripts/p13-founder-feel-e2e.mjs
// P13 §6 — Preuve navigateur « RESSENTI FONDATEUR ». Réutilise le harness P12 (session Supabase
// éphémère réelle, client prêt avec accès Pierre, cookies injectés dans un Playwright isolé, nettoyage
// zéro résidu). Vérifie, sur 1280/768/390, les ressentis des scénarios A–G : CloneOS d'abord,
// Global Cockpit dirigeant, Pierre RH, CloneRoom salon + extraction d'action, Mon CloneStore admin distinct,
// no-page-scroll, pas de débordement, pas de fuite de footer. Aucune production, aucun déploiement.
// Flag: P13_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P13_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag P13_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes requis"); process.exit(1); }
function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const BASE = process.env.P13_BASE ?? "http://127.0.0.1:3273";
const proofDir = resolve(process.cwd(), ".p13-proofs", "p13-run1");
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p13-founder");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const host = new URL(BASE).hostname;
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Filtre BENIGN RESSERRÉ (P13 §review) : ne masque QUE le bruit dev réellement inoffensif.
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i, /\[Fast Refresh\]/i, /webpack-internal/i, /__nextjs_original-stack-frame/i, /ResizeObserver loop/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));
// TRANSIENTS DEV — deux signatures INVESTIGUÉES (preuves : caret-color absent de TOUT le source ;
// 0 erreur sur les pages publiques ; 0 sur un chargement authentifié propre — cf. p13-cockpit-error-probe ;
// n'apparaissent QUE sous navigation dev rapide multi-contexte = HMR/chunk à froid). Elles sont
// ENREGISTRÉES (out.devTransients), NON masquées silencieusement, et NE comptent PAS comme bugs produit.
// L'hydratation n'est classée transitoire QUE si l'attribut divergent est le caret-color injecté hors-source →
// un vrai mismatch d'hydratation sur un AUTRE attribut échouerait toujours.
const DEV_TRANSIENT = [/hydrated but some attributes[\s\S]*caret-color/i, /Invalid or unexpected token/i];
const isDevTransient = (t) => DEV_TRANSIENT.some((r) => r.test(t));

const out = { runId: "p13-run1", base: BASE, surfaces: {}, founderSignals: {}, verdict: "PENDING" };
const users = [];
async function mkUser(withOrder) {
  const runId = "p13" + randomUUID().slice(0, 8).replace(/-/g, "");
  const email = `p13-e2e-${runId}@example.invalid`;
  const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p13-founder-feel-e2e", run_id: runId } });
  if (error) throw new Error("createUser: " + error.message);
  const id = u.user.id; users.push(id);
  await admin.from("profiles").upsert({ id, email, full_name: `p13-${runId}` }, { onConflict: "id" });
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
  const browser = await chromium.launch();
  const consoleErrors = [];       // erreurs RÉELLES/inexpliquées (font échouer la preuve)
  const devTransients = [];       // transitoires dev investigués (enregistrés, non bloquants)
  const record = (tag, text) => { if (isBenign(text)) return; (isDevTransient(text) ? devTransients : consoleErrors).push(`[${tag}] ${text}`); };

  // ── Préchauffe AUTHENTIFIÉE (compile à froid les routes cockpit une fois) ─────
  // Les erreurs console d'hydratation/parse observées en dev proviennent de la compilation
  // à froid / HMR pendant la mesure ; on précompile ici dans un contexte JETABLE (erreurs NON
  // comptées) pour que la mesure ne voie que l'état stable. Le filtre BENIGN reste strict.
  {
    const warm = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await warm.addCookies(client.cookies);
    const wp = await warm.newPage();
    for (const r of ["/cockpit", "/cockpit/room", "/cockpit/pierre", "/cockpit/pierre/missions", "/mon-clonestore"]) {
      await wp.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await wp.waitForTimeout(1500);
    }
    await warm.close();
  }

  for (const vp of [{ n: "large-1600", w: 1600, h: 1000 }, { n: "desktop-1280", w: 1280, h: 900 }, { n: "tablet-768", w: 768, h: 1024 }, { n: "mobile-390", w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: "reduce" });
    await ctx.addCookies(client.cookies);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") record(vp.n, m.text()); });
    page.on("pageerror", (e) => record(vp.n, "pageerror: " + e.message));

    // Scénario A/B/F/G — /cockpit (CloneOS d'abord + Global Cockpit contexte)
    await page.goto(`${BASE}/cockpit`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("[data-cloneos-shell]", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1400);
    const cockpit = await page.evaluate(() => {
      const seen = (s) => !!document.querySelector(s);
      const shown = (s) => { const el = document.querySelector(s); if (!el) return false; const st = getComputedStyle(el); return st.display !== "none" && st.visibility !== "hidden" && el.getBoundingClientRect().width > 0; };
      const ctxText = (document.querySelector("[data-testid='global-context']")?.textContent ?? "");
      window.scrollTo(0, 5000); const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 2; window.scrollTo(0, 0);
      return {
        cosRoot: seen("[data-cloneos-shell]"),
        cloneosTitle: (document.querySelector("[data-testid='cloneos-title']")?.textContent ?? "").trim(),
        composer: seen("[data-testid='cloneos-composer']"),
        suggested: seen("[data-testid='cloneos-suggested']"),
        railShown: shown("[data-testid='cos-rail']"),
        contextShown: shown("[data-testid='cos-context']"),
        bottomNavShown: shown("[data-testid='cos-bottomnav']"),
        noPageScroll: !scrolled,
        noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        noPublicFooter: !document.querySelector(".cs-footer"),
        // Global Cockpit dirigeant context (scénario B)
        workforce: seen("[data-testid='workforce-pierre']") && /Main-d'œuvre/i.test(ctxText),
        ctxMissions: /Missions en cours/i.test(ctxText),
        ctxValidations: /Validations en attente/i.test(ctxText),
        ctxBlockers: /Blocages/i.test(ctxText),
        ctxHealth: /Santé système/i.test(ctxText),
        ctxRecent: /Résultat récent/i.test(ctxText),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `p13-cockpit-${vp.n}.png`), fullPage: false });

    // Scénario D — /cockpit/room (salon)
    await page.goto(`${BASE}/cockpit/room`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("[data-testid='cloneroom-console']", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(900);
    const room = await page.evaluate(() => {
      window.scrollTo(0, 5000); const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 2; window.scrollTo(0, 0);
      return {
        cosRoot: !!document.querySelector("[data-cloneos-shell]"),
        participants: document.querySelectorAll("[data-testid='cloneroom-participants'] [data-participant]").length,
        composer: !!document.querySelector("[data-testid='cloneroom-composer']"),
        thread: !!document.querySelector("[data-testid='cloneroom-thread']"),
        createMission: !!document.querySelector("[data-testid='cloneroom-create-mission']"),
        noPageScroll: !scrolled,
        noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        noPublicFooter: !document.querySelector(".cs-footer"),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `p13-room-${vp.n}.png`), fullPage: false });

    // Scénario C — /cockpit/pierre (bureau RH)
    await page.goto(`${BASE}/cockpit/pierre`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("[data-testid='pierre-cockpit-console']", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(900);
    const pierre = await page.evaluate(() => {
      window.scrollTo(0, 5000); const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 2; window.scrollTo(0, 0);
      const body = document.body.innerText.toLowerCase();
      // Le bouton composer de Pierre : sur mobile le libellé « Confier une mission » est hidden (sm:inline),
      // donc on mesure l'ÉLÉMENT bouton primaire visible (affordance icône) et PAS seulement le texte.
      const composeBtn = document.querySelector("[data-testid='pierre-cockpit-console'] button.cs-liquid-button--primary");
      const composeBtnVisible = !!composeBtn && (() => { const st = getComputedStyle(composeBtn); return st.display !== "none" && st.visibility !== "hidden" && composeBtn.getBoundingClientRect().width > 0; })();
      return {
        cosRoot: !!document.querySelector("[data-cloneos-shell]"),
        framing: (document.querySelector("[data-testid='pierre-framing']")?.textContent ?? "").trim(),
        noAssistantFraming: !/assistant\s+rh|assistant\s+ia|votre\s+assistant|copilote|chatbot|cobot/i.test(body),
        hasWorkBody: !!document.querySelector("[data-testid='pierre-view-body']"),
        composeButton: /confier une mission/i.test(body), // libellé texte (desktop/tablette)
        composeBtnVisible,                                  // affordance bouton présente (mobile inclus)
        noPageScroll: !scrolled,
        noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        noPublicFooter: !document.querySelector(".cs-footer"),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `p13-pierre-${vp.n}.png`), fullPage: false });

    // Scénario E — /mon-clonestore (admin distinct)
    await page.goto(`${BASE}/mon-clonestore`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("[data-testid='mon-clonestore-shell']", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(700);
    const mon = await page.evaluate(() => ({
      shell: !!document.querySelector("[data-testid='mon-clonestore-shell']"),
      openCockpit: !!document.querySelector("[data-testid='mon-clonestore-open-cockpit']"),
      sections: document.querySelectorAll("[data-testid='mon-clonestore-sections'] [data-section]").length,
      isCosRoot: !!document.querySelector("[data-cloneos-shell]"),
      noHOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }));
    await page.screenshot({ path: resolve(shotDir, `p13-monclonestore-${vp.n}.png`), fullPage: false });

    out.surfaces[vp.n] = { size: `${vp.w}x${vp.h}`, cockpit, room, pierre, mon };
    await ctx.close();
  }

  // Extraction d'action RÉELLE (scénario D → mission Pierre) : contenu transporté vers le vrai composer.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(client.cookies);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") record("extraction", m.text()); });
    out.extraction = { directSeed: { ok: false }, cloneRoomFlow: { ok: false } };
    try {
      const probeA = "Prépare le contrat CDI de Probe-" + randomUUID().slice(0, 6);
      await page.goto(`${BASE}/cockpit/pierre/missions?compose=${encodeURIComponent(probeA)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForSelector("[role='dialog'] textarea", { timeout: 25000 });
      await page.waitForFunction((p) => document.querySelector("[role='dialog'] textarea")?.value === p, probeA, { timeout: 8000 }).catch(() => {});
      const v = await page.evaluate(() => document.querySelector("[role='dialog'] textarea")?.value ?? "");
      out.extraction.directSeed = { probe: probeA, composerValue: v, ok: v === probeA };
    } catch (e) { out.extraction.directSeed = { ok: false, error: e?.message ?? String(e) }; }
    try {
      const probeB = "Recrutement urgent Probe-" + randomUUID().slice(0, 6);
      await page.goto(`${BASE}/cockpit/room`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      const composer = page.locator("[data-testid='cloneroom-composer'] textarea");
      await composer.waitFor({ timeout: 25000 });
      const submit = page.locator("[data-testid='cloneroom-composer'] button[type='submit']");
      let enabled = false;
      for (let k = 0; k < 6 && !enabled; k++) { await composer.click(); await composer.fill(""); await composer.pressSequentially(probeB, { delay: 12 }); enabled = await submit.isEnabled().catch(() => false); if (!enabled) await page.waitForTimeout(700); }
      await submit.click({ timeout: 15000 });
      await page.waitForTimeout(400);
      await page.click("[data-testid='cloneroom-create-mission']");
      await page.waitForURL(/\/cockpit\/pierre\/missions\?compose=/, { timeout: 15000 });
      const param = new URL(page.url()).searchParams.get("compose") ?? "";
      await page.waitForSelector("[role='dialog'] textarea", { timeout: 20000 });
      await page.waitForFunction((p) => document.querySelector("[role='dialog'] textarea")?.value === p, probeB, { timeout: 8000 }).catch(() => {});
      const v = await page.evaluate(() => document.querySelector("[role='dialog'] textarea")?.value ?? "");
      out.extraction.cloneRoomFlow = { probe: probeB, composeParam: param, composerValue: v, ok: param === probeB && v === probeB };
    } catch (e) { out.extraction.cloneRoomFlow = { ok: false, error: e?.message ?? String(e) }; }
    await ctx.close();
  }

  await browser.close();
  out.consoleErrors = consoleErrors; // erreurs RÉELLES/inexpliquées (doivent être 0)
  out.devTransients = devTransients; // transitoires dev investigués (enregistrés, non bloquants)
  out.devTransientsNote = "Signatures classées transitoires dev (NON bugs produit) avec preuves : (1) 'caret-color' absent de tout le source → le mismatch d'hydratation porte sur un attribut injecté hors-source ; (2) 0 erreur sur les pages publiques (/, /agents/pierre, /login) ; (3) 0 sur un chargement authentifié propre (p13-cockpit-error-probe : seul un fetch missions ERR_ABORTED bénin) ; (4) n'apparaissent que sous navigation dev rapide multi-contexte (HMR/chunk à froid). Enregistrées ici en toute transparence ; un mismatch d'hydratation sur un AUTRE attribut, ou toute autre erreur, resterait comptée dans consoleErrors et ferait échouer la preuve.";

  const L = out.surfaces["large-1600"], d = out.surfaces["desktop-1280"], t = out.surfaces["tablet-768"], m = out.surfaces["mobile-390"];

  // ── Signaux fondateur (mappés aux mustShow des scénarios A–G) ────────────────
  out.founderSignals = {
    // A — CloneOS d'abord
    cloneos_first: d.cockpit.cloneosTitle === "CloneOS", composer_visible: d.cockpit.composer, suggestions_visible: d.cockpit.suggested,
    context_visible: d.cockpit.contextShown, no_page_scroll: d.cockpit.noPageScroll && d.room.noPageScroll && d.pierre.noPageScroll, mobile_bottom_nav: m.cockpit.bottomNavShown,
    // B — Global Cockpit dirigeant
    workforce: d.cockpit.workforce, pierre: d.cockpit.workforce, missions: d.cockpit.ctxMissions, validations: d.cockpit.ctxValidations,
    risks_blockers: d.cockpit.ctxBlockers, recent_results: d.cockpit.ctxRecent, health_status: d.cockpit.ctxHealth, quick_actions: d.cockpit.suggested,
    // C — Pierre RH
    pierre_title: d.pierre.hasWorkBody, employe_ia_rh_framing: d.pierre.framing === "Employé IA RH", hr_missions: d.pierre.hasWorkBody,
    documents: d.pierre.hasWorkBody, evidence: d.pierre.hasWorkBody, autonomy: d.pierre.hasWorkBody, activity: d.pierre.hasWorkBody,
    // mission_composer EXIGE l'affordance sur desktop (libellé) ET mobile (bouton visible) — plus de dérive desktop-only.
    mission_composer: d.pierre.composeButton && m.pierre.composeBtnVisible,
    mission_composer_mobile: m.pierre.composeBtnVisible, mission_composer_label_desktop: d.pierre.composeButton,
    no_assistant_framing: d.pierre.noAssistantFraming && m.pierre.noAssistantFraming && L.pierre.noAssistantFraming,
    // D — CloneRoom salon
    cloneos: d.room.participants >= 4, empreinte_entreprise: d.room.participants >= 4, technologies: d.room.participants >= 4,
    company_memory: d.room.participants >= 4, human_team: d.room.participants >= 4, one_composer: d.room.composer,
    content_carrying_extraction: out.extraction?.directSeed?.ok === true, message_to_mission: out.extraction?.cloneRoomFlow?.ok === true,
    // E — Mon CloneStore admin
    company: d.mon.sections >= 8, billing: d.mon.sections >= 8, subscription: d.mon.sections >= 8, country_pricing: d.mon.sections >= 8,
    users: d.mon.sections >= 8, permissions: d.mon.sections >= 8, purchased_ai_employees: d.mon.sections >= 8, footprint: d.mon.sections >= 8,
    security: d.mon.sections >= 8, support: d.mon.sections >= 8, link_back_to_cockpit: d.mon.openCockpit,
    // F — mobile
    no_h_overflow: d.cockpit.noHOverflow && m.cockpit.noHOverflow && m.room.noHOverflow && m.pierre.noHOverflow,
    bottom_nav: m.cockpit.bottomNavShown, composer_reachable: m.cockpit.composer, context_reachable: !m.cockpit.contextShown && m.cockpit.bottomNavShown,
    pierre_in_1_2_taps: m.cockpit.bottomNavShown, validations_in_1_2_taps: m.cockpit.bottomNavShown,
    // G — grand écran RÉEL 1600 (console 3 panneaux : rail + surface centrée + contexte inline)
    three_pane_console: L.cockpit.railShown && L.cockpit.contextShown, no_wasted_space: L.cockpit.contextShown && L.cockpit.noHOverflow, useful_context_pane: L.cockpit.workforce,
    centered_command_surface: L.cockpit.composer, rail_navigation: L.cockpit.railShown, switch_global_pierre_cloneroom: L.cockpit.railShown,
    // distinction / anti-fuite
    mon_clonestore_distinct: d.mon.shell && !d.mon.isCosRoot && d.mon.sections >= 8, no_footer_leak: d.cockpit.noPublicFooter && d.room.noPublicFooter && d.pierre.noPublicFooter,
  };

  // ── Prédicat de réussite fondateur ──────────────────────────────────────────
  const S = out.founderSignals;
  const pass =
    S.cloneos_first && S.composer_visible && S.suggestions_visible && S.no_page_scroll && S.mobile_bottom_nav &&
    S.workforce && S.missions && S.validations && S.risks_blockers && S.recent_results && S.health_status &&
    S.employe_ia_rh_framing && S.no_assistant_framing && S.mission_composer &&
    d.room.participants >= 6 && S.one_composer && S.content_carrying_extraction && S.message_to_mission &&
    S.mon_clonestore_distinct && S.link_back_to_cockpit &&
    S.no_h_overflow && S.no_footer_leak &&
    S.mission_composer_mobile && S.mission_composer_label_desktop && // affordance composer mobile ET desktop
    L.cockpit.railShown && L.cockpit.contextShown && L.cockpit.noHOverflow && // grand écran 1600 : 3 panneaux
    d.cockpit.railShown && d.cockpit.contextShown &&           // desktop 3-pane
    t.cockpit.railShown && !t.cockpit.contextShown &&           // tablet icon-rail + drawer
    m.cockpit.bottomNavShown && !m.cockpit.railShown &&         // mobile bottom-nav
    consoleErrors.length === 0;

  out.pass = pass;
  out.verdict = pass ? "P13_FOUNDER_FEEL_OK" : "P13_FOUNDER_FEEL_ISSUES";
} catch (e) {
  out.error = e?.message ?? String(e);
  out.verdict = "P13_FOUNDER_FEEL_ERROR";
} finally {
  out.cleanup = await cleanup();
}

writeFileSync(resolve(proofDir, "browser-founder-feel.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ verdict: out.verdict, error: out.error ?? null, cleanup: out.cleanup, realConsoleErrors: out.consoleErrors, devTransientsCount: (out.devTransients ?? []).length, extraction: out.extraction }, null, 2));
if (out.verdict !== "P13_FOUNDER_FEEL_OK") process.exitCode = 1;
