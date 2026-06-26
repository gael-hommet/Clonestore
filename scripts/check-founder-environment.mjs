#!/usr/bin/env node
// BLOC FINAL §6/§7/§8 — vérifie les variables d'environnement Founder Access.
// Usage : node scripts/check-founder-environment.mjs [--stripe|--email|--analytics|--all]
import { checkStripeEnv, checkEmailEnv, checkAnalyticsEnv, printCheck } from "./founder-env-checks.mjs";

const args = new Set(process.argv.slice(2));
const all = args.has("--all") || args.size === 0;
let ok = true;
if (all || args.has("--stripe")) ok = printCheck("stripe", checkStripeEnv()) && ok;
if (all || args.has("--email")) ok = printCheck("email", checkEmailEnv()) && ok;
if (all || args.has("--analytics")) ok = printCheck("analytics", checkAnalyticsEnv()) && ok;
console.log(`\n${ok ? "[env] OK" : "[env] BLOCKED — variables manquantes (preuve externe en attente de configuration opérateur)"}`);
process.exit(ok ? 0 : 1);
