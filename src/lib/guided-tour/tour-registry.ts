// Guided Tour — registre des tours (P9.1).
//
// Point d'entrée unique pour retrouver un tour par id. Réutilisable : d'autres
// tours (onboarding client, etc.) s'ajouteront ici sans toucher au moteur.

import type { Tour } from "./types";
import {
  PUBLIC_DISCOVERY_TOUR,
  PUBLIC_DISCOVERY_TOUR_ID,
} from "./registry/public-discovery-tour";
import { MY_CLONESTORE_TOUR, MY_CLONESTORE_TOUR_ID } from "./registry/my-clonestore-tour";
import { PIERRE_COCKPIT_TOUR, PIERRE_COCKPIT_TOUR_ID } from "./registry/pierre-cockpit-tour";
import { CLONECHAT_TOUR, CLONECHAT_TOUR_ID } from "./registry/clonechat-tour";

const REGISTRY: Readonly<Record<string, Tour>> = {
  [PUBLIC_DISCOVERY_TOUR_ID]: PUBLIC_DISCOVERY_TOUR,
  [MY_CLONESTORE_TOUR_ID]: MY_CLONESTORE_TOUR,
  [PIERRE_COCKPIT_TOUR_ID]: PIERRE_COCKPIT_TOUR,
  [CLONECHAT_TOUR_ID]: CLONECHAT_TOUR,
};

export function getTour(id: string): Tour | null {
  return REGISTRY[id] ?? null;
}

export function listTours(): Tour[] {
  return Object.values(REGISTRY);
}

export function hasTour(id: string): boolean {
  return id in REGISTRY;
}

export { PUBLIC_DISCOVERY_TOUR_ID, MY_CLONESTORE_TOUR_ID, PIERRE_COCKPIT_TOUR_ID, CLONECHAT_TOUR_ID };
