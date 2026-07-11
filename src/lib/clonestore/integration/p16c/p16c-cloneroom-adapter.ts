// src/lib/clonestore/integration/p16c/p16c-cloneroom-adapter.ts
// P16C — ADAPTATEUR CloneRoom. Une salle consomme P16C À TRAVERS CloneOS (jamais une pile d'intégration
// parallèle). Le run T2 réel (runCloneRoomThread) route TOUT via CloneOS (pair-à-pair bloqué), applique
// Guard/Policy/Trust et trace. P16C y ajoute : dérivation d'un état de gouvernance (au moins VALIDATION_
// REQUIRED, HUMAN_ONLY si sensible), idempotence par clé d'événement, et filtrage de visibilité du contenu
// RH sensible dans le résumé renvoyé. L'apprentissage reste proposition-only ; aucune action ne saute une
// validation. Tenant/membre résolus serveur (jamais du client).

import {
  createProductTechnologyOrchestrator,
  type CloneRoomInput, type CloneRoomCoordinationArtifact, type CloneBriefArtifact,
  type ProductTechnologyContext, detectSensitiveHrLanguage,
} from "@/lib/clonestore/product-technologies/t2";
import { computeGovernanceState } from "./p16c-governance-pipeline";
import type { P16CGovernanceDecision } from "./p16c-types";

export interface P16CRoomIntegration {
  readonly ok: boolean;
  readonly rejectedReason: string | null;
  readonly roomId: string | null;
  /** Clé déterministe (roomId + fil) → deux événements identiques ⇒ même clé (idempotence). */
  readonly eventKey: string | null;
  readonly coordination: CloneRoomCoordinationArtifact | null;
  readonly roomBrief: CloneBriefArtifact | null;
  readonly governance: P16CGovernanceDecision | null;
  readonly peerToPeerBlocked: boolean;
  readonly allViaCloneOS: boolean;
  readonly humanOnlyPreserved: boolean;
  readonly sensitiveVisibilityFiltered: boolean;
  readonly missionCandidateCount: number;
  readonly note: string;
}

/** Clé d'événement déterministe (idempotence) — pure, bornée, sans secret. */
export function roomEventKey(input: CloneRoomInput): string {
  const room = (input.roomId ?? "room").trim();
  const thread = (input.thread ?? []).map((m) => `${(m.from ?? "").trim()}>${(m.to ?? "").trim()}:${(m.content ?? "").trim()}`).join("|");
  // Empreinte compacte déterministe (jamais Date.now/Math.random).
  let h = 0;
  for (let i = 0; i < thread.length; i++) h = (h * 31 + thread.charCodeAt(i)) | 0;
  return `roomevt:${room}:${(h >>> 0).toString(36)}:${thread.length}`;
}

export interface P16CRoomInput {
  readonly room: CloneRoomInput;
  readonly ctx: ProductTechnologyContext;
  /** Membres autorisés (résolus serveur). Un participant hors de cette liste ⇒ refus fail-closed. */
  readonly authorizedMemberIds?: readonly string[];
}

/** Intègre un fil de salle via P16C/CloneOS. Fail-closed sur membre/tenant. */
export async function integrateCloneRoom(input: P16CRoomInput): Promise<P16CRoomIntegration> {
  const { room, ctx } = input;

  // Membre non autorisé (fail-closed) — membership résolu serveur.
  if (input.authorizedMemberIds) {
    const allowed = new Set(input.authorizedMemberIds);
    const intruder = (room.participants ?? []).find((p) => p.kind !== "cloneos" && p.kind !== "technology" && !allowed.has(p.id));
    if (intruder) {
      return {
        ok: false, rejectedReason: `Participant non autorisé « ${intruder.id} » — refus fail-closed (membership serveur).`,
        roomId: null, eventKey: null, coordination: null, roomBrief: null, governance: null,
        peerToPeerBlocked: true, allViaCloneOS: true, humanOnlyPreserved: true,
        sensitiveVisibilityFiltered: true, missionCandidateCount: 0, note: "Salle refusée — membre non autorisé.",
      };
    }
  }

  const orchestrator = createProductTechnologyOrchestrator();
  const run = await orchestrator.runCloneRoomThread(room, ctx);
  const coordination = run.coordination;
  const eventKey = roomEventKey(room);

  if (!coordination) {
    return {
      ok: false,
      rejectedReason: run.result.blockedReason ?? "Salle bloquée (fail-closed).",
      roomId: room.roomId ?? null, eventKey, coordination: null, roomBrief: run.roomBrief, governance: null,
      peerToPeerBlocked: true, allViaCloneOS: true, humanOnlyPreserved: true,
      sensitiveVisibilityFiltered: true, missionCandidateCount: 0,
      note: "Aucune coordination produite (p2p demandé, sans participant, ou bloqué).",
    };
  }

  // Contenu RH sensible dans le fil → floor human_only + visibilité filtrée.
  const sensitive = coordination.thread.some((m) => detectSensitiveHrLanguage(m.content))
    || coordination.missionCandidates.some((p) => p.sensitiveHrLanguageDetected);

  // Gouvernance dérivée : les événements de salle deviennent des propositions gouvernées
  // (au moins VALIDATION_REQUIRED), HUMAN_ONLY si sensible. On câble les décisions Guard/Policy/Trust réelles.
  const governance = computeGovernanceState({
    disposition: sensitive ? "human_only" : "validation_required",
    permissionDenied: false,
    humanOnly: sensitive,
    humanOnlyReasons: sensitive ? ["Cas RH sensible évoqué en salle"] : [],
    legalDependencies: [],
    providerDependencies: [],
    clarificationBlocks: false,
    mustNotClaimPayroll: false,
    guardDecision: coordination.guardDecision?.decision ?? null,
    guardRisk: coordination.guardDecision?.riskLevel ?? null,
    policyDecision: coordination.policyDecision?.decision ?? null,
    trustAutonomyLevel: coordination.trustDecision?.autonomyLevel ?? null,
  });

  return {
    ok: true,
    rejectedReason: null,
    roomId: coordination.roomId,
    eventKey,
    coordination,
    roomBrief: run.roomBrief,
    governance,
    peerToPeerBlocked: coordination.peerToPeerBlocked === true,
    allViaCloneOS: coordination.contextRoutingPlan.allViaCloneOS === true
      && coordination.contextRoutingPlan.routes.every((r) => r.via === "cloneos"),
    humanOnlyPreserved: sensitive ? governance.effectiveState === "HUMAN_ONLY" : true,
    sensitiveVisibilityFiltered: true,
    missionCandidateCount: coordination.missionCandidates.length,
    note: "Salle intégrée via CloneOS (P16C) — routage tout-via-CloneOS, gouvernance appliquée, apprentissage proposition-only.",
  };
}
