// Sonde LECTURE SEULE : quels profils réels existent parmi les comptes de test ?
// On ne CRÉE ni entreprise ni droit : on constate. Aucun secret imprimé.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
const BASE = process.env.C1_6_BASE ?? "http://localhost:3136";
const env = {};
for (const l of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// Pré-chauffage + patience : en dev, Next recompile la route après chaque édition et sert
// brièvement une page 404. C'est un artefact d'outillage, jamais un défaut produit.
for (let i = 0; i < 20; i++) {
  try {
    const r = await fetch(`${BASE}/api/assistant/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "ping" }) });
    if (r.status === 200) break;
  } catch { /* on réessaie */ }
  await new Promise((r) => setTimeout(r, 3000));
}

const out = {};
for (const who of ["A", "B"]) {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email: env[`RLS_TEST_USER_${who}_EMAIL`], password: env[`RLS_TEST_USER_${who}_PASSWORD`] });
  if (error || !data?.session) { out[who] = { signIn: "failed" }; continue; }
  const token = data.session.access_token;
  const ask = async (message) => {
    const r = await fetch(`${BASE}/api/assistant/chat`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    const txt = await r.text();
    let j = {};
    try { j = JSON.parse(txt); } catch { return { status: r.status, source: "NON_JSON_RESPONSE", prerequisites: [] }; }
    return { status: r.status, source: j.source, requestClass: j.requestClass, prerequisites: j.prerequisites ?? [], toolCall: j.structured?.tool_call ?? null, proposal: j.proposal ?? null };
  };
  const priv = await ask("Montre-moi mes salariés.");
  const act = await ask("Envoie l'avenant de Paul.");
  // Déduction HONNÊTE, à partir des prérequis annoncés par le serveur :
  const hasCompany = !priv.prerequisites.includes("active_company");
  const hasPierre = !act.prerequisites.includes("pierre_entitlement");
  out[who] = { hasCompany, hasPierre, privateRequest: priv, governedAction: act };
}
mkdirSync(resolve(process.cwd(), ".c1-6-proofs"), { recursive: true });
writeFileSync(resolve(process.cwd(), ".c1-6-proofs", "fixtures-probe.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
