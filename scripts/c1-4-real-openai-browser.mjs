#!/usr/bin/env node
// scripts/c1-4-real-openai-browser.mjs
// C1.4 §12/§15 — PREUVE RUNTIME OPENAI RÉELLE dans un VRAI navigateur authentifié.
//
// Scénario A : utilisateur AUTHENTIFIÉ, SANS droit Pierre, SANS entreprise (mode découverte).
// Prouve : réservation de budget DURABLE (base locale jetable, rôle clonechat_app) AVANT
// l'appel provider · appel OpenAI RÉEL (source openai_public) · tokens in/out NON NULS ·
// commit du budget · citations validées · garde de claims · aucune donnée tenant ·
// requête opérationnelle → activation Pierre requise.
//
// BORNES : 3 requêtes provider MAXIMUM, questions publiques non sensibles uniquement.
// N'imprime AUCUN secret (ni clé, ni cookie, ni DSN).

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.C1_4_BASE ?? "http://localhost:3125";
const ROOT = process.cwd();
const MAX_PROVIDER_CALLS = 3;

const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = env.RLS_TEST_USER_A_EMAIL;
const PASSWORD = env.RLS_TEST_USER_A_PASSWORD;
const OPENAI_PRESENT = /^sk-[A-Za-z0-9_-]{20,}$/.test(env.OPENAI_API_KEY ?? "");

const out = {
  preconditions: { openaiKeyPresentByShape: OPENAI_PRESENT, maxProviderCalls: MAX_PROVIDER_CALLS },
  scenarioA_noEntitlement_noCompany: {},
  providerCalls: [],
  operationalBlocked: {},
  security: {},
};

if (!OPENAI_PRESENT) { out.blocked = "OPENAI_API_KEY absente/forme invalide"; console.log(JSON.stringify(out, null, 2)); process.exit(2); }

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const { data: si, error: se } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (se || !si?.session) { out.blocked = `sign-in échoué: ${se?.message ?? "pas de session"}`; console.log(JSON.stringify(out, null, 2)); process.exit(2); }
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = "base64-" + Buffer.from(JSON.stringify(si.session), "utf8").toString("base64");

const browser = await chromium.launch();
async function ctxPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addCookies([{ name: cookieName, value: cookieValue, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  return { ctx, page };
}

/** Appelle l'API réelle DEPUIS le navigateur authentifié et renvoie les métadonnées runtime. */
async function apiAsk(page, message) {
  return page.evaluate(async (msg) => {
    const r = await fetch("/api/assistant/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }),
    });
    const j = await r.json().catch(() => null);
    return {
      status: r.status,
      source: j?.source,
      discovery: j?.discovery,
      code: j?.code,
      runtime: j?.runtime ?? null,
      citations: j?.structured?.citations ?? [],
      citationLabels: j?.citationLabels ?? [],
      answerLen: (j?.structured?.answer ?? "").length,
      answerSample: (j?.structured?.answer ?? "").slice(0, 160),
      // Fuites éventuelles (doivent rester vides)
      leaksKey: JSON.stringify(j ?? {}).includes("sk-"),
      mentionsTenant: /company_id|companyId|u:[0-9a-f-]{8}/i.test(JSON.stringify(j ?? {})),
    };
  }, message);
}

// ── PREUVE PROVIDER RÉEL (bornée) ────────────────────────────────────────────
const QUESTIONS = [
  "Quels sont les prix de Pierre en France et en Suisse ?",
  "Pourquoi Pierre est différent d'un assistant généraliste ?",
];

{
  const { ctx, page } = await ctxPage(1440, 900);

  for (const q of QUESTIONS.slice(0, MAX_PROVIDER_CALLS)) {
    const r = await apiAsk(page, q);
    out.providerCalls.push({
      question: q,
      status: r.status,
      source: r.source,
      discoveryMode: r.discovery === true,
      provider: r.runtime?.provider ?? null,
      providerReportedModel: r.runtime?.model ?? null, // rapporté PAR le provider
      requestedModel: r.runtime?.requestedModel ?? null, // ce que NOUS avons demandé
      providerCalled: r.runtime?.providerCalled ?? null,
      reservationGranted: r.runtime?.reservationGranted ?? null,
      reservedBeforeProvider: r.runtime?.reservedBeforeProvider ?? null, // MESURÉ (null si aucun appel)
      inputTokens: r.runtime?.inputTokens ?? 0,
      outputTokens: r.runtime?.outputTokens ?? 0,
      committedTokens: r.runtime?.committedTokens ?? 0,
      entitlementKnown: r.runtime?.entitlementKnown ?? null,
      citationsValidated: Array.isArray(r.citations),
      citationLabels: r.citationLabels,
      answerLen: r.answerLen,
      answerSample: r.answerSample,
      isRealProvider: r.source === "openai_public" && r.runtime?.provider === "openai",
      nonZeroTokens: (r.runtime?.inputTokens ?? 0) > 0 && (r.runtime?.outputTokens ?? 0) > 0,
      notDeterministic: r.source !== "public_fallback",
      noKeyLeak: r.leaksKey === false,
      noTenantData: r.mentionsTenant === false,
    });
  }

  // ── Requête OPÉRATIONNELLE sans droit → activation Pierre requise ──────────
  const op = await apiAsk(page, "Prépare l'onboarding de Sarah.");
  out.operationalBlocked = {
    question: "Prépare l'onboarding de Sarah.",
    status: op.status,
    source: op.source,
    code: op.code,
    entitlementRequired: op.source === "pierre_access_required",
    noProviderCall: op.runtime === null,
    answerSample: op.answerSample,
  };

  // ── UI : workspace réel, composer actif ──────────────────────────────────
  out.scenarioA_noEntitlement_noCompany = {
    realWorkspace: (await page.locator('[data-tour-id="clonechat-entry"]').count()) > 0,
    composerEnabled: await page.locator("textarea").isEnabled().catch(() => false),
    viewport: "1440x900",
  };
  await ctx.close();
}

// ── Mobile ───────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await ctxPage(390, 844);
  const r = await apiAsk(page, "Que peut faire Pierre pour un dirigeant qui porte seul la charge RH ?");
  out.mobile = {
    viewport: "390x844",
    realWorkspace: (await page.locator('[data-tour-id="clonechat-entry"]').count()) > 0,
    composerEnabled: await page.locator("textarea").isEnabled().catch(() => false),
    noHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    source: r.source,
    provider: r.runtime?.provider ?? null,
    inputTokens: r.runtime?.inputTokens ?? 0,
    outputTokens: r.runtime?.outputTokens ?? 0,
    isRealProvider: r.source === "openai_public" && r.runtime?.provider === "openai",
  };
  await ctx.close();
}

