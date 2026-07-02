// Guided Tour — barrel de l'API pure (P9.1).
// La couche React (src/components/guided-tour/*) consomme uniquement ce module.

export * from "./types";
export * from "./tour-machine";
export * from "./positioning";
export * from "./target-resolver";
export * from "./progress-storage";
export * from "./a11y";
export * from "./tour-registry";
export {
  PUBLIC_DISCOVERY_TOUR,
  PUBLIC_DISCOVERY_TOUR_ID,
  PUBLIC_DISCOVERY_WELCOME,
} from "./registry/public-discovery-tour";
export {
  MY_CLONESTORE_TOUR,
  MY_CLONESTORE_TOUR_ID,
  MY_CLONESTORE_WELCOME,
} from "./registry/my-clonestore-tour";
export {
  PIERRE_COCKPIT_TOUR,
  PIERRE_COCKPIT_TOUR_ID,
  PIERRE_COCKPIT_WELCOME,
} from "./registry/pierre-cockpit-tour";
export {
  CLONECHAT_TOUR,
  CLONECHAT_TOUR_ID,
  CLONECHAT_WELCOME,
} from "./registry/clonechat-tour";
