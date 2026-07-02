#!/usr/bin/env node
// PHASE F §14 — porte unique de l'expérience publique / présentation / démo.
// Vérifie des INVARIANTS structurels (pas des greps fragiles isolés) :
//   1) toutes les routes publiques du parcours existent ;
//   2) intégrité du funnel (chaque page renvoie vers l'étape suivante attendue) ;
//   3) prix cohérent (source de vérité 449 € HT) ;
//   4) démo réellement sûre (disclaimers + aucun effet de bord réel) ;
//   5) aucune fausse promesse (liste noire) ;
//   6) aucun secret dans les fichiers publics client ;
//   7) message de différenciation employé IA vs assistant présent.
// exit 0 = tout vert ; exit 1 = au moins un défaut produit/contenu.

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), "utf-8");
const has = (p) => existsSync(resolve(root, p));

const failures = [];
const checks = [];
const ok = (name) => checks.push({ name, ok: true });
const ko = (name, detail) => { checks.push({ name, ok: false, detail }); failures.push(`${name} — ${detail}`); };

// ── 1) Routes publiques du parcours ─────────────────────────────────────────
const ROUTES = {
  home: "src/app/page.tsx",
  agents: "src/app/agents/page.tsx",
  pierre: "src/app/agents/pierre/page.tsx",
  demo: "src/app/demo/pierre/page.tsx",
  questions: "src/app/questions/page.tsx",
  reserver: "src/app/reserver/pierre/page.tsx",
  reservationForm: "src/app/reserver/pierre/ReservationForm.tsx",
  signup: "src/app/signup/page.tsx",
  login: "src/app/login/page.tsx",
  onboarding: "src/app/profile/onboarding/page.tsx",
};
for (const [key, file] of Object.entries(ROUTES)) {
  if (has(file)) ok(`route:${key}`); else ko(`route:${key}`, `fichier manquant: ${file}`);
}

const src = Object.fromEntries(
  Object.entries(ROUTES).filter(([, f]) => has(f)).map(([k, f]) => [k, read(f)]),
);

// ── 2) Intégrité du funnel ──────────────────────────────────────────────────
const link = (content, href) => content && content.includes(`"${href}"`);
const funnel = [
  ["home→demo", "home", "/demo/pierre"],
  ["home→reserver", "home", "/reserver/pierre"],
  ["pierre→demo", "pierre", "/demo/pierre"],
  ["demo→reserver", "demo", "/reserver/pierre"],
  ["demo→pierre", "demo", "/agents/pierre"],
];
for (const [name, page, href] of funnel) {
  if (link(src[page], href)) ok(`funnel:${name}`); else ko(`funnel:${name}`, `${page} ne renvoie pas vers ${href}`);
}
// La boutique /agents renvoie vers la fiche Pierre ET vers sa démo. On vérifie le
// COMPORTEMENT utilisateur réel (les deux liens présents), pas une implémentation
// particulière : la boutique a été reconstruite avec un lien Pierre statique
// (plus de map dynamique `/agents/${agent.slug}`), ce qui reste valide.
if (link(src.agents, "/agents/pierre") && link(src.agents, "/demo/pierre"))
  ok("funnel:agents→pierre");
else ko("funnel:agents→pierre", "la boutique /agents ne renvoie pas vers la fiche Pierre / sa démo");

// ── 3) Prix cohérent (source de vérité 449 € HT) ────────────────────────────
const priceSrc = "src/lib/demo/presentation/commercial-state.ts";
if (has(priceSrc) && /FOUNDER_PRICE\s*=\s*"449 € HT"/.test(read(priceSrc))) ok("price:source-of-truth");
else ko("price:source-of-truth", `449 € HT introuvable dans ${priceSrc}`);
for (const page of ["home", "pierre", "demo"]) {
  if (src[page] && src[page].includes("449")) ok(`price:visible:${page}`); else ko(`price:visible:${page}`, `prix 449 absent de ${page}`);
}
// La page réservation référence la constante prix (jamais un prix codé en dur divergent).
if (src.reserver && /FOUNDER_PRICE_MONTHLY|449/.test(src.reserver)) ok("price:visible:reserver");
else ko("price:visible:reserver", "prix absent de la page réservation");

