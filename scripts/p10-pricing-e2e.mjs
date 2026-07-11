// scripts/p10-pricing-e2e.mjs
// P10 §8/§9 — Preuve E2E de la tarification par pays.
//  A) PUBLIC (navigateur, sans compte) : carte de prix (FR 449 € / CH 499 CHF), sélecteur, état
//     inconnu, mobile 390 sans débordement ; sondes API /api/pricing/public (FR/CH/US/aucun).
//  B) AUTHENTIFIÉ (session Supabase réelle, node) : matrice du guard checkout serveur-autoritatif —
//     CH (± prix EUR forgé) → TOUJOURS STRIPE_PRICE_NOT_CONFIGURED (jamais l'EUR) ; FR (± CHF forgé)
//     → TOUJOURS l'EUR ; aucun pays → COUNTRY_REQUIRED ; US → COUNTRY_NOT_SUPPORTED.
// Serveur : next dev, STRIPE_COUNTRY_PRICING_ENABLED=true, CHF Stripe volontairement NON configuré
// (prouve le fail-closed CH). Nettoie l'utilisateur éphémère (zéro résidu).
// Flag garde-fou : P10_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P10_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") {
  console.error("flag P10_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes requis"); process.exit(1);
}
function env() {
  const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {};
  for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } }
  return e;
}
const E = env();
const BASE = process.env.P10_BASE ?? "http://127.0.0.1:3270";
const RUN = process.env.P10_RUN ?? "p10-run1";
const proofDir = resolve(process.cwd(), ".p10-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p10");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i, /\[Fast Refresh\]/i, /Invalid or unexpected token/i, /Unexpected end of JSON input/i, /hydrat/i, /webpack/i, /__next/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const out = { runId: RUN, base: BASE, public: {}, auth: {}, verdict: "PENDING" };
let userId = null;
async function cleanup() {
  if (!userId) return "NO_USER";
  try { await admin.from("orders").delete().eq("user_id", userId); } catch { /* */ }
  try { await admin.from("profiles").delete().eq("id", userId); } catch { /* */ }
  try { await admin.auth.admin.deleteUser(userId); } catch { /* */ }
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE";
}

