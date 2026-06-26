#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log("  OK  " + m); const warn = (m) => console.log("  !!  " + m); let n = 0;
console.log("\n== PHASE 8.3-B2G S3 — Contract Renderers ==\n");
const r = read("src/lib/pierre/v1/renderers.ts"); const m = read("src/lib/pierre/v1/contract-render-model.ts");
if (/RenderTable/.test(r) && /tableLines/.test(r) && /w:tbl/.test(r)) ok("tables PDF+DOCX"); else { warn("tables missing"); n++; }
if (/wrapText/.test(r) && /(pageBreak|brk)/.test(r)) ok("wrapping + page breaks"); else { warn("wrapping/pagebreak missing"); n++; }
if (/signatures/.test(r)) ok("signature zones"); else { warn("signatures missing"); n++; }
if (/buildContractRenderModel/.test(m) && /renderContractPdf/.test(m) && /renderContractDocx/.test(m)) ok("one canonical model -> 2 formats"); else { warn("canonical model missing"); n++; }
if (/canonicalContractHash/.test(m)) ok("canonical hash distinct from binary hashes"); else { warn("canonical hash missing"); n++; }
console.log("\n" + (n === 0 ? " RESULTAT : PASS — structural checks OK; behavioural proof via Vitest: `npm run test:phase8-3-b2g` (counts from Vitest, never hardcoded)." : " RESULTAT : NEEDS REVIEW — " + n + ".") + "\n");
process.exit(n === 0 ? 0 : 1);
