// src/lib/pierre/v1/hr-proactive/__tests__/proactive.test.ts
// PHASE 8.11 — proactive detection → dedup → governed mission creation. Signals are derived from the
// packs, only registered signals fire, dedup prevents duplicate follow-ups, and every signal maps to
// a real handling pack (fail-closed otherwise).

import { describe, it, expect } from "vitest";
import { SIGNAL_REGISTRY, getSignalDefinition } from "../signal-registry";
import { detect } from "../detector";
import { deduplicate } from "../deduplication";
import { signalToMissionRequest, batchToMissionRequests } from "../mission-creation";
import { getMissionPack } from "../../hr-mission-packs/registry";

describe("proactive signals", () => {
  it("derives a non-empty registry, each signal handled by a real pack", () => {
    expect(SIGNAL_REGISTRY.length).toBeGreaterThan(0);
    for (const s of SIGNAL_REGISTRY) expect(getMissionPack(s.handledByPackId), s.key).toBeTruthy();
  });

  it("detector only fires for registered signal keys", () => {
    const key = SIGNAL_REGISTRY[0].key;
    const now = "2026-07-02T10:00:00.000Z";
    const out = detect([
      { signalKey: key, companyId: "co1", subjectRef: "emp1", detectedAt: now },
      { signalKey: "not.a.real.signal", companyId: "co1", subjectRef: "emp2", detectedAt: now },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].dedupKey).toBe(`${key}:emp1`);
  });

  it("deduplicates by (key, subject) within a batch and against existing", () => {
    const now = "2026-07-02T10:00:00.000Z";
    const key = SIGNAL_REGISTRY[0].key;
    const sigs = detect([
      { signalKey: key, companyId: "co1", subjectRef: "emp1", detectedAt: now },
      { signalKey: key, companyId: "co1", subjectRef: "emp1", detectedAt: now }, // dup in batch
    ]);
    const r = deduplicate(sigs);
    expect(r.fresh.length).toBe(1);
    expect(r.suppressed).toBe(1);
    // and against an existing live signal
    const r2 = deduplicate(r.fresh, [r.fresh[0].dedupKey]);
    expect(r2.fresh.length).toBe(0);
  });

  it("maps a signal to a governed mission request for its handling pack", () => {
    const def = SIGNAL_REGISTRY[0];
    const req = signalToMissionRequest({ key: def.key, companyId: "co1", subjectRef: "emp1", detectedAt: "2026-07-02T10:00:00.000Z", severity: def.defaultSeverity, dedupKey: `${def.key}:emp1` });
    expect(req).toBeTruthy();
    expect(req!.packId).toBe(def.handledByPackId);
    expect(req!.correlationId).toContain("proactive:");
    expect(getSignalDefinition(def.key)).toBeTruthy();
  });

  it("batch mission-creation is fail-closed (unknown signal → no request)", () => {
    const reqs = batchToMissionRequests([{ key: "unknown.sig", companyId: "co1", subjectRef: "x", detectedAt: "2026-07-02T10:00:00.000Z", severity: "info", dedupKey: "unknown.sig:x" }]);
    expect(reqs).toEqual([]);
  });
});
