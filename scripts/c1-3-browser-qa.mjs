#!/usr/bin/env node
// scripts/c1-3-browser-qa.mjs
// C1.3 — QA NAVIGATEUR : utilisateur AUTHENTIFIÉ SANS entreprise active.
// Se connecte via Supabase (identifiants lus depuis .env.local — JAMAIS imprimés), injecte
// le cookie de session, puis prouve dans le VRAI navigateur que /assistant répond aux
// questions PUBLIQUES (mode découverte) et bloque les demandes ENTREPRISE.
// N'imprime QUE des résultats d'assertion. Aucun secret en sortie.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.C1_3_BASE ?? "http://localhost:3124";
const ROOT = process.cwd();

// ── env (.env.local) — lu en mémoire, jamais journalisé ──────────────────────
const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = env.RLS_TEST_USER_A_EMAIL;
const PASSWORD = env.RLS_TEST_USER_A_PASSWORD;
if (!SUPABASE_URL || !SUPABASE_ANON || !EMAIL || !PASSWORD) {
  console.log(JSON.stringify({ blocked: true, reason: "identifiants de test Supabase absents de .env.local" }, null, 2));
  process.exit(2);
}

// ── 1) Session Supabase RÉELLE (aucun secret imprimé) ───────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signInErr || !signIn?.session) {
  console.log(JSON.stringify({ blocked: true, reason: `sign-in échoué: ${signInErr?.message ?? "pas de session"}` }, null, 2));
  process.exit(2);
}
const session = signIn.session;
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
// @supabase/ssr : valeur = "base64-" + base64(JSON(session))
const cookieValue = "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64");

// ── 2) Navigateur ────────────────────────────────────────────────────────────
const results = { authenticatedNoCompany: null, desktop: {}, mobile: {}, security: {} };
const browser = await chromium.launch();

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addCookies([{ name: cookieName, value: cookieValue, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
  return { ctx, page: await ctx.newPage() };
}

/** Envoie un message dans le composer et renvoie le dernier texte de la conversation. */
async function ask(page, question) {
  const before = await page.locator("main").innerText();
  await page.fill("textarea", question);
  await page.press("textarea", "Enter");
  // Attend que le fil grandisse (réponse assistant).
  await page.waitForFunction(
    (prevLen) => (document.querySelector("main")?.innerText.length ?? 0) > prevLen + question_len_guard,
    before.length,
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1200);
  return await page.locator("main").innerText();
}
const question_len_guard = 20;

async function run(width, height, bucket) {
  const { ctx, page } = await newPage(width, height);
  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  bucket.realWorkspace = (await page.locator('[data-tour-id="clonechat-entry"]').count()) > 0;
  bucket.composerEnabled = await page.locator("textarea").isEnabled().catch(() => false);
  bucket.noPlaceholder = !/arrive bient[oô]t/i.test(body);
  bucket.noBlockerOnLoad = !/Aucune entreprise active/i.test(body);
  bucket.headerVisible = (await page.locator('[data-tour-id="clonechat-header"]').count()) > 0;

  // Q1 — publique : paiement/réservation
  let text = await ask(page, "Comment payer Pierre ?");
  bucket.q_payer_realAnswer = text.length > 200 && !/Aucune entreprise active/i.test(text);
  bucket.q_payer_noBlocker = !/Aucune entreprise active/i.test(text);
  bucket.discoveryHintShown = /Mode d[ée]couverte/i.test(text);

  // Q2 — publique : recommandation commerciale
  text = await ask(page, "Est-ce que tu me recommandes Pierre pour me libérer de la charge RH ?");
  bucket.q_reco_realAnswer = !/Aucune entreprise active/i.test(text) && /Pierre/i.test(text);

  // Q3 — publique : prix canoniques
  text = await ask(page, "Quels sont les prix ?");
  bucket.q_prix_canonical = /449/.test(text) && /499/.test(text);
  bucket.q_prix_noBlocker = !/Aucune entreprise active/i.test(text);

  // Q4 — publique : produit
  text = await ask(page, "Comment fonctionne CloneStore ?");
  bucket.q_clonestore_realAnswer = !/Aucune entreprise active/i.test(text) && text.length > 200;

  // Q5 — publique : capacités Pierre
  text = await ask(page, "Que peut faire Pierre ?");
  bucket.q_capacites_realAnswer = !/Aucune entreprise active/i.test(text) && /Pierre/i.test(text);

  // Q6 — ENTREPRISE : doit être bloquée
  text = await ask(page, "Prépare l'onboarding de Sarah.");
  bucket.q_onboarding_companyRequired = /s[ée]lectionnez ou cr[ée]ez/i.test(text);

  // Q7 — ENTREPRISE : doit être bloquée
  text = await ask(page, "Montre-moi mes salariés.");
  bucket.q_salaries_companyRequired = /s[ée]lectionnez ou cr[ée]ez/i.test(text);

  // Aucune donnée tenant exposée (pas de nom d'entreprise/salarié inventé).
  bucket.noTenantData = !/company-|companyId|u:[0-9a-f-]{8}/i.test(text);

  // Rafraîchissement → workspace toujours utilisable
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  bucket.refreshUsable =
    (await page.locator('[data-tour-id="clonechat-entry"]').count()) > 0 &&
    (await page.locator("textarea").isEnabled().catch(() => false));

  bucket.viewport = `${width}x${height}`;
  if (width < 500) {
    bucket.noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  }
  await ctx.close();
}

// Confirme d'abord l'état « authentifié SANS entreprise » via l'API réelle.
{
  const { ctx, page } = await newPage(1440, 900);
  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  const probe = await page.evaluate(async () => {
    const r = await fetch("/api/assistant/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Comment payer Pierre ?" }),
    });
    const j = await r.json().catch(() => null);
    return { status: r.status, source: j?.source, discovery: j?.discovery, hasStructured: !!j?.structured };
  });
  results.authenticatedNoCompany = {
    apiStatus: probe.status,
    source: probe.source,
    discoveryMode: probe.discovery === true,
    isPublicMode: probe.source === "openai_public" || probe.source === "public_fallback",
    notAnonymous: probe.status !== 401,
    notCompanyBlocked: probe.source !== "company_required",
  };
  await ctx.close();
}

await run(1440, 900, results.desktop);
await run(390, 844, results.mobile);

// ── Sécurité : anonyme → 401 ; arrêt d'urgence testé par suite unitaire ──────
{
  const ctx = await browser.newContext(); // AUCUN cookie
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  results.security.anonymous = await page.evaluate(async () => {
    const r = await fetch("/api/assistant/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Comment payer Pierre ?" }),
    });
    const j = await r.json().catch(() => null);
    return { status: r.status, code: j?.code, blocked: r.status === 401 };
  });
  await ctx.close();
}

await browser.close();

const dir = resolve(ROOT, ".c1-3-proofs", "no-company-public-fallback");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "browser-desktop.json"), JSON.stringify({ runId: "c1-3", url: `${BASE}/assistant`, authenticatedNoCompany: results.authenticatedNoCompany, ...results.desktop }, null, 2));
writeFileSync(resolve(dir, "browser-mobile.json"), JSON.stringify({ runId: "c1-3", url: `${BASE}/assistant`, ...results.mobile }, null, 2));
writeFileSync(resolve(dir, "anonymous-access.json"), JSON.stringify({ runId: "c1-3", ...results.security }, null, 2));

console.log(JSON.stringify(results, null, 2));