try {
  // ═══ A) PUBLIC — carte de prix + API (sans compte) ═══
  const browser = await chromium.launch();
  const consoleErrors = [];
  for (const vp of [{ name: "desktop-1280", width: 1280, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => { if (!isBenign(e.message)) consoleErrors.push("pageerror: " + e.message); });

    await page.goto(`${BASE}/agents/pierre`, { waitUntil: "domcontentloaded" });
    const card = await page.waitForSelector("[data-testid='country-pricing-card']", { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(1500);

    const vpProof = { size: `${vp.width}x${vp.height}`, cardPresent: !!card };
    if (card) {
      // offres visibles (deux devises)
      vpProof.offerEur = (await page.locator("[data-testid='offer-eur']").first().textContent().catch(() => null))?.trim() ?? null;
      vpProof.offerChf = (await page.locator("[data-testid='offer-chf']").first().textContent().catch(() => null))?.trim() ?? null;
      // état initial (inconnu → invite à sélectionner ; pas de prix). Attend que le fetch initial
      // se résolve (sinon on lit l'état « Chargement… » et le prompt n'est pas encore rendu).
      await page.waitForSelector("[data-testid='pricing-select-prompt'], [data-testid='pricing-price']", { timeout: 15000 }).catch(() => {});
      vpProof.initialSelectPrompt = (await page.locator("[data-testid='pricing-select-prompt']").count()) > 0;
      vpProof.initialNoPrice = (await page.locator("[data-testid='pricing-price']").count()) === 0;
      await page.screenshot({ path: resolve(shotDir, `p10-card-unknown-${vp.name}.png`), fullPage: false });
      // sélection FR → 449 €
      await page.click("[data-pricing-country-option='FR']");
      await page.waitForTimeout(900);
      vpProof.frPrice = (await page.locator("[data-testid='pricing-price']").first().textContent().catch(() => null))?.trim() ?? null;
      // sélection CH → 499 CHF
      await page.click("[data-pricing-country-option='CH']");
      await page.waitForTimeout(900);
      vpProof.chPrice = (await page.locator("[data-testid='pricing-price']").first().textContent().catch(() => null))?.trim() ?? null;
      // débordement horizontal ?
      vpProof.noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      await page.screenshot({ path: resolve(shotDir, `p10-card-${vp.name}.png`), fullPage: false });

      // sondes API (résolution SERVEUR)
      if (vp.name === "desktop-1280") {
        vpProof.api = await page.evaluate(async () => {
          const get = async (q) => { const r = await fetch(`/api/pricing/public${q}`); return r.json(); };
          return {
            none: await get(""),
            fr: await get("?country=FR"),
            ch: await get("?country=CH"),
            us: await get("?country=US"),
          };
        });
      }
    }
    out.public[vp.name] = vpProof;
    await ctx.close();
  }
  await browser.close();
  out.public.consoleErrors = consoleErrors;

  // ═══ B) AUTHENTIFIÉ — matrice du guard checkout (session Supabase réelle) ═══
  const runId = "p10" + randomUUID().slice(0, 8).replace(/-/g, "");
  const email = `p10-e2e-${runId}@example.invalid`;
  const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p10-pricing-e2e", run_id: runId } });
  if (ue) throw new Error("createUser: " + ue.message);
  userId = u.user.id;
  await admin.from("profiles").upsert({ id: userId, email, full_name: `p10-${runId}` }, { onConflict: "id" });
  // NB : PAS d'order → l'utilisateur n'est PAS actif → le checkout procède (pas de court-circuit).

  const captured = [];
  const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
  const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
  if (se || !si?.session) throw new Error("signIn: " + (se?.message ?? "no session"));
  const token = si.session.access_token;

  const post = async (body) => {
    const r = await fetch(`${BASE}/api/checkout`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch { /* */ }
    return { status: r.status, ok: j?.ok, code: j?.code, reviewRequired: j?.reviewRequired, resolvedCountry: j?.resolvedCountry, hasUrl: typeof j?.url === "string" && j.url.startsWith("https://") };
  };

  out.auth.no_country = await post({ agent_slug: "pierre" });
  out.auth.unsupported_US = await post({ agent_slug: "pierre", country: "US" });
  out.auth.ch_failclosed = await post({ agent_slug: "pierre", country: "CH" });
  out.auth.ch_forged_eur = await post({ agent_slug: "pierre", country: "CH", price_key: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", price_id: "price_hacked_eur", currency: "EUR" });
  out.auth.fr_eur = await post({ agent_slug: "pierre", country: "FR" });
  out.auth.fr_forged_chf = await post({ agent_slug: "pierre", country: "FR", price_key: "STRIPE_PRICE_PIERRE_CHF_MONTHLY", currency: "CHF" });

  // ═══ Verdict ═══
  const d = out.public["desktop-1280"] ?? {};
  const m = out.public["mobile-390"] ?? {};
  const a = out.auth;
  const publicOk = d.cardPresent && d.frPrice?.includes("449") && d.chPrice?.includes("499")
    && d.initialSelectPrompt === true && d.initialNoPrice === true // unknown → selector, no price (visible state)
    && d.api?.none?.requiresCountrySelection === true && d.api?.none?.price === null
    && d.api?.fr?.price?.amount === 449 && d.api?.ch?.price?.amount === 499
    && d.api?.us?.supported === false && d.api?.us?.price === null
    && m.cardPresent && m.noHorizontalOverflow === true
    && (out.public.consoleErrors?.length ?? 0) === 0;
  const authOk =
    a.no_country?.code === "COUNTRY_REQUIRED" && a.no_country?.ok === false
    && a.unsupported_US?.code === "COUNTRY_NOT_SUPPORTED"
    && a.ch_failclosed?.code === "STRIPE_PRICE_NOT_CONFIGURED" && a.ch_failclosed?.status === 503
    && a.ch_forged_eur?.code === "STRIPE_PRICE_NOT_CONFIGURED" // forged EUR ignored → CH STILL fail-closed (never EUR)
    && a.fr_eur?.ok === true && a.fr_eur?.hasUrl === true       // FR → real EUR checkout
    && a.fr_forged_chf?.ok === true && a.fr_forged_chf?.hasUrl === true; // forged CHF ignored → EUR used
  out.publicOk = publicOk; out.authOk = authOk;
  out.verdict = publicOk && authOk ? "P10_PRICING_OK" : "P10_PRICING_ISSUES";
} catch (e) {
  out.error = e?.message ?? String(e);
  out.verdict = "P10_PRICING_ERROR";
} finally {
  out.cleanup = await cleanup();
}

writeFileSync(resolve(proofDir, "ui-proof.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ verdict: out.verdict, error: out.error ?? null, cleanup: out.cleanup, publicOk: out.publicOk, authOk: out.authOk, auth: out.auth, publicDesktop: out.public["desktop-1280"], mobileOverflow: out.public["mobile-390"]?.noHorizontalOverflow, console: out.public.consoleErrors }, null, 2));
if (out.verdict !== "P10_PRICING_OK") process.exitCode = 1;
