// src/lib/clonestore/product-technologies/t2/cloneroom-product-tech.ts
// T2 — CloneRoom : la salle de collaboration opérationnelle (humains, CloneOS, employés IA,
// technologies). Collecte les messages, garde les participants, convertit les fils en
// candidats de mission, route le contexte VIA CLONEOS — JAMAIS de pair-à-pair anarchique
// entre employés IA. CloneTrace reste visible ; CloneGuard n'est jamais contourné.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import { cloneOSProductTech, type CloneOSMissionPlan, type CloneOSEmployeeDescriptor } from "./cloneos-product-tech";
import { cloneGuardProductTech, type CloneGuardDecision } from "./cloneguard-product-tech";
import { clonePolicyProductTech, type ClonePolicyDecision, type ClonePolicyRule } from "./clonepolicy-product-tech";
import { cloneTrustProductTech, type CloneTrustDecision } from "./clonetrust-product-tech";
import { cloneTraceProductTech, type CloneTraceEvent } from "./clonetrace-product-tech";

export type CloneRoomParticipantKind = "human" | "cloneos" | "ai_employee" | "technology";

export interface CloneRoomParticipant {
  readonly id: string;
  readonly kind: CloneRoomParticipantKind;
}

export interface CloneRoomMessage {
  readonly from?: string;
  readonly to?: string; // destinataire éventuel — un employé IA ne parle JAMAIS directement à un autre
  readonly content?: string;
}

export interface CloneRoomInput {
  readonly roomId?: string;
  readonly participants?: readonly CloneRoomParticipant[];
  readonly thread?: readonly CloneRoomMessage[];
  readonly availableEmployees?: readonly CloneOSEmployeeDescriptor[];
  /** Règles d'entreprise (ClonePolicy) appliquées aux missions issues de la salle. */
  readonly policyRules?: readonly ClonePolicyRule[];
  /** Le pair-à-pair anarchique est INTERDIT — demander son activation bloque la salle. */
  readonly allowPeerToPeer?: boolean;
}

export interface CloneRoomRoute {
  readonly fromParticipantId: string;
  readonly toParticipantId: string;
  readonly via: "cloneos";
  readonly note: string;
}

export interface CloneRoomCoordinationArtifact {
  readonly artifactKind: "cloneroom_coordination";
  readonly roomId: string;
  readonly participants: readonly CloneRoomParticipant[];
  readonly thread: readonly { readonly from: string; readonly to: string | null; readonly content: string }[];
  readonly missionCandidates: readonly CloneOSMissionPlan[];
  readonly contextRoutingPlan: { readonly allViaCloneOS: true; readonly routes: readonly CloneRoomRoute[] };
  readonly guardDecision: CloneGuardDecision | null;
  readonly policyDecision: ClonePolicyDecision | null;
  readonly trustDecision: CloneTrustDecision | null;
  readonly traceEvent: CloneTraceEvent | null;
  readonly peerToPeerBlocked: true;
  readonly executed: false;
}

const PARTICIPANT_KINDS: readonly CloneRoomParticipantKind[] = ["human", "cloneos", "ai_employee", "technology"];
let roomSequence = 0;

