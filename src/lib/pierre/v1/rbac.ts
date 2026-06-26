// src/lib/pierre/v1/rbac.ts
// PHASE 8.2 — RBAC helpers: role permissions (in tenant-context) + site scope.
//
// Authorization has two axes: (1) role -> permitted actions (Permission), and
// (2) site scope -> which sites' data a member may see. A member with site_ids
// === null sees all company sites; otherwise only the listed sites.

import type { TenantContext } from "./tenant-context";
export { hasPermission, requirePermission } from "./tenant-context";
export type { Permission } from "./tenant-context";

/** The site ids a member is scoped to, or null for "all sites". */
export function siteScope(ctx: TenantContext): string[] | null {
  return ctx.site_ids;
}

/** May this member access data attached to `siteId` (null = no/unset site)? */
export function canAccessSite(ctx: TenantContext, siteId: string | null): boolean {
  if (ctx.site_ids === null) return true;
  return siteId !== null && ctx.site_ids.includes(siteId);
}

/** App-level scope filter for a `site_id` column. Returns null when unrestricted. */
export function siteScopeArray(ctx: TenantContext): string[] | null {
  return ctx.site_ids && ctx.site_ids.length > 0 ? ctx.site_ids : null;
}
