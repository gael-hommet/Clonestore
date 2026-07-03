// src/lib/pierre/v1/cognitive-runtime/entity-resolution.ts
// PHASE 8.14 — deterministic entity resolution (owner §7). PURE over an ALREADY-tenant-scoped candidate
// list (the caller fetches candidates via the real permission-filtered repos, e.g. searchEmployees /
// EmployeeRepo.byId; this module never touches the DB, so it cannot leak across tenants and is fully
// unit-testable). Never guesses when ambiguity affects execution: homonyms → "ambiguous" with the exact
// distinguishing question; nothing found → "not_found"; forbidden candidate → "forbidden".

import type { ResolvedReference, ResolutionStatus } from "./types";

export type EntityCandidate = {
  readonly id: string;
  readonly name: string;
  readonly site?: string | null;
  readonly status?: string | null;      // e.g. "active" | "archived" | "former"
  readonly forbidden?: boolean;         // caller marks a candidate the actor may not access
  readonly distinguisher?: string | null; // precomputed human distinguisher (site/role/date)
};

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function distinguisherFor(c: EntityCandidate): string {
  if (c.distinguisher) return c.distinguisher;
  const bits = [c.site ? `site ${c.site}` : null, c.status ? c.status : null].filter(Boolean);
  return bits.length ? bits.join(", ") : `id ${c.id.slice(0, 8)}`;
}

/**
 * Resolve `query` against tenant-scoped `candidates`.
 * - exactly one non-forbidden name/id match → resolved
 * - several matches → ambiguous (with distinguishers so the caller can ask the exact question)
 * - only forbidden matches → forbidden
 * - none → not_found
 * Prefers active over archived/former when that uniquely disambiguates.
 */
export function resolveEntity(
  kind: ResolvedReference["kind"],
  query: string,
  candidates: readonly EntityCandidate[],
): ResolvedReference {
  const q = norm(query);
  const base = (status: ResolutionStatus, id: string | null, reason: string, cands: EntityCandidate[] = []): ResolvedReference => ({
    kind, status, id, label: query,
    candidates: cands.map((c) => ({ id: c.id, label: c.name, distinguisher: distinguisherFor(c) })),
    reason,
  });
  if (!q) return base("unresolved", null, "empty_query");

  // direct id hit
  const byId = candidates.find((c) => c.id === query);
  if (byId) return byId.forbidden ? base("forbidden", null, "id_forbidden") : base("resolved", byId.id, "id_match");

  const matches = candidates.filter((c) => {
    const n = norm(c.name);
    return n === q || n.includes(q) || q.includes(n);
  });
  if (matches.length === 0) return base("not_found", null, "no_match");

  const allowed = matches.filter((c) => !c.forbidden);
  if (allowed.length === 0) return base("forbidden", null, "all_forbidden");
  if (allowed.length === 1) return base("resolved", allowed[0].id, "unique_match");

  // Multiple allowed matches — try to disambiguate by exact-name + active status.
  const exact = allowed.filter((c) => norm(c.name) === q);
  const pool = exact.length > 0 ? exact : allowed;
  const active = pool.filter((c) => (c.status ?? "active") === "active");
  if (active.length === 1) return base("resolved", active[0].id, "unique_active_match");

  return base("ambiguous", null, "homonym", pool);
}

/** Validate a manager reference without cross-tenant leak: the manager id MUST be among the tenant-scoped
 *  employee candidates and must not be forbidden. */
export function resolveManager(managerRef: string, employeeCandidates: readonly EntityCandidate[]): ResolvedReference {
  const r = resolveEntity("manager", managerRef, employeeCandidates);
  return r;
}
