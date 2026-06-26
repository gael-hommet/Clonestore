#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log("  OK  " + m); const warn = (m) => console.log("  !!  " + m); let n = 0;
console.log("\n== PHASE 8.3-B2G S1 — Contract Policy Registry ==\n");
const s = read("src/lib/pierre/v1/contract-policies.ts");
for (const k of ["CDI_FULL_TIME", "CDD", "APPRENTICESHIP", "INTERNSHIP", "OTHER"]) { if (s.includes(k)) ok(k); else { warn(k + " absent"); n++; } }
if (/validateContractType/.test(s) && /unknown_contract_type/.test(s)) ok("unknown type refused"); else { warn("type validation missing"); n++; }
if (/isRendererAllowedForContract/.test(s)) ok("renderer gated"); else { warn("renderer not gated"); n++; }
if (/requires_end_date/.test(s) && /fixed_term/.test(s)) ok("fixed-term date rules"); else { warn("date rules missing"); n++; }
if (/auto_execution_allowed: false/.test(s)) ok("auto-execution forbidden"); else { warn("auto-exec not blocked"); n++; }
console.log("\n" + (n === 0 ? " RESULTAT : PASS — structural checks OK; behavioural proof via Vitest: `npm run test:phase8-3-b2g` (counts from Vitest, never hardcoded)." : " RESULTAT : NEEDS REVIEW — " + n + ".") + "\n");
process.exit(n === 0 ? 0 : 1);
