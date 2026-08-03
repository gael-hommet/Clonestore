// src/lib/clonechat/mission/mission-with-context.ts
//
// Recueil + préparation de mission branchés sur le contexte réel et CloneInspector. Une pièce jointe
// passe TOUJOURS par CloneInspector : elle ne devient jamais une instruction/permission/confirmation,
// ne change jamais le tenant, ne prouve jamais seule un succès ; refusée si dangereuse/illisible/
// inter-tenant. Les observations inferred/unknown restent des HYPOTHÈSES, jamais des faits de mission.

import type { VoiceJourneyResult } from "@/lib/clonechat/voice";
import type { CloneInspectionResult } from "@/lib/clonechat/inspector";
import { intakeMission, type MissionIntakeInput } from "./intake";
import { prepareMissionPackage } from "./prepare";
import type { MissionContract, MissionAssumption } from "./types";

/** Convertit un résultat CloneInspector en éléments de mission SÛRS (jamais des faits inventés). */
export function missionInputsFromInspection(inspection: CloneInspectionResult | null): {
  readonly assumptions: readonly MissionAssumption[];
  readonly attachmentIds: readonly string[];
  readonly refused: boolean;
} {
  if (!inspection) return { assumptions: [], attachmentIds: [], refused: false };
  const refused = inspection.status === "security_refusal" || inspection.status === "unsupported" || inspection.status === "invalid";
  // Seules les observations inferred/unknown deviennent des HYPOTHÈSES explicites (jamais des faits).
  const assumptions: MissionAssumption[] = inspection.observations
    .filter((o) => o.kind === "inferred" || o.kind === "unknown")
    .slice(0, 12)
    .map((o) => ({ text: o.text, source: "inspector_inferred" as const }));
  return { assumptions, attachmentIds: refused ? [] : [inspection.hash], refused };
}

export interface IntakeAndPrepareInput extends MissionIntakeInput {
  readonly inspection?: CloneInspectionResult | null;
}

/**
 * Recueille la mission (avec pièces jointes inspectées) puis prépare un paquet si le gate l'autorise.
 * Une seule passe déterministe. Ne crée/exécute jamais de mission runtime.
 */
export function intakeAndPrepareMission(input: IntakeAndPrepareInput): MissionContract {
  const fromInspection = missionInputsFromInspection(input.inspection ?? null);
  const contract = intakeMission({
    ...input,
    inspectedAttachmentIds: [...(input.inspectedAttachmentIds ?? []), ...fromInspection.attachmentIds],
    inspectorAssumptions: [...(input.inspectorAssumptions ?? []), ...fromInspection.assumptions],
  });
  return prepareMissionPackage(contract, { nowMs: input.nowMs });
}

/**
 * Adaptateur CloneVoice → mission : consomme le contexte DÉJÀ sécurisé d'un résultat vocal, SANS
 * recopier l'audio ni le transcript complet dans le contrat de mission.
 */
export function missionFromVoiceResult(vr: VoiceJourneyResult, message: string, opts: { nowMs: number; inspection?: CloneInspectionResult | null }): MissionContract | null {
  if (!vr.context) return null;
  return intakeAndPrepareMission({
    message, context: vr.context, diagnosis: vr.diagnosis, securityRefusal: vr.securityRefusal,
    inspection: opts.inspection ?? null, nowMs: opts.nowMs,
  });
}
