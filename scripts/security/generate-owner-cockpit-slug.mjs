#!/usr/bin/env node
// Phase E §4.1 — Génère un slug secret cryptographiquement aléatoire pour la route
// du Founder Command Center. Le slug N'EST PAS codé en dur : place la valeur
// affichée dans CLONESTORE_OWNER_COCKPIT_SLUG (variable d'environnement).
//
// Usage : node scripts/security/generate-owner-cockpit-slug.mjs

import { randomBytes } from "node:crypto";

// 24 octets → 32 caractères base64url : espace de recherche ~2^192, non devinable.
const slug = randomBytes(24).toString("base64url");

console.log("");
console.log("  Slug du Founder Command Center généré.");
console.log("  Ajoutez cette ligne à votre environnement (NON committée) :");
console.log("");
console.log(`  CLONESTORE_OWNER_COCKPIT_SLUG=${slug}`);
console.log("");
console.log(`  Le cockpit sera alors atteignable sur : /internal/${slug}/command-center`);
console.log("  Un mauvais slug renvoie 404 sans révéler l'existence du cockpit.");
console.log("");
