// src/lib/pierre/v1/__integration__/db-adapter.itest.ts
// PHASE 8.1 — production pg adapter resolvability + error handling.

import { describe, it, expect } from "vitest";

describe("production pg adapter", () => {
  it("`pg` resolves as a real dependency (Pool present)", async () => {
    const pg = await import("pg");
    expect(typeof pg.Pool).toBe("function");
  });

  it("invalid URL → fast typed connection error, no secret leak, no reconnect loop", async () => {
    const { createRuntimeExecutorForUrl } = await import("../db");
    // Port 1 is refused immediately; short connect timeout via env.
    process.env.PIERRE_DB_CONN_TIMEOUT_MS = "1500";
    const { db, close } = createRuntimeExecutorForUrl("postgres://app:TOPSECRETPASSWORD@127.0.0.1:1/none");
    const started = Date.now();
    let err: unknown;
    try { await db.query("select 1"); } catch (e) { err = e; }
    const elapsed = Date.now() - started;
    expect(err).toBeTruthy();
    // No secret leaked in the surfaced error.
    expect(String((err as Error)?.message ?? "")).not.toContain("TOPSECRETPASSWORD");
    // Failed fast (no infinite reconnect loop).
    expect(elapsed).toBeLessThan(10000);
    await close().catch(() => { /* pool end best-effort */ });
  }, 20000);
});
