// src/lib/pierre/v1/final-certification/blocker-registry.ts
// PHASE 8.13 — the consolidated blocker registry: what is blocked, why, and who can lift it. None of
// these is liftable by a model. These are the honest reasons certain acts / countries are not
// launch-grade — separate from functional completeness.
export type Blocker = { id: string; scope: "legal" | "provider" | "external" | "production"; title: string; status: string; effect: string; liftedBy: string };

export const BLOCKERS: readonly Blocker[] = [
  { id: "legal_review", scope: "legal", title: "Qualified human legal review", status: "REQUIRED", effect: "0 country rules VERIFIED → automatic country-legal execution blocked", liftedBy: "named qualified legal professional attesting each officially-sourced rule" },
  { id: "official_retrieval", scope: "legal", title: "Official rule retrieval + archival", status: "PENDING", effect: "rules stay SOURCE_REQUIRED (pointers only)", liftedBy: "authenticated retrieval pipeline archiving official bytes" },
  { id: "p874_yousign", scope: "external", title: "P8.7.4 — Yousign", status: "OPEN", effect: "e-signature not usable; governed manual signature path only", liftedBy: "external resolution of the sandbox org-membership blocker" },
  { id: "payroll_engine", scope: "provider", title: "Certified payroll engine + social declarations", status: "NOT_INTEGRATED", effect: "official computation + declarations external; manual path only", liftedBy: "real payroll provider integration + credentials" },
  { id: "operational_providers", scope: "provider", title: "Identity / time / benefits / training providers", status: "NOT_INTEGRATED", effect: "governed manual handoffs only", liftedBy: "real provider integrations + credentials" },
  { id: "deploy_block", scope: "production", title: "Deploy block", status: "ACTIVE", effect: "Pierre not publicly enabled (NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1)", liftedBy: "a separate owner-approved final launch gate" },
];

export function blockersByScope() {
  return BLOCKERS.reduce<Record<string, Blocker[]>>((a, b) => { (a[b.scope] ??= []).push(b); return a; }, {});
}
