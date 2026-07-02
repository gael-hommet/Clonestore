// src/lib/pierre/v1/__tests__/bounded-concurrency.test.ts
// PHASE 8.9 — the bounded-concurrency / backpressure primitive that governs the
// document pipeline. Proves: in-flight never exceeds the cap, the cap is actually
// reached, results keep input order, backpressure holds a huge producer to the cap,
// and maxQueued sheds explicitly instead of growing memory.

import { describe, it, expect } from "vitest";
import { BoundedConcurrency, mapBounded, QueueOverflowError } from "../bounded-concurrency";

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe("BoundedConcurrency", () => {
  it("never exceeds maxConcurrent and actually reaches it", async () => {
    const gate = new BoundedConcurrency({ maxConcurrent: 4 });
    let live = 0; let observedMax = 0;
    await Promise.all(
      Array.from({ length: 40 }, () =>
        gate.run(async () => { live++; observedMax = Math.max(observedMax, live); await tick(3); live--; })),
    );
    expect(observedMax).toBeLessThanOrEqual(4);
    expect(observedMax).toBe(4);           // the cap is genuinely reached
    expect(gate.peakInFlight).toBeLessThanOrEqual(4);
    expect(gate.stats.completed).toBe(40);
    expect(gate.inFlight).toBe(0);
  });

  it("backpressures a huge producer to the cap (never spawns > cap live tasks)", async () => {
    const gate = new BoundedConcurrency({ maxConcurrent: 8 });
    let live = 0; let observedMax = 0;
    // microtask yields (no timers) so 5k tasks stay fast while still interleaving at await points
    await Promise.all(
      Array.from({ length: 5000 }, () =>
        gate.run(async () => { live++; observedMax = Math.max(observedMax, live); await Promise.resolve(); await Promise.resolve(); live--; })),
    );
    expect(observedMax).toBeLessThanOrEqual(8);
    expect(gate.stats.started).toBe(5000);
  });

  it("mapBounded preserves input order under a low cap", async () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const out = await mapBounded(input, 3, async (n) => { await tick(Math.random() * 4); return n * 2; });
    expect(out).toEqual(input.map((n) => n * 2));
  });

  it("releases the slot even when a task throws", async () => {
    const gate = new BoundedConcurrency({ maxConcurrent: 2 });
    await expect(gate.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    // a subsequent task still gets a slot
    const ok = await gate.run(async () => 42);
    expect(ok).toBe(42);
    expect(gate.inFlight).toBe(0);
  });

  it("sheds explicitly (QueueOverflowError) when maxQueued is exceeded", async () => {
    const gate = new BoundedConcurrency({ maxConcurrent: 1, maxQueued: 1 });
    const p1 = gate.run(async () => { await tick(20); return "a"; }); // takes the only slot
    const p2 = gate.run(async () => "b");                            // becomes the 1 queued waiter
    // third has nowhere to wait → rejected synchronously
    await expect(gate.run(async () => "c")).rejects.toBeInstanceOf(QueueOverflowError);
    await expect(p1).resolves.toBe("a");
    await expect(p2).resolves.toBe("b");
    expect(gate.stats.rejected).toBe(1);
  });

  it("drain resolves only after everything settles", async () => {
    const gate = new BoundedConcurrency({ maxConcurrent: 3 });
    let done = 0;
    for (let i = 0; i < 15; i++) void gate.run(async () => { await tick(3); done++; });
    await gate.drain();
    expect(done).toBe(15);
    expect(gate.inFlight).toBe(0);
  });
});
