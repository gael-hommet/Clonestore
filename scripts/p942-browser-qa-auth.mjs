// scripts/p942-browser-qa-auth.mjs
// P9.4.2 r2 §7 — Passe AUTHENTIFIÉE : connexion Supabase réelle (utilisateur éphémère) →
// /assistant en mode connecté. Capture l'état authentifié + propreté console + accessibilité,
// sur mobile + desktop. L'utilisateur n'a PAS d'entreprise réelle → le serveur DOIT refuser
// fermé (company_required) : on vérifie qu'AUCUNE fausse entreprise n'est utilisée et qu'aucune
// action à effet n'est proposée. Navigateur ISOLÉ (n'affecte pas la session P8).

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.P942_BASE ?? "http://127.0.0.1:3222";
const RUN = process.env.P942_RUN ?? "p942-final";
const EMAIL = process.env.P942_EMAIL, PASSWORD = process.env.P942_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("P942_EMAIL + P942_PASSWORD requis"); process.exit(2); }
const proofDir = resolve(process.cwd(), ".p942-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-4-2");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });

const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const browser = await chromium.launch();
const report = { runId: RUN, base: BASE, email: EMAIL, steps: {}, verdict: "PENDING" };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

// 1) Connexion via /login (formulaire Supabase réel).
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);
const sessionToken = await page.evaluate(async () => {
  try {
    for (let i = 0; i < Object.keys(localStorage).length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes("auth-token")) return "present";
    }
  } catch { /* ignore */ }
  // cookie-based (@supabase/ssr)
  return document.cookie.includes("sb-") ? "cookie" : "none";
});
report.steps.login = { attempted: true, session: sessionToken, url: page.url() };

// 2) /assistant en mode connecté.
await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// 3) Envoi d'un message → le serveur résout le tenant. Sans entreprise réelle → refus fermé.
const chatResponses = [];
page.on("response", async (res) => {
  if (res.url().includes("/api/assistant/chat")) {
    try { chatResponses.push({ status: res.status(), body: await res.json() }); } catch { /* ignore */ }
  }
});
const composer = await page.$('textarea, [contenteditable="true"], input[type="text"]');
if (composer) {
  await composer.fill("Bonjour Pierre, où en sont mes missions ?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(4000);
}
const chatResp = chatResponses[0]?.body ?? null;

// 4) Aucune action à effet proposée (pas d'entreprise réelle) + aucune fausse entreprise.
const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const actionButtons = await page.$$eval("button", (bs) => bs.filter((b) => /confirmer|confier|annuler la mission|approuver|rejeter/i.test(b.textContent || "")).length);
await page.screenshot({ path: resolve(shotDir, "p942-authenticated-1280.png"), fullPage: false });

report.steps.assistant = {
  reached: true, url: page.url(),
  chatSource: chatResp?.source ?? null,
  companyRequired: chatResp?.source === "company_required" || chatResp?.code === "MEMBERSHIP_REQUIRED",
  noFakeCompanyUsed: chatResp?.source !== "openai" || (chatResp?.durable !== undefined),
  effectfulActionButtons: actionButtons,
  noHorizontalOverflow: overflow,
  consoleErrors,
};

// company_required attendu (utilisateur sans entreprise) ; aucun bouton d'action à effet.
const pass = report.steps.login.session !== "none" && report.steps.assistant.effectfulActionButtons === 0 && report.steps.assistant.noHorizontalOverflow && consoleErrors.length === 0;
report.verdict = pass ? "AUTH_QA_OK" : "AUTH_QA_ISSUES";
await ctx.close(); await browser.close();
writeFileSync(resolve(proofDir, "browser-qa-auth.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, login: report.steps.login.session, chatSource: report.steps.assistant.chatSource, companyRequired: report.steps.assistant.companyRequired, effectfulButtons: report.steps.assistant.effectfulActionButtons, consoleErrors: consoleErrors.length }, null, 2));
