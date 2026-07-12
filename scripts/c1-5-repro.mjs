#!/usr/bin/env node
// scripts/c1-5-repro.mjs
// C1.5 §2 — REPRODUCTION dans la VRAIE UI (pas un fetch direct) : utilisateur AUTHENTIFIÉ
// SANS entreprise active. On tape réellement dans le composer et on lit le fil rendu.
// N'imprime aucun secret.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.C1_5_BASE ?? "http://localhost:3130";
const ROOT = process.cwd();
const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: si, error: se } = await supabase.auth.signInWithPassword({
  email: env.RLS_TEST_USER_A_EMAIL, password: env.RLS_TEST_USER_A_PASSWORD,
});
if (se || !si?.session) { console.log(JSON.stringify({ blocked: `sign-in: ${se?.message ?? "no session"}` })); process.exit(2); }
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookie = { name: `sb-${ref}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(si.session), "utf8").toString("base64"), domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" };

const dir = resolve(ROOT, ".c1-5-proofs");
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([cookie]);
const page = await ctx.newPage();

const apiCalls = [];
page.on("response", async (r) => {
  const u = new URL(r.url());
  if (!u.pathname.startsWith("/api/assistant")) return;
  let body = null;
  try { body = await r.json(); } catch { /* ignore */ }
  apiCalls.push({ path: u.pathname, status: r.status(), ok: body?.ok ?? null, source: body?.source ?? null, code: body?.code ?? null, discovery: body?.discovery ?? null, answer: (body?.structured?.answer ?? "").slice(0, 120) });
});

await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const initial = {
  composerEnabled: await page.locator("textarea").isEnabled().catch(() => false),
  bodyMentionsNoCompany: /Aucune entreprise active/i.test(await page.locator("body").innerText()),
};

async function ask(text) {
  const before = apiCalls.length;
  await page.locator("textarea").fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(18000);
  const thread = await page.locator('[data-tour-id="clonechat-thread"]').innerText();
  return {
    question: text,
    threadTail: thread.slice(-700),
    apiCalls: apiCalls.slice(before),
    composerStillEnabled: await page.locator("textarea").isEnabled().catch(() => false),
    hardBlockerShown: /Aucune entreprise active n'est associée/i.test(thread),
  };
}

const scenarioA = await ask("comment je paye pierre ? tu me recommandes de le prendre pour me libérer du temps ?");
await page.screenshot({ path: resolve(dir, "repro-A-public.png"), fullPage: false });
const scenarioB = await ask("prépare l'avenant de Paul");
await page.screenshot({ path: resolve(dir, "repro-B-operational.png"), fullPage: false });

// Style réel de la bulle utilisateur (le violet est-il encore là ?)
const bubble = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('[data-tour-id="clonechat-thread"] > div'));
  for (const r of rows) {
    const el = r.querySelector("div > div");
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
      return { className: el.className, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, color: cs.color };
    }
  }
  return null;
});

await ctx.close();
await browser.close();

const out = { initial, scenarioA, scenarioB, userBubbleStyle: bubble, allAssistantApiCalls: apiCalls };
writeFileSync(resolve(dir, "repro.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
