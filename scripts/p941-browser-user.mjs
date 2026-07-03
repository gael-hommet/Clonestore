// P9.4.1 — create/delete un utilisateur Supabase éphémère pour la vérif navigateur.
// Flag: P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
if (process.env.P94_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES !== "yes") { console.error("flag requis"); process.exit(1); }
function env(){const t=readFileSync("C:/Users/homme/clonestore/.env.local","utf8");const e={};for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m){let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);e[m[1]]=v;}}return e;}
const E=env();
const admin=createClient(E.NEXT_PUBLIC_SUPABASE_URL,E.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const mode=process.argv[2]??"create";
if(mode==="create"){
  const runId="p941b"+randomUUID().slice(0,8).replace(/-/g,"");
  const email=`p94-e2e-a-${runId}@example.invalid`; const password="Qa!"+randomBytes(18).toString("base64url");
  const {data:u,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:"p941-browser",run_id:runId}});
  if(error){console.error(error.message);process.exit(2);}
  const id=u.user.id;
  await admin.from("profiles").upsert({id,email,full_name:`p941-${runId}`},{onConflict:"id"});
  await admin.from("orders").upsert({user_id:id,agent_slug:"pierre",status:"active",started_at:new Date().toISOString()},{onConflict:"user_id,agent_slug"});
  console.log(JSON.stringify({userId:id,email,password,runId}));
} else {
  const id=process.argv[3];
  try{await admin.from("orders").delete().eq("user_id",id);}catch{}
  try{await admin.from("profiles").delete().eq("id",id);}catch{}
  try{await admin.auth.admin.deleteUser(id);}catch{}
  const {data}=await admin.auth.admin.listUsers({page:1,perPage:200});
  console.log((data?.users??[]).some(x=>x.id===id)?"RESIDUE":"DELETED — ZERO RESIDUE");
}
