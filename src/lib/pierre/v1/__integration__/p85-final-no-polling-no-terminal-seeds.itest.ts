// PHASE 8.5-FINAL §9 — STRUCTURAL guarantee that the four gaps stay closed. (1) The nominal scheduler tick
// no longer scans the business terminal tables nor calls the polling bridges — it only drains the
// service-emitted runtime-event outbox. (2) The REAL services emit the durable events themselves. (3) The
// p85-final E2E / service-event tests use NO terminal pre-seed helper, NO raw terminal UPDATE, and NO
// manual ingestPierreRuntimeEvent call. If any of these regress, this test fails.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const V1 = resolve(process.cwd(), "src/lib/pierre/v1");
const read = (rel: string) => readFileSync(resolve(V1, rel), "utf8");
const INT = resolve(V1, "__integration__");
// the E2E + service-event tests (this structural file is excluded — it names the forbidden patterns on purpose)
const finalTests = readdirSync(INT).filter((f) => f.startsWith("p85-final-") && f.endsWith(".itest.ts") && !f.includes("no-polling"));

describe("P8.5-FINAL no-polling / no-terminal-seeds", () => {
  it("the nominal scheduler tick does NOT call the polling bridges", () => {
    const sched = read("runtime-scheduler.ts");
    expect(sched).not.toMatch(/runPierreRuntimeBridges/);
    expect(sched).not.toMatch(/from ".\/runtime-bridges"/);
    // it DOES drain the service-emitted outbox instead
    expect(sched).toMatch(/drainRuntimeEventOutbox/);
  });

  it("the nominal scheduler tick does NOT scan a business terminal table by status", () => {
    const sched = read("runtime-scheduler.ts");
    // no `from pierre_rt_signature_requests ... status='completed'` style terminal poll in the scheduler
    expect(sched).not.toMatch(/pierre_rt_signature_requests/);
    expect(sched).not.toMatch(/pierre_rt_communication_deliveries/);
    expect(sched).not.toMatch(/from pierre_rt_validations/);
  });

  it("the REAL services emit the durable runtime events themselves", () => {
    expect(read("mission-service.ts")).toMatch(/emitRuntimeEvent\(/); // validation decision
    expect(read("signatures.ts")).toMatch(/emitRuntimeEvent\(/);      // P8.3 terminal
    expect(read("communications.ts")).toMatch(/emitRuntimeEvent\(/);  // P8.4 terminal
  });

  it("the polling bridges, if present, are operator-backfill only (never wired into the tick)", () => {
    // runtime-bridges.ts may still exist as a reconciliation backfill, but the scheduler must not import it
    const sched = read("runtime-scheduler.ts");
    expect(sched.includes("runtime-bridges")).toBe(false);
  });

  it("no p85-final test uses a terminal pre-seed helper, a raw terminal UPDATE, or a manual ingest", () => {
    expect(finalTests.length).toBeGreaterThanOrEqual(7); // the 7 E2E + service-event + compensation tests
    for (const f of finalTests) {
      const src = read(`__integration__/${f}`);
      // no terminal pre-seed helpers
      expect(src, `${f} must not seed a terminal signature/communication`).not.toMatch(/seedSignatureRequest|seedDeliveredCommunicationIntent/);
      // no manual ingestion of a runtime event (the services emit; the scheduler drains)
      expect(src, `${f} must not manually ingest a runtime event`).not.toMatch(/ingestPierreRuntimeEvent/);
      // no raw UPDATE that fabricates a terminal business truth
      expect(src, `${f} must not raw-UPDATE a validation decision`).not.toMatch(/update\s+pierre_rt_validations\s+set\s+status\s*=/i);
      expect(src, `${f} must not raw-UPDATE a signature status`).not.toMatch(/update\s+pierre_rt_signature_requests\s+set\s+status\s*=/i);
      expect(src, `${f} must not raw-UPDATE a delivery status`).not.toMatch(/update\s+pierre_rt_communication_deliveries\s+set\s+status\s*=/i);
    }
  });

  it("the terminal pre-seed helpers no longer exist in the runtime test helpers", () => {
    const helpers = read("__integration__/p85-helpers.ts");
    expect(helpers).not.toMatch(/seedSignatureRequest|seedDeliveredCommunicationIntent/);
  });
});
