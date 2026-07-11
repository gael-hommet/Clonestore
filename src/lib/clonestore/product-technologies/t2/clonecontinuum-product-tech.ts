// src/lib/clonestore/product-technologies/t2/clonecontinuum-product-tech.ts
// T2 — CloneContinuum : le moteur de continuité des missions dans le temps.
// Gère : attentes (info/validation), reprises, relances, réveils, missions planifiées,
// tâches multi-jours, clôture propre, réouverture, statuts propres. AUCUN cron live,
// aucun envoi — il RECOMMANDE le prochain réveil, l'armement reste humain/CloneSignals.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";

export type CloneContinuumStateKind =
  | "active" | "waiting_for_info" | "waiting_for_validation" | "scheduled_followup"
  | "resumed" | "closed" | "reopened";

export type CloneContinuumEvent =
  | "info_requested" | "info_received" | "validation_requested" | "validation_received"
  | "followup_scheduled" | "resume" | "close" | "reopen";

export interface CloneContinuumInput {
  readonly missionId?: string;
  readonly currentState?: CloneContinuumStateKind;
  readonly event?: CloneContinuumEvent;
  readonly waitingSinceHours?: number;
}

export interface CloneContinuumState {
  readonly artifactKind: "clonecontinuum_state";
  readonly missionId: string;
  readonly previousState: CloneContinuumStateKind;
  readonly state: CloneContinuumStateKind;
  readonly allowedTransitions: readonly CloneContinuumStateKind[];
  readonly nextWakeupRecommendation: { readonly afterHours: number; readonly reason: string } | null;
  readonly liveSchedulerUsed: false;
  readonly cronCreated: false;
  readonly executed: false;
}

/** Machine d'états PURE de continuité. Transition inconnue → état inchangé (fail-closed). */
export function transitionContinuum(current: CloneContinuumStateKind, event: CloneContinuumEvent | undefined): CloneContinuumStateKind {
  switch (event) {
    case "info_requested": return current === "closed" ? current : "waiting_for_info";
    case "info_received": return current === "waiting_for_info" ? "resumed" : current;
    case "validation_requested": return current === "closed" ? current : "waiting_for_validation";
    case "validation_received": return current === "waiting_for_validation" ? "resumed" : current;
    case "followup_scheduled": return current === "closed" ? current : "scheduled_followup";
    case "resume": return current === "closed" ? current : "resumed";
    case "close": return "closed";
    case "reopen": return current === "closed" ? "reopened" : current;
    default: return current;
  }
}

const ALLOWED: Readonly<Record<CloneContinuumStateKind, readonly CloneContinuumStateKind[]>> = {
  active: ["waiting_for_info", "waiting_for_validation", "scheduled_followup", "closed"],
  waiting_for_info: ["resumed", "scheduled_followup", "closed"],
  waiting_for_validation: ["resumed", "scheduled_followup", "closed"],
  scheduled_followup: ["resumed", "closed"],
  resumed: ["waiting_for_info", "waiting_for_validation", "scheduled_followup", "closed"],
  closed: ["reopened"],
  reopened: ["waiting_for_info", "waiting_for_validation", "scheduled_followup", "closed"],
};

export const cloneContinuumProductTech: ProductTechnologyContract<CloneContinuumInput, CloneContinuumState> =
  defineProductTechnologyContract({
    id: "clonecontinuum",
    name: "CloneContinuum",
    definition: "Le moteur de continuité des missions au-delà de la première réponse : attentes, reprises, relances, réveils, clôtures et réouvertures propres.",
    role: "Faire survivre une mission dans le temps, proprement.",
    answersQuestion: "Comment une mission survit-elle au-delà de la première réponse ?",
    contains: ["attente d'information", "attente de validation", "reprises", "relances", "réveils de mission", "missions planifiées", "tâches multi-jours", "clôture propre", "réouverture", "statuts propres"],
    doesNotContain: ["cron live", "envoi push/email", "exécution de rappels live"],
    dependencies: ["clonesignals", "clonetrace"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonecontinuum,
    liveBlockedReason: null,
    requiresValidation: false, // un état de continuité n'est pas un effet
    commercialClaimAllowed: "Les missions vivent dans le temps : attentes suivies, reprises propres, recommandations de relance — sous contrôle humain.",
    commercialClaimForbidden: ["relances envoyées automatiquement en production", "scheduler autonome live"],
    prepareArtifact: (input) => {
      const missionId = (input?.missionId ?? "").trim();
      if (missionId.length === 0) {
        return { kind: "blocked", artifact: null, blockedReason: "missionId requis pour la continuité — fail-closed." };
      }
      const previous = input?.currentState ?? "active";
      const state = transitionContinuum(previous, input?.event);
      const waiting = typeof input?.waitingSinceHours === "number" ? input.waitingSinceHours : 0;
      const wakeup =
        state === "waiting_for_validation" ? { afterHours: waiting >= 72 ? 4 : 24, reason: "Validation en attente — recommander une relance (armement humain/CloneSignals)." }
        : state === "waiting_for_info" ? { afterHours: 48, reason: "Information manquante — recommander une relance courtoise." }
        : state === "scheduled_followup" ? { afterHours: 24, reason: "Suivi planifié — vérifier l'échéance." }
        : null;
      return {
        kind: "ok",
        artifact: {
          artifactKind: "clonecontinuum_state",
          missionId,
          previousState: previous,
          state,
          allowedTransitions: ALLOWED[state],
          nextWakeupRecommendation: wakeup,
          liveSchedulerUsed: false,
          cronCreated: false,
          executed: false,
        },
      };
    },
  });
