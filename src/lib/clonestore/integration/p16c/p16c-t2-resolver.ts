// src/lib/clonestore/integration/p16c/p16c-t2-resolver.ts
// P16C — RÉSOLUTION des besoins T2 déclarés par Pierre, à travers le VRAI registre T2 (aucun 2e registre).
// Pour chaque besoin : contrat produit réel, statut/mode réels, blocage live réel, fallback réel, et une
// préparation locale-safe RÉELLE (input minimal sans aucun drapeau d'effet). Une techno inconnue échoue
// fail-closed. Les techos composées (ADN/Guard/Policy/Trust/OS/…) sont AUSSI exécutées, sous gouvernance,
// par l'adaptateur CloneOS via l'orchestrateur T2 réel — ce module prouve leur résolvabilité par contrat.

import {
  getProductTechnologyRegistryEntry,
} from "@/lib/clonestore/product-technologies/t2/product-technology-registry";
import {
  isProductTechnologyId, type ProductTechnologyContext, type ProductTechnologyId,
} from "@/lib/clonestore/product-technologies/t2";
import type { P16AT2Need } from "@/lib/pierre/v1/ultimate/p16a";
import type { P16CT2Step } from "./p16c-types";

export interface P16CT2ResolveContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly employeeId?: string;
  readonly requesterRole?: string;
  readonly objective?: string;
}

/** Input minimal PAR TECHNO — jamais de drapeau d'effet/live. Prouve la préparabilité locale-safe. */
function safeT2InputFor(techId: ProductTechnologyId, objective: string, requestId: string): unknown {
  switch (techId) {
    case "cloneadn": return {};
    case "cloneguard": return { action: { kind: "mission_proposal", description: objective, channel: "internal" } };
    case "clonepolicy": return { action: { taskType: "generic_mission", channel: "internal" } };
    case "clonetrust": return { taskType: "generic_mission", riskLevel: "sensitive" };
    case "cloneos": return { request: objective };
    case "clonetrace": return { subject: `mission-${requestId}`, action: "Intégration P16C préparée" };
    case "clonereview": return { draft: objective };
    case "clonecontinuum": return { missionId: requestId, currentState: "active" };
    case "clonesignals": return { missionId: requestId };
    case "clonelearn": return { events: [] };
    case "clonebrief": return { when: "morning", missions: [{ title: objective, state: "prepared" }] };
    case "clonevoice": return { transcriptText: objective };
    case "clonecall": return { employeeCalledId: "pierre", objective, transcriptText: objective };
    case "cloneroom": return { participants: [{ id: "human-1", kind: "human" }], thread: [] };
    default: return {};
  }
}

/** Résout un seul besoin T2 en étape typée (préparation locale-safe réelle via le contrat). */
export async function resolveT2Step(
  need: P16AT2Need,
  ctx: P16CT2ResolveContext,
): Promise<P16CT2Step> {
  const objective = (ctx.objective ?? "Mission RH gouvernée").trim();
  const requestId = "p16c";

  if (!isProductTechnologyId(need.techId)) {
    return {
      techId: need.techId as ProductTechnologyId, known: false, reason: need.reason,
      status: "missing", mode: "blocked", liveBlockedReason: "Product-technology inconnue.",
      resultKind: "blocked", requiresHumanValidation: true, artifactPrepared: false, artifactKind: null,
    };
  }

  const entry = getProductTechnologyRegistryEntry(need.techId)!;
  const productCtx: ProductTechnologyContext = {
    employeeId: (ctx.employeeId ?? "pierre").trim(),
    companyId: ctx.companyId,
    actorUserId: ctx.actorId,
    requesterRole: ctx.requesterRole,
    purpose: objective,
  };

  const result = await entry.contract.prepare(safeT2InputFor(need.techId, objective, requestId), productCtx);
  const artifactRecord = result.artifact && typeof result.artifact === "object" ? (result.artifact as Record<string, unknown>) : null;

  return {
    techId: need.techId,
    known: true,
    reason: need.reason,
    status: entry.status,
    mode: entry.contract.mode,
    liveBlockedReason: entry.liveBlockedReason,
    resultKind: result.kind,
    requiresHumanValidation: result.requiresHumanValidation,
    artifactPrepared: result.kind === "ok" || result.kind === "needs_validation" || (result.kind === "fallback" && result.artifact !== null),
    artifactKind: typeof artifactRecord?.artifactKind === "string" ? (artifactRecord.artifactKind as string) : null,
  };
}

/** Résout tous les besoins T2 déclarés. */
export async function resolveT2Steps(
  needs: readonly P16AT2Need[],
  ctx: P16CT2ResolveContext,
): Promise<P16CT2Step[]> {
  const steps: P16CT2Step[] = [];
  for (const need of needs) steps.push(await resolveT2Step(need, ctx));
  return steps;
}
