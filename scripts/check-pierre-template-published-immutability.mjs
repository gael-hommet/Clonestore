#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),".."); const read=(r)=>(existsSync(resolve(ROOT,r))?readFileSync(resolve(ROOT,r),"utf-8"):"");
const ok=(m)=>console.log("  ✅ "+m); const warn=(m)=>console.log("  ⚠️  "+m); let n=0;
console.log("\n══ §2 Published Template Immutability ══\n");
const v=read("supabase/migrations/2026-06-16__pierre_v9_template_immutability_trigger.sql");
if(/trg_template_version_immutable/.test(v)&&/published template version is immutable/.test(v)) ok("trigger DB d'immutabilité"); else {warn("trigger absent");n++;}
if(/may only transition to deprecated/.test(v)) ok("seule transition published→deprecated permise"); else {warn("transition non gardée");n++;}
console.log("\n"+(n===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":" RÉSULTAT : NEEDS REVIEW — "+n+".")+"\n");
