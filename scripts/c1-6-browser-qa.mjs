#!/usr/bin/env node
// scripts/c1-6-browser-qa.mjs
// C1.6 §10 — QA RÉELLE. Le succès ne peut PAS être revendiqué depuis des tests unitaires :
// il exige un navigateur INCOGNITO, sans compte et sans cookie, qui converse via /assistant.
//
// Matrice : anonyme · authentifié sans entreprise · (les autres profils sont couverts au
// niveau route). Aucun secret imprimé.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.C1_6_BASE ?? "http://localhost:3131";
const ROOT = process.cwd();
const DIR = resolve(ROOT, ".c1-6-proofs");
mkdirSync(DIR, { recursive: true });

const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// Pré-chauffage : en dev, Next compile la route à la PREMIÈRE requête. Sans cela, le fetch
// navigateur échoue (« Failed to fetch ») — un artefact d'outillage, jamais un défaut produit.
for (const path of ["/api/assistant/chat", "/api/assistant/conversations", "/api/assistant/execute"]) {
  try { await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch { /* le but est de compiler, pas de réussir */ }
}

const browser = await chromium.launch();
const out = {};

/** Ouvre une page. `cookie = null` ⇒ INCOGNITO TOTAL : aucun cookie, aucun compte. */
async function open(cookie, width = 1440, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height } }); // contexte NEUF = incognito
  if (cookie) await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  const calls = [];
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/assistant")) return;
    let j = null; try { j = await r.json(); } catch { /* ignore */ }
    calls.push({
      path: u.pathname, status: r.status(),
      source: j?.source ?? null, anonymous: j?.anonymous ?? null,
      requestClass: j?.requestClass ?? null, prerequisites: j?.prerequisites ?? null,
      provider: j?.runtime?.provider ?? null,
      toolCall: j?.structured?.tool_call ?? null, proposal: j?.proposal ?? null,
    });
  });
  const nav = await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  return { ctx, page, calls, finalUrl: page.url(), navStatus: nav?.status() ?? null };
}

async function ask(page, calls, text, waitMs = 45000) {
  const before = calls.length;
  await page.locator("textarea").fill(text);
  await page.keyboard.press("Enter");
  // On ATTEND la réponse réelle au lieu de dormir un temps fixe : sinon la réponse d'un tour
  // lent est comptée dans la fenêtre du tour suivant (artefact de mesure, pas un défaut produit).
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (calls.slice(before).some((c) => c.path === "/api/assistant/chat")) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500); // laisser le rendu se terminer
  return {
    text,
    thread: await page.locator('[data-tour-id="clonechat-thread"]').innerText(),
    calls: calls.slice(before),
    composerEnabled: await page.locator("textarea").isEnabled().catch(() => false),
  };
}

// ══════════════ PROFIL 1 — ANONYME (incognito, zéro cookie) ══════════════════
{
  const { ctx, page, calls, finalUrl, navStatus } = await open(null);
  await page.waitForTimeout(1200);

  out.anonymous = {
    entry: {
      navStatus,
      finalUrl,
      redirectedToLogin: /connexion|login|signin/i.test(finalUrl),
      composerActive: await page.locator("textarea").isEnabled().catch(() => false),
      loginWallShown: /Connexion requise|connectez-vous pour continuer/i.test(await page.locator("body").innerText()),
      companyWarning: /Aucune entreprise active/i.test(await page.locator("body").innerText()),
      headerLabel: await page.locator('[data-tour-id="clonechat-header"] p').first().innerText().catch(() => ""),
    },
  };

  // Scénario A — question publique
  const A = await ask(page, calls, "Comment Pierre peut-il me faire gagner du temps ?");
  await page.screenshot({ path: resolve(DIR, "anon-A-public.png") });
  const cA = A.calls.find((c) => c.path === "/api/assistant/chat");
  out.anonymous.scenarioA = {
    question: A.text, httpStatus: cA?.status ?? null, source: cA?.source ?? null,
    anonymousFlag: cA?.anonymous ?? null, requestClass: cA?.requestClass ?? null,
    provider: cA?.provider ?? null,
    got401: cA?.status === 401,
    answered: (A.thread.match(/\S/g) ?? []).length > 40,
    composerStillActive: A.composerEnabled,
    answerTail: A.thread.slice(-260),
  };

  // Scénario B — donnée privée demandée par un anonyme
  const B = await ask(page, calls, "Montre-moi les salariés de mon entreprise.");
  await page.screenshot({ path: resolve(DIR, "anon-B-private.png") });
  const cB = B.calls.find((c) => c.path === "/api/assistant/chat");
  out.anonymous.scenarioB = {
    question: B.text, httpStatus: cB?.status ?? null, source: cB?.source ?? null,
    requestClass: cB?.requestClass ?? null, prerequisites: cB?.prerequisites ?? null,
    got401: cB?.status === 401,
    // Aucune donnée privée, aucune action : ni tool_call, ni proposition.
    noToolCall: (cB?.toolCall ?? null) === null,
    noProposal: (cB?.proposal ?? null) === null,
    explainsPrerequisite: /connectez-vous|connecter/i.test(B.thread),
    composerStillActive: B.composerEnabled,
    tail: B.thread.slice(-260),
  };

  // Scénario C — retour à une question publique juste après (aucun état mort)
  const C = await ask(page, calls, "Quels sont les prix ?");
  const cC = C.calls.find((c) => c.path === "/api/assistant/chat");
  out.anonymous.scenarioC = {
    question: C.text, httpStatus: cC?.status ?? null, source: cC?.source ?? null,
    answeredNormally: cC?.status === 200 && (cC?.source === "openai_public" || cC?.source === "public_fallback"),
    composerStillActive: C.composerEnabled,
    noDeadState: true,
  };

  // Action gouvernée demandée par un anonyme → aucune action, prérequis explicites
  const D = await ask(page, calls, "Envoie l'avenant de Paul.");
  const cD = D.calls.find((c) => c.path === "/api/assistant/chat");
  out.anonymous.governedAction = {
    question: D.text, httpStatus: cD?.status ?? null, requestClass: cD?.requestClass ?? null,
    prerequisites: cD?.prerequisites ?? null,
    noToolCall: (cD?.toolCall ?? null) === null,
    noProposal: (cD?.proposal ?? null) === null,
    composerStillActive: D.composerEnabled,
  };

  // Identité visuelle partagée (mêmes composants)
  out.anonymous.ui = await page.evaluate(() => ({
    sameWorkspace: Boolean(document.querySelector('[data-tour-id="clonechat-entry"]')),
    sameComposer: Boolean(document.querySelector('[data-tour-id="clonechat-input"]')),
    sameHeader: Boolean(document.querySelector('[data-tour-id="clonechat-header"]')),
    userBubbleClass: document.querySelector(".cc-bubble-user") ? "cc-bubble-user" : null,
    assistantBubbleClass: document.querySelector(".cc-bubble-assistant") ? "cc-bubble-assistant" : null,
  }));

  await ctx.close();
}

