// src/lib/pierre/v1/hr-mission-packs/validator.ts
// PHASE 8.11 — machine checks that a mission pack is governed & real: every binding resolves to a
// verified primitive, sensitive/irreversible mutations are approval-gated, completion criteria
// exist, and runtimeStatus is consistent with the pack's steps/dependencies. A pack that would
// call SQL / a provider / an unregistered action / an unpolicied mutation cannot pass.

import type { HrMissionPackDefinition } from "./types";
import { resolveBinding } from "./runtime-map";
import { getCapability } from "../hr-canon/capability-registry";

export type PackIssue = { id: string; field: string; severity: "error" | "warning"; message: string };

export function validateMissionPack(p: HrMissionPackDefinition): PackIssue[] {
  const out: PackIssue[] = [];
  const err = (field: string, message: string) => out.push({ id: p?.id ?? "<no-id>", field, severity: "error", message });
  const warn = (field: string, message: string) => out.push({ id: p?.id ?? "<no-id>", field, severity: "warning", message });

  if (!p.id || !/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(p.id)) err("id", "id must be 'domain.pack' snake_case");
  if (p.id && p.domain && !p.id.startsWith(`${p.domain}.`)) err("id", `id must be namespaced by domain '${p.domain}.'`);
  if (!p.title) err("title", "title required");
  if (p.capabilityIds.length === 0) err("capabilityIds", "a pack must realize ≥1 canon capability");
  for (const cid of p.capabilityIds) if (!getCapability(cid)) err("capabilityIds", `unknown capability '${cid}'`);
  if (p.steps.length === 0) err("steps", "a pack must have ≥1 step");
  if (p.completionCriteria.length === 0) err("completionCriteria", "≥1 completion criterion required");

  const stepKeys = new Set<string>();
  let hasHuman = false, hasExternal = false, hasSignature = false, hasApproval = false, hasClose = false;
  for (const s of p.steps) {
    if (stepKeys.has(s.key)) err("steps", `duplicate step key '${s.key}'`);
    stepKeys.add(s.key);
    const r = resolveBinding(s.binding);
    if (!r.ok) err("steps", `${s.key}: ${r.error}`);
    if (s.binding.type === "human_decision") hasHuman = true;
    if (s.binding.type === "external_handoff") hasExternal = true;
    if (s.binding.type === "runtime_action" && s.binding.actionKey === "approval.request") hasApproval = true;
    if (s.kind === "request_approval") hasApproval = true;
    if (s.kind === "close") hasClose = true;
    if (s.kind === "signature") hasSignature = true;
    for (const d of s.dependsOn ?? []) if (!p.steps.some((x) => x.key === d)) err("steps", `${s.key}: unknown dependsOn '${d}'`);
  }
  if (!hasClose) warn("steps", "no explicit close step");

  // governance: a pack that SIGNS, makes a legally-reserved HUMAN decision, or applies an IRREVERSIBLE
  // employee mutation must carry an approval policy or an approval/human step. Reversible record-keeping
  // mutations do not require an approval gate (they are auditable + undoable).
  const irreversibleMutation = p.expectedEmployeeMutations.some((m) => !m.reversible);
  if ((hasSignature || hasHuman || irreversibleMutation) && p.approvals.length === 0 && !hasApproval && !hasHuman)
    err("approvals", "sensitive pack (signature / human decision / irreversible mutation) needs an approval policy or approval/human step");

  // runtimeStatus consistency
  if (p.runtimeStatus === "RUNTIME_READY_EXTERNAL_BLOCKED" && (!hasExternal || p.integrationRequirements.length === 0))
    err("runtimeStatus", "RUNTIME_READY_EXTERNAL_BLOCKED requires an external_handoff step + integrationRequirements");
  if (p.runtimeStatus === "HUMAN_DECISION_REQUIRED" && !hasHuman)
    err("runtimeStatus", "HUMAN_DECISION_REQUIRED requires a human_decision step");
  if (p.runtimeStatus === "COUNTRY_RULES_REQUIRED" && p.countryRuleRequirements.length === 0)
    err("runtimeStatus", "COUNTRY_RULES_REQUIRED requires countryRuleRequirements");
  if (p.runtimeStatus === "IMPLEMENTED" && (hasExternal || hasHuman))
    warn("runtimeStatus", "IMPLEMENTED pack contains an external/human step — consider a more specific status");

  return out;
}

export type PackRegistryValidation = { ok: boolean; errors: PackIssue[]; warnings: PackIssue[]; count: number; duplicateIds: string[] };
export function validatePackRegistry(packs: HrMissionPackDefinition[]): PackRegistryValidation {
  const all: PackIssue[] = [];
  const seen = new Map<string, number>();
  for (const p of packs) { seen.set(p.id, (seen.get(p.id) ?? 0) + 1); all.push(...validateMissionPack(p)); }
  const duplicateIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  for (const id of duplicateIds) all.push({ id, field: "id", severity: "error", message: "duplicate pack id" });
  const errors = all.filter((i) => i.severity === "error");
  return { ok: errors.length === 0, errors, warnings: all.filter((i) => i.severity === "warning"), count: packs.length, duplicateIds };
}
