// src/lib/pierre/demo/demo-validation.ts
// PIERRE FINAL INTERACTIVE DEMO — runtime/test invariants.
//
// Guarantees the experience cannot drift into dishonesty: every capability shown
// is declared and not demo-only, metrics are scenario-derived, CTA destinations
// are real routes, and no forbidden commercial claim appears in scenario copy.

import type { DemoScenario } from "./demo-types";
import { DEMO_SCENARIOS } from "./demo-scenarios";
import {
  isCapabilityDeclared,
  SCENARIO_ALLOWED_CAPABILITY_IDS,
  DEMO_ONLY_CAPABILITY_IDS,
} from "./demo-truth-registry";
import { computeScenarioMetrics, understandingIsConsistent } from "./demo-engine";

// Real, existing routes the demo is allowed to link to (no dead links).
export const DEMO_CTA_DESTINATIONS = {
  reserve: "/reserver/pierre",
  discover: "/agents/pierre",
  diagnostic: "/diagnostic-rh",
  legal_cgv: "/legal/cgv",
  legal_cgu: "/legal/cgu",
  legal_privacy: "/legal/confidentialite",
} as const;

export const DEMO_CTA_ALLOWED_HREFS: ReadonlySet<string> = new Set(Object.values(DEMO_CTA_DESTINATIONS));

// Forbidden commercial claims (aligned with the public-copy scanners).
export const FORBIDDEN_CLAIM_PATTERNS: readonly RegExp[] = [
  /zéro erreur/i,
  /conformité garantie/i,
  /remplace (?:un |votre )?avocat(?! ni)/i,
  /DSN autonome/i,
  /licenciement automatique/i,
  /paie officielle/i,
];

export interface ValidationIssue {
  scenarioId: string;
  kind: string;
  detail: string;
}

function scenarioCapabilityRefs(scenario: DemoScenario): string[] {
  const ids = new Set<string>();
  for (const m of scenario.missions) {
    for (const t of m.tasks) ids.add(t.capabilityId);
  }
  for (const d of scenario.documents) ids.add(d.capabilityId);
  for (const msg of scenario.messages) ids.add(msg.capabilityId);
  ids.add(scenario.guardrail.capabilityId);
  return [...ids];
}

function scenarioText(scenario: DemoScenario): string {
  const parts: string[] = [scenario.name, scenario.promise, scenario.request, scenario.guardrail.intro, scenario.guardrail.cannotReason];
  for (const m of scenario.missions) {
    parts.push(m.title, m.dependsOn ?? "");
    for (const t of m.tasks) parts.push(t.label, t.detail ?? "");
  }
  for (const d of scenario.documents) {
    parts.push(d.title, d.subtitle ?? "", d.disclosure);
    for (const b of d.blocks) {
      if (b.kind === "paragraph" || b.kind === "heading") parts.push(b.text);
      if (b.kind === "list") parts.push(...b.items);
      if (b.kind === "meta") for (const r of b.rows) parts.push(r.label, r.value);
    }
  }
  for (const msg of scenario.messages) parts.push(msg.title ?? "", ...msg.lines);
  return parts.join("\n");
}

/** Validate a single scenario; returns a (possibly empty) list of issues. */
export function validateScenario(scenario: DemoScenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (kind: string, detail: string) => issues.push({ scenarioId: scenario.id, kind, detail });

  // 1) Every referenced capability is declared and not demo-only.
  for (const id of scenarioCapabilityRefs(scenario)) {
    if (!isCapabilityDeclared(id)) push("undeclared_capability", id);
    else if (DEMO_ONLY_CAPABILITY_IDS.has(id)) push("demo_only_capability_shown_active", id);
    else if (!SCENARIO_ALLOWED_CAPABILITY_IDS.has(id)) push("capability_not_allowed_in_scenario", id);
  }

  // 2) Declared capabilityIds list is coherent (declared, non-demo-only).
  for (const id of scenario.capabilityIds) {
    if (!isCapabilityDeclared(id)) push("undeclared_capability_in_list", id);
    if (DEMO_ONLY_CAPABILITY_IDS.has(id)) push("demo_only_capability_in_list", id);
  }

  // 3) Understanding numbers are scenario-consistent (no invented counts).
  if (!understandingIsConsistent(scenario)) push("understanding_inconsistent", JSON.stringify(scenario.understanding));

  // 4) Metrics never invent information.
  const metrics = computeScenarioMetrics(scenario);
  if (metrics.informationsInventees !== 0) push("invented_information", String(metrics.informationsInventees));
  if (metrics.missions < 1 || metrics.taches < 1) push("empty_scenario", JSON.stringify(metrics));

  // 5) CTA actions inside messages must point at real documents that exist.
  const docIds = new Set(scenario.documents.map((d) => d.id));
  for (const msg of scenario.messages) {
    for (const a of msg.actions ?? []) {
      if (a.kind === "view_document" && a.documentId && !docIds.has(a.documentId)) {
        push("dead_document_link", `${msg.id} → ${a.documentId}`);
      }
    }
  }

  // 6) No forbidden commercial claim in scenario copy.
  const text = scenarioText(scenario);
  for (const re of FORBIDDEN_CLAIM_PATTERNS) {
    if (re.test(text)) push("forbidden_claim", re.source);
  }

  return issues;
}

/** Validate every scenario; returns all issues found (empty = healthy). */
export function validateAllScenarios(): ValidationIssue[] {
  return DEMO_SCENARIOS.flatMap(validateScenario);
}

/** Convenience boolean for runtime guards. */
export function demoIsHealthy(): boolean {
  return validateAllScenarios().length === 0;
}
