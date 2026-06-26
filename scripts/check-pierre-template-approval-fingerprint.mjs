#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok=(m)=>console.log(`  ✅ ${m}`); const warn=(m)=>console.log(`  ⚠️  ${m}`); let needs=0;
console.log("\n══ PHASE 8.3-B2C §5/§6/§7 — Approval Fingerprint — Check ══\n");
const t=read("src/lib/pierre/v1/templates.ts");
if(/TemplateApprovalFingerprint/.test(t) && /content_hash[\s\S]*schema_hash[\s\S]*renderer[\s\S]*document_type[\s\S]*locale[\s\S]*jurisdiction/.test(t)) ok("fingerprint couvre content/schema/renderer/type/locale/jurisdiction"); else { warn("fingerprint incomplet"); needs++; }
if(/Approval invalidated: template content changed/.test(t)) ok("publication bloquée si drift"); else { warn("drift non bloqué"); needs++; }
if(/template\.approve.*§7|§7 — approve does NOT require template\.read/.test(t)) ok("§7 approve sans template.read"); else { warn("§7 non documenté"); needs++; }
console.log("\n"+(needs===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":` RÉSULTAT : NEEDS REVIEW — ${needs}.`)+"\n");
