#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),".."); const read=(r)=>(existsSync(resolve(ROOT,r))?readFileSync(resolve(ROOT,r),"utf-8"):"");
const ok=(m)=>console.log("  ✅ "+m); const warn=(m)=>console.log("  ⚠️  "+m); let n=0;
console.log("\n══ §4 Template Version Concurrency ══\n");
const t=read("src/lib/pierre/v1/templates.ts");
if(/for update/.test(t)&&/db\.transaction/.test(t)) ok("BEGIN + FOR UPDATE + INSERT dans une transaction"); else {warn("pas de lock transactionnel");n++;}
const test=read("src/lib/pierre/v1/__integration__/p83-template-real-concurrency.itest.ts");
if(/Promise\.all/.test(test)&&/length: 10/.test(test)) ok("test concurrence réel (10 simultanés)"); else {warn("test séquentiel");n++;}
console.log("\n"+(n===0?" RÉSULTAT : PASS — vérifications structurelles OK; preuve comportementale via Vitest: `npm run test:phase8-3-b2` (décomptes fournis par Vitest, jamais codés en dur).":" RÉSULTAT : NEEDS REVIEW — "+n+".")+"\n");
