// PHASE 8.5-R4 §R4.13 — the compensation registry classifies each effect HONESTLY. A queued
// communication is compensatable; a submitted/delivered one is irreversible (never pretended-undone). A
// completed signature is irreversible; a signed document is never deleted. A mission cancellation
// summary marks itself NOT clean when an irreversible effect or a failed compensation is present.
import { describe, it, expect } from "vitest";
import { getCompensationRule, isCompensatable, isIrreversible } from "../runtime-compensation-registry";
import { buildCancellationSummary } from "../runtime-compensations";

describe("P8.5-R4 compensation registry", () => {
  it("communication: queued is compensatable; submitted/delivered are irreversible", () => {
    expect(isCompensatable("communication.create_intent", "queued")).toBe(true);
    expect(isIrreversible("communication.create_intent", "submitted")).toBe(true);
    expect(isIrreversible("communication.create_intent", "delivered")).toBe(true);
    expect(isCompensatable("communication.create_intent", "delivered")).toBe(false);
  });

  it("signature: prepared is compensatable; completed is irreversible (requires approval)", () => {
    expect(isCompensatable("signature.prepare", "prepared_not_submitted")).toBe(true);
    expect(isIrreversible("signature.prepare", "completed")).toBe(true);
    expect(getCompensationRule("signature.prepare")!.requiresApproval).toBe(true);
  });

  it("a signed document is never compensatable (evidence preserved)", () => {
    expect(isIrreversible("document.generate", "signed")).toBe(true);
    expect(isCompensatable("document.generate", "signed")).toBe(false);
    expect(isCompensatable("document.generate", "draft")).toBe(true);
  });

  it("a decided validation's history is preserved; a pending one is compensatable", () => {
    expect(isCompensatable("approval.request", "pending")).toBe(true);
    expect(isIrreversible("approval.request", "approved")).toBe(true);
  });

  it("the cancellation summary is honest: irreversible + failures make it NOT clean", () => {
    const summary = buildCancellationSummary([
      { action_key: "follow_up.schedule", state: "active", reference: "sch1" },          // compensated locally
      { action_key: "communication.create_intent", state: "delivered", reference: "d1" }, // irreversible
      { action_key: "signature.prepare", state: "submitted", reference: "sig1", compensation_failed: true }, // failed
    ]);
    expect(summary.cancelled_local_effects.map((e) => e.action_key)).toEqual(["follow_up.schedule"]);
    expect(summary.irreversible_external_effects.map((e) => e.action_key)).toEqual(["communication.create_intent"]);
    expect(summary.compensation_failures.map((e) => e.action_key)).toEqual(["signature.prepare"]);
    expect(summary.manual_actions_required.length).toBe(2);
    expect(summary.clean).toBe(false); // never a clean "cancelled" when irreversible/failed effects exist
  });

  it("a purely local run cancels cleanly", () => {
    const summary = buildCancellationSummary([{ action_key: "follow_up.schedule", state: "active" }, { action_key: "approval.request", state: "pending" }]);
    expect(summary.clean).toBe(true);
    expect(summary.irreversible_external_effects).toEqual([]);
  });
});
