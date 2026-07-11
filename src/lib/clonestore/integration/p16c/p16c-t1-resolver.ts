// src/lib/clonestore/integration/p16c/p16c-t1-resolver.ts
// P16C — RÉSOLUTION des besoins T1 déclarés par Pierre, à travers le VRAI registre/bus T1 (aucun 2e
// registre). Pour chaque besoin : contrat réel, permission AVANT prepare (via le bus), mode/statut réels,
// fallback réel, blocage live réel, préparation locale-safe RÉELLE (jamais d'effet, jamais de live). Une
// techno inconnue échoue fail-closed. Le bus est PROPRE AU RUN (isolation tenant : aucun journal partagé).

import {
  createTechnologyBus, getTechnologyRegistryEntry, resolveTechnologyMode,
  isTechnologyId, type TechnologyBus, type TechnologyContext,
} from "@/lib/clonestore/technologies/t1";
import type { P16AT1Need } from "@/lib/pierre/v1/ultimate/p16a";
import type { P16CT1Step } from "./p16c-types";

export interface P16CT1ResolveContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly employeeId?: string;   // employé IA (défaut « pierre » — un id parmi d'autres)
  readonly purpose?: string;
}

/** Entrée minimale, SANS AUCUN drapeau d'effet live (jamais "send"/"push"/"schedule"…) pour prouver la
 *  préparation locale-safe. Le contrat T1 ré-garde fail-closed + anti-live de toute façon. */
function safeInputFor(reason: string, purpose: string): Record<string, unknown> {
  return { subject: purpose, objective: purpose, note: reason };
}

/** Résout un seul besoin T1 en étape typée (préparation locale-safe réelle via le bus). */
export async function resolveT1Step(
  need: P16AT1Need,
  ctx: P16CT1ResolveContext,
  bus: TechnologyBus,
): Promise<P16CT1Step> {
  const employeeId = (ctx.employeeId ?? "pierre").trim();
  const purpose = (ctx.purpose ?? "Préparation RH gouvernée").trim();
  const techCtx: TechnologyContext = { employeeId, companyId: ctx.companyId, actorUserId: ctx.actorId, purpose };

  // Techno inconnue → fail-closed (jamais résolue, jamais préparée).
  if (!isTechnologyId(need.techId)) {
    return {
      techId: need.techId as P16CT1Step["techId"], known: false, reason: need.reason,
      status: "missing", mode: "blocked", permissionAllowed: false,
      permissionReason: `Technologie T1 inconnue « ${need.techId} » — refus fail-closed.`,
      liveBlocked: true, liveBlockedReason: "Technologie inconnue.", supportsLocalExecution: false,
      safeFallback: "Technologie inconnue — refus fail-closed.", resultKind: "blocked",
      requiresHumanValidation: true, artifactPrepared: false,
    };
  }

  const entry = getTechnologyRegistryEntry(need.techId)!;
  const mode = resolveTechnologyMode({ status: entry.status, liveDependency: entry.contract.liveDependency });
  const permission = bus.canUseTechnology(employeeId, need.techId, techCtx);

  // Permission AVANT prepare (garantie par le bus). On PRÉPARE réellement l'artefact local-safe.
  const result = await bus.prepareWithTechnology(need.techId, safeInputFor(need.reason, purpose), techCtx);
  const liveBlocked = need.liveBlocked || entry.liveBlockedReason !== null || entry.contract.liveDependency !== "none";

  return {
    techId: need.techId,
    known: true,
    reason: need.reason,
    status: entry.status,
    mode,
    permissionAllowed: permission.allowed,
    permissionReason: permission.reason,
    liveBlocked,
    liveBlockedReason: need.blockedReason ?? entry.liveBlockedReason,
    supportsLocalExecution: mode === "local_safe",
    safeFallback: entry.safeFallback,
    resultKind: result.kind,
    requiresHumanValidation: result.requiresHumanValidation,
    artifactPrepared: result.kind === "ok" || result.kind === "needs_validation" || (result.kind === "fallback" && result.artifact !== null),
  };
}

/** Résout tous les besoins T1 déclarés (bus propre au run = isolation tenant). */
export async function resolveT1Steps(
  needs: readonly P16AT1Need[],
  ctx: P16CT1ResolveContext,
  bus: TechnologyBus = createTechnologyBus(),
): Promise<P16CT1Step[]> {
  const steps: P16CT1Step[] = [];
  for (const need of needs) steps.push(await resolveT1Step(need, ctx, bus));
  return steps;
}
