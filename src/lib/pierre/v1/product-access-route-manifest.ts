// src/lib/pierre/v1/product-access-route-manifest.ts
// PHASE 8.6 — GLOBAL PRODUCT-ACCESS ROUTE MANIFEST.
//
// Every private client route+method of the governed Pierre engine (src/app/api/pierre/v1/**) is
// classified here. A GATED class (READ/ONBOARDING/WRITE_STANDARD/WRITE_COSTLY/ADMIN) means the route
// MUST gate on withProductAccess(req, <requirement>, ...) — masking a button in the UI is never enough.
// An ALLOWLIST class (PUBLIC/AUTHENTICATED/SYSTEM_ONLY) is an EXPLICIT, documented exception (health,
// authentication/handoff, pre-tenant identity ops, system/cron/webhook). Nothing is implicitly allowed:
// the structural test (p86-product-gate-all-private-routes) fails on any discovered route+method that is
// absent here, and on any gated route whose source does not call withProductAccess with the mapped
// requirement.
//
// The families the spec enumerates (company / companies / members / invitations / onboarding) all live
// UNDER pierre/v1 in this codebase — there are no top-level src/app/api/{company,members,...} routes.

export type AccessClass =
  | "PUBLIC"
  | "AUTHENTICATED"
  | "ONBOARDING"
  | "READ"
  | "WRITE_STANDARD"
  | "WRITE_COSTLY"
  | "ADMIN"
  | "SYSTEM_ONLY";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Classes that MUST be enforced by withProductAccess in the route source. */
export const GATED_CLASSES: readonly AccessClass[] = ["ONBOARDING", "READ", "WRITE_STANDARD", "WRITE_COSTLY", "ADMIN"];
/** Classes that are explicit, documented exceptions (no product gate). */
export const ALLOWLIST_CLASSES: readonly AccessClass[] = ["PUBLIC", "AUTHENTICATED", "SYSTEM_ONLY"];

export function isGated(c: AccessClass): boolean {
  return GATED_CLASSES.includes(c);
}

/** A gated class → the exact AccessRequirement string the route's withProductAccess call must use. */
export const REQUIREMENT_OF: Record<string, "read" | "onboarding" | "write_standard" | "write_costly" | "admin"> = {
  READ: "read",
  ONBOARDING: "onboarding",
  WRITE_STANDARD: "write_standard",
  WRITE_COSTLY: "write_costly",
  ADMIN: "admin",
};

type RouteMethods = Partial<Record<HttpMethod, AccessClass>>;

/**
 * Route key = the path under `src/app/api/` with the trailing `/route.ts` removed and forward slashes.
 * e.g. `src/app/api/pierre/v1/contracts/[id]/approve/route.ts` → `pierre/v1/contracts/[id]/approve`.
 */
