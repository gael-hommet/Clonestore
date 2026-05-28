// B46 — Technology Permissions
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type { CloneStoreTechnologyId, TechnologyAccessLevel } from "./technology-b46-types";

// ── Locked technologies (client can never disable or unlock) ─────────────────

const LOCKED: Set<CloneStoreTechnologyId> = new Set(["cloneguard", "clonetrace"]);

// ── Customer-configurable (paying customers may adjust, but not unlock) ───────

const CUSTOMER_CONFIGURABLE: Set<CloneStoreTechnologyId> = new Set(["cloneadn", "clonevoice", "clonechat"]);

// ── Public view permissions ───────────────────────────────────────────────────

export function canViewTechnologyConfig(
  access: TechnologyAccessLevel,
  _techId: CloneStoreTechnologyId,
): boolean {
  return access !== "anonymous";
}

// ── Edit permissions ──────────────────────────────────────────────────────────

export function canEditTechnologyConfig(
  access: TechnologyAccessLevel,
  techId: CloneStoreTechnologyId,
): boolean {
  if (access === "anonymous" || access === "logged_unpaid") return false;
  if (LOCKED.has(techId)) return false;
  if (access === "internal_admin") return true;
  // paid_customer / trial: only customer-configurable technologies
  return CUSTOMER_CONFIGURABLE.has(techId);
}

// ── Reset permissions ─────────────────────────────────────────────────────────

export function canResetTechnologyConfig(
  access: TechnologyAccessLevel,
  techId: CloneStoreTechnologyId,
): boolean {
  if (access === "internal_admin") return true;
  if (access === "paid_customer") {
    return CUSTOMER_CONFIGURABLE.has(techId) && !LOCKED.has(techId);
  }
  return false;
}

// ── Disable permissions ───────────────────────────────────────────────────────

export function canDisableTechnology(
  access: TechnologyAccessLevel,
  techId: CloneStoreTechnologyId,
): boolean {
  if (LOCKED.has(techId)) return false;
  if (access === "internal_admin") return true;
  if (access === "paid_customer") {
    return techId === "clonevoice" || techId === "clonechat";
  }
  return false;
}

// ── Runtime mode edit permissions ─────────────────────────────────────────────

export function canEditRuntimeMode(
  access: TechnologyAccessLevel,
  techId: CloneStoreTechnologyId,
): boolean {
  if (access !== "internal_admin") return false;
  if (LOCKED.has(techId)) return false;
  return true;
}

// ── Resolve access level from auth context ────────────────────────────────────

export function resolveAccessLevel(params: {
  has_active_order: boolean;
  is_internal_admin: boolean;
  is_authenticated: boolean;
  is_trial: boolean;
}): TechnologyAccessLevel {
  if (!params.is_authenticated) return "anonymous";
  if (params.is_internal_admin) return "internal_admin";
  if (params.has_active_order) return "paid_customer";
  if (params.is_trial) return "trial";
  return "logged_unpaid";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isLockedTechnology(techId: CloneStoreTechnologyId): boolean {
  return LOCKED.has(techId);
}

export function isCustomerConfigurableTechnology(techId: CloneStoreTechnologyId): boolean {
  return CUSTOMER_CONFIGURABLE.has(techId);
}

export function getLockedTechnologies(): CloneStoreTechnologyId[] {
  return [...LOCKED] as CloneStoreTechnologyId[];
}

export function getCustomerConfigurableTechnologies(): CloneStoreTechnologyId[] {
  return [...CUSTOMER_CONFIGURABLE] as CloneStoreTechnologyId[];
}
