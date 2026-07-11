// src/lib/clonestore/product-technologies/t2/cloneadn-product-tech.ts
// T2 — CloneADN : la couche opératoire vivante de l'entreprise. Fait travailler un employé IA
// COMME CETTE ENTREPRISE (ton, formalité, circuits, formulations) — pas comme une IA générique.
// Ne contient PAS : exécution, décision de risque, orchestration, historique, voix.
// RÈGLE DURE : les enrichissements sont des PROPOSITIONS — jamais de mutation silencieuse.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";

export interface CloneADNInput {
  readonly companyName?: string;
  readonly tone?: string;
  readonly formality?: "vouvoiement" | "tutoiement";
  readonly relanceStyle?: string;
  readonly frequentFormulations?: readonly string[];
  readonly reusableTemplates?: readonly string[];
  readonly validationHabits?: readonly string[];
}

export interface CloneADNProfileArtifact {
  readonly artifactKind: "cloneadn_profile";
  readonly identity: { readonly companyName: string };
  readonly tone: string;
  readonly formality: "vouvoiement" | "tutoiement";
  readonly validationCircuitSuggestions: readonly string[];
  readonly relanceStyle: string;
  readonly frequentFormulations: readonly string[];
  readonly reusableTemplates: readonly string[];
  readonly expectedBehaviours: readonly string[];
  readonly usefulContext: string;
  /** Invariants : l'ADN propose — il ne mute rien, ne bloque rien, ne remplace pas ClonePolicy. */
  readonly mutationPolicy: "proposals_only";
  readonly adnMutated: false;
  readonly overridesPolicy: false;
}

const clean = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;

const cleanList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];

export const cloneADNProductTech: ProductTechnologyContract<CloneADNInput, CloneADNProfileArtifact> =
  defineProductTechnologyContract({
    id: "cloneadn",
    name: "CloneADN",
    definition: "La couche opératoire vivante de l'entreprise : identité, ton, formalité, habitudes de validation/relance, formulations et gabarits récurrents, circuits humains.",
    role: "Faire travailler le système comme CETTE entreprise exacte — jamais comme une IA générique.",
    answersQuestion: "Comment faire travailler le système comme cette entreprise exacte ?",
    contains: [
      "identité d'entreprise", "ton", "formalité (tutoiement/vouvoiement)", "habitudes de validation",
      "habitudes de relance", "formulations fréquentes", "gabarits récurrents", "circuits humains",
      "comportements attendus", "éléments réutilisables", "contexte utile",
    ],
    doesNotContain: ["exécution brute", "décision de risque (CloneGuard)", "logique de blocage", "orchestration (CloneOS)", "historique exhaustif (CloneTrace)", "voix (CloneVoice)"],
    dependencies: [],
    status: "integration_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.cloneadn,
    liveBlockedReason: null,
    requiresValidation: true,
    commercialClaimAllowed: "Adapte le style de travail (ton, formalité, circuits, formulations) à chaque entreprise, sur la base d'un profil validé par l'humain.",
    commercialClaimForbidden: ["apprentissage silencieux du comportement", "mémoire d'entreprise sans contrôle humain"],
    prepareArtifact: (input) => ({
      kind: "needs_validation",
      artifact: {
        artifactKind: "cloneadn_profile",
        identity: { companyName: clean(input?.companyName, "entreprise-sans-nom") },
        tone: clean(input?.tone, "professionnel, direct et chaleureux"),
        formality: input?.formality === "tutoiement" ? "tutoiement" : "vouvoiement",
        validationCircuitSuggestions: cleanList(input?.validationHabits).length > 0
          ? cleanList(input?.validationHabits)
          : ["Toute communication externe est validée par un humain avant envoi.", "Les documents RH sont relus par le responsable avant usage."],
        relanceStyle: clean(input?.relanceStyle, "courtoise, à J+3 puis J+7, jamais insistante"),
        frequentFormulations: cleanList(input?.frequentFormulations),
        reusableTemplates: cleanList(input?.reusableTemplates),
        expectedBehaviours: [
          "préparer plutôt qu'exécuter en cas de doute",
          "respecter les circuits de validation humains",
          "adopter le ton et la formalité de l'entreprise",
        ],
        usefulContext: "Profil appliqué par les technologies produit (brief, review, call, room) — la source durable reste CloneADN existant (src/lib/clonestore/adn/**).",
        mutationPolicy: "proposals_only",
        adnMutated: false,
        overridesPolicy: false,
      },
    }),
  });
