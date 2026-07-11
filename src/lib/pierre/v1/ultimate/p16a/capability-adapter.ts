// src/lib/pierre/v1/ultimate/p16a/capability-adapter.ts
// P16A — bounded Pierre Ultimate capability adapter (owner §6). This is NOT a second registry: it reads
// the ONE real canon (HR_CAPABILITIES) + the evidence-linked closure (CLOSED_HR_CAPABILITIES) and, for a
// request, returns only the most-relevant, AUTHORIZED, BOUNDED set (never the whole canon into a prompt).
// It preserves each capability's domain / risk / autonomy / human-only / legal / provider / country /
// closure metadata and derives the honest per-capability disposition. The capability COUNT is always
// derived from the registry length — never hardcoded.

import { HR_CAPABILITIES, getCapability, capabilitiesByDomain } from "../../hr-canon/capability-registry";
import { CLOSED_HR_CAPABILITIES } from "../../hr-canon/capability-closure";
import { retrieveCapabilities, isKnownCapability } from "../../cognitive-runtime/capability-retrieval";
import type { HrCapabilityDefinition } from "../../hr-canon/types";
import type { P16ASelectedCapability, P16ADisposition } from "./types";

/** The current canonical capability count — DERIVED from the real registry, never hardcoded. */
export function pierreCapabilityCount(): number {
  return HR_CAPABILITIES.length;
}

// Closure status lookup (O(1)) over the evidence-linked closed canon.
const CLOSURE_BY_ID: ReadonlyMap<string, string> = new Map(
  CLOSED_HR_CAPABILITIES.map((c) => [c.id, c.implementation] as const),
);

function closureStatusOf(id: string): string {
  return CLOSURE_BY_ID.get(id) ?? "UNKNOWN";
}

function providersOf(cap: HrCapabilityDefinition): string[] {
  return (cap.integrationDependencies ?? [])
    .filter((d) => d.system && d.system !== "none" && d.status !== "available")
    .map((d) => d.system);
}
function countryFamiliesOf(cap: HrCapabilityDefinition): string[] {
  return (cap.countryRuleDependencies ?? []).filter((d) => d.required).map((d) => d.ruleFamily);
}

const LEGAL_CLOSURES = new Set(["IMPLEMENTED_LEGAL_BLOCKED", "LEGAL_CONTENT_REQUIRED"]);
const EXTERNAL_CLOSURES = new Set(["IMPLEMENTED_EXTERNAL_GOVERNED", "EXTERNAL_DEPENDENCY"]);
const GOVERNED_CLOSURES = new Set(["IMPLEMENTED_GOVERNED", "VERIFIED_EXISTING"]);

/** Honest disposition for one capability. Precedence: human-only > legal > provider > autonomy ladder. */
export function dispositionFor(cap: HrCapabilityDefinition): P16ADisposition {
  const closure = closureStatusOf(cap.id);
  const humanOnly = cap.autonomy === "human_only" || cap.autonomy === "forbidden";
  if (humanOnly) return "human_only";

  const legal = countryFamiliesOf(cap).length > 0 || LEGAL_CLOSURES.has(closure);
  if (legal) return "prepare"; // internal workflow prepared; final legal execution fails closed (never claimed)

  const provider = providersOf(cap).length > 0 || EXTERNAL_CLOSURES.has(closure);
  if (provider) return "provider_blocked";

  switch (cap.autonomy) {
    case "observe_only": return "read_explain";
    case "suggest": return "propose";
    case "prepare_draft": return "prepare";
    case "execute_with_validation": return "validation_required";
    case "execute_autonomous":
      return GOVERNED_CLOSURES.has(closure) ? "execute_local" : "prepare";
    default: return "prepare";
  }
}

function enrich(cap: HrCapabilityDefinition, score: number): P16ASelectedCapability {
  const closure = closureStatusOf(cap.id);
  const providers = providersOf(cap);
  const countryRuleFamilies = countryFamiliesOf(cap);
  return {
    id: cap.id,
    domain: cap.domain,
    label: cap.label,
    score,
    autonomy: cap.autonomy,
    closureStatus: closure,
    humanOnly: cap.autonomy === "human_only" || cap.autonomy === "forbidden",
    legalDependency: countryRuleFamilies.length > 0 || LEGAL_CLOSURES.has(closure),
    providerDependency: providers.length > 0 || EXTERNAL_CLOSURES.has(closure),
    providers,
    countryRuleFamilies,
    requiredInputs: (cap.requiredInputs ?? []).map((i) => i.key),
    expectedArtifacts: (cap.expectedArtifacts ?? []).map((a) => a.label),
    disposition: dispositionFor(cap),
  };
}

export type RetrieveOptions = { limit?: number; domains?: readonly string[] };

/**
 * Retrieve the bounded, enriched capability set for a free-text HR request. Deterministic. Never returns
 * the whole canon (bounded by `retrieveCapabilities`' limit). Unknown ids can never appear.
 */
export function retrieveForRequest(request: string, opts?: RetrieveOptions): P16ASelectedCapability[] {
  const retrieved = retrieveCapabilities(request, { limit: opts?.limit, domains: opts?.domains });
  const out: P16ASelectedCapability[] = [];
  for (const r of retrieved) {
    const cap = getCapability(r.id);
    if (!cap) continue; // retrieval only ever yields canon ids; defensive
    out.push(enrich(cap, r.score));
  }
  return out;
}

/** Enrich a single capability by id (used for representative-request probes / tests). */
export function selectedCapabilityById(id: string): P16ASelectedCapability | undefined {
  if (!isKnownCapability(id)) return undefined;
  const cap = getCapability(id);
  return cap ? enrich(cap, 0) : undefined;
}

/** All capabilities of a domain, enriched. Bounded by domain, never the whole canon. */
export function selectedCapabilitiesByDomain(domain: string): P16ASelectedCapability[] {
  return capabilitiesByDomain(domain).map((c) => enrich(c, 0));
}
