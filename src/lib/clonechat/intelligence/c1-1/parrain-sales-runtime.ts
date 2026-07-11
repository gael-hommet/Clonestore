// src/lib/clonechat/intelligence/c1-1/parrain-sales-runtime.ts
// C1.1 — Runtime de vente GROUNDED : persona + douleur exprimée → capacités RÉELLES de
// Pierre (canon vivant) → chaîne opérationnelle → contrôle/validation → prix canonique →
// CTA vers une route réelle. Persuasif mais jamais manipulateur : pas de fausse urgence,
// pas de rareté inventée, pas de ROI inventé, pas de garantie légale, pas de « remplace
// toute la RH », et TOUJOURS la séparation disponible / préparé-local / prêt-intégration /
// bloqué-externe / planifié.

import { SALES_PERSONA_PROFILES, findSalesObjection, type SalesPersonaProfile } from "../c1/clonechat-sales-brain";
import type { SalesPersona } from "../c1/clonechat-knowledge-types";
import { retrieveCapabilities, capabilityChunks } from "./parrain-pierre-index";
import { pricingChunk, productIdentityChunk } from "./parrain-product-index";
import { sitePageByRoute } from "./parrain-site-index";
import type { ParrainKnowledgeChunk, ParrainLink } from "./parrain-types";

export interface SalesTurnAnalysis {
  readonly persona: SalesPersona | null;
  readonly personaProfile: SalesPersonaProfile | null;
  readonly detectedPains: readonly string[];
  readonly matchedObjectionId: string | null;
  readonly diagnosticQuestion: string | null;
  readonly recommendedCTA: ParrainLink;
  readonly groundingChunks: readonly ParrainKnowledgeChunk[];
  readonly availabilitySplit: string;
}

const PERSONA_SIGNALS: readonly { readonly persona: SalesPersona; readonly rx: RegExp }[] = [
  { persona: "ceo", rx: /\bceo\b|dirigeant|je dirige|patron|g[ée]rant/i },
  { persona: "hr_director", rx: /\bdrh\b|responsable rh|directrice? des ressources|équipe rh/i },
  { persona: "founder", rx: /fondateur|fondatrice|startup|ma boîte|ma pme|pas de rh/i },
  { persona: "office_manager", rx: /office manager|assistante? de direction/i },
  { persona: "operations_manager", rx: /op[ée]rations|process|responsable ops/i },
  { persona: "legal_minded_buyer", rx: /juridique|avocat|conformit|l[ée]gal|rgpd/i },
  { persona: "technical_buyer", rx: /technique|s[ée]curit[ée]|architecture|api|int[ée]gration|donn[ée]es/i },
  { persona: "skeptical_buyer", rx: /sceptique|d[ée]jà vu|promesses|marketing|bullshit|prouve/i },
];

const PAIN_SIGNALS: readonly { readonly pain: string; readonly rx: RegExp }[] = [
  { pain: "Travail administratif répétitif", rx: /r[ée]p[ée]titif|administratif|paperasse|tâches manuelles/i },
  { pain: "Relances et suivis perdus", rx: /relance|oubli|suivi|perdu|tombe dans les trous/i },
  { pain: "Documents éparpillés entre outils", rx: /[ée]parpill|dispers|plusieurs outils|partout/i },
  { pain: "Onboardings en retard", rx: /onboard|int[ée]gration|arriv[ée]e|retard/i },
  { pain: "Pas de continuité opérationnelle", rx: /continuit[ée]|reprend|s'arr[êe]te|abandonn/i },
  { pain: "Devoir tout réexpliquer", rx: /r[ée]expliqu|recommencer|contexte perdu|repartir de z[ée]ro/i },
  { pain: "Risque d'une IA non contrôlée", rx: /risque|contr[ôo]le|confiance|d[ée]rape|hallucin/i },
  { pain: "Prouver qui a validé quoi", rx: /qui a valid[ée]|trace|audit|responsabilit[ée]/i },
  { pain: "La RH coordonne des micro-actions", rx: /micro-?actions|coordonner|10 actions|charge mentale/i },
];

export function analyzeSalesTurn(question: string): SalesTurnAnalysis {
  const persona = PERSONA_SIGNALS.find((p) => p.rx.test(question))?.persona ?? null;
  const profile = persona ? SALES_PERSONA_PROFILES.find((p) => p.id === persona) ?? null : null;
  const detectedPains = PAIN_SIGNALS.filter((p) => p.rx.test(question)).map((p) => p.pain);
  const objection = findSalesObjection(question);
  const capabilities = retrieveCapabilities(question, { limit: 3 });

  // Question diagnostique : UNE seule, seulement si ni douleur ni objection claire.
  const diagnosticQuestion =
    detectedPains.length === 0 && !objection
      ? "Pour viser juste : qu'est-ce qui coûte le plus de temps à votre équipe aujourd'hui — les documents, les relances/suivis, ou les onboardings ?"
      : null;

  const ctaRoute = profile?.cta.route ?? (objection?.cta.route ?? "/demo");
  const ctaPage = sitePageByRoute(ctaRoute);
  const recommendedCTA: ParrainLink = {
    route: ctaPage?.route ?? "/demo",
    label: profile?.cta.label ?? objection?.cta.label ?? "Voir la démo",
  };

  const groundingChunks: ParrainKnowledgeChunk[] = [
    productIdentityChunk(),
    pricingChunk(question),
    ...capabilityChunks(capabilities),
  ];

  return Object.freeze({
    persona,
    personaProfile: profile,
    detectedPains,
    matchedObjectionId: objection?.id ?? null,
    diagnosticQuestion,
    recommendedCTA,
    groundingChunks,
    availabilitySplit:
      "Séparation honnête à maintenir : disponible maintenant (démo, réservation fondateur, préparation gouvernée en local) · préparé/local-sûr (documents, e-mails, sessions CloneCall texte) · prêt pour intégration (technologies T1/T2) · bloqué externe (paiement en ligne, signature, envoi auto, voix, téléphonie) · planifié (Pierre Ultimate P16A). Une fonctionnalité en roadmap n'est jamais vendue comme disponible.",
  });
}

/** Comportements interdits — vérifiés par tests sur les sorties du runtime. */
export const SALES_FORBIDDEN_BEHAVIOURS: readonly string[] = Object.freeze([
  "fausse urgence",
  "fausse rareté",
  "ROI inventé",
  "garantie légale",
  "remplacement total de la RH",
  "claim live non supporté",
  "roadmap vendue comme disponible",
]);
