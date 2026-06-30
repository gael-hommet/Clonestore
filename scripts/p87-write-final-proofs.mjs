#!/usr/bin/env node
// scripts/p87-write-final-proofs.mjs — write the P8.7.3 redacted proof files under .p87-proofs/step3/final/
// from the REAL external-providers check + the persisted storage proof. No secrets, no DSNs, no full emails.
import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const engine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-external-providers-check.mjs")).href);
const envEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);
const { env } = envEngine.loadEnvironment("production", { cwd: ROOT, processEnv: process.env, readFile: (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null), fileExists: (p) => existsSync(p), join });
async function fetchJson(url, init = {}) { try { const r = await fetch(url, { method: init.method || "GET", headers: init.headers || {}, body: init.body }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, ok: r.ok, json: j }; } catch { return { status: 0, ok: false, json: null }; } }
const readStorage = () => { const p = join(ROOT, ".p87-proofs", "step3", "storage-proof.json"); try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null; } catch { return null; } };
const rep = await engine.runExternalProvidersCheck({ env, fetchJson, readProof: readStorage, now: new Date().toISOString() });
const dir = join(ROOT, ".p87-proofs", "step3", "final");
mkdirSync(dir, { recursive: true });
const w = (name, obj) => writeFileSync(join(dir, name), JSON.stringify(obj, null, 2));
const at = rep.generated_at;
w("application-proof.json", { domain: "application", at, status: rep.domains.application.status, detail: rep.domains.application.detail });
w("stripe-sandbox-proof.json", { domain: "stripe", at, environment: "test", status: rep.domains.stripe.status, detail: rep.domains.stripe.detail });
w("resend-provider-proof.json", { domain: "communications", provider: "resend", at, status: rep.domains.communications.status, detail: rep.domains.communications.detail });
w("yousign-provider-proof.json", { domain: "signature", provider: "yousign", environment: "sandbox", at, status: rep.domains.signature.status, detail: rep.domains.signature.detail });
w("storage-proof-reference.json", { domain: "storage", at, status: rep.domains.storage.status, source: ".p87-proofs/step3/storage-proof.json", ok: !!readStorage()?.ok });
w("prelaunch-report.json", { at, prelaunch_ready: rep.prelaunch_ready, live_ready: rep.live_ready, stripe_live_flip_required: rep.stripe_live_flip_required, domains: Object.fromEntries(Object.entries(rep.domains).map(([k, v]) => [k, v.status])) });
console.log(JSON.stringify({ written: 6, prelaunch_ready: rep.prelaunch_ready, live_ready: rep.live_ready, stripe_live_flip_required: rep.stripe_live_flip_required }, null, 2));
process.exit(rep.prelaunch_ready ? 0 : 1);
