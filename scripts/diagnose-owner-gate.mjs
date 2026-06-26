#!/usr/bin/env node
// Diagnostic owner-gate : compare le mot de passe (saisi masqué, jamais journalisé) au MÊME
// hash normalisé que la route Next, puis exécute le VRAI POST /unlock. N'affiche jamais le
// mot de passe, le hash ni le cookie — seulement longueur/segments/empreinte + résultats.
//
//   node scripts/diagnose-owner-gate.mjs [--url=http://localhost:3000]
//   (non-interactif pour tests : OWNER_GATE_TEST_PASSWORD=… node scripts/diagnose-owner-gate.mjs)
import readline from "node:readline";
import { resolveHashInfo, verifyPassword, parseEnvFile } from "./owner-hash-util.mjs";

const base = (process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3000").replace(/\/$/, "");
const env = { ...parseEnvFile(".env.local"), ...process.env };
const cookieSecret = env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET;
const slug = env.CLONESTORE_OWNER_COCKPIT_SLUG;

const info = resolveHashInfo(env); // base64 prioritaire, repli variable directe
const CONFIG_OK = info.present && Boolean(cookieSecret) && Boolean(slug);
const HASH_FORMAT_OK = info.formatValid;

console.log(`hash_length=${info.length} hash_parts=${info.parts} hash_fingerprint=${info.fingerprint ?? "-"}`);
console.log(`CONFIG_OK=${CONFIG_OK}`);
console.log(`HASH_FORMAT_OK=${HASH_FORMAT_OK}`);

function askHidden(query) {
  if (process.env.OWNER_GATE_TEST_PASSWORD != null) return Promise.resolve(process.env.OWNER_GATE_TEST_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Masque la saisie (n'écrit jamais le mot de passe à l'écran ni dans les logs).
    rl._writeToOutput = (s) => rl.output.write(s.includes(query) ? query : "*");
    rl.question(query, (a) => { rl.output.write("\n"); rl.close(); resolve(a); });
  });
}

const password = await askHidden("Mot de passe propriétaire (masqué) : ");
const PASSWORD_MATCH = password.length > 0 && Boolean(info.normalized) && verifyPassword(password, info.normalized);
console.log(`PASSWORD_MATCH=${PASSWORD_MATCH}`);

let status = "(no-server)";
let setCookie = false;
try {
  const res = await fetch(`${base}/api/internal/owner-gate/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }), // entrée /founder : aucun slug
  });
  status = res.status;
  setCookie = Boolean(res.headers.get("set-cookie"));
} catch (e) {
  status = `(fetch-failed: ${e.message})`;
}
console.log(`HTTP_STATUS=${status}`);
console.log(`SET_COOKIE_PRESENT=${setCookie}`);

if (PASSWORD_MATCH && status === 401) {
  console.log(`\n⚠ PASSWORD_MATCH=true mais la route renvoie 401 : le serveur Next charge un hash`);
  console.log(`  DIFFÉRENT du .env.local (empreinte attendue ${info.fingerprint}). Serveur obsolète →`);
  console.log(`  relancez « npm run dev:clean » puis réessayez. (Activez CLONESTORE_OWNER_GATE_DIAG=1`);
  console.log(`  pour voir la raison exacte côté serveur.)`);
}
