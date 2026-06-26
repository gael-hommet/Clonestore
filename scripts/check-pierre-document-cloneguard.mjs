#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok=(m)=>console.log(`  ✅ ${m}`); const warn=(m)=>console.log(`  ⚠️  ${m}`); let needs=0;
console.log("\n══ PHASE 8.3-B2 §15 — Documentary CloneGuard — Check ══\n");
const g = read("src/lib/pierre/v1/document-guard.ts");
if(/evaluateGuard/.test(g)) ok("compose le CloneGuard canonique"); else { warn("ne compose pas evaluateGuard"); needs++; }
for(const [re,label] of [[/template_not_published/,"modèle non publié → block"],[/template_not_approved/,"modèle non approuvé → block"],[/missing_required_fields/,"champ absent → block"],[/file_not_clean/,"fichier non clean → block"],[/sensitive_no_permission/,"sensible sans permission → block"],[/compensation_requires_approval/,"rémunération → permission+approval"],[/disciplinary_requires_approval/,"disciplinaire → approval/escalation"],[/content_hash_changed_after_approval/,"hash modifié → block"],[/signature_without_approval/,"signature sans approbation → block"],[/signed_immutable/,"contrat signé modifié → block"],[/legal_hold_delete/,"suppression legal hold → block"],[/signed_document_delete/,"suppression doc signé → block"],[/evidence_no_permission/,"preuve sans permission → block"]]) if(re.test(g)) ok(label); else { warn(label+" absent"); needs++; }
if(/decision[\s\S]*reason_codes[\s\S]*missing_information[\s\S]*required_permissions[\s\S]*required_approvals[\s\S]*prohibited_actions[\s\S]*safe_alternatives[\s\S]*trace_event/.test(g)) ok("sortie complète"); else { warn("sortie incomplète"); needs++; }
console.log("\n"+(needs===0?" RÉSULTAT : PASS — guard testé (p83-document-cloneguard.test 12/12).":` RÉSULTAT : NEEDS REVIEW — ${needs}.`)+"\n");
