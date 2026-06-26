#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok=(m)=>console.log(`  ✅ ${m}`); const warn=(m)=>console.log(`  ⚠️  ${m}`); let needs=0;
console.log("\n══ PHASE 8.3-B2 §7-9 — Template Engine — Check ══\n");
const t = read("src/lib/pierre/v1/templates.ts");
if(/FORBIDDEN_SEGMENTS = new Set\(\["__proto__", "constructor", "prototype"\]\)/.test(t)) ok("§8 anti prototype-pollution"); else { warn("anti proto absent"); needs++; }
if(/ALLOWED_NAMESPACES/.test(t) && /company.*employee.*employment.*contract.*site.*manager.*dates.*validated_custom_fields/.test(t.replace(/\n/g," "))) ok("§8 namespaces whitelist"); else { warn("namespaces absents"); needs++; }
if(/typeof cur === "function" \? undefined/.test(t)) ok("§8 fonctions jamais résolues"); else { warn("fonctions non bloquées"); needs++; }
for(const f of ["createTemplate","createTemplateVersion","validateTemplateVersion","submitTemplateForReview","approveTemplateVersion","publishTemplateVersion","deprecateTemplateVersion","buildGenerationContext","renderTemplatePreview","getPublishedTemplateVersion"]) if(t.includes(`function ${f}`)) ok(f); else { warn(f+" manquant"); needs++; }
if(/missing_fields[\s\S]*invalid_fields[\s\S]*unknown_fields[\s\S]*sensitive_fields_used[\s\S]*template_content_hash[\s\S]*generation_context_hash/.test(t)) ok("§8 résultat merge complet"); else { warn("résultat merge incomplet"); needs++; }
// B2E: publication is now guarded by the central state machine (approved→published),
// enforced in the service AND by the DB trigger — the literal status check was replaced.
if(/assertTemplateTransition\(v\.status, "published"\)/.test(t)) ok("§7 publication gardée par la machine d'état"); else { warn("publication non gardée"); needs++; }
console.log("\n"+(needs===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":` RÉSULTAT : NEEDS REVIEW — ${needs}.`)+"\n");
