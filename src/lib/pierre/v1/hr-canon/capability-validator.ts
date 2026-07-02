// src/lib/pierre/v1/hr-canon/capability-validator.ts
// PHASE 8.10 — validates capability definitions against the canon schema + cross-consistency
// rules. This is what makes the registry MACHINE-CHECKED, not a prose promise: every capability
// must be structurally complete, use only canonical enum values, and satisfy the integrity rules
// (VERIFIED_EXISTING needs real evidence; HUMAN_ONLY/forbidden cannot be autonomous; targetPhase
// consistent with status; ids unique & namespaced by domain; certification criteria present).

import type { HrCapabilityDefinition } from "./types";
import { VALUES } from "./capability-schema";

export type ValidationIssue = { id: string; field: string; severity: "error" | "warning"; message: string };
export type ValidationResult = { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };

function inSet<T>(v: T, set: readonly T[]): boolean { return set.includes(v); }

/** Validate a single capability. Returns structural + integrity issues. */
export function validateCapability(c: HrCapabilityDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (field: string, message: string) => issues.push({ id: c?.id ?? "<no-id>", field, severity: "error", message });
  const warn = (field: string, message: string) => issues.push({ id: c?.id ?? "<no-id>", field, severity: "warning", message });

  // required scalars
  if (!c.id || !/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(c.id)) err("id", "id must be 'domain.operation' snake_case");
  if (typeof c.version !== "number" || c.version < 1) err("version", "version must be >= 1");
  if (!inSet(c.domain, VALUES.domain)) err("domain", `unknown domain '${c.domain}'`);
  if (c.id && c.domain && !c.id.startsWith(`${c.domain}.`)) err("id", `id must be namespaced by domain '${c.domain}.'`);
  if (!c.operation) err("operation", "operation required");
  if (!c.label) err("label", "label required");
  if (!c.description) warn("description", "description empty");

  // enum arrays
  for (const s of c.lifecycleStages) if (!inSet(s, VALUES.lifecycleStage)) err("lifecycleStages", `bad stage '${s}'`);
  if (c.lifecycleStages.length === 0) err("lifecycleStages", "at least one lifecycle stage required");
  for (const t of c.triggerModes) if (!inSet(t, VALUES.triggerMode)) err("triggerModes", `bad trigger '${t}'`);
  if (c.triggerModes.length === 0) err("triggerModes", "at least one trigger mode required");
  for (const a of c.supportedActors) if (!inSet(a, VALUES.actor)) err("supportedActors", `bad actor '${a}'`);
  if (c.supportedActors.length === 0) err("supportedActors", "at least one actor required");
  for (const s of c.subjectTypes) if (!inSet(s, VALUES.subject)) err("subjectTypes", `bad subject '${s}'`);
  if (!inSet(c.missingInformationPolicy, VALUES.missingInfo)) err("missingInformationPolicy", `bad policy '${c.missingInformationPolicy}'`);
  if (!inSet(c.autonomy, VALUES.autonomy)) err("autonomy", `bad autonomy '${c.autonomy}'`);
  if (!inSet(c.implementation, VALUES.implementation)) err("implementation", `bad status '${c.implementation}'`);
  if (!inSet(c.targetPhase, VALUES.targetPhase)) err("targetPhase", `bad targetPhase '${c.targetPhase}'`);

  // workflow completeness
  if (!c.workflow || !Array.isArray(c.workflow.steps) || c.workflow.steps.length === 0) err("workflow", "workflow.steps required (non-empty)");
  else for (const st of c.workflow.steps) if (!inSet(st.autonomy, VALUES.autonomy)) err("workflow.steps", `bad step autonomy '${st.autonomy}'`);

  // risk completeness
  if (!c.risk || !["low", "medium", "high", "critical"].includes(c.risk.level)) err("risk", "risk.level required");

  // ── integrity rules ──
  if (c.implementation === "VERIFIED_EXISTING" && c.evidence.length === 0)
    err("evidence", "VERIFIED_EXISTING requires at least one evidence reference");
  if (c.implementation === "VERIFIED_EXISTING" && c.targetPhase !== "ALREADY_VERIFIED")
    err("targetPhase", "VERIFIED_EXISTING must target ALREADY_VERIFIED");
  if ((c.autonomy === "human_only" || c.autonomy === "forbidden") && c.implementation !== "HUMAN_ONLY" && c.risk.legalSensitivity !== "high" && c.risk.level !== "critical")
    warn("autonomy", "human_only/forbidden autonomy usually pairs with HUMAN_ONLY status or high legal/critical risk");
  if (c.implementation === "HUMAN_ONLY" && !["human_only", "forbidden", "observe_only", "suggest", "prepare_draft"].includes(c.autonomy))
    err("autonomy", "HUMAN_ONLY status cannot have an executing autonomy level");
  if (c.implementation === "LEGAL_CONTENT_REQUIRED" && c.countryRuleDependencies.length === 0)
    err("countryRuleDependencies", "LEGAL_CONTENT_REQUIRED requires at least one country rule dependency");
  if (c.implementation === "EXTERNAL_DEPENDENCY" && c.integrationDependencies.length === 0)
    err("integrationDependencies", "EXTERNAL_DEPENDENCY requires at least one integration dependency");
  if (c.certificationCriteria.length === 0) err("certificationCriteria", "at least one certification criterion required");
  // an autonomous execution that mutates irreversibly should carry an approval or be governed
  const irreversible = c.employeeMutations.some((m) => !m.reversible);
  if (c.autonomy === "execute_autonomous" && irreversible && c.approvals.length === 0)
    warn("approvals", "autonomous + irreversible mutation without an approval policy");

  return issues;
}

/** Validate the whole registry: per-capability + uniqueness + basic distribution. */
export function validateRegistry(caps: HrCapabilityDefinition[]): ValidationResult & { count: number; duplicateIds: string[] } {
  const all: ValidationIssue[] = [];
  const seen = new Map<string, number>();
  for (const c of caps) { seen.set(c.id, (seen.get(c.id) ?? 0) + 1); all.push(...validateCapability(c)); }
  const duplicateIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  for (const id of duplicateIds) all.push({ id, field: "id", severity: "error", message: "duplicate id" });
  const errors = all.filter((i) => i.severity === "error");
  const warnings = all.filter((i) => i.severity === "warning");
  return { ok: errors.length === 0, errors, warnings, count: caps.length, duplicateIds };
}
