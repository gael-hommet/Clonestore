// C1.7 — Vérification d'EXISTENCE des modèles (appel /v1/models : gratuit, non génératif).
// On ne configure JAMAIS un modèle par défaut sans preuve qu'il existe.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const env = {};
for (const l of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const key = env.OPENAI_API_KEY;
if (!key) { console.log("no key"); process.exit(2); }
const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
const j = await r.json();
const ids = (j.data ?? []).map((m) => m.id).sort();
const WANTED = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gpt-4o-mini", "gpt-4o"];
const out = {
  httpStatus: r.status,
  totalModels: ids.length,
  requested: Object.fromEntries(WANTED.map((w) => [w, ids.includes(w)])),
  candidatesSeen: ids.filter((i) => /^gpt-5|luna|terra|transcribe|^gpt-4o/.test(i)).slice(0, 40),
};
mkdirSync(resolve(process.cwd(), ".c1-7-proofs"), { recursive: true });
writeFileSync(resolve(process.cwd(), ".c1-7-proofs", "model-availability.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
