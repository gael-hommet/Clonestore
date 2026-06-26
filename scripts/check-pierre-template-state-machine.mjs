#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),".."); const read=(r)=>(existsSync(resolve(ROOT,r))?readFileSync(resolve(ROOT,r),"utf-8"):"");
const ok=(m)=>console.log("  ✅ "+m); const warn=(m)=>console.log("  ⚠️  "+m); let n=0;
console.log("\n══ §1 Template State Machine ══\n");
const s=read("src/lib/pierre/v1/template-state.ts");
if(/assertTemplateTransition/.test(s)&&/TemplateTransitionError/.test(s)&&/TEMPLATE_TRANSITIONS/.test(s)) ok("machine d'état centrale + erreur typée"); else {warn("machine absente");n++;}
const t=read("src/lib/pierre/v1/templates.ts");
if((t.match(/assertTemplateTransition/g)||[]).length>=4) ok("transitions vérifiées dans les services"); else {warn("services ne vérifient pas");n++;}
console.log("\n"+(n===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":" RÉSULTAT : NEEDS REVIEW — "+n+".")+"\n");
