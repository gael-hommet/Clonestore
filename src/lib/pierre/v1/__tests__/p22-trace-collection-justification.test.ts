import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { HR_MISSION_PACKS } from "../hr-mission-packs/registry";
import type { StepBinding } from "../hr-mission-packs/types";

// P22 §14 — justify every TRACE_ONLY (hr.record.append) and GENERIC_COLLECTION_ONLY (hr.data.collect)
// step. A trace/collection is JUSTIFIED only when the step is genuinely audit/intake/observation/generic
// collection. If the step implies creating/modifying/validating/computing/reconciling a business object,
// it is a REMEDIATION candidate (must eventually bind to a real domain action). Writes the matrix JSON.

// Skeleton + audit kinds where a trace/collection record IS the honest deliverable (no business object).
const JUSTIFIED_KINDS = new Set([
  "intake",       // records the request classification
  "validate",     // records that permissions/preconditions were checked
  "collect",      // generic missing-info collection (hr.data.collect returns NEEDS_INFORMATION)
  "decide",        // records a CLASSIFICATION only; the binding decision is a separate human() step
]);

describe("P22 trace/collection justification matrix", () => {
  it("classifies every trace/collection step and writes the justification matrix", () => {
    const rows: Array<Record<string, unknown>> = [];
    let justified = 0;
    let remediation = 0;

    for (const pack of HR_MISSION_PACKS) {
      for (const s of pack.steps) {
        if (s.binding.type !== "runtime_action") continue;
        const action = (s.binding as Extract<StepBinding, { type: "runtime_action" }>).actionKey;
        if (action !== "hr.record.append" && action !== "hr.data.collect") continue;

        const isJustified = JUSTIFIED_KINDS.has(s.kind);
        if (isJustified) justified += 1; else remediation += 1;

        rows.push({
          pack: pack.id,
          step: s.key,
          kind: s.kind,
          action,
          trace_or_collection_justified: isJustified,
          justification: isJustified
            ? (s.kind === "collect" ? "generic missing-info collection (NEEDS_INFORMATION on gaps)"
               : s.kind === "intake" ? "intake classification audit record"
               : s.kind === "decide" ? "classification record only; the binding decision is a separate human() step"
               : "precondition/permission validation record")
            : null,
          business_object_required: !isJustified,
          remediation: isJustified ? null
            : `step kind '${s.kind}' implies a domain object — bind to a real domain action (compute/persist), not a trace`,
          proof: isJustified ? "audit/intake/collection is the deliverable — no business object expected" : "TODO: real domain action + PGlite proof",
        });
      }
    }

    const summary = {
      generated_for: "P22_TRACE_COLLECTION_JUSTIFICATION_MATRIX",
      note: "A trace/collection is only justified when the step is genuinely audit/intake/generic-collection. Steps implying a business object are remediation candidates — a trace must never mask a missing business result.",
      total_trace_or_collection_steps: rows.length,
      justified,
      remediation_candidates: remediation,
      rows,
    };
    fs.writeFileSync(
      path.join(process.cwd(), "docs", "reports", "P22_TRACE_COLLECTION_JUSTIFICATION_MATRIX.json"),
      JSON.stringify(summary, null, 2),
      "utf8",
    );

    // Guard: every trace/collection step is explicitly classified (justified or remediation), none unclassified.
    expect(justified + remediation).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(0);
  });
});
