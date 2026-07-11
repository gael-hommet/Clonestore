// src/lib/clonestore/pierre-journey/journey-status.ts
// P9.6 — Statut de PRÉPARATION du parcours (readiness), PURE présentation.
//
// Dérive un état lisible « où en est l'entreprise dans le parcours de Pierre » à partir de
// signaux DÉJÀ produits par le stack existant (autonomie P8 + données cockpit V1). Ce n'est
// PAS un planificateur RH : aucune décision, aucune logique métier, aucune orchestration.
// Il ne fait que résumer, pour l'humain, l'état réel remonté par P8/le cockpit.

export type ReadinessState = "done" | "pending" | "todo" | "blocked";
export type ReadinessLevel = "blocked" | "onboarding" | "operating";

export interface JourneyReadinessInput {
  /** Entreprise réelle résolue côté serveur (companyResolved). Faux = repli / pas d'entreprise. */
  readonly companyResolved: boolean;
  /** Mode d'autonomie courant (colonne P8), ou null si non résolu. */
  readonly autonomy: { readonly productModeId: string; readonly label: string } | null;
  /** Nombre total de missions Pierre connues. */
  readonly missionCount: number;
  /** Mission en cours mise en avant (non terminale), ou null. */
  readonly activeMission: { readonly id: string; readonly title: string; readonly statusLabel: string } | null;
  /** Validations humaines en attente. */
  readonly pendingValidations: number;
  /** Preuves / livrables produits (artefacts). */
  readonly evidenceCount: number;
  /** Dernier résultat abouti (mission terminée), ou null. */
  readonly latestResult: { readonly id: string; readonly title: string; readonly statusLabel: string } | null;
}

export interface JourneyReadinessItem {
  readonly id: "company" | "autonomy" | "mission" | "validation" | "evidence" | "result";
  readonly label: string;
  readonly state: ReadinessState;
  readonly detail: string;
}

export interface JourneyReadiness {
  readonly level: ReadinessLevel;
  readonly canOperate: boolean;   // l'entreprise est réelle → Pierre peut opérer
  readonly summary: string;
  readonly items: readonly JourneyReadinessItem[];
}

/**
 * Résume l'état de préparation du parcours. Honnête par construction :
 * sans entreprise résolue → bloqué ; entreprise mais aucune mission → onboarding ;
 * au moins une mission → opérationnel. Les compteurs viennent des données réelles.
 */
export function computeJourneyReadiness(input: JourneyReadinessInput): JourneyReadiness {
  const {
    companyResolved, autonomy, missionCount, activeMission,
    pendingValidations, evidenceCount, latestResult,
  } = input;

  const company: JourneyReadinessItem = companyResolved
    ? { id: "company", label: "Entreprise", state: "done", detail: "Entreprise résolue — Pierre est rattaché." }
    : { id: "company", label: "Entreprise", state: "blocked", detail: "Aucune entreprise résolue. Rattachez-vous pour que Pierre opère." };

  const autonomyItem: JourneyReadinessItem = !companyResolved
    ? { id: "autonomy", label: "Autonomie", state: "todo", detail: "Disponible dès qu'une entreprise est rattachée." }
    : autonomy
      ? { id: "autonomy", label: "Autonomie", state: "done", detail: `Mode « ${autonomy.label} » actif.` }
      : { id: "autonomy", label: "Autonomie", state: "todo", detail: "Choisissez le niveau d'autonomie de Pierre." };

  const mission: JourneyReadinessItem = !companyResolved
    ? { id: "mission", label: "Mission", state: "todo", detail: "Confiez une mission à Pierre une fois rattaché." }
    : activeMission
      ? { id: "mission", label: "Mission", state: "pending", detail: `En cours : « ${activeMission.title} » (${activeMission.statusLabel}).` }
      : missionCount > 0
        ? { id: "mission", label: "Mission", state: "done", detail: `${missionCount} mission${missionCount > 1 ? "s" : ""} — aucune en cours actuellement.` }
        : { id: "mission", label: "Mission", state: "todo", detail: "Aucune mission encore confiée à Pierre." };

  const validation: JourneyReadinessItem = pendingValidations > 0
    ? { id: "validation", label: "Validations", state: "pending", detail: `${pendingValidations} validation${pendingValidations > 1 ? "s" : ""} en attente de votre décision.` }
    : { id: "validation", label: "Validations", state: "done", detail: "Aucune validation en attente." };

  const evidence: JourneyReadinessItem = evidenceCount > 0
    ? { id: "evidence", label: "Preuves", state: "done", detail: `${evidenceCount} livrable${evidenceCount > 1 ? "s" : ""} / preuve${evidenceCount > 1 ? "s" : ""} disponible${evidenceCount > 1 ? "s" : ""}.` }
    : { id: "evidence", label: "Preuves", state: "todo", detail: "Aucune preuve produite pour l'instant." };

  const result: JourneyReadinessItem = latestResult
    ? { id: "result", label: "Résultat", state: "done", detail: `Dernier résultat : « ${latestResult.title} » (${latestResult.statusLabel}).` }
    : { id: "result", label: "Résultat", state: "todo", detail: "Aucun résultat abouti pour l'instant." };

  const items = [company, autonomyItem, mission, validation, evidence, result] as const;

  const level: ReadinessLevel = !companyResolved ? "blocked" : missionCount === 0 ? "onboarding" : "operating";
  const summary =
    level === "blocked"
      ? "Rattachez une entreprise pour que Pierre puisse opérer."
      : level === "onboarding"
        ? "Entreprise prête. Confiez une première mission à Pierre."
        : pendingValidations > 0
          ? "Pierre opère — une décision de votre part est attendue."
          : "Pierre opère pour votre entreprise.";

  return { level, canOperate: companyResolved, summary, items };
}
