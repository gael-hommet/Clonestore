#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log("  OK  " + m); const warn = (m) => console.log("  !!  " + m); let n = 0;
console.log("\n== PHASE 8.3-B2G S8 — Contract Amendments ==\n");
const c = read("src/lib/pierre/v1/contracts.ts");
if (/createContractAmendment/.test(c)) ok("amendment service"); else { warn("amendment service missing"); n++; }
if (/parent_contract_id/.test(c) && /(no amendment chains|amend an amendment)/.test(c)) ok("no amendment chains"); else { warn("chain not blocked"); n++; }
if (/amendment_allowed_after_signature/.test(c)) ok("post-signature amendment rule"); else { warn("post-signature rule missing"); n++; }
if (/idempotency/i.test(c)) ok("amendment idempotency"); else { warn("idempotency missing"); n++; }
if (/cancelled/.test(c)) ok("cancelled-parent rule"); else { warn("cancelled rule missing"); n++; }
console.log("\n" + (n === 0 ? " RESULTAT : PASS — structural checks OK; behavioural proof via Vitest: `npm run test:phase8-3-b2g` (counts from Vitest, never hardcoded)." : " RESULTAT : NEEDS REVIEW — " + n + ".") + "\n");
process.exit(n === 0 ? 0 : 1);