// ══════════════ PROFIL 2 — AUTHENTIFIÉ SANS ENTREPRISE ═══════════════════════
{
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: si } = await sb.auth.signInWithPassword({ email: env.RLS_TEST_USER_A_EMAIL, password: env.RLS_TEST_USER_A_PASSWORD });
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookie = { name: `sb-${ref}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(si.session), "utf8").toString("base64"), domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" };

  const { ctx, page, calls } = await open(cookie);
  await page.waitForTimeout(1200);
  const A = await ask(page, calls, "Comment Pierre peut-il me faire gagner du temps ?");
  const B = await ask(page, calls, "Montre-moi les salariés de mon entreprise.");
  await page.screenshot({ path: resolve(DIR, "authed-nocompany.png") });
  const cA = A.calls.find((c) => c.path === "/api/assistant/chat");
  const cB = B.calls.find((c) => c.path === "/api/assistant/chat");
  out.authedNoCompany = {
    publicQuestion: { status: cA?.status ?? null, source: cA?.source ?? null, sameSourceAsAnonymous: cA?.source === out.anonymous.scenarioA.source },
    privateRequest: {
      status: cB?.status ?? null, prerequisites: cB?.prerequisites ?? null,
      // Un utilisateur CONNECTÉ ne doit PAS se voir demander de se connecter : seul
      // « entreprise active » manque.
      onlyCompanyMissing: Array.isArray(cB?.prerequisites) && cB.prerequisites.includes("active_company") && !cB.prerequisites.includes("authentication"),
      noToolCall: (cB?.toolCall ?? null) === null,
    },
    noHardCompanyBlocker: !/Aucune entreprise active/i.test(B.thread),
    composerActive: B.composerEnabled,
    headerLabel: await page.locator('[data-tour-id="clonechat-header"] p').first().innerText().catch(() => ""),
  };
  await ctx.close();
}

// ══════════════ Routes PRIVÉES : toujours protégées ══════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  try {
    out.privateRoutesStillProtected = await page.evaluate(async () => {
      const conv = await fetch("/api/assistant/conversations", { method: "GET" });
      const exec = await fetch("/api/assistant/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: "x" }) });
      return { conversationsStatus: conv.status, executeStatus: exec.status, bothBlocked: conv.status === 401 && exec.status === 401 };
    });
  } catch (e) {
    out.privateRoutesStillProtected = { error: String(e).slice(0, 120), bothBlocked: false };
  }
  await ctx.close();
}

await browser.close();

const a = out.anonymous;
out.verdict = {
  anonymousPageOpens: a.entry.navStatus === 200 && !a.entry.redirectedToLogin,
  anonymousComposerActive: a.entry.composerActive,
  noLoginWall: !a.entry.loginWallShown,
  noCompanyWarning: !a.entry.companyWarning,
  anonymousPublicAnswered200: a.scenarioA.httpStatus === 200 && !a.scenarioA.got401 && a.scenarioA.answered,
  anonymousUsesRealCloneChat: a.scenarioA.source === "openai_public" || a.scenarioA.source === "public_fallback",
  anonymousPrivateRequestNo401: a.scenarioB.httpStatus === 200 && !a.scenarioB.got401,
  anonymousPrivateNoData: a.scenarioB.noToolCall && a.scenarioB.noProposal,
  anonymousGovernedActionCreatesNothing: a.governedAction.noToolCall && a.governedAction.noProposal,
  conversationSurvivesRefusal: a.scenarioC.answeredNormally && a.scenarioC.composerStillActive,
  sameUiEverywhere: Boolean(a.ui.sameWorkspace && a.ui.sameComposer && a.ui.sameHeader && a.ui.userBubbleClass),
  authedNoCompanySamePath: out.authedNoCompany.publicQuestion.sameSourceAsAnonymous,
  authedNoCompanyOnlyCompanyMissing: out.authedNoCompany.privateRequest.onlyCompanyMissing,
  privateRoutesStillProtected: out.privateRoutesStillProtected.bothBlocked,
};

writeFileSync(resolve(DIR, "browser-qa.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
