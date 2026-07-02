// src/lib/pierre/v1/hr-proactive/mission-creation.ts
// PHASE 8.11 — turn a deduplicated signal into a GOVERNED mission-creation request for the handling
// pack. Pure: it produces the request the verified runtime (createMission) enacts — it never creates
// a mission itself and never fabricates a tenant/subject.
import type { HrSignal } from "./signal-types";
import { getSignalDefinition } from "./signal-registry";
import { getMissionPack } from "../hr-mission-packs/registry";

export type MissionCreationRequest = {
  packId: string;
  companyId: string;
  subjectRef: string;
  correlationId: string;      // dedup at the mission layer too
  reason: string;
};

export function signalToMissionRequest(signal: HrSignal): MissionCreationRequest | null {
  const def = getSignalDefinition(signal.key);
  if (!def) return null;
  const pack = getMissionPack(def.handledByPackId);
  if (!pack) return null;     // fail-closed: no pack → no mission
  return { packId: pack.id, companyId: signal.companyId, subjectRef: signal.subjectRef, correlationId: `proactive:${signal.dedupKey}`, reason: `proactive signal ${signal.key} (${signal.severity})` };
}

export function batchToMissionRequests(signals: readonly HrSignal[]): MissionCreationRequest[] {
  return signals.map(signalToMissionRequest).filter((r): r is MissionCreationRequest => r !== null);
}
