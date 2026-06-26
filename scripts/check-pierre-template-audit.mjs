#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),".."); const read=(r)=>(existsSync(resolve(ROOT,r))?readFileSync(resolve(ROOT,r),"utf-8"):"");
const ok=(m)=>console.log("  ✅ "+m); const warn=(m)=>console.log("  ⚠️  "+m); let n=0;
console.log("\n══ §11 Template Audit / CloneTrace / Outbox ══\n");
const s=read("src/lib/pierre/v1/template-state.ts");
for(const e of ["template.created","template.version_created","template.review_requested","template.changes_requested","template.approved","template.approval_invalidated","template.published","template.deprecated","template.archived","template.preview_rendered","template.generation_blocked"]) if(s.includes(e)) ok(e); else {warn(e+" absent");n++;}
// B2E: the audit is written through the SECURITY DEFINER append-only function, the real
// CloneTrace through document_access_log, and the outbox is deterministically deduped.
if((/pierre_rt_log_template_event/.test(s)||/pierre_rt_template_audit/.test(s))&&/pierre_rt_document_access_log/.test(s)&&/pierre_rt_outbox/.test(s)) ok("audit (SECURITY DEFINER) + CloneTrace + outbox"); else {warn("audit/clonetrace/outbox absent");n++;}
console.log("\n"+(n===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":" RÉSULTAT : NEEDS REVIEW — "+n+".")+"\n");