export const ROUTE_MANIFEST: Record<string, RouteMethods> = {
  // ── Infra / system / pre-tenant identity (ALLOWLIST) ─────────────────────────────────
  "pierre/v1/health": { GET: "PUBLIC" },
  "pierre/v1/webhooks/signature": { POST: "SYSTEM_ONLY" },
  "pierre/v1/worker/tick": { POST: "SYSTEM_ONLY" },
  "pierre/v1/admin/backfill": { POST: "SYSTEM_ONLY" },
  "pierre/v1/communications/dispatch": { POST: "SYSTEM_ONLY" },
  "pierre/v1/activation": { POST: "AUTHENTICATED" },
  "pierre/v1/companies": { GET: "AUTHENTICATED" },
  "pierre/v1/company/switch": { POST: "AUTHENTICATED" },
  "pierre/v1/invitations/accept": { POST: "AUTHENTICATED" },
  "pierre/v1/product-access": { GET: "AUTHENTICATED" },
  "pierre/v1/members/leave": { POST: "AUTHENTICATED" },

  // ── Cockpit / overview ───────────────────────────────────────────────────────────────
  "pierre/v1/cockpit/snapshot": { GET: "READ" },

  // ── Company ────────────────────────────────────────────────────────────────────────
  "pierre/v1/company": { GET: "READ", PATCH: "ONBOARDING" },
  "pierre/v1/company/export": { POST: "READ" },

  // ── Onboarding ───────────────────────────────────────────────────────────────────────
  "pierre/v1/onboarding": { GET: "ONBOARDING" },
  "pierre/v1/onboarding/steps/[step]": { PATCH: "ONBOARDING" },
  "pierre/v1/onboarding/complete": { POST: "ONBOARDING" },

  // ── Missions ─────────────────────────────────────────────────────────────────────────
  "pierre/v1/missions": { GET: "READ", POST: "WRITE_COSTLY" },
  "pierre/v1/missions/first": { POST: "WRITE_COSTLY" },
  "pierre/v1/missions/[id]": { GET: "READ" },
  "pierre/v1/missions/[id]/tasks": { GET: "READ" },
  "pierre/v1/missions/[id]/timeline": { GET: "READ" },
  "pierre/v1/missions/[id]/validations": { GET: "READ" },
  "pierre/v1/missions/[id]/runtime": { GET: "READ", POST: "WRITE_STANDARD" },
  "pierre/v1/missions/[id]/cancel": { POST: "WRITE_STANDARD" },

  // ── Validations ──────────────────────────────────────────────────────────────────────
  "pierre/v1/validations/[id]/[action]": { POST: "WRITE_STANDARD" },

  // ── Employees ────────────────────────────────────────────────────────────────────────
  "pierre/v1/employees": { GET: "READ", POST: "WRITE_STANDARD" },
  "pierre/v1/employees/search": { GET: "READ" },
  "pierre/v1/employees/[id]": { GET: "READ", PATCH: "WRITE_STANDARD" },
  "pierre/v1/employees/[id]/absences": { GET: "READ", POST: "WRITE_STANDARD" },
  "pierre/v1/employees/[id]/access-log": { GET: "READ" },
  "pierre/v1/employees/[id]/anonymize": { POST: "ADMIN" },
  "pierre/v1/employees/[id]/archive": { POST: "ADMIN" },
  "pierre/v1/employees/[id]/completeness": { GET: "READ" },
  "pierre/v1/employees/[id]/contracts": { GET: "READ", POST: "WRITE_STANDARD" },
  "pierre/v1/employees/[id]/contracts/[contractId]/versions": { POST: "WRITE_STANDARD" },
  "pierre/v1/employees/[id]/documents": { GET: "READ" },
  "pierre/v1/employees/[id]/documents/[documentId]": { DELETE: "ADMIN" },
  "pierre/v1/employees/[id]/export": { POST: "READ" },
  "pierre/v1/employees/[id]/legal-hold": { POST: "ADMIN" },
  "pierre/v1/employees/[id]/missions": { GET: "READ" },
  "pierre/v1/employees/[id]/reactivate": { POST: "WRITE_STANDARD" },
  "pierre/v1/employees/[id]/sensitive": { GET: "READ", POST: "ADMIN" },
  "pierre/v1/employees/[id]/tasks": { GET: "READ" },
  "pierre/v1/employees/[id]/timeline": { GET: "READ" },
  "pierre/v1/employees/import/preview": { POST: "WRITE_STANDARD" },
  "pierre/v1/employees/import/commit": { POST: "WRITE_STANDARD" },
  "pierre/v1/employees/import/[batchId]": { GET: "READ" },
  "pierre/v1/employees/import/[batchId]/rollback": { POST: "WRITE_STANDARD" },

  // ── Documents & contracts ──────────────────────────────────────────────────────────
  "pierre/v1/contracts": { POST: "WRITE_STANDARD" },
  "pierre/v1/contracts/[id]": { GET: "READ" },
  "pierre/v1/contracts/[id]/amendments": { POST: "WRITE_STANDARD" },
  "pierre/v1/contracts/[id]/approve": { POST: "WRITE_STANDARD" },
  "pierre/v1/contracts/[id]/finalize": { POST: "WRITE_COSTLY" },
  "pierre/v1/contracts/[id]/generate": { POST: "WRITE_COSTLY" },
  "pierre/v1/contracts/[id]/history": { GET: "READ" },
  "pierre/v1/contracts/[id]/prepare-signature": { POST: "WRITE_COSTLY" },
  "pierre/v1/contracts/[id]/readiness": { POST: "READ" },
  "pierre/v1/contracts/[id]/request-changes": { POST: "WRITE_STANDARD" },
  "pierre/v1/contracts/[id]/signature": { GET: "READ" },
  "pierre/v1/contracts/[id]/signature/cancel": { POST: "ADMIN" },
  "pierre/v1/contracts/[id]/signature/submit": { POST: "WRITE_COSTLY" },
  "pierre/v1/contracts/[id]/submit-review": { POST: "WRITE_STANDARD" },
  "pierre/v1/contracts/[id]/versions": { POST: "WRITE_STANDARD" },

  // ── Signatures ───────────────────────────────────────────────────────────────────────
  "pierre/v1/signatures/[id]/evidence": { GET: "READ" },
  "pierre/v1/signatures/reconcile": { POST: "WRITE_STANDARD" },

  // ── Messages & communications ──────────────────────────────────────────────────────
  "pierre/v1/messages": { GET: "READ" },
  "pierre/v1/messages/[id]/read": { POST: "WRITE_STANDARD" },
  "pierre/v1/messages/[id]/archive": { POST: "WRITE_STANDARD" },
  "pierre/v1/communications": { GET: "READ" },
  "pierre/v1/communications/dead-letter": { GET: "READ" },
  "pierre/v1/communications/[id]/retry": { POST: "WRITE_STANDARD" },
  "pierre/v1/communications/[id]/cancel": { POST: "WRITE_STANDARD" },

  // ── Members & invitations ──────────────────────────────────────────────────────────
  "pierre/v1/members": { GET: "READ" },
  "pierre/v1/members/[id]": { PATCH: "ADMIN" },
  "pierre/v1/members/[id]/reactivate": { POST: "ADMIN" },
  "pierre/v1/members/[id]/remove": { POST: "ADMIN" },
  "pierre/v1/members/[id]/roles": { POST: "ADMIN" },
  "pierre/v1/members/[id]/roles/[role]": { DELETE: "ADMIN" },
  "pierre/v1/members/[id]/suspend": { POST: "ADMIN" },
  "pierre/v1/members/[id]/transfer-ownership": { POST: "ADMIN" },
  "pierre/v1/invitations": { POST: "WRITE_COSTLY" },
  "pierre/v1/invitations/[id]/resend": { POST: "WRITE_COSTLY" },
  "pierre/v1/invitations/[id]/revoke": { POST: "ADMIN" },

  // ── Roles ──────────────────────────────────────────────────────────────────────────
  "pierre/v1/roles": { GET: "READ", POST: "ADMIN" },
  "pierre/v1/roles/[key]": { GET: "READ", PATCH: "ADMIN" },
  "pierre/v1/roles/[key]/archive": { POST: "ADMIN" },

  // ── Sites ──────────────────────────────────────────────────────────────────────────
  "pierre/v1/sites": { GET: "READ", POST: "WRITE_STANDARD" },
  "pierre/v1/sites/[id]": { GET: "READ", PATCH: "WRITE_STANDARD" },
  "pierre/v1/sites/[id]/archive": { POST: "ADMIN" },
  "pierre/v1/sites/[id]/assign-manager": { POST: "WRITE_STANDARD" },
  "pierre/v1/sites/[id]/reactivate": { POST: "WRITE_STANDARD" },

  // ── Audit ──────────────────────────────────────────────────────────────────────────
  "pierre/v1/audit/data-access": { GET: "READ" },
};

