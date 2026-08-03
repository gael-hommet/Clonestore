// src/lib/clonechat/mission/index.ts — surface publique du Mission Support (BLOC 11 B).
export { intakeMission, classifyMissionType, REQUIRED_BY_TYPE, DEFAULT_MISSION_TTL_MS, type MissionIntakeInput } from "./intake";
export { evaluateReadiness, type ReadinessInput } from "./readiness";
export { prepareMissionPackage } from "./prepare";
export {
  intakeAndPrepareMission, missionFromVoiceResult, missionInputsFromInspection, type IntakeAndPrepareInput,
} from "./mission-with-context";
export {
  CLONECHAT_MISSION_VERSION,
  type MissionType, type MissionStatus, type MissionRisk, type MissionPriority, type MissionInputKey,
  type MissionAssumption, type MissionContract, type ReadinessDecision, type ReadinessResult,
} from "./types";
