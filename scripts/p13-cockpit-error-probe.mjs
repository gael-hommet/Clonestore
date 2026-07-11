// scripts/p13-cockpit-error-probe.mjs — capture DÉTAILLÉE (message + stack + location) des
// console.error/pageerror sur les surfaces cockpit AUTHENTIFIÉES, pour classer honnêtement
// artefact-dev vs bug produit. Mint client éphémère + cookies + cleanup zéro résidu.
// Flag: P13_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
if (process.env.P13_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag requis"); process.exit(1); }
function env() { const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8"); const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); e[m[1]] = v; } } return e; }
const E = env();
const BASE = process.env.P13_BASE ?? "http://127.0.0.1:3273";
const host = new URL(BASE).hostname;
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = [];
async function mkUser() {
  const runId = "p13probe" + randomUUID().slice(0, 6).replace(/-/g, "");
  const email = `p13-e2e-${runId}@example.invalid`; const password = "Qa!" + randomBytes(18).toString("base64url");
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "p13-founder-feel-e2e" } });
  const id = u.user.id; users.push(id);
  await admin.from("profiles").upsert({ id, email, full_name: `p13-${runId}` }, { onConflict: "id" });
  await admin.from("orders").upsert({ user_id: id, agent_slug: "pierre", status: "active", started_at: new Date().toISOString() }, { onConflict: "user_id,agent_slug" });
  const captured = [];
  const ssr = createServerClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { for (const c of cs) captured.push(c); } } });
  const { data: si } = await ssr.auth.signInWithPassword({ email, password });
  if (!si?.session) throw new Error("no session");
  return captured.map((c) => ({ name: c.name, value: c.value, domain: host, path: c.options?.path ?? "/", httpOnly: false, secure: false, sameSite: "Lax", expires: c.options?.maxAge ? Math.floor(Date.now() / 1000) + c.options.maxAge : -1 }));
}
try {
  const cookies = await mkUser();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const events = [];
  page.on("console", (m) => { if (m.type() === "error") events.push({ kind: "console", text: m.text().slice(0, 200), loc: m.location() }); });
  page.on("pageerror", (e) => events.push({ kind: "pageerror", message: e.message.slice(0, 200), stack: (e.stack || "").split("\n").slice(0, 6).join(" | ") }));
  page.on("requestfailed", (r) => events.push({ kind: "requestfailed", url: r.url().slice(0, 160), err: r.failure()?.errorText }));
  for (const p of ["/cockpit", "/cockpit/room"]) { await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 }); await page.waitForTimeout(3000); }
  await browser.close();
  console.log(JSON.stringify(events, null, 2));
} finally {
  for (const id of users) { try { await admin.from("orders").delete().eq("user_id", id); } catch {} try { await admin.from("profiles").delete().eq("id", id); } catch {} try { await admin.auth.admin.deleteUser(id); } catch {} }
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  console.log("cleanup:", (data?.users ?? []).some((x) => users.includes(x.id)) ? "RESIDUE" : "ZERO RESIDUE");
}