/** WHY each allowlisted route is exempt from the product gate (kept minimal + explicit). */
export const ALLOWLIST_REASONS: Record<string, string> = {
  "pierre/v1/health": "liveness/readiness probe — public by design",
  "pierre/v1/webhooks/signature": "specialised signed provider webhook — system ingress, not a client route",
  "pierre/v1/worker/tick": "runtime worker tick — system/cron triggered (own secret)",
  "pierre/v1/admin/backfill": "operator migration/backfill — system/admin only",
  "pierre/v1/communications/dispatch": "communication dispatch — SYSTEM-only trigger (own secret), refuses ordinary callers",
  "pierre/v1/activation": "activation/handoff claim — identity-scoped, runs BEFORE any tenant/entitlement exists",
  "pierre/v1/companies": "list my companies — pre-tenant identity op (withUser)",
  "pierre/v1/company/switch": "switch active company — pre-tenant identity op (withUser)",
  "pierre/v1/invitations/accept": "accept an invitation — identity-scoped, the accepter has no company/entitlement yet",
  "pierre/v1/product-access": "the product-access STATUS probe itself — must be readable in EVERY entitlement state (incl. suspended/denied)",
  "pierre/v1/members/leave": "self-service membership exit — must work regardless of the company's entitlement state",
};

/** Normalise a discovered route.ts file path to its manifest key. */
export function routeKeyFromFile(filePath: string): string {
  const norm = filePath.replace(/\\/g, "/");
  const marker = "app/api/";
  const i = norm.lastIndexOf(marker);
  const tail = (i >= 0 ? norm.slice(i + marker.length) : norm).replace(/\/route\.ts$/, "");
  return tail;
}