export const cloneRoomProductTech: ProductTechnologyContract<CloneRoomInput, CloneRoomCoordinationArtifact> =
  defineProductTechnologyContract({
    id: "cloneroom",
    name: "CloneRoom",
    definition: "La salle de collaboration opérationnelle où humains, CloneOS, employés IA et technologies se coordonnent — toujours via CloneOS, jamais en pair-à-pair anarchique.",
    role: "Collecter les messages, garder les participants, convertir les fils en candidats de mission, router le contexte via CloneOS, garder CloneTrace visible.",
    answersQuestion: "Comment humains et employés IA collaborent-ils dans une salle, proprement coordonnés ?",
    contains: ["session de salle", "participants (humain/CloneOS/employé IA/technologie)", "fil de messages", "extraction de candidats de mission", "plan de routage de contexte via CloneOS", "lien CloneTrace", "handoff CloneOS"],
    doesNotContain: ["communication pair-à-pair anarchique entre employés IA", "appels providers live", "contournement de CloneGuard"],
    dependencies: ["cloneos", "cloneguard", "clonetrace", "clonebrief"],
    status: "integration_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.cloneroom,
    liveBlockedReason: null,
    requiresValidation: true,
    commercialClaimAllowed: "Une salle opérationnelle où l'équipe et les employés IA se coordonnent : les échanges deviennent des missions proposées, tracées et gouvernées.",
    commercialClaimForbidden: ["les employés IA collaborent sans supervision", "communication IA-IA non gouvernée"],
    prepareArtifact: async (input, ctx) => {
      // Coercition fail-closed : allowPeerToPeer:"true"/1/"yes" bloque aussi.
      const p2pRequested = ((v: unknown): boolean =>
        v === true || (typeof v === "number" && v !== 0) ||
        (typeof v === "string" && ["true", "1", "on", "yes"].includes(v.trim().toLowerCase())))(input?.allowPeerToPeer);
      if (p2pRequested) {
        return {
          kind: "blocked",
          artifact: null,
          blockedReason: "Pair-à-pair anarchique demandé — INTERDIT : toute coordination entre employés IA passe par CloneOS (gouvernée, tracée).",
        };
      }
      const participants = (input?.participants ?? []).filter(
        (p): p is CloneRoomParticipant => !!p && typeof p.id === "string" && p.id.trim().length > 0 && PARTICIPANT_KINDS.includes(p.kind),
      );
      if (participants.length === 0) {
        return { kind: "blocked", artifact: null, blockedReason: "Salle sans participant valide — fail-closed." };
      }
      roomSequence += 1;
      const roomId = (input?.roomId ?? "").trim() || `room-${roomSequence}`;
      const kindOf = new Map(participants.map((p) => [p.id, p.kind]));

      const thread = (input?.thread ?? [])
        .filter((m) => typeof m?.content === "string" && m.content!.trim().length > 0)
        .map((m) => ({
          from: (m.from ?? "participant-inconnu").trim(),
          to: m.to?.trim() || null,
          content: m.content!.trim(),
        }));

      // Routage : TOUT échange adressé passe par CloneOS ; le pair-à-pair employé→employé est
      // systématiquement réécrit en « via CloneOS » (jamais direct). FAIL-CLOSED : un expéditeur/
      // destinataire NON DÉCLARÉ dans participants est traité comme un employé IA (identité
      // auto-déclarée, non vérifiée à cette couche — la frontière serveur reste RLS/auth).
      const kindOrAiEquivalent = (id: string): CloneRoomParticipantKind => kindOf.get(id) ?? "ai_employee";
      const routes: CloneRoomRoute[] = thread
        .filter((m) => m.to !== null)
        .map((m) => {
          const fromKind = kindOrAiEquivalent(m.from);
          const toKind = kindOrAiEquivalent(m.to as string);
          const undeclared = !kindOf.has(m.from) || !kindOf.has(m.to as string);
          return {
            fromParticipantId: m.from,
            toParticipantId: m.to as string,
            via: "cloneos" as const,
            note: undeclared
              ? "Participant non déclaré dans la salle — traité comme employé IA (fail-closed) et ROUTÉ via CloneOS."
              : fromKind === "ai_employee" && toKind === "ai_employee"
                ? "Échange employé IA → employé IA : ROUTÉ via CloneOS (le direct est interdit)."
                : "Contexte routé et centralisé par CloneOS.",
          };
        });

      // Fil → candidat(s) de mission via CloneOS (messages humains prioritaires).
      const humanText = thread.filter((m) => kindOf.get(m.from) === "human").map((m) => m.content).join(". ");
      const requestText = humanText.length > 0 ? humanText : thread.map((m) => m.content).join(". ");
      const missionCandidates: CloneOSMissionPlan[] = [];
      if (requestText.trim().length > 0) {
        const osResult = await cloneOSProductTech.prepare(
          { request: requestText, availableEmployees: input?.availableEmployees, context: `Salle ${roomId}` },
          ctx,
        );
        const plan = osResult.artifact as CloneOSMissionPlan | null;
        if (plan) missionCandidates.push(plan);
      }

      // Porte de gouvernance sur le contenu de la salle + trace visible.
      const guardResult = await cloneGuardProductTech.prepare(
        { action: { kind: "room_coordination", description: requestText || "salle sans contenu", channel: "internal" } },
        ctx,
      );
      const guardDecision = (guardResult.artifact as CloneGuardDecision | null) ?? null;

      // ClonePolicy + CloneTrust : les missions issues de la salle sont sous les MÊMES portes
      // que la demande brute (jamais un chemin de moindre gouvernance).
      const policyResult = await clonePolicyProductTech.prepare(
        {
          rules: input?.policyRules,
          action: { taskType: missionCandidates[0]?.intention.intentKind ?? "generic_mission", channel: "internal", requesterRole: ctx.requesterRole },
        },
        ctx,
      );
      const policyDecision = (policyResult.artifact as ClonePolicyDecision | null) ?? null;
      const trustResult = await cloneTrustProductTech.prepare(
        {
          taskType: missionCandidates[0]?.intention.intentKind ?? "generic_mission",
          riskLevel: guardDecision?.riskLevel ?? "sensitive",
          requesterRole: ctx.requesterRole,
          policyCap: policyDecision?.autonomyCap,
        },
        ctx,
      );
      const trustDecision = (trustResult.artifact as CloneTrustDecision | null) ?? null;

      const traceResult = await cloneTraceProductTech.prepare(
        { subject: roomId, action: `Coordination de salle (${participants.length} participants, ${thread.length} messages)`, missionId: missionCandidates.length > 0 ? roomId : undefined },
        ctx,
      );

      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "cloneroom_coordination",
          roomId,
          participants,
          thread,
          missionCandidates,
          contextRoutingPlan: { allViaCloneOS: true, routes },
          guardDecision,
          policyDecision,
          trustDecision,
          traceEvent: (traceResult.artifact as CloneTraceEvent | null) ?? null,
          peerToPeerBlocked: true,
          executed: false,
        },
      };
    },
  });
