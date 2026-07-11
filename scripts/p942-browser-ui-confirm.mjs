// scripts/p942-browser-ui-confirm.mjs
// P9.4.2 r2 §7 — Preuve du CLIC UI « Confirmer » : composer un message via le VRAI composer,
// obtenir une proposition serveur (bouton Confirmer rendu), CLIQUER le bouton, et observer que
// le client n'envoie que { proposalId } à /api/assistant/execute. Session Supabase RÉELLE injectée
// + tenant opérationnel (drapeau local/test). Serveur isolé stable (distDir dédié + in-memory).
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
const BASE = process.env.P942_BASE ?? "http://127.0.0.1:3222";
const proofDir = resolve(process.cwd(), ".p942-proofs", process.env.P942_RUN ?? "p942-final");
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-4-2");
mkdirSync(proofDir, { recursive: true }); mkdirSync(shotDir, { recursive: true });
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const host = new URL(BASE).hostname;
const BENIGN = [/Failed to load resource/i, /favicon/i, /status of (401|403|404|503)/i, /React DevTools/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const runId = "p942ui" + randomUUID().slice(0, 8).replace(/-/g, "");
const email = `p942-ui-${runId}@example.invalid`; const password = "Qa!" + randomBytes(18).toString("base64url");
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p942-ui-confirm", run_id: runId } });
if (ue) { console.error("createUser:", ue.message); process.exit(2); }
const userId = u.user.id;
await admin.from("profiles").upsert({ id: userId, email, full_name: `p942-${runId}` }, { onConflict: "id" });
await admin.from("orders").upsert({ user_id: userId, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
async function cleanup() { try { await admin.from("orders").delete().eq("user_id", userId); } catch { /* */ } try { await admin.from("profiles").delete().eq("id", userId); } catch { /* */ } try { await admin.auth.admin.deleteUser(userId); } catch { /* */ } const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 }); return (data?.users ?? []).some((x) => x.id === userId) ? "RESIDUE" : "DELETED — ZERO RESIDUE"; }

const captured = [];
const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
const { data: si, error: se } = await ssr.auth.signInWithPassword({ email, password });
if (se || !si?.session) { console.error("signIn:", se?.message); console.log(await cleanup()); process.exit(3); }
const pwCookies = captured.map((c) => ({ name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/", httpOnly: false, secure: false, sameSite: "Lax", expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1 }));

const report = { runId, email, steps: {}, verdict: "PENDING" };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(pwCookies);
  const page = await ctx.newPage();
  const consoleErrors = []; const executeRequests = []; const chatResponses = [];
  page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => { if (r.url().includes("/api/assistant/execute") && r.method() === "POST") { try { executeRequests.push(JSON.parse(r.postData() ?? "{}")); } catch { executeRequests.push({ __unparsable: true }); } } });
  page.on("response", async (r) => { if (r.url().includes("/api/assistant/chat") && r.request().method() === "POST") { try { chatResponses.push(await r.json()); } catch { /* */ } } });

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  for (const sel of ["Plus tard", "Passer"]) { try { const el = page.getByText(sel, { exact: false }).first(); if (await el.count() && await el.isVisible()) { await el.click({ timeout: 1500 }); break; } } catch { /* */ } }
  await page.waitForTimeout(500);

  // Composer via le VRAI composer : fill (déclenche onChange React) → cliquer Envoyer.
  // Ré-essais : OpenAI ne propose pas toujours l'outil au 1er tour → on renvoie une demande
  // explicite d'ouverture de cas de support jusqu'à voir un bouton Confirmer.
  const composer = page.locator("textarea").first();
  const send = page.locator('button[aria-label="Envoyer"]').first();
  const MSG = "Ouvre un cas de support s'il te plait : le bouton d'export des salaries ne repond pas et bloque l'equipe.";
  let sendEnabled = null, confirmLoc = null;
  for (let attempt = 0; attempt < 6 && !confirmLoc; attempt++) {
    await composer.click();
    await composer.fill(MSG);
    await page.waitForTimeout(500);
    if (attempt === 0) sendEnabled = await page.evaluate(() => { const b = document.querySelector('button[aria-label="Envoyer"]'); return b ? !b.disabled : null; });
    try { await send.click({ timeout: 3000 }); } catch { await composer.press("Enter"); }
    // attendre une réponse + un éventuel bouton Confirmer
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(700);
      const loc = page.locator("button", { hasText: /confirmer|ouvrir un cas|confier cette mission|approuver/i }).first();
      if (await loc.count()) { confirmLoc = loc; break; }
    }
  }
  const proposalFromChat = chatResponses.find((x) => x?.proposal?.id) ?? null;
  await page.screenshot({ path: resolve(shotDir, "p942-ui-proposal.png"), fullPage: false });

  let confirmClicked = false;
  if (confirmLoc) { try { await confirmLoc.click({ timeout: 3000 }); confirmClicked = true; await page.waitForTimeout(4000); } catch { /* */ } }
  await page.screenshot({ path: resolve(shotDir, "p942-ui-confirmed.png"), fullPage: false });

  const firstExec = executeRequests.find((b) => b && !b.__unparsable) ?? null;
  // Message assistant final rendu après confirmation (résultat visible).
  const resultText = await page.evaluate(() => document.body.innerText).catch(() => "");
  report.steps = {
    sendButtonEnabledAfterTyping: sendEnabled,
    chatProduced: chatResponses.length,
    serverProposalId: proposalFromChat?.proposal?.id ?? null,
    proposalKind: proposalFromChat?.proposal?.kind ?? null,
    confirmButtonRendered: !!confirmLoc,
    confirmClicked,
    executeRequestBodies: executeRequests,
    uiConfirmSendsOnlyProposalId: firstExec ? (Object.keys(firstExec).length === 1 && typeof firstExec.proposalId === "string") : null,
    resultRendered: /cas de support ouvert|c'est fait|r[eé]sultat r[eé]el confirm[eé]/i.test(resultText),
    consoleErrors,
  };
  await ctx.close();
} finally { await browser.close(); }

report.cleanup = await cleanup();
const s = report.steps;
const pass = s.serverProposalId && s.confirmButtonRendered && s.confirmClicked && s.uiConfirmSendsOnlyProposalId === true && (s.consoleErrors?.length ?? 0) === 0 && report.cleanup.includes("ZERO RESIDUE");
report.verdict = pass ? "BROWSER_UI_CONFIRM_OK" : "BROWSER_UI_CONFIRM_CHECK";
writeFileSync(resolve(proofDir, "browser-ui-confirm.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, steps: s, cleanup: report.cleanup }, null, 2));
if (!pass) process.exit(1);
