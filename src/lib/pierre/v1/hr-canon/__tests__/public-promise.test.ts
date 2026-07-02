// src/lib/pierre/v1/hr-canon/__tests__/public-promise.test.ts
// PHASE 8.10 — no public "Pierre can do X" without a backing capability: every promise links to
// real capability ids (no dangling), and a promise is fully_backed only when every linked
// capability is VERIFIED_EXISTING (forward-looking promises resolve to partial/aspirational).

import { describe, it, expect } from "vitest";
import { PROMISE_TRACEABILITY, danglingPromises, tracePromise } from "../public-promise-map";
import { getCapability } from "../capability-registry";

describe("public promise traceability", () => {
  it("has no dangling promise (every linked capability id exists)", () => {
    expect(danglingPromises()).toEqual([]);
    for (const p of PROMISE_TRACEABILITY) for (const id of p.capabilityIds) expect(getCapability(id), id).toBeTruthy();
  });

  it("computes backing honestly (fully_backed ⇒ all linked capabilities VERIFIED_EXISTING)", () => {
    for (const p of PROMISE_TRACEABILITY) {
      if (p.backing === "fully_backed") {
        for (const id of p.capabilityIds) expect(getCapability(id)!.implementation, `${p.id}/${id}`).toBe("VERIFIED_EXISTING");
      }
      if (p.backing === "aspirational") {
        expect(p.verifiedCount).toBe(0);
      }
    }
  });

  it("forward-looking promises (absences/payroll/performance) are NOT fully_backed yet", () => {
    for (const pid of ["promise.absences", "promise.payroll_prep", "promise.performance"]) {
      const p = PROMISE_TRACEABILITY.find((x) => x.id === pid)!;
      expect(p.backing, pid).not.toBe("fully_backed");
    }
  });

  it("a promise linking a missing capability id is detected as dangling", () => {
    const t = tracePromise({ id: "promise.fake", statement: "x", source: "test", capabilityIds: ["does.not_exist"] });
    expect(t.missingCapabilityIds).toEqual(["does.not_exist"]);
    expect(t.backing).toBe("aspirational");
  });
});
