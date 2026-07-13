#!/usr/bin/env node
// scripts/e1-1-environment-precheck.mjs
// E1.1 §10 — Audit d'environnement par PRÉSENCE et FORME uniquement.
// N'imprime JAMAIS une valeur : ni clé, ni URL de base, ni jeton, ni cookie.
// Vérifie aussi les invariants structurels (production/paiement/live jamais déduits d'une forme).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const env = {};
for (const f of [".env.local", ".env"]) {
  const p = resolve(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const all = { ...env, ...process.env };
const has = (k) => typeof all[k] === "string" && all[k].trim() !== "";

/** Décrit une variable SANS la divulguer. */
const describe = (k, shape) => ({
  present: has(k),
  shapeValid: has(k) ? Boolean(shape(all[k])) : null,
  valuePrinted: false,
});

const anyShape = (v) => v.length > 0;
const httpsShape = (v) => /^https:\/\/[^\s]+$/.test(v);
const pgShape = (v) => /^postgres(ql)?:\/\//.test(v);
const openaiShape = (v) => /^sk-[A-Za-z0-9_-]{20,}$/.test(v);
const jwtShape = (v) => v.split(".").length === 3;
const stripeLive = (v) => /^sk_live_/.test(v);
const stripeTest = (v) => /^sk_test_/.test(v);

const report = {
  runId: "repository-reconciliation",
  secretsPrinted: false,
  database: {
    DATABASE_URL: describe("DATABASE_URL", pgShape),
    CLONECHAT_DB_URL: describe("CLONECHAT_DB_URL", pgShape),
    resolutionOrder: "CLONECHAT_DB_URL || DATABASE_URL",
  },
  supabase: {
    NEXT_PUBLIC_SUPABASE_URL: describe("NEXT_PUBLIC_SUPABASE_URL", httpsShape),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: describe("NEXT_PUBLIC_SUPABASE_ANON_KEY", jwtShape),
    SUPABASE_SERVICE_ROLE_KEY: describe("SUPABASE_SERVICE_ROLE_KEY", jwtShape),
  },
  openai: { OPENAI_API_KEY: describe("OPENAI_API_KEY", openaiShape) },
  app: {
    NEXT_PUBLIC_SITE_URL: describe("NEXT_PUBLIC_SITE_URL", anyShape),
    NEXT_PUBLIC_APP_URL: describe("NEXT_PUBLIC_APP_URL", anyShape),
  },
  flags: {
    CLONECHAT_ENABLED: { present: has("CLONECHAT_ENABLED"), valuePrinted: false },
    PRODUCTION_AUTHORIZED_ENV: { present: has("PRODUCTION_AUTHORIZED"), valuePrinted: false },
  },
  stripe: {
    STRIPE_SECRET_KEY: describe("STRIPE_SECRET_KEY", anyShape),
    liveKeyShapeDetected: has("STRIPE_SECRET_KEY") ? stripeLive(all.STRIPE_SECRET_KEY) : false,
    testKeyShapeDetected: has("STRIPE_SECRET_KEY") ? stripeTest(all.STRIPE_SECRET_KEY) : false,
  },
  providers: {
    YOUSIGN_API_KEY: describe("YOUSIGN_API_KEY", anyShape),
    RESEND_API_KEY: describe("RESEND_API_KEY", anyShape),
    TWILIO_AUTH_TOKEN: describe("TWILIO_AUTH_TOKEN", anyShape),
    ELEVENLABS_API_KEY: describe("ELEVENLABS_API_KEY", anyShape),
  },
  monitoring: {
    SENTRY_DSN: describe("SENTRY_DSN", anyShape),
    NEXT_PUBLIC_SENTRY_DSN: describe("NEXT_PUBLIC_SENTRY_DSN", anyShape),
  },
  invariants: {},
  leaks: {},
};

// ── Invariants structurels : évalués sur le CODE, pas sur des promesses ───────
const prodGate = readFileSync(resolve(ROOT, "src/lib/clonestore/production/p10-production-gate.ts"), "utf8");
const payMode = readFileSync(resolve(ROOT, "src/lib/clonestore/production/p15-1-payment-mode.ts"), "utf8");
const availability = readFileSync(resolve(ROOT, "src/lib/features/product-availability.ts"), "utf8");

report.invariants = {
  // La production est une CONSTANTE de code, jamais déduite de NODE_ENV ni d'une variable.
  productionAuthorizedIsConst: /export const PRODUCTION_AUTHORIZED\s*(:\s*boolean\s*)?=\s*false/.test(prodGate),
  productionNotInferredFromNodeEnv: !/PRODUCTION_AUTHORIZED[^\n]*NODE_ENV/.test(prodGate),
  // Le paiement live ne peut JAMAIS être déduit de la forme d'une clé.
  paymentNeverLiveWhileFloorDown: /PRODUCTION_AUTHORIZED/.test(payMode),
  // CloneChat : actif par défaut + arrêt d'urgence explicite (règle canonique unique).
  clonechatActiveByDefault: /if \(typeof raw !== "string" \|\| raw\.trim\(\) === ""\) return true/.test(availability),
  clonechatEmergencyKillSwitch: /EMERGENCY_OFF_VALUES/.test(availability),
};

// ── Fuites : aucun secret serveur exposé en NEXT_PUBLIC_* ─────────────────────
const SERVER_ONLY = ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "DATABASE_URL", "CLONECHAT_DB_URL", "YOUSIGN_API_KEY", "RESEND_API_KEY"];
const publicKeys = Object.keys(all).filter((k) => k.startsWith("NEXT_PUBLIC_"));
const suspicious = publicKeys.filter((k) => /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|DATABASE_URL/i.test(k));
// Un secret serveur ne doit pas non plus être RÉPLIQUÉ dans une variable publique.
const duplicated = [];
for (const s of SERVER_ONLY) {
  if (!has(s)) continue;
  for (const p of publicKeys) if (all[p] === all[s]) duplicated.push(p);
}
report.leaks = {
  serverSecretsExposedAsPublic: suspicious,
  serverSecretValueDuplicatedIntoPublicVar: duplicated,
  none: suspicious.length === 0 && duplicated.length === 0,
};

const dir = resolve(ROOT, ".e1-1-proofs", "repository-reconciliation");
mkdirSync(dir, { recursive: true });
const json = JSON.stringify(report, null, 2);

// Garde dure : refuser d'émettre si une VALEUR de secret apparaît dans la sortie.
for (const k of [...SERVER_ONLY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (has(k) && all[k].length > 8 && json.includes(all[k])) {
    console.error(`REFUS : la valeur de ${k} a fuité dans la sortie.`);
    process.exit(3);
  }
}
writeFileSync(resolve(dir, "environment-precheck.json"), json);
console.log(json);
