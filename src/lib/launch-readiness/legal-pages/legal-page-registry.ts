// P-FINAL 01 — Phase 2 — Registry of all required legal pages with expected content.
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalPageDefinition, LegalPageId } from "./types";

export const LEGAL_PAGE_DEFINITIONS: Record<LegalPageId, LegalPageDefinition> = {
  cgu: {
    id: "cgu",
    title: "Conditions Générales d'Utilisation",
    path: "/legal/cgu",
    description: "Règles d'utilisation du service CloneStore et de Pierre.",
    required_for_public_launch: true,
    required_sections: [
      { id: "objet", label: "Objet du service", description: "Describe what CloneStore/Pierre does", required_for_public_launch: true },
      { id: "acceptation", label: "Acceptation des conditions", description: "How acceptance is given", required_for_public_launch: true },
      { id: "acces", label: "Accès au service", description: "How access works, subscription requirement", required_for_public_launch: true },
      { id: "limites_ia", label: "Limites de l'IA", description: "Hard limits: no autonomous termination, no payroll, no legal advice", required_for_public_launch: true },
      { id: "donnees_rh", label: "Données RH sensibles", description: "Handling of sensitive employee data", required_for_public_launch: true },
      { id: "usages_interdits", label: "Usages interdits", description: "What is explicitly forbidden", required_for_public_launch: true },
      { id: "suspension", label: "Suspension et résiliation", description: "Conditions for account suspension", required_for_public_launch: true },
      { id: "propriete", label: "Propriété intellectuelle", description: "IP ownership", required_for_public_launch: true },
      { id: "droit_applicable", label: "Droit applicable", description: "Governing law and jurisdiction", required_for_public_launch: false },
    ],
    forbidden_claims: [
      "Pierre garantit la conformité légale",
      "Pierre remplace un avocat",
      "Pierre remplace un juriste",
      "Pierre est un logiciel de paie officiel",
      "Pierre prend des décisions de licenciement",
      "zéro erreur garantie",
      "résultats garantis",
    ],
    required_disclaimers: [
      "validation humaine",
      "Pierre ne garantit pas",
      "ne remplace pas",
    ],
  },

  cgv: {
    id: "cgv",
    title: "Conditions Générales de Vente",
    path: "/legal/cgv",
    description: "Modalités commerciales, tarifaires et d'abonnement.",
    required_for_public_launch: true,
    required_sections: [
      { id: "objet", label: "Objet", description: "Scope of the CGV", required_for_public_launch: true },
      { id: "tarifs", label: "Offre et tarifs", description: "Pricing, subscription tiers", required_for_public_launch: true },
      { id: "facturation", label: "Facturation et paiement", description: "Billing, payment methods", required_for_public_launch: true },
      { id: "resiliation", label: "Renouvellement et résiliation", description: "Auto-renewal, cancellation", required_for_public_launch: true },
      { id: "remboursement", label: "Politique de remboursement", description: "Refund policy", required_for_public_launch: true },
      { id: "perimetre", label: "Périmètre du service", description: "What is included in the subscription", required_for_public_launch: true },
      { id: "exclusions", label: "Ce que le service ne comprend pas", description: "Explicit exclusions", required_for_public_launch: true },
      { id: "responsabilite", label: "Limitation de responsabilité", description: "Liability cap", required_for_public_launch: true },
    ],
    forbidden_claims: [
      "essai gratuit illimité",
      "essai gratuit de 7 jours",
      "satisfaction garantie ou remboursé",
      "aucun risque",
      "Pierre garantit",
      "résultats garantis",
    ],
    required_disclaimers: [
      "validation juridique",
      "placeholder",
    ],
  },

  dpa: {
    id: "dpa",
    title: "Data Processing Agreement",
    path: "/legal/dpa",
    description: "Accord de traitement des données personnelles (RGPD).",
    required_for_public_launch: true,
    required_sections: [
      { id: "parties", label: "Parties et qualification", description: "RT vs ST roles", required_for_public_launch: true },
      { id: "objet", label: "Objet et nature du traitement", description: "Nature and purposes", required_for_public_launch: true },
      { id: "categories_donnees", label: "Catégories de données", description: "Data categories processed", required_for_public_launch: true },
      { id: "sous_traitants", label: "Sous-traitants ultérieurs", description: "Sub-processors list", required_for_public_launch: true },
      { id: "securite", label: "Mesures de sécurité", description: "Technical/org security measures", required_for_public_launch: true },
      { id: "violation", label: "Notification des violations", description: "Breach notification", required_for_public_launch: true },
      { id: "droits", label: "Droits des personnes concernées", description: "DSAR handling", required_for_public_launch: true },
    ],
    forbidden_claims: [
      "garantit la conformité RGPD",
      "aucune violation possible",
      "données totalement sécurisées",
    ],
    required_disclaimers: [
      "validation juridique",
      "RGPD",
    ],
  },

  mentions: {
    id: "mentions",
    title: "Mentions Légales",
    path: "/legal/mentions",
    description: "Informations légales obligatoires de l'éditeur.",
    required_for_public_launch: true,
    required_sections: [
      { id: "editeur", label: "Éditeur du service", description: "Legal entity information", required_for_public_launch: true },
      { id: "directeur", label: "Directeur de publication", description: "Publication director", required_for_public_launch: true },
      { id: "hebergement", label: "Hébergement", description: "Hosting provider details", required_for_public_launch: true },
      { id: "contact", label: "Contact", description: "Official contact information", required_for_public_launch: true },
      { id: "propriete", label: "Propriété intellectuelle", description: "IP statement", required_for_public_launch: true },
    ],
    forbidden_claims: [
      "Pierre est avocat",
      "Pierre garantit",
    ],
    required_disclaimers: [
      "Pierre n'est pas",
      "validation humaine",
    ],
  },

  confidentialite: {
    id: "confidentialite",
    title: "Politique de Confidentialité",
    path: "/legal/confidentialite",
    description: "Politique de protection des données personnelles.",
    required_for_public_launch: true,
    required_sections: [
      { id: "donnees_collectees", label: "Données collectées", description: "What data is collected", required_for_public_launch: true },
      { id: "finalites", label: "Finalités du traitement", description: "Why data is processed", required_for_public_launch: true },
      { id: "base_legale", label: "Base légale", description: "Legal basis for processing", required_for_public_launch: true },
      { id: "droits", label: "Droits des personnes", description: "How to exercise rights", required_for_public_launch: true },
      { id: "conservation", label: "Durée de conservation", description: "Retention periods", required_for_public_launch: true },
      { id: "contact", label: "Contact", description: "DPO or privacy contact", required_for_public_launch: true },
    ],
    forbidden_claims: [
      "aucune donnée conservée",
      "données totalement anonymes",
      "aucun tracking",
    ],
    required_disclaimers: [
      "RGPD",
      "droits",
    ],
  },
};

export function getLegalPageDefinition(id: LegalPageId): LegalPageDefinition {
  return LEGAL_PAGE_DEFINITIONS[id];
}

export function getAllLegalPageIds(): LegalPageId[] {
  return Object.keys(LEGAL_PAGE_DEFINITIONS) as LegalPageId[];
}

export function getRequiredForLaunchPageIds(): LegalPageId[] {
  return getAllLegalPageIds().filter((id) => LEGAL_PAGE_DEFINITIONS[id].required_for_public_launch);
}
