// src/lib/clonestore/product-technologies/t2/clonebrief-product-tech.ts
// T2 — CloneBrief : la synthèse exécutive. Briefing matin/soir, résumé missions, blocages,
// validations en attente, actions autonomes, décisions à prendre. RÈGLES DURES : ne construit
// QUE sur les faits fournis (jamais d'invention), « préparé » n'est JAMAIS présenté comme
// « fait », les blocages ne sont JAMAIS masqués.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";

export interface CloneBriefFact {
  readonly title?: string;
  readonly state?: "prepared" | "done" | "blocked" | "waiting";
  readonly detail?: string;
}

export interface CloneBriefInput {
  readonly when?: "morning" | "evening";
  readonly missions?: readonly CloneBriefFact[];
  readonly blockers?: readonly CloneBriefFact[];
  readonly waitingValidations?: readonly CloneBriefFact[];
  readonly autonomousActions?: readonly CloneBriefFact[];
  readonly decisionsNeeded?: readonly CloneBriefFact[];
}

export interface CloneBriefSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

export interface CloneBriefArtifact {
  readonly artifactKind: "clonebrief_artifact";
  readonly when: "morning" | "evening";
  readonly sections: readonly CloneBriefSection[];
  readonly counts: {
    readonly missions: number; readonly blockers: number; readonly waitingValidations: number;
    readonly autonomousActions: number; readonly decisionsNeeded: number;
  };
  readonly onlyProvidedFacts: true;
  readonly preparedNeverClaimedAsDone: true;
  readonly blockersHidden: false;
  readonly inventedFacts: false;
}

const factLine = (f: CloneBriefFact): string => {
  const title = (f.title ?? "élément sans titre").trim();
  const state =
    f.state === "done" ? "FAIT"
    : f.state === "blocked" ? "BLOQUÉ"
    : f.state === "waiting" ? "EN ATTENTE"
    : "PRÉPARÉ (non exécuté)"; // défaut honnête : préparé ≠ fait
  return `${title} — ${state}${f.detail ? ` — ${f.detail.trim()}` : ""}`;
};

export const cloneBriefProductTech: ProductTechnologyContract<CloneBriefInput, CloneBriefArtifact> =
  defineProductTechnologyContract({
    id: "clonebrief",
    name: "CloneBrief",
    definition: "La synthèse exécutive : ce que le client doit savoir maintenant — missions, blocages, validations, actions autonomes, décisions.",
    role: "Produire les briefings matin/soir et les résumés de mission à partir des faits de CloneTrace/CloneContinuum/CloneSignals — sans jamais inventer.",
    answersQuestion: "Que doit savoir le client maintenant ?",
    contains: ["briefing du matin", "briefing du soir", "résumé de mission", "résumé des blocages", "validations en attente", "actions autonomes", "décisions à prendre"],
    doesNotContain: ["invention de faits", "« fait » quand c'est seulement préparé", "blocages masqués"],
    dependencies: ["clonetrace", "clonecontinuum", "clonesignals"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonebrief,
    liveBlockedReason: null,
    requiresValidation: true, // un brief livré au client est relu
    commercialClaimAllowed: "Peut préparer un brief exécutif clair — missions, blocages, validations en attente, décisions à prendre — construit sur les faits tracés fournis. Aucune diffusion planifiée automatique tant qu'aucun scheduler produit n'y est branché.",
    commercialClaimForbidden: ["rapport garanti exhaustif", "aucune supervision nécessaire"],
    prepareArtifact: (input) => {
      const missions = input?.missions ?? [];
      const blockers = input?.blockers ?? [];
      const waiting = input?.waitingValidations ?? [];
      const autonomous = input?.autonomousActions ?? [];
      const decisions = input?.decisionsNeeded ?? [];
      const sections: CloneBriefSection[] = [
        { heading: "Missions", lines: missions.map(factLine) },
        // Les blocages sont TOUJOURS présents dans le brief, même vides (jamais masqués).
        { heading: "Blocages", lines: blockers.length > 0 ? blockers.map(factLine) : ["Aucun blocage signalé dans les faits fournis."] },
        { heading: "Validations en attente", lines: waiting.map(factLine) },
        { heading: "Actions autonomes (préparations sûres)", lines: autonomous.map(factLine) },
        { heading: "Décisions à prendre", lines: decisions.map(factLine) },
      ];
      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "clonebrief_artifact",
          when: input?.when === "evening" ? "evening" : "morning",
          sections,
          counts: {
            missions: missions.length, blockers: blockers.length, waitingValidations: waiting.length,
            autonomousActions: autonomous.length, decisionsNeeded: decisions.length,
          },
          onlyProvidedFacts: true,
          preparedNeverClaimedAsDone: true,
          blockersHidden: false,
          inventedFacts: false,
        },
      };
    },
  });
