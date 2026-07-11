// src/lib/clonestore/product-technologies/t2/clonesignals-product-tech.ts
// T2 — CloneSignals : le moteur d'événements et de déclencheurs. Surveille et PROPOSE des
// déclenchements : validation en retard, réponse absente, échéance proche, document manquant,
// mission endormie, délai dépassé, condition métier remplie. AUCUN scheduler live, aucune
// notification envoyée, aucun cron créé — des CANDIDATS que l'humain/le système arme.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";

export type CloneSignalKind =
  | "validation_late" | "no_reply" | "deadline_approaching" | "document_missing"
  | "mission_sleeping" | "delay_exceeded" | "business_condition_met";

export interface CloneSignalsInput {
  readonly missionId?: string;
  readonly waitingValidationSinceHours?: number;
  readonly lastReplyAgeHours?: number;
  readonly deadlineInHours?: number;
  readonly missionIdleHours?: number;
  readonly missingDocuments?: readonly string[];
  readonly businessConditions?: readonly { readonly condition: string; readonly met: boolean }[];
}

export interface CloneSignalCandidate {
  readonly signalKind: CloneSignalKind;
  readonly detail: string;
  readonly proposedAction: "remind" | "wake_mission" | "escalate";
  readonly recommendedInHours: number;
}

export interface CloneSignalsArtifact {
  readonly artifactKind: "clonesignals_candidates";
  readonly missionId: string | null;
  readonly candidates: readonly CloneSignalCandidate[];
  readonly liveSchedulerUsed: false;
  readonly cronCreated: false;
  readonly notificationSentLive: false;
}

export const cloneSignalsProductTech: ProductTechnologyContract<CloneSignalsInput, CloneSignalsArtifact> =
  defineProductTechnologyContract({
    id: "clonesignals",
    name: "CloneSignals",
    definition: "Le moteur d'événements et de déclencheurs : quand le système doit réagir même sans nouvelle commande humaine.",
    role: "Détecter les situations (retards, silences, échéances, manques, conditions) et proposer des déclenchements — jamais les exécuter live.",
    answersQuestion: "Quand le système doit-il réagir même sans nouvelle commande humaine ?",
    contains: ["validation en retard", "réponse absente", "échéance proche", "document manquant", "mission endormie", "délai dépassé", "condition métier remplie"],
    doesNotContain: ["scheduler live", "envoi de notifications live", "création de cron"],
    dependencies: ["clonecontinuum", "clonetrace"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonesignals,
    liveBlockedReason: null,
    requiresValidation: true, // un candidat armé devient un effet → l'humain arme
    commercialClaimAllowed: "Le système repère les retards, silences et échéances et propose les bonnes relances — l'humain garde l'armement.",
    commercialClaimForbidden: ["relances envoyées automatiquement en production", "surveillance temps réel garantie"],
    prepareArtifact: (input) => {
      const candidates: CloneSignalCandidate[] = [];
      const w = input?.waitingValidationSinceHours;
      if (typeof w === "number" && w >= 48) {
        candidates.push({ signalKind: "validation_late", detail: `Validation en attente depuis ${w}h.`, proposedAction: "remind", recommendedInHours: 4 });
      }
      const r = input?.lastReplyAgeHours;
      if (typeof r === "number" && r >= 72) {
        candidates.push({ signalKind: "no_reply", detail: `Aucune réponse depuis ${r}h.`, proposedAction: "remind", recommendedInHours: 24 });
      }
      const d = input?.deadlineInHours;
      if (typeof d === "number" && d <= 48) {
        candidates.push({ signalKind: "deadline_approaching", detail: `Échéance dans ${d}h.`, proposedAction: d <= 8 ? "escalate" : "remind", recommendedInHours: Math.max(1, Math.floor(d / 2)) });
      }
      for (const doc of input?.missingDocuments ?? []) {
        candidates.push({ signalKind: "document_missing", detail: `Document manquant : ${doc}.`, proposedAction: "remind", recommendedInHours: 24 });
      }
      const idle = input?.missionIdleHours;
      if (typeof idle === "number" && idle >= 120) {
        candidates.push({ signalKind: "mission_sleeping", detail: `Mission sans activité depuis ${idle}h.`, proposedAction: "wake_mission", recommendedInHours: 1 });
      }
      if (typeof w === "number" && w >= 168) {
        candidates.push({ signalKind: "delay_exceeded", detail: "Délai maximal d'attente dépassé (7 jours).", proposedAction: "escalate", recommendedInHours: 1 });
      }
      for (const c of input?.businessConditions ?? []) {
        if (c.met) candidates.push({ signalKind: "business_condition_met", detail: `Condition remplie : ${c.condition}.`, proposedAction: "wake_mission", recommendedInHours: 1 });
      }
      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "clonesignals_candidates",
          missionId: input?.missionId ?? null,
          candidates,
          liveSchedulerUsed: false,
          cronCreated: false,
          notificationSentLive: false,
        },
      };
    },
  });
