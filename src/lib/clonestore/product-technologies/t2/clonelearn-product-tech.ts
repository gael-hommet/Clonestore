// src/lib/clonestore/product-technologies/t2/clonelearn-product-tech.ts
// T2 — CloneLearn : l'apprentissage progressif de l'entreprise. Apprend des validations,
// corrections, reformulations, refus, usages répétitifs — et PROPOSE : préférences,
// comportements recommandés, enrichissements CloneADN, avec confiance et distinction
// habitude/exception. RÈGLE DURE T2 : CloneLearn PROPOSE ; il ne mute JAMAIS silencieusement
// le comportement de l'entreprise (approvalRequired: true sur chaque candidat, adnMutated: false).

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";

export type CloneLearnSourceEvent = "validation" | "correction" | "reformulation" | "refusal" | "repetition";

export interface CloneLearnInput {
  readonly events?: readonly { readonly type?: CloneLearnSourceEvent; readonly detail?: string }[];
}

export interface CloneLearningCandidate {
  readonly sourceEventType: CloneLearnSourceEvent;
  readonly occurrences: number;
  readonly preferenceSuggestion: string;
  readonly confidence: number; // 0–1
  readonly classification: "habit" | "exception";
  readonly adnEnrichmentProposal: string;
  readonly approvalRequired: true;
}

export interface CloneLearnArtifact {
  readonly artifactKind: "clonelearn_candidates";
  readonly candidates: readonly CloneLearningCandidate[];
  readonly adnMutated: false;
  readonly modelTrained: false;
  readonly mutationPolicy: "proposal_only";
}

export const cloneLearnProductTech: ProductTechnologyContract<CloneLearnInput, CloneLearnArtifact> =
  defineProductTechnologyContract({
    id: "clonelearn",
    name: "CloneLearn",
    definition: "L'apprentissage progressif de l'entreprise : le système devient plus juste avec le temps — par PROPOSITIONS validées, jamais par mutation silencieuse.",
    role: "Transformer validations, corrections, reformulations, refus et répétitions en préférences proposées, avec confiance et distinction habitude/exception.",
    answersQuestion: "Comment le système devient-il plus juste avec le temps ?",
    contains: ["candidats d'apprentissage", "type d'événement source", "suggestion de préférence", "score de confiance", "habitude vs exception", "proposition d'enrichissement CloneADN", "validation requise"],
    doesNotContain: ["mutation automatique de CloneADN", "entraînement de modèle", "stockage de comportement non approuvé"],
    dependencies: ["cloneadn", "clonetrace"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonelearn,
    liveBlockedReason: null,
    requiresValidation: true, // chaque apprentissage est une proposition à valider
    commercialClaimAllowed: "Le système apprend les habitudes de l'entreprise et propose des améliorations — chaque apprentissage est validé par l'humain avant application.",
    commercialClaimForbidden: ["apprentissage autonome silencieux", "le système se reprogramme seul", "entraînement de modèle sur vos données"],
    prepareArtifact: (input) => {
      const events = (input?.events ?? []).filter((e) => !!e?.type && typeof e.detail === "string" && e.detail.trim().length > 0);
      // Agrégation par (type, detail) : la répétition fait l'habitude.
      const buckets = new Map<string, { type: CloneLearnSourceEvent; detail: string; count: number }>();
      for (const e of events) {
        const key = `${e.type}::${e.detail!.trim().toLowerCase()}`;
        const existing = buckets.get(key);
        if (existing) existing.count += 1;
        else buckets.set(key, { type: e.type as CloneLearnSourceEvent, detail: e.detail!.trim(), count: 1 });
      }
      const candidates: CloneLearningCandidate[] = [...buckets.values()].map((b) => {
        const confidence = Math.min(0.95, 0.3 + b.count * 0.2); // plafonné — jamais une certitude
        const habit = b.count >= 3;
        return {
          sourceEventType: b.type,
          occurrences: b.count,
          preferenceSuggestion: `Préférence observée (${b.type}) : ${b.detail}`,
          confidence,
          classification: habit ? "habit" : "exception",
          adnEnrichmentProposal: habit
            ? `Proposer d'ajouter au profil CloneADN : « ${b.detail} » (validé ${b.count}×).`
            : `Observation isolée — NE PAS enrichir CloneADN sans confirmation supplémentaire.`,
          approvalRequired: true,
        };
      });
      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "clonelearn_candidates",
          candidates,
          adnMutated: false,
          modelTrained: false,
          mutationPolicy: "proposal_only",
        },
      };
    },
  });
