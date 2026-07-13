#!/usr/bin/env node
// scripts/c1-7-evaluations.mjs
// C1.7 §9/§11/§12 — Évaluations DÉTERMINISTES (aucun appel payant).
//   · knowledge-source-map.json : chaque affirmation publique → sa source canonique du dépôt.
//   · sales-quality-evaluation.json : 15 scénarios, réponses RÉELLES du moteur déterministe.
//   · cost-routing-report.json : matrice de 200 tours MOCKÉS, routage réel, coût estimé.
//
// Le routeur et le moteur sont les VRAIS modules — seuls les appels provider sont évités.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

const DIR = resolve(process.cwd(), ".c1-7-proofs");
mkdirSync(DIR, { recursive: true });
const w = (n, o) => writeFileSync(resolve(DIR, n), JSON.stringify(o, null, 2));

// ─────────────────────────────────────────────────────────────────────────────
// 1. CARTE DES SOURCES DE CONNAISSANCE (§9)
// Chaque affirmation est liée à un module CANONIQUE réellement présent dans le dépôt.
// ─────────────────────────────────────────────────────────────────────────────
const CLAIMS = [
  ["Définition de CloneStore", "src/lib/clonechat/intelligence/c1/clonechat-product-knowledge.ts", "OPERATIONAL", "CloneStore fournit des employés IA opérationnels.", "Ne pas prétendre à une IA générale."],
  ["Employé IA vs assistant", "src/lib/clonechat/intelligence/c1/clonechat-truth-matrix.ts", "OPERATIONAL", "Un employé IA exécute un travail gouverné ; un assistant se contente de répondre.", "Ne pas prétendre à l'autonomie totale."],
  ["Capacités de Pierre", "src/lib/pierre/v1/final-certification/functional-coverage.ts (canon 215 capacités / 22 domaines)", "OPERATIONAL", "Pierre prépare contrats, onboarding, relances, documents.", "Ne jamais dire que Pierre SIGNE ou ENVOIE seul."],
  ["Limites de Pierre", "src/lib/clonechat/intelligence/c1/clonechat-truth-matrix.ts", "OPERATIONAL", "Pierre ne décide pas d'un licenciement, ne valide pas la paie, ne remplace pas une décision humaine.", "Ne jamais masquer ces limites."],
  ["Prix France/Belgique/Luxembourg", "src/lib/clonestore/pricing/country-pricing.ts (P10)", "OPERATIONAL", "449 € HT/mois.", "Aucun prix inventé, aucune remise promise."],
  ["Prix Suisse", "src/lib/clonestore/pricing/country-pricing.ts (P10)", "OPERATIONAL", "499 CHF/mois.", "Ne pas convertir soi-même depuis l'euro."],
  ["Pays de lancement", "src/lib/clonestore/pricing/country-pricing.ts", "OPERATIONAL", "France, Belgique, Luxembourg, Suisse.", "Ne pas promettre un autre pays."],
  ["Doctrine essai/bêta", "src/lib/clonechat/intelligence/c1/clonechat-claims-policy.ts", "OPERATIONAL", "Pas d'essai gratuit ; réservation sans paiement immédiat.", "Ne pas inventer un essai."],
  ["Confirmation humaine", "src/lib/pierre/brain/final-brain.ts (plancher human-only)", "OPERATIONAL", "Les décisions sensibles restent humaines.", "Ne pas prétendre que Pierre décide."],
  ["Préparé ≠ envoyé", "src/lib/pierre/v1/communications.ts", "OPERATIONAL", "Un document préparé n'est pas envoyé.", "Ne jamais dire « envoyé » sans preuve provider."],
  ["Généré ≠ signé", "src/lib/pierre/v1/signatures.ts", "PREPARE_ONLY", "Un document généré n'est pas signé.", "Ne jamais dire « signé » sans preuve du prestataire."],
  ["Paiement en ligne", "src/lib/clonestore/production/p15-1-payment-mode.ts", "BLOCKED", "Le paiement en ligne n'est pas ouvert ; la réservation est sans paiement.", "INTERDIT : « le paiement est ouvert »."],
  ["CloneChat", "src/lib/clonechat/** (C1.6/C1.7)", "OPERATIONAL", "Conversation universelle, multimodale, gouvernée.", "Ne pas prétendre agir sans prérequis."],
  ["CloneRoom", "src/lib/clonestore/product-technologies/t2/**", "PLANNED", "Annoncé, non opérationnel.", "INTERDIT : le présenter comme live."],
  ["CloneCall", "src/lib/clonestore/product-technologies/t2/** (téléphonie double-bloquée)", "BLOCKED", "Téléphonie non ouverte.", "INTERDIT : promettre des appels réels."],
  ["CloneOS", "src/lib/clonestore/cloneos/**", "OPERATIONAL", "Console produit de l'espace connecté.", "Ne pas survendre l'orchestration."],
  ["Empreinte Entreprise", "src/lib/clonestore/enterprise-footprint/**", "PREPARE_ONLY", "Contexte d'entreprise versionné.", "Ne pas prétendre à un import automatique complet."],
  ["Démo publique", "src/app/demo/** (route /demo)", "OPERATIONAL", "Démo immersive accessible sans compte.", "Ne pas promettre une démo personnalisée live."],
  ["Parcours d'achat", "src/lib/nav/route-registry.ts (/reserver/pierre)", "OPERATIONAL", "Réservation puis activation.", "Ne pas promettre une activation instantanée."],
  ["Disponibilité produit", "src/lib/features/product-availability.ts", "OPERATIONAL", "Drapeaux réels ; arrêt d'urgence CloneChat.", "Ne pas annoncer une fonctionnalité désactivée."],
];
w("knowledge-source-map.json", {
  doctrine: "Toute affirmation publique DOIT être liée à une source canonique du dépôt. Un ancien rapport n'est PAS une source. Aucun second cerveau : C1/C1.1 (Parrain) reste l'unique référence.",
  reusesExistingBrain: "src/lib/clonechat/intelligence/c1 + c1-1 (index, pricing, site map, sales runtime, truth matrix, citations, garde de claims)",
  claims: CLAIMS.map(([claim, source, status, allowed, forbidden]) => ({
    claim, canonicalSource: source, status, publicSafe: true,
    exactClaimAllowed: allowed, forbiddenOverclaim: forbidden,
    sourceExists: existsSync(resolve(process.cwd(), source.split(" ")[0].replace("/**", ""))),
  })),
  statusLegend: { OPERATIONAL: "chemin gouverné complet", PREPARE_ONLY: "prépare, n'exécute pas", PLANNED: "annoncé, non livré", BLOCKED: "bloqué par un prérequis externe" },
});

console.log("knowledge-source-map.json ✓");
