#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok=(m)=>console.log(`  ✅ ${m}`); const warn=(m)=>console.log(`  ⚠️  ${m}`); let needs=0;
console.log("\n══ PHASE 8.3-B2C §1/§2 — Template Merge Security — Check ══\n");
const t=read("src/lib/pierre/v1/templates.ts");
if(/§1 — UNKNOWN \(undeclared\) fields are NEVER resolved/.test(t) && /if \(!declared\.has\(path\)\)/.test(t)) ok("§1 champ inconnu jamais résolu (safeGet non appelé)"); else { warn("§1 non corrigé"); needs++; }
if(/resolveFieldPolicy\(path, customDefs\)/.test(t) && /sensitivity === "sensitive" \|\| policy\.sensitivity === "restricted"/.test(t)) ok("§2 sensibilité canonique (registre, pas template)"); else { warn("§2 sensibilité non canonique"); needs++; }
if(/readyPreview = invalid\.size === 0 && unknown\.size === 0/.test(t)) ok("ready_for_preview=false si unknown"); else { warn("ready_for_preview non corrigé"); needs++; }
const f=read("src/lib/pierre/v1/field-policies.ts");
if(/FIELD_POLICIES/.test(f) && /resolveFieldPolicy/.test(f) && /CustomFieldDefinition/.test(f)) ok("registre field policy + custom defs"); else { warn("field-policies absent"); needs++; }
if(/validateDocumentType/.test(t) && /allowed_renderers\.includes/.test(t)) ok("§3 validation type + renderer"); else { warn("§3 validation absente"); needs++; }
if(/validateTemplateVersionInternal/.test(t)) ok("§7 validation interne séparée du RBAC"); else { warn("§7 non séparé"); needs++; }
if(/approved_fingerprint/.test(t) && /computeFingerprint/.test(t)) ok("§5 fingerprint d'approbation"); else { warn("§5 fingerprint absent"); needs++; }
if(/for update/.test(t)) ok("§6 allocation de version verrouillée"); else { warn("§6 lock absent"); needs++; }
console.log("\n"+(needs===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":` RÉSULTAT : NEEDS REVIEW — ${needs}.`)+"\n");
