// B46 — Technology Configuration Test Fixtures
// Pure: no Supabase, no Next, no async. For tests only.

import type {
  B46TechnologyItem,
  B46TechnologyStatus,
  B46ReadinessContext,
  CloneStoreTechnologyId,
} from "./technology-b46-types";
import { B46_TECHNOLOGY_IDS } from "./technology-b46-types";
import { buildAllB46TechnologyItems, buildB46TechnologyItem } from "./technology-b46-registry";

export function buildDefaultB46ReadinessContext(overrides?: Partial<B46ReadinessContext>): B46ReadinessContext {
  return {
    b38_closed: true,
    b39_closed: true,
    b40_closed: true,
    b41_closed: true,
    b42_closed: true,
    b43_closed: true,
    b44_closed: true,
    b45_closed: true,
    empreinte_ready: true,
    document_style_ready: true,
    security_ready: true,
    observability_ready: true,
    email_runtime_mode: "mock",
    ai_runtime_mode: "mock",
    ...overrides,
  };
}

export function buildMinimalB46ReadinessContext(): B46ReadinessContext {
  return buildDefaultB46ReadinessContext({
    b38_closed: false,
    b39_closed: false,
    b41_closed: false,
    b42_closed: false,
    b43_closed: false,
    b44_closed: false,
    b45_closed: false,
    empreinte_ready: false,
    document_style_ready: false,
    security_ready: false,
    observability_ready: false,
  });
}

export function buildFullB46TechnologyItems(
  context?: B46ReadinessContext,
): B46TechnologyItem[] {
  return buildAllB46TechnologyItems(context ?? buildDefaultB46ReadinessContext());
}

export function buildTechnologyItemWithStatus(
  id: CloneStoreTechnologyId,
  status: B46TechnologyStatus,
  context?: B46ReadinessContext,
): B46TechnologyItem {
  return buildB46TechnologyItem(id, context ?? buildDefaultB46ReadinessContext(), status);
}

export function buildDegradedTechnologyItems(): B46TechnologyItem[] {
  const ctx = buildDefaultB46ReadinessContext();
  return B46_TECHNOLOGY_IDS.map((id) => {
    const status: B46TechnologyStatus = id === "cloneguard" || id === "clonetrace"
      ? "active"   // locked technologies keep active even in degraded test
      : "degraded";
    return buildB46TechnologyItem(id, ctx, status);
  });
}
