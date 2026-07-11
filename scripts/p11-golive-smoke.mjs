// scripts/p11-golive-smoke.mjs
// P11 §9 — Smoke navigateur final (léger, AUCUN paiement, AUCUNE session Stripe créée).
//  A) PUBLIC (sans compte) : carte de prix FR 449€ / CH 499CHF, état inconnu (sélecteur), mobile 390.
//  B) AUTHENTIFIÉ (session Supabase réelle) : codes de BLOCAGE checkout qui NE créent PAS de session
//     Stripe — no country → COUNTRY_REQUIRED ; CH (CHF non configuré) → STRIPE_PRICE_NOT_CONFIGURED
//     (fail-closed : la Suisse ne peut pas payer en EUR). Confirme que P11 n'a rien cassé du parcours P10.
// Nettoie l'utilisateur éphémère (zéro résidu). Flag: P11_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

if (process.env.P11_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag P11_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes requis"); process.exit(1); }
function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const BASE = process.env.P11_BASE ?? "http://127.0.0.1:3271";
const proofDir = resolve(process.cwd(), ".p11-proofs", "p11-run1");
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p11");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i, /\[Fast Refresh\]/i, /Invalid or unexpected token/i, /Unexpected end of JSON input/i, /hydrat/i, /webpack/i, /__next/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const out = { runId: "p11-run1", base: BASE, public: {}, auth: {}, verdict: "PENDING" };
let userId = null;
async function cleanup() { if (!userId) return "NO_USER"; try { await admin.from("orders").delete().eq("user_id", userId); } catch {} try { await admin.from("profiles").delete().eq("id", userId); } catch {} try { await admin.auth.admin.deleteUser(userId); } catch {} const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 }); return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE"; }

try {
  const browser = await chromium.launch();
  const consoleErrors = [];
  for (const vp of [{ name: "desktop-1280", width: 1280, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => { if (!isBenign(e.message)) consoleErrors.push("pageerror: " + e.message); });
    await page.goto(`${BASE}/agents/pierre`, { waitUntil: "domcontentloaded" });
    const card = await page.waitForSelector("[data-testid='country-pricing-card']", { timeout: 30000 }).catch(() => null);
    await page.waitForSelector("[data-testid='pricing-select-prompt'], [data-testid='pricing-price']", { timeout: 15000 }).catch(() => {});
    const p = { size: `${vp.width}x${vp.height}`, cardPresent: !!card };
    if (card) {
      p.initialSelectPrompt = (await page.locator("[data-testid='pricing-select-prompt']").count()) > 0;
      await page.click("[data-pricing-country-option='FR']"); await page.waitForTimeout(800);
      p.frPrice = (await page.locator("[data-testid='pricing-price']").first().textContent().catch(() => null))?.trim() ?? null;
      await page.click("[data-pricing-country-option='CH']"); await page.waitForTimeout(800);
      p.chPrice = (await page.locator("[data-testid='pricing-price']").first().textContent().catch(() => null))?.trim() ?? null;
      p.noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      await page.screenshot({ path: resolve(shotDir, `p11-card-${vp.name}.png`), fullPage: false });
      if (vp.name === "desktop-1280") p.api = await page.evaluate(async () => { const g = async (q) => (await fetch(`/api/pricing/public${q}`)).json(); return { none: await g(""), fr: await g("?country=FR"), ch: await g("?country=CH") }; });
    }
    out.public[vp.name] = p;
    await ctx.close();
  }
  await browser.close();
  out.public.consoleErrors = consoleErrors;

  // Authentifié : codes de blocage (aucune session Stripe créée).
  const runId = "p11" + randomUUID().slice(0, 8).replace(/-/g, "");
  const email = `p11-e2e-${runId}@example.invalid`; const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p11-golive-smoke", run_id: runId } });
  if (ue) throw new Error("createUser: " + ue.message);
  userId = u.user.id;
  await admin.from("profiles").upsert({ id: userId, email, full_name: `p11-${runId}` }, { onConflict: "id" });
  const captured = [];
  const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
  const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
  if (se || !si?.session) throw new Error("signIn: " + (se?.message ?? "no session"));
  const token = si.session.access_token;
  const post = async (body) => { const r = await fetch(`${BASE}/api/checkout`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, ok: j?.ok, code: j?.code, hasUrl: typeof j?.url === "string" && j.url.startsWith("https://") }; };
  out.auth.no_country = await post({ agent_slug: "pierre" });
  out.auth.ch_failclosed = await post({ agent_slug: "pierre", country: "CH" });
  out.auth.ch_forged_eur = await post({ agent_slug: "pierre", country: "CH", price_key: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", currency: "EUR" });

  const d = out.public["desktop-1280"] ?? {}, m = out.public["mobile-390"] ?? {}, a = out.auth;
  const publicOk = d.cardPresent && d.frPrice?.includes("449") && d.chPrice?.includes("499") && d.initialSelectPrompt === true
    && d.api?.none?.price === null && d.api?.fr?.price?.amount === 449 && d.api?.ch?.price?.amount === 499
    && m.cardPresent && m.noHorizontalOverflow === true && (out.public.consoleErrors?.length ?? 0) === 0;
  const authOk = a.no_country?.code === "COUNTRY_REQUIRED" && a.ch_failclosed?.code === "STRIPE_PRICE_NOT_CONFIGURED"
    && a.ch_forged_eur?.code === "STRIPE_PRICE_NOT_CONFIGURED" && !a.no_country?.hasUrl && !a.ch_failclosed?.hasUrl;
  out.publicOk = publicOk; out.authOk = authOk; out.noStripeSessionCreated = !a.no_country?.hasUrl && !a.ch_failclosed?.hasUrl && !a.ch_forged_eur?.hasUrl;
  out.verdict = publicOk && authOk ? "P11_SMOKE_OK" : "P11_SMOKE_ISSUES";
} catch (e) { out.error = e?.message ?? String(e); out.verdict = "P11_SMOKE_ERROR"; }
finally { out.cleanup = await cleanup(); }

writeFileSync(resolve(proofDir, "browser-smoke.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ verdict: out.verdict, error: out.error ?? null, cleanup: out.cleanup, publicOk: out.publicOk, authOk: out.authOk, noStripeSession: out.noStripeSessionCreated, auth: out.auth, desktop: out.public["desktop-1280"], mobileOverflow: out.public["mobile-390"]?.noHorizontalOverflow, console: out.public.consoleErrors }, null, 2));
if (out.verdict !== "P11_SMOKE_OK") process.exitCode = 1;
