// B48 — API Route Readiness
// Documents which routes exist and their launch status.
// Pure: no Supabase, no Next, no async. No throw.

export type RouteEntry = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  surface: string;
  auth_required: boolean;
  status: "active" | "demo_only" | "internal_only" | "disabled";
  blocking_if_missing: boolean;
  notes: string | null;
};

const ROUTE_REGISTRY: RouteEntry[] = [
  // Auth / Billing
  { method: "GET", path: "/api/auth/session", surface: "auth", auth_required: false, status: "active", blocking_if_missing: true, notes: null },
  { method: "POST", path: "/api/billing/activate", surface: "billing", auth_required: true, status: "active", blocking_if_missing: true, notes: null },
  { method: "POST", path: "/api/checkout", surface: "checkout", auth_required: true, status: "active", blocking_if_missing: true, notes: null },
  { method: "GET", path: "/api/stripe/return", surface: "billing", auth_required: false, status: "active", blocking_if_missing: true, notes: "Stripe return URL handler" },
  // CloneStore platform
  { method: "GET", path: "/api/clonestore/runtime", surface: "cockpit", auth_required: true, status: "active", blocking_if_missing: false, notes: null },
  { method: "POST", path: "/api/clonestore/runtime", surface: "cockpit", auth_required: true, status: "active", blocking_if_missing: false, notes: null },
  { method: "GET", path: "/api/clonestore/technologies/snapshot", surface: "technologies", auth_required: true, status: "active", blocking_if_missing: false, notes: null },
  // Pierre core
  { method: "POST", path: "/api/pierre/submit", surface: "pierre", auth_required: true, status: "active", blocking_if_missing: true, notes: null },
  { method: "GET", path: "/api/pierre/mission/[missionId]", surface: "pierre", auth_required: true, status: "active", blocking_if_missing: false, notes: null },
  { method: "GET", path: "/api/pierre/use/brain/contracts", surface: "pierre", auth_required: true, status: "active", blocking_if_missing: false, notes: null },
  // Pierre legal B47
  { method: "GET", path: "/api/pierre/legal/guardrails", surface: "legal", auth_required: false, status: "active", blocking_if_missing: false, notes: "B47 legal check" },
  { method: "POST", path: "/api/pierre/legal/validate-output", surface: "legal", auth_required: false, status: "active", blocking_if_missing: false, notes: "B47 output validation" },
  { method: "GET", path: "/api/pierre/legal/readiness", surface: "legal", auth_required: false, status: "active", blocking_if_missing: false, notes: "B47 readiness verdict" },
  // B48 launch
  { method: "GET", path: "/api/clonestore/launch-readiness", surface: "operations", auth_required: false, status: "active", blocking_if_missing: false, notes: "B48 launch verdict" },
  { method: "GET", path: "/api/pierre/launch-readiness", surface: "pierre", auth_required: false, status: "active", blocking_if_missing: false, notes: "B48 Pierre launch verdict" },
  // Documents / PDF
  { method: "POST", path: "/api/pierre/doc/generate", surface: "documents", auth_required: true, status: "active", blocking_if_missing: false, notes: "human validation required" },
  { method: "POST", path: "/api/pierre/pdf/generate", surface: "documents", auth_required: true, status: "active", blocking_if_missing: false, notes: null },
  // Email
  { method: "POST", path: "/api/pierre/email/draft", surface: "email", auth_required: true, status: "active", blocking_if_missing: false, notes: "draft only — no live send" },
];

export function getAllRoutes(): RouteEntry[] {
  return [...ROUTE_REGISTRY];
}

export function getRoutesBySurface(surface: string): RouteEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.surface === surface);
}

export function getBlockingRoutes(): RouteEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.blocking_if_missing);
}

export function getRouteReadinessSummary(): {
  total: number;
  active: number;
  demo_only: number;
  internal_only: number;
  disabled: number;
  blocking_active: number;
} {
  const active = ROUTE_REGISTRY.filter((r) => r.status === "active").length;
  const demo_only = ROUTE_REGISTRY.filter((r) => r.status === "demo_only").length;
  const internal_only = ROUTE_REGISTRY.filter((r) => r.status === "internal_only").length;
  const disabled = ROUTE_REGISTRY.filter((r) => r.status === "disabled").length;
  const blocking_active = ROUTE_REGISTRY.filter((r) => r.blocking_if_missing && r.status === "active").length;
  return { total: ROUTE_REGISTRY.length, active, demo_only, internal_only, disabled, blocking_active };
}
