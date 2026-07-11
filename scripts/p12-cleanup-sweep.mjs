// scripts/p12-cleanup-sweep.mjs
// P12 — balayage de nettoyage / ZÉRO RÉSIDU. Réutilise le style de nettoyage de
// scripts/p12-cloneos-shell-e2e.mjs : liste les utilisateurs éphémères P12 E2E
// (email p12-e2e-* ou user_metadata.purpose=p12-shell-e2e), supprime leurs orders +
// profiles + comptes, puis confirme qu'il n'en reste aucun. READ-ONLY sur toute autre donnée.
// Flag requis pour éviter toute exécution accidentelle : P12_CLEANUP_I_UNDERSTAND=yes

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

if (process.env.P12_CLEANUP_I_UNDERSTAND !== "yes") {
  console.error("flag P12_CLEANUP_I_UNDERSTAND=yes requis");
  process.exit(1);
}

function env() {
  const t = readFileSync("C:/Users/homme/clonestore/.env.local", "utf8");
  const e = {};
  for (const l of t.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      e[m[1]] = v;
    }
  }
  return e;
}

const E = env();
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const isP12 = (u) => /p12-e2e-/.test(u.email || "") || u?.user_metadata?.purpose === "p12-shell-e2e";

const { data: before } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const orphans = (before?.users ?? []).filter(isP12);
console.log("p12-e2e orphan users found:", orphans.length);

for (const o of orphans) {
  try { await admin.from("orders").delete().eq("user_id", o.id); } catch {}
  try { await admin.from("profiles").delete().eq("id", o.id); } catch {}
  try { await admin.auth.admin.deleteUser(o.id); console.log("deleted", o.email); }
  catch (err) { console.log("delete FAILED", o.email, err?.message); }
}

const { data: after } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const remaining = (after?.users ?? []).filter(isP12).length;
console.log("remaining p12-e2e users:", remaining, remaining === 0 ? "— ZERO RESIDUE" : "— RESIDUE!");
process.exitCode = remaining === 0 ? 0 : 1;
