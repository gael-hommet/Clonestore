#!/usr/bin/env node
// scripts/c1-5-browser-qa.mjs
// C1.5 §7 — QA MANUELLE dans la VRAIE UI, utilisateur AUTHENTIFIÉ SANS entreprise active.
// Scénario A (question publique) · B (demande opérationnelle) · C (mobile).
// On tape RÉELLEMENT dans le composer. Aucun secret imprimé.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.C1_5_BASE ?? "http://localhost:3130";
const ROOT = process.cwd();
const DIR = resolve(ROOT, ".c1-5-proofs");
mkdirSync(DIR, { recursive: true });

const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: si, error: se } = await sb.auth.signInWithPassword({ email: env.RLS_TEST_USER_A_EMAIL, password: env.RLS_TEST_USER_A_PASSWORD });
if (se || !si?.session) { console.log(JSON.stringify({ blocked: "sign-in failed" })); process.exit(2); }
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const COOKIE = { name: `sb-${ref}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(si.session), "utf8").toString("base64"), domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" };

const browser = await chromium.launch();
const out = { scenarioA: {}, scenarioB: {}, scenarioC: {}, brand: {}, security: {} };

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addCookies([COOKIE]);
  const page = await ctx.newPage();
  const calls = [];
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/assistant")) return;
    let j = null; try { j = await r.json(); } catch { /* ignore */ }
    calls.push({ path: u.pathname, status: r.status(), source: j?.source ?? null, discovery: j?.discovery ?? null, provider: j?.runtime?.provider ?? null });
  });
  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  return { ctx, page, calls };
}

async function ask(page, calls, text, waitMs = 25000) {
  const before = calls.length;
  await page.locator("textarea").fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(waitMs);
  const thread = await page.locator('[data-tour-id="clonechat-thread"]').innerText();
  return { text, thread, calls: calls.slice(before) };
}

// ── Desktop : A puis B, en tapant IMMÉDIATEMENT (le cas qui échouait) ────────
{
  const { ctx, page, calls } = await open(1440, 900);
  // On ne « laisse pas le temps » : c'est exactement le scénario qui produisait le faux blocage.
  await page.waitForTimeout(1200);

  out.initial = {
    composerEnabled: await page.locator("textarea").isEnabled().catch(() => false),
    discoveryCardVisible: (await page.locator('[data-tour-id="clonechat-discovery-hint"]').count()) > 0,
    hardBlockerText: /Aucune entreprise active/i.test(await page.locator("body").innerText()),
    modeLabel: await page.locator('[data-tour-id="clonechat-header"] p').first().innerText().catch(() => ""),
  };

  const A = await ask(page, calls, "comment je paye pierre ? tu me recommandes de le prendre pour me libérer du temps ?");
  await page.screenshot({ path: resolve(DIR, "qa-A-public-desktop.png") });
  const chatA = A.calls.find((c) => c.path === "/api/assistant/chat");
  out.scenarioA = {
    question: A.text,
    reachedServer: Boolean(chatA),                      // ← LE point : la requête part vraiment
    source: chatA?.source ?? null,
    discovery: chatA?.discovery ?? null,
    provider: chatA?.provider ?? null,
    answeredByLocalDeterministicEngine: !chatA,         // ← l'ancien comportement défectueux
    hardBlockerShown: /Aucune entreprise active/i.test(A.thread),
    claimsCompanyData: /Données de votre entreprise \(/.test(A.thread) || /visibles par vous seul/i.test(A.thread),
    composerStillEnabled: await page.locator("textarea").isEnabled().catch(() => false),
    answerTail: A.thread.slice(-320),
  };

  out.afterSettle = { discoveryCardVisible: (await page.locator('[data-tour-id="clonechat-discovery-hint"]').count()) > 0, modeLabel: await page.locator('[data-tour-id="clonechat-header"] p').first().innerText().catch(() => "") };

  const B = await ask(page, calls, "prépare l'avenant de Paul");
  await page.screenshot({ path: resolve(DIR, "qa-B-operational-desktop.png") });
  const chatB = B.calls.find((c) => c.path === "/api/assistant/chat");
  out.scenarioB = {
    question: B.text,
    reachedServer: Boolean(chatB),
    source: chatB?.source ?? null,
    refusedAsCompanyAction: chatB?.source === "pierre_access_required" || chatB?.source === "company_required",
    explanationMentionsGeneralQuestionsStillWork: /questions générales/i.test(B.thread),
    claimsCompanyData: /Données de votre entreprise \(/.test(B.thread) || /visibles par vous seul/i.test(B.thread),
    composerStillEnabledAfterRefusal: await page.locator("textarea").isEnabled().catch(() => false),
    crashed: /Application error|Unhandled/i.test(await page.locator("body").innerText()),
    refusalTail: B.thread.slice(-300),
  };

  // Le chat reste utilisable APRÈS un refus (pas de dead state)
  const C2 = await ask(page, calls, "quels sont les prix ?");
  out.scenarioB.chatStillUsableAfterRefusal = Boolean(C2.calls.find((c) => c.path === "/api/assistant/chat"));

  // Discovery card affichée UNE seule fois (pas de spam dans le fil)
  out.scenarioB.discoveryHintRepeatsInThread = (C2.thread.match(/Mode découverte/g) ?? []).length;

  // ── Marque : style RÉEL calculé de la bulle utilisateur ──
  out.brand = await page.evaluate(() => {
    const u = document.querySelector(".cc-bubble-user");
    const a = document.querySelector(".cc-bubble-assistant");
    const cs = u ? getComputedStyle(u) : null;
    const as = a ? getComputedStyle(a) : null;
    const violet = Array.from(document.querySelectorAll('[data-tour-id="clonechat-entry"] *')).some((el) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.color, s.backgroundImage].some((v) => /107,\s*99,\s*232|rgb\(107, 99, 232\)/.test(v));
    });
    return {
      userBubbleFound: Boolean(u),
      userBubbleBackgroundImage: cs?.backgroundImage?.slice(0, 120) ?? null,
      userBubbleColor: cs?.color ?? null,
      assistantBubbleBackgroundImage: as?.backgroundImage?.slice(0, 90) ?? null,
      assistantBubbleColor: as?.color ?? null,
      oldVioletPresentAnywhere: violet,
    };
  });

  await ctx.close();
}

// ── Mobile ───────────────────────────────────────────────────────────────────
{
  const { ctx, page, calls } = await open(390, 844);
  await page.waitForTimeout(1200);
  const M = await ask(page, calls, "quels sont les prix ?");
  await page.screenshot({ path: resolve(DIR, "qa-C-mobile.png") });
  out.scenarioC = {
    viewport: "390x844",
    reachedServer: Boolean(M.calls.find((c) => c.path === "/api/assistant/chat")),
    composerEnabled: await page.locator("textarea").isEnabled().catch(() => false),
    discoveryCardVisible: (await page.locator('[data-tour-id="clonechat-discovery-hint"]').count()) > 0,
    noHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    bubbleFitsViewport: await page.evaluate(() => {
      const b = document.querySelector(".cc-bubble-user");
      return b ? b.getBoundingClientRect().width <= window.innerWidth : true;
    }),
  };
  await ctx.close();
}

// ── Anonyme : reste bloqué ───────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  out.security.anonymousChatApi = await page.evaluate(async () => {
    const r = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Quels sont les prix ?" }) });
    return { status: r.status, blocked: r.status === 401 };
  });
  await ctx.close();
}

await browser.close();

out.verdict = {
  publicQuestionReachesServer: out.scenarioA.reachedServer === true,
  publicQuestionNotHardBlocked: out.scenarioA.hardBlockerShown === false,
  noFakeCompanyClaimed: out.scenarioA.claimsCompanyData === false && out.scenarioB.claimsCompanyData === false,
  operationalStillBlocked: out.scenarioB.refusedAsCompanyAction === true,
  chatUsableAfterRefusal: out.scenarioB.chatStillUsableAfterRefusal === true,
  composerAlwaysActive: out.initial.composerEnabled && out.scenarioA.composerStillEnabled && out.scenarioB.composerStillEnabledAfterRefusal,
  oldPurpleRemoved: out.brand.oldVioletPresentAnywhere === false,
  mobileClean: out.scenarioC.noHorizontalOverflow === true && out.scenarioC.bubbleFitsViewport === true,
  anonymousStillBlocked: out.security.anonymousChatApi?.blocked === true,
};

writeFileSync(resolve(DIR, "browser-qa.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
