// src/lib/clonestore/integration/p16c/p16c-downstream.ts
// P16C — adaptateurs AVAL : CloneTrace / CloneReview / CloneBrief / CloneContinuum / CloneSignals /
// CloneLearn. Trace/Review/Continuum/Signals proviennent du RUN orchestrateur T2 réel (déjà gouverné) ;
// CloneBrief et CloneLearn sont exécutés par contrat réel. RÈGLES : Trace préserve la provenance et ne
// marque jamais de complétion sans preuve ; Review peut bloquer/exiger une révision, jamais garantir le
// droit ; Brief n'invente aucun fait ; Continuum reprend d'un état autoritaire ; Signals dédupliquent ;
// CloneLearn est PROPOSITION uniquement (adnMutated=false, approvalRequired sur chaque candidat).

import {
  cloneLearnProductTech, cloneBriefProductTech,
  type CloneOSRunResult, type ProductTechnologyContext,
  type CloneLearnArtifact, type CloneBriefArtifact, type CloneLearnSourceEvent,
} from "@/lib/clonestore/product-technologies/t2";
import type { PierreUltimateIntegrationContract } from "@/lib/pierre/v1/ultimate/p16a";
import type { P16CMergedResult } from "./p16c-types";

export function buildTraceRequirements(run: CloneOSRunResult): string[] {
  const ev = run.traceEvent;
  const reqs: string[] = [
    "Chaque décision d'intégration, plan technologique et sortie est tracée (provenance préservée).",
    "Complétion JAMAIS marquée sans preuve autoritaire (l'exécution reste derrière la confirmation).",
  ];
  // On décrit l'EXIGENCE de trace (déterministe), jamais l'id d'événement volatile de ce run
  // (un id séquentiel casserait l'idempotence du plan) — chaque exécution produit sa propre trace.
  if (ev) {
    reqs.push(`Événement à tracer: « ${ev.action} » avec pointeur de reprise et provenance.`);
    reqs.push(`Preuve T1 EvidenceTech ${ev.t1Evidence ? "présente" : "absente (fallback local)"}.`);
  }
  return reqs;
}

export function buildReviewRequirements(run: CloneOSRunResult): string[] {
  const r = run.review;
  if (!r) return ["Relecture qualité à effectuer avant tout usage (aucune garantie légale)."];
  return [
    `Relecture qualité: score ${r.qualityScore}/100, ${r.issues.length} anomalie(s).`,
    r.humanReviewNeeded ? "Revue humaine renforcée requise (contenu sensible / anomalies)." : "Relecture interne faite — validation humaine reste requise.",
    "Aucune garantie légale/d'exactitude (CloneReview ne remplace pas la revue juridique).",
  ];
}

export function buildContinuityRequirements(contract: PierreUltimateIntegrationContract): string[] {
  const c = contract.continuity;
  const reqs: string[] = [];
  if (c.isContinuation) {
    reqs.push("Re-lire l'état durable AUTORITAIRE de la mission/artefact (jamais depuis le texte du chat).");
    if (c.targetId) reqs.push(`Cible de continuité: ${c.targetKind} « ${c.targetId} » (version courante préservée).`);
    if (c.isCorrection) reqs.push("Correction d'un artefact existant ≠ nouvelle mission — préserver la lignée/version.");
  } else {
    reqs.push("Nouvelle mission — état de continuité initialisé (aucune reprise d'une mission étrangère).");
  }
  return reqs;
}

export function buildSignalsRequirements(run: CloneOSRunResult): string[] {
  const s = run.signalCandidates;
  const reqs = ["Déclencheurs = CANDIDATS locaux (aucun scheduler/notification live) ; armement humain."];
  if (s) {
    // Dédup par (signalKind) — jamais de doublon.
    const kinds = [...new Set(s.candidates.map((c) => c.signalKind))];
    reqs.push(`Candidats de relance dédupliqués: ${kinds.length ? kinds.join(", ") : "aucun"}.`);
  }
  return reqs;
}

export function buildBriefRequirements(merged: P16CMergedResult): string[] {
  return [
    "Brief construit UNIQUEMENT sur les faits fournis (aucune invention).",
    `« préparé » n'est jamais présenté comme « fait » — statut mission = ${merged.missionStatus}.`,
    merged.conflicts.length > 0 ? "Blocages/conflits jamais masqués dans le brief." : "Blocages exposés honnêtement (même absents).",
  ];
}

/** Exécute CloneBrief réel sur les faits de la mission (préparé ≠ fait). */
export async function runBrief(
  merged: P16CMergedResult,
  objective: string,
  ctx: ProductTechnologyContext,
): Promise<CloneBriefArtifact | null> {
  const result = await cloneBriefProductTech.prepare(
    {
      when: "morning",
      missions: [{ title: objective.slice(0, 80), state: merged.missionStatus === "prepared" ? "prepared" : "waiting" }],
      blockers: merged.operations
        .filter((o) => o.status === "provider_blocked_operation" || o.status === "human_only_decision")
        .map((o) => ({ title: o.ref, state: "blocked" as const, detail: o.detail })),
      waitingValidations: merged.missionStatus === "proposed" ? [{ title: "Validation humaine requise", state: "waiting" }] : [],
    },
    ctx,
  );
  return (result.artifact as CloneBriefArtifact | null) ?? null;
}

export interface P16CLearningOutcome {
  readonly artifact: CloneLearnArtifact | null;
  /** Candidats proposés (jamais canoniques immédiatement). */
  readonly candidatesAllowed: boolean;
  /** RÈGLE DURE : jamais de mutation silencieuse de la connaissance (adnMutated=false). */
  readonly adnMutated: false;
}

/**
 * CloneLearn PROPOSITION-ONLY à partir des issues de support/correction. Chaque candidat exige une
 * approbation ; le sensible/légal ne s'auto-approuve jamais ; aucune mutation de CloneADN.
 */
export async function runLearningCandidates(
  events: readonly { readonly type: CloneLearnSourceEvent; readonly detail: string }[],
  ctx: ProductTechnologyContext,
): Promise<P16CLearningOutcome> {
  const result = await cloneLearnProductTech.prepare({ events }, ctx);
  const artifact = (result.artifact as CloneLearnArtifact | null) ?? null;
  return { artifact, candidatesAllowed: true, adnMutated: false };
}
