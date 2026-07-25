// Canonical Analytics Runtime Wiring — preuve que l'écriture analytics est STRICTEMENT bornée
// et ne peut jamais retarder indéfiniment le chemin métier (Phase E).

import { describe, it, expect } from "vitest";
import { boundedAnalyticsWrite, analyticsWriteTimeoutMs } from "../server-events";

describe("boundedAnalyticsWrite — analytics can never block the business path", () => {
  it("returns inserted when the op resolves quickly", async () => {
    const r = await boundedAnalyticsWrite(async () => ({ ok: true, outcome: "inserted" }), 500);
    expect(r).toBe("inserted");
  });

  it("returns duplicate when the op reports a duplicate", async () => {
    const r = await boundedAnalyticsWrite(async () => ({ ok: true, outcome: "duplicate" }), 500);
    expect(r).toBe("duplicate");
  });

  it("returns unavailable when the DB rejects (op returns ok:false)", async () => {
    const r = await boundedAnalyticsWrite(async () => ({ ok: false, reason: "STORAGE_UNAVAILABLE" }), 500);
    expect(r).toBe("unavailable");
  });

  it("returns rejected when the op resolves with a rejected event name", async () => {
    const r = await boundedAnalyticsWrite(async () => ({ ok: false, reason: "NOT_A_SERVER_EVENT" }), 500);
    expect(r).toBe("rejected");
  });

  it("returns rejected (never throws) when the op throws", async () => {
    const r = await boundedAnalyticsWrite(async () => { throw new Error("boom"); }, 500);
    expect(r).toBe("rejected");
  });

  it("TIMES OUT within the bound when the op never resolves — the caller is not blocked", async () => {
    const start = Date.now();
    // op that never resolves (simulates a hung DB).
    const r = await boundedAnalyticsWrite(() => new Promise(() => { /* never resolves */ }), 120);
    const elapsed = Date.now() - start;
    expect(r).toBe("timeout");
    // The bounded call MUST return close to the timeout, not hang. Allow generous CI slack.
    expect(elapsed).toBeLessThan(2000);
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it("a slow op that exceeds the bound yields timeout, and the business path still continues", async () => {
    let businessCompleted = false;
    const analytics = boundedAnalyticsWrite(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, outcome: "inserted" }), 5000)),
      100,
    );
    // Business path proceeds immediately after awaiting the BOUNDED analytics call.
    const outcome = await analytics;
    businessCompleted = true;
    expect(outcome).toBe("timeout");
    expect(businessCompleted).toBe(true);
  });

  it("has a positive, configurable default timeout", () => {
    expect(analyticsWriteTimeoutMs()).toBeGreaterThan(0);
  });
});
