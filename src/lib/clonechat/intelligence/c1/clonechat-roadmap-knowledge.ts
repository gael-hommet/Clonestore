// src/lib/clonechat/intelligence/c1/clonechat-roadmap-knowledge.ts
// C1 — Connaissance roadmap : ce qui est disponible MAINTENANT, ce qui vient ENSUITE
// (P16A Pierre Ultimate, P16C intégration), ce qui reste PLUS TARD, et ce qui dépend
// de vérifications EXTERNES. Formulations sûres (aucune promesse de date, aucun
// blocage masqué, aucune revendication live).

import type { RoadmapEntry, RoadmapHorizon } from "./clonechat-knowledge-types";

const r = (x: RoadmapEntry): RoadmapEntry => Object.freeze(x);

export const CLONECHAT_ROADMAP: readonly RoadmapEntry[] = Object.freeze([
  // ── Maintenant ──────────────────────────────────────────────────────────────
  r({
    id: "now.launch_product",
    title: "Produit de lancement (site, démo, réservation fondateur, cockpits)",
    horizon: "now",
    dependsOn: [],
    honestStatement: "Disponible et démontrable dès aujourd'hui — sans paiement.",
  }),
  r({
    id: "now.pierre_launch",
    title: "Pierre version lancement (missions, documents, validations, trace)",
    horizon: "now",
    dependsOn: [],
    honestStatement: "Prêt et prouvé de bout en bout en local ; les décisions sensibles restent humaines.",
  }),
  r({
    id: "now.technologies_ready",
    title: "Technologies T1 (15) et T2 (14) prêtes pour intégration",
    horizon: "now",
    dependsOn: [],
    honestStatement: "Couches vérifiées en local sûr : CloneOS, CloneGuard, CloneTrace, CloneCall (safe local), CloneRoom…",
  }),
  // ── Ensuite ─────────────────────────────────────────────────────────────────
  r({
    id: "next.p16a",
    title: "P16A — Pierre Ultimate (profondeur missions/documents, dossier 360, rapport de valeur mensuel…)",
    horizon: "next",
    dependsOn: ["now.pierre_launch"],
    honestStatement: "Prochain chantier planifié (12 items classés P16.0) — pas encore construit.",
  }),
  r({
    id: "next.p16c",
    title: "P16C — Intégration Pierre ↔ technologies (10 adaptateurs avec fallback sûr)",
    horizon: "next",
    dependsOn: ["next.p16a", "now.technologies_ready"],
    honestStatement: "Porte d'intégration après P16A : Pierre consommera les technologies par contrat.",
  }),
  r({
    id: "next.clonechat_ui_wiring",
    title: "Câblage de l'intelligence C1 dans l'interface CloneChat (/assistant)",
    horizon: "next",
    dependsOn: [],
    honestStatement: "La connaissance C1 est prête ; le câblage UI est une étape dédiée, derrière le flag existant.",
  }),
  // ── Plus tard ───────────────────────────────────────────────────────────────
  r({
    id: "later.voice",
    title: "Voix opérationnelle (CloneVoice)",
    horizon: "later",
    dependsOn: ["ext.voice_provider"],
    honestStatement: "Architecture prête ; s'ouvrira seulement après vérification externe d'un provider vocal.",
  }),
  r({
    id: "later.telephony",
    title: "Appels réels (CloneCall téléphonie)",
    horizon: "later",
    dependsOn: ["ext.telephony_provider"],
    honestStatement: "Safe local aujourd'hui ; l'ouverture téléphonique exige un provider télécom vérifié + un cadre légal validé.",
  }),
  r({
    id: "later.future_employees",
    title: "Futurs employés IA (autres départements)",
    horizon: "later",
    dependsOn: ["next.p16c"],
    honestStatement: "La boutique les affiche en roadmap ; le bus technologique les servira avec les mêmes règles que Pierre.",
  }),
  // ── Externe (hors de notre seul contrôle) ───────────────────────────────────
  r({
    id: "ext.stripe_live",
    title: "Ouverture du paiement en ligne",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Compte de paiement à configurer et vérifier (checklist propriétaire prête) — fermé d'ici là.",
  }),
  r({
    id: "ext.legal_tax",
    title: "Revue légale / fiscale externe (FR/BE/LU/CH)",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Paquet de revue préparé ; prérequis assumé avant toute ouverture payante.",
  }),
  r({
    id: "ext.signature",
    title: "Signature électronique vérifiée (ou fallback approuvé)",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Dossiers préparés + circuit manuel en attendant un provider vérifié.",
  }),
  r({
    id: "ext.email_provider",
    title: "Provider e-mail vérifié",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Brouillons prêts ; l'envoi reste manuel d'ici là.",
  }),
  r({
    id: "ext.voice_provider",
    title: "Provider vocal vérifié",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Condition d'ouverture de la voix.",
  }),
  r({
    id: "ext.telephony_provider",
    title: "Provider télécom vérifié + cadre légal",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Double condition avant toute ouverture de la téléphonie.",
  }),
  r({
    id: "ext.connectors",
    title: "Connecteurs SIRH / paie / Slack vérifiés",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Exports maîtrisés en attendant.",
  }),
  r({
    id: "ext.monitoring",
    title: "Monitoring de production",
    horizon: "external",
    dependsOn: [],
    honestStatement: "Pas d'ouverture sans surveillance attestée.",
  }),
  r({
    id: "ext.owner_signoff",
    title: "Sign-off propriétaire + levée délibérée du plancher P10",
    horizon: "external",
    dependsOn: ["ext.stripe_live", "ext.legal_tax", "ext.monitoring"],
    honestStatement: "La production restera OFF jusqu'à une décision de code délibérée — jamais par simple configuration.",
  }),
]);

export function roadmapByHorizon(h: RoadmapHorizon): readonly RoadmapEntry[] {
  return CLONECHAT_ROADMAP.filter((x) => x.horizon === h);
}

export function externalBlockers(): readonly RoadmapEntry[] {
  return roadmapByHorizon("external");
}

/** Prochaines phases recommandées — alignées sur P16.0. */
export const NEXT_PHASES: readonly string[] = Object.freeze(["P16A", "P16C"]);
