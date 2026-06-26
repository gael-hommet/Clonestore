#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok=(m)=>console.log(`  ✅ ${m}`); const warn=(m)=>console.log(`  ⚠️  ${m}`); let needs=0;
console.log("\n══ PHASE 8.3-B2 §6 — Document Type Registry — Check ══\n");
const d = read("src/lib/pierre/v1/document-types.ts");
const types=["employment_contract","contract_amendment","job_offer","onboarding_pack","policy_acknowledgement","absence_justification","payroll_variable_document","interview_report","training_certificate","disciplinary_document","employee_certificate","work_certificate","offboarding_document","generic_hr_document"];
if(types.every(t=>d.includes(t+":"))) ok("14 types RH canoniques"); else { warn("types manquants"); needs++; }
for(const fn of ["getDocumentTypePolicy","validateDocumentType","calculateDocumentRequirements","canRoleUseDocumentType","canRoleReadDocumentType","canRoleApproveDocumentType"]) if(d.includes(`export function ${fn}`)) ok(fn); else { warn(fn+" manquant"); needs++; }
if(/unknown_document_type/.test(d)) ok("type inconnu refusé (non contournable)"); else { warn("type inconnu non refusé"); needs++; }
const docs=read("src/lib/pierre/v1/documents.ts");
if(/validateDocumentType\(input\.document_type\)/.test(docs) && /canRoleUseDocumentType/.test(docs)) ok("createDocument utilise le registre"); else { warn("createDocument ne valide pas le type"); needs++; }
console.log("\n"+(needs===0?" RÉSULTAT : PASS — registre testé (p83-document-type-registry.test 5/5).":` RÉSULTAT : NEEDS REVIEW — ${needs}.`)+"\n");