// ── 4) Démo réellement sûre ─────────────────────────────────────────────────
const demo = src.demo ?? "";
const SAFETY = [/aucune action réelle/i, /données fictives/i, /aucun appel ia/i, /validation humaine/i];
if (SAFETY.every((re) => re.test(demo))) ok("demo:safety-disclaimers");
else ko("demo:safety-disclaimers", "un disclaimer de sécurité manque dans la démo");
// Aucun effet de bord réel dans la démo : on cible le CODE réel (imports/appels),
// pas la prose rassurante du type "aucun appel Supabase/Stripe".
const SIDE_EFFECTS = [
  /\bfetch\s*\(/, /\.from\([^)]*\)\.(insert|upsert|update|delete)/,
  /from\s+["']@supabase/, /createClient\s*\(/, /new\s+Stripe\s*\(/, /from\s+["']stripe["']/, /from\s+["']resend["']/,
];
const demoLeaks = SIDE_EFFECTS.filter((re) => re.test(demo)).map((re) => re.source);
if (demoLeaks.length === 0) ok("demo:no-real-side-effects");
else ko("demo:no-real-side-effects", `effet de bord potentiel: ${demoLeaks.join(", ")}`);

// ── 5) Aucune fausse promesse (liste noire) ─────────────────────────────────
const FALSE_PROMISES = [
  /zéro erreur/i, /conformité garantie/i, /remplace (?:un |votre )?avocat(?! ni| pas)/i,
  /DSN autonome/i, /paie officielle/i, /licenciement automatique/i, /7 jours gratuits/i, /open.bar/i,
];
for (const [page, content] of Object.entries(src)) {
  const hits = FALSE_PROMISES.filter((re) => re.test(content)).map((re) => re.source);
  if (hits.length === 0) ok(`no-false-promise:${page}`);
  else ko(`no-false-promise:${page}`, `fausse promesse détectée: ${hits.join(", ")}`);
}

// ── 6) Aucun secret dans les fichiers publics ───────────────────────────────
const SECRETS = [/sk_live_[A-Za-z0-9]/, /sk_test_[A-Za-z0-9]/, /whsec_[A-Za-z0-9]/, /\bre_[a-z0-9]{12,}/, /SERVICE_ROLE_KEY\s*=\s*["'][A-Za-z0-9]/];
for (const [page, content] of Object.entries(src)) {
  const leaks = SECRETS.filter((re) => re.test(content)).map((re) => re.source);
  if (leaks.length === 0) ok(`no-secret:${page}`);
  else ko(`no-secret:${page}`, `secret potentiel: ${leaks.join(", ")}`);
}

// ── 7) Différenciation employé IA vs assistant (message central) ────────────
if (src.home && /assistant/i.test(src.home) && /(prend le travail|emplo(y|i)é ia)/i.test(src.home)) ok("home:differentiator");
else ko("home:differentiator", "message employé IA vs assistant absent de la homepage");
if (src.pierre && /assistant/i.test(src.pierre)) ok("pierre:differentiator");
else ko("pierre:differentiator", "positionnement (vs assistant) absent de la page Pierre");

// ── 8) Démo : phrase de sécurité explicite ──────────────────────────────────
if (/Démonstration sécurisée — aucune action réelle envoyée/.test(demo)) ok("demo:explicit-safe-phrase");
else ko("demo:explicit-safe-phrase", "phrase de sécurité explicite absente de la démo");

// ── Rapport ──────────────────────────────────────────────────────────────────
console.log("\n=== Phase F — Public Presentation & Demo ===");
const passed = checks.filter((c) => c.ok).length;
for (const c of checks) if (!c.ok) console.log(`  ✗ ${c.name} — ${c.detail}`);
console.log(`\n${passed}/${checks.length} contrôles verts.`);
if (failures.length === 0) {
  console.log("[check] OK — présentation publique, funnel, démo et garde-fous conformes.");
  process.exit(0);
}
console.log(`[check] ÉCHEC — ${failures.length} défaut(s) produit/contenu.`);
process.exit(1);
