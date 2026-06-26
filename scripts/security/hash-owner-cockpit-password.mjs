#!/usr/bin/env node
// Phase E §4.2 — Hache le mot de passe de la porte propriétaire (scrypt + sel
// aléatoire) et affiche UNIQUEMENT l'empreinte à placer dans la variable
// d'environnement CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH.
//
// Le mot de passe en clair n'est jamais affiché, ni écrit sur disque, ni codé en
// dur. La saisie est masquée (pas d'écho) et n'apparaît pas dans l'historique shell.
//
// Usage : node scripts/security/hash-owner-cockpit-password.mjs

import { scryptSync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const N = 16384, R = 8, P = 1, KEYLEN = 64;

function hashOwnerPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// Lecture masquée du mot de passe (aucun écho terminal).
function readHidden(promptText) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout;
    const onData = () => { stdout.write("[2K[200D" + promptText); };
    process.stdout.write(promptText);
    process.stdin.on("data", onData);
    rl.question("", (answer) => {
      process.stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

(async () => {
  const pw1 = (await readHidden("Mot de passe du cockpit : ")).trim();
  if (pw1.length < 12) {
    console.error("\n  Refusé : choisissez au moins 12 caractères.\n");
    process.exit(1);
  }
  const pw2 = (await readHidden("Confirmez le mot de passe : ")).trim();
  if (pw1 !== pw2) {
    console.error("\n  Les deux saisies diffèrent. Recommencez.\n");
    process.exit(1);
  }
  const hash = hashOwnerPassword(pw1);
  const b64 = Buffer.from(hash, "utf8").toString("base64");
  console.log("\n  Empreinte générée. Placez la ligne BASE64 dans votre environnement (NON committée) :\n");
  console.log(`  CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH_B64=${b64}\n`);
  console.log("  ⚠ Utilisez la forme _B64 : le hash scrypt contient des « $ » que le chargeur");
  console.log("    d'environnement de Next interprète comme des variables et CORROMPT (→ 401).");
  console.log("    Le base64 n'a aucun « $ » et traverse le chargeur intact.\n");
  console.log("    (Forme directe, à éviter en .env car corrompue par l'expansion $ :");
  console.log(`     CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH=${hash})\n`);
  console.log("  N'enregistrez jamais le mot de passe en clair.\n");
})().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
