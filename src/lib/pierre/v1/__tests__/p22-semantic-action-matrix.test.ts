import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { HR_MISSION_PACKS } from "../hr-mission-packs/registry";
import { packToRuntimePlan } from "../hr-mission-packs/runtime-map";
import type { StepBinding } from "../hr-mission-packs/types";

// ─────────────────────────────────────────────────────────────────────────────
// P22 SEMANTIC action matrix — the honest correction the previous "100% operational" claim required.
// Classifies every runtime_action step by what its handler ACTUALLY does, distinguishing a real
// BUSINESS_EFFECT from a TRACE_ONLY / GENERIC_COLLECTION_ONLY placeholder, and flags SEMANTIC GAPS
// (a step whose kind implies producing/modifying a business object but whose handler only records a
// trace). Writes docs/reports/P22_ACTION_SEMANTIC_GAP_MATRIX.json.
// ─────────────────────────────────────────────────────────────────────────────

type Cls =
  | "BUSINESS_EFFECT"
  | "GOVERNED_EXTERNAL_INTENT"
  | "HUMAN_DECISION_BOUNDARY"
  | "TRACE_ONLY"
  | "GENERIC_COLLECTION_ONLY"
  | "STRUCTURAL"
  | "BROKEN_OR_UNBOUND";

const CLASS: Record<string, Cls> = {
  "document.generate": "BUSINESS_EFFECT",
  "absence.record.create": "BUSINESS_EFFECT",
  "employee.timeline.append": "BUSINESS_EFFECT",
  "analytics.compute": "BUSINESS_EFFECT",
  "follow_up.schedule": "BUSINESS_EFFECT",
  "approval.request": "HUMAN_DECISION_BOUNDARY",
  "communication.create_intent": "GOVERNED_EXTERNAL_INTENT",
  "signature.prepare": "GOVERNED_EXTERNAL_INTENT",
  "hr.reconcile.apply": "GOVERNED_EXTERNAL_INTENT",
  "wait.until_time": "GOVERNED_EXTERNAL_INTENT",
  "wait.for_event": "GOVERNED_EXTERNAL_INTENT",
  "hr.record.append": "TRACE_ONLY",
  "hr.data.collect": "GENERIC_COLLECTION_ONLY",
  "mission.complete": "STRUCTURAL",
  "mission.block": "STRUCTURAL",
  "mission.noop": "BROKEN_OR_UNBOUND",
  "employee.read": "STRUCTURAL",
  "contract.read": "STRUCTURAL",
  "document.read": "STRUCTURAL",
};

// The 4 remaining semantic gaps genuinely require a NEW domain table (no existing pierre_rt_* fits).
const NEW_TABLE_REQUIRED = new Set([
  "org.workforce_planning:record",
  "recruitment.pipeline_management:track",
  "relations.hr_requests:route",
  "pierre_admin.country_config:bind_pack",
]);

// Kinds that IMPLY the step should produce/modify a real domain business object.
const BUSINESS_KINDS = new Set(["mutate_record", "prepare_document", "reconcile"]);

// Per (domain, kind) — the business object the step is meant to produce, and the remediation when
// it is currently trace/collection-only. Only meaningful for SEMANTIC GAP rows.
function expectedObject(domain: string, kind: string): string {
  if (kind === "prepare_document") return "document (versioned)";
  if (kind === "reconcile") return `${domain} reconciliation record / external return applied`;
  if (kind === "mutate_record") return `${domain} domain record created/updated`;
  return "n/a";
}

describe("P22 semantic action matrix", () => {
  it("classifies every step and writes the gap matrix", () => {
    const rows: Array<Record<string, unknown>> = [];
    const counts: Record<string, number> = {};
    let semanticGaps = 0;

    for (const pack of HR_MISSION_PACKS) {
      const plan = packToRuntimePlan(pack);
      const byKey = new Map(plan.steps.map((s) => [s.step_key, s.action_key]));
      for (const s of pack.steps) {
        if (s.binding.type !== "runtime_action") continue;
        const actionKey = (s.binding as Extract<StepBinding, { type: "runtime_action" }>).actionKey;
        const cls = CLASS[actionKey] ?? "BROKEN_OR_UNBOUND";
        counts[cls] = (counts[cls] ?? 0) + 1;

        const isBusinessKind = BUSINESS_KINDS.has(s.kind);
        const isRealBusinessEffect = cls === "BUSINESS_EFFECT";
        const gap = isBusinessKind && !isRealBusinessEffect &&
          (cls === "TRACE_ONLY" || cls === "GENERIC_COLLECTION_ONLY");
        if (gap) semanticGaps += 1;

        rows.push({
          pack: pack.id,
          domain: pack.domain,
          step: s.key,
          kind: s.kind,
          action_key: actionKey,
          classification: cls,
          expected_business_object: isBusinessKind ? expectedObject(pack.domain, s.kind) : "n/a",
          semantic_gap: gap,
          remediation: gap
            ? (NEW_TABLE_REQUIRED.has(`${pack.id}:${s.key}`)
                ? `NEW_TABLE_REQUIRED: add a dedicated pierre_rt_* table + governed service for ${pack.domain}, then bind '${s.key}' to it (mirroring absence.record.create)`
                : `bind '${s.key}' to a real ${pack.domain} domain action (persist the business object), mirroring absence.record.create`)
            : null,
          in_runtime_plan: byKey.has(s.key),
        });
      }
    }

    // Honest denominators.
    const businessEffect = counts["BUSINESS_EFFECT"] ?? 0;
    const authorizableBusiness = businessEffect + semanticGaps; // steps that SHOULD produce a business object
    const businessEffectCompletionRate = authorizableBusiness > 0
      ? Number(((businessEffect / authorizableBusiness) * 100).toFixed(1))
      : 0;

    const matrix = {
      generated_for: "P22_ACTION_SEMANTIC_GAP_MATRIX",
      note: "Honest semantic classification. TRACE_ONLY / GENERIC_COLLECTION_ONLY are NOT business completion. business_effect_completion_rate = real BUSINESS_EFFECT steps / steps whose kind implies a business object.",
      total_runtime_action_steps: rows.length,
      classification_counts: counts,
      semantic_gaps: semanticGaps,
      business_effect_steps: businessEffect,
      authorizable_business_steps: authorizableBusiness,
      business_effect_completion_rate: businessEffectCompletionRate,
      proven_real_sql_business_actions: ["absence.record.create", "employee.timeline.append", "hr.reconcile.apply (apply-or-await)"],
      real_sql_proven_domains: ["absence", "employee-360 (timeline)", "reconciliation (external apply/await)"],
      remaining_semantic_gaps_need_new_table: [
        "org.workforce_planning:record", "recruitment.pipeline_management:track",
        "relations.hr_requests:route", "pierre_admin.country_config:bind_pack",
      ],
      rows,
    };
    fs.writeFileSync(
      path.join(process.cwd(), "docs", "reports", "P22_ACTION_SEMANTIC_GAP_MATRIX.json"),
      JSON.stringify(matrix, null, 2),
      "utf8",
    );

    // This test documents reality; it must not falsely assert closure. It only guards that the
    // matrix was produced and that no step is BROKEN_OR_UNBOUND (0 mission.noop).
    expect(counts["BROKEN_OR_UNBOUND"] ?? 0).toBe(0);
    expect(rows.length).toBeGreaterThan(0);
  });
});
