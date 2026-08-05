// src/lib/clonechat/onboarding/index.ts — surface publique de l'onboarding CloneChat (BLOC 11 A) + orchestrateur global.
export { resolveOnboarding, DEFAULT_ONBOARDING_TTL_MS, type OnboardingInput, type OnboardingGoal } from "./engine";
export {
  onboardAndPrepareMissionWithCloneChat, type OnboardAndMissionResult, type OnboardAndMissionOptions,
} from "./orchestrator";
export { getJourney, type JourneyBlueprint, type JourneyStepSpec } from "./journeys";
export {
  onboardingKey, loadValidOnboarding, loadOnboardingOutcome, createInMemoryOnboardingStore, createUnavailableOnboardingStore,
  type OnboardingStore, type OnboardingLoadRejection, type OnboardingLoadOutcome,
} from "./store";
export {
  CLONECHAT_ONBOARDING_VERSION,
  type OnboardingStatus, type OnboardingJourneyId, type OnboardingStepState, type OnboardingStep,
  type OnboardingState, type OnboardingPersisted, type ResumeState,
} from "./types";