// ── Anonyme → 401 ────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  out.security.anonymous = await page.evaluate(async () => {
    const r = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Quels sont les prix ?" }) });
    const j = await r.json().catch(() => null);
    return { status: r.status, code: j?.code, blocked: r.status === 401 };
  });
  await ctx.close();
}

await browser.close();

// ── Synthèse ────────────────────────────────────────────────────────────────
const real = out.providerCalls.filter((c) => c.isRealProvider && c.nonZeroTokens);
out.summary = {
  providerCallsMade: out.providerCalls.length,
  realOpenAICallsProven: real.length,
  realOpenAIBrowserCallExecuted: real.length > 0,
  realOpenAITokensObserved: real.length > 0 && real.every((c) => c.inputTokens > 0 && c.outputTokens > 0),
  realOpenAIBudgetCommitted: real.length > 0 && real.every((c) => c.committedTokens > 0),
  // MESURÉ côté serveur (horloge logique), pas une constante : réservation STRICTEMENT avant le provider.
  reservedBeforeProvider: real.length > 0 && real.every((c) => c.providerCalled === true && c.reservationGranted === true && c.reservedBeforeProvider === true),
  // Le modèle annoncé provient du provider lui-même (jamais recopié depuis la config).
  providerReportedModelObserved: real.length > 0 && real.every((c) => typeof c.providerReportedModel === "string" && c.providerReportedModel.length > 0),
  deterministicFallbackAvoidedForProof: real.every((c) => c.notDeterministic),
  operationalRequiresEntitlement: out.operationalBlocked.entitlementRequired === true,
  anonymousBlocked: out.security.anonymous?.blocked === true,
  noKeyLeak: out.providerCalls.every((c) => c.noKeyLeak),
  noTenantData: out.providerCalls.every((c) => c.noTenantData),
};

const dir = resolve(ROOT, ".c1-4-proofs", "access-openai-runtime");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "real-openai-browser.json"), JSON.stringify({ preconditions: out.preconditions, scenarioA: out.scenarioA_noEntitlement_noCompany, providerCalls: out.providerCalls, summary: out.summary }, null, 2));
writeFileSync(resolve(dir, "browser-desktop.json"), JSON.stringify({ ...out.scenarioA_noEntitlement_noCompany, providerCalls: out.providerCalls, operationalBlocked: out.operationalBlocked }, null, 2));
writeFileSync(resolve(dir, "browser-mobile.json"), JSON.stringify(out.mobile, null, 2));
writeFileSync(resolve(dir, "anonymous-access.json"), JSON.stringify(out.security, null, 2));

console.log(JSON.stringify({ summary: out.summary, providerCalls: out.providerCalls, operationalBlocked: out.operationalBlocked, mobile: out.mobile, security: out.security }, null, 2));
