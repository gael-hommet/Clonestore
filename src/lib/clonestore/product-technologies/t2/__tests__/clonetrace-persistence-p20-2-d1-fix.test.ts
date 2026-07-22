// src/lib/clonestore/product-technologies/t2/__tests__/clonetrace-persistence-p20-2-d1-fix.test.ts
// P20.2 (D1 fix) — REAL write + REAL read against PGlite (PIERRE_E2E_TEST_MODE=1), proving
// CloneTrace T2 artifacts can now be durably persisted via the existing V1 EventRepo/pierre_rt_events
// store — not just produced in memory. Never touches production; never a real/remote database.
//
// SCHEMA DISCOVERY (this session, from real Postgres errors, not assumed):
//   pierre_rt_events.mission_id is FK-constrained to REAL pierre_rt_missions rows — a CloneTrace
//   T2 session id (e.g. "call-1", or even a syntactically-valid-but-unseeded UUID) is NOT a real
//   V1 mission and violates that FK. The adapter therefore reconstructs via correlation_id
//   (a plain uuid column, no FK) instead, always generating one if the caller doesn't supply it.

import { describe, it, expect, beforeAll } from "vitest";
import { cloneTraceProductTech } from "../clonetrace-product-tech";
import { persistCloneTraceEvent, reconstructCloneTraceTimelineByCorrelation } from "@/lib/pierre/v1/clonetrace-t2-bridge";
import { cloneCallProductTech } from "../clonecall-product-tech";
import { cloneRoomProductTech } from "../cloneroom-product-tech";
import { getTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { newUuid } from "@/lib/pierre/v1/sql";
import type { ProductTechnologyContext } from "../product-technology-types";

process.env.PIERRE_E2E_TEST_MODE = "1"; // getRuntimeDb/getTestRuntimeDb → PGlite, jamais la production

let companyA: string;
let companyB: string;

beforeAll(async () => {
  const db = await getTestRuntimeDb(); // ensures schema is migrated/ready
  companyA = newUuid();
  companyB = newUuid();
  // pierre_rt_events.company_id is a real FK into pierre_rt_companies — seed both companies first.
  await db.query(`insert into pierre_rt_companies (id, name, registration_country) values ($1,'Trace-Co-A','FR'), ($2,'Trace-Co-B','FR')`, [companyA, companyB]);
}, 30000); // P20 final phase: raised from the vitest default 10s — PGlite's cold schema-migration start
// measured >10s when this file runs inside a large batch competing for process startup resources
// (reproduced, not assumed: isolated runs are ~10.6s total; batched runs have timed out at exactly
// the 10s default). 30s gives real headroom without masking a genuine failure.

describe("P20.2 (D1) — CloneTrace persistence adapter: real write + real read", () => {
  it("1. écriture réelle + relecture réelle : un artefact CloneTrace produit un événement persisté et relisible par correlation_id", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const result = await cloneTraceProductTech.prepare({ subject: "s1", action: "test d1 fix" }, ctx);
    expect(result.kind).toBe("ok");
    const artifact = result.artifact!;

    const persisted = await persistCloneTraceEvent(db, artifact, { companyId: companyA });
    expect(persisted.ok).toBe(true);
    const correlationId = (persisted as { correlationId: string }).correlationId;
    expect(correlationId).toBeTruthy();

    const timeline = await reconstructCloneTraceTimelineByCorrelation(db, companyA, correlationId);
    expect(timeline.length).toBe(1);
    expect(timeline[0].company_id).toBe(companyA);
    expect(timeline[0].correlation_id).toBe(correlationId);
    expect(timeline[0].type).toBe("clonetrace:test d1 fix");
    expect(timeline[0].created_at).toBeTruthy();
    // Original non-UUID technology event id preserved in metadata — never lost.
    const meta = timeline[0].metadata as { clonetrace_event_id?: string };
    expect(meta.clonetrace_event_id).toBe(artifact.eventId);
  });

  it("2. company_id absent → refus fail-closed, AUCUNE écriture, jamais un ok mensonger", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const result = await cloneTraceProductTech.prepare({ subject: "s", action: "a" }, ctx);
    const persisted = await persistCloneTraceEvent(db, result.artifact!, { companyId: "" });
    expect(persisted.ok).toBe(false);
    expect((persisted as { error: string }).error).toBeTruthy();
  });

  it("3. isolation cross-company : les événements de la société A ne sont jamais lus par la société B (même correlation_id)", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const r = await cloneTraceProductTech.prepare({ subject: "s", action: "isolation test" }, ctx);
    const persisted = await persistCloneTraceEvent(db, r.artifact!, { companyId: companyA });
    const correlationId = (persisted as { correlationId: string }).correlationId;

    const timelineB = await reconstructCloneTraceTimelineByCorrelation(db, companyB, correlationId);
    expect(timelineB.length).toBe(0); // société B ne voit rien, même avec le correlation_id exact de A
  });

  it("4. ordre chronologique : plusieurs événements de la même corrélation sont relus dans l'ordre d'écriture", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const correlationId = newUuid();
    for (const action of ["étape 1", "étape 2", "étape 3"]) {
      const r = await cloneTraceProductTech.prepare({ subject: "s", action }, ctx);
      const p = await persistCloneTraceEvent(db, r.artifact!, { companyId: companyA, correlationId });
      expect(p.ok).toBe(true);
    }
    const timeline = await reconstructCloneTraceTimelineByCorrelation(db, companyA, correlationId);
    expect(timeline.length).toBe(3);
    expect(timeline.map((e) => e.type)).toEqual(["clonetrace:étape 1", "clonetrace:étape 2", "clonetrace:étape 3"]);
  });

  it("5. redaction : aucun secret/token dans les métadonnées persistées", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const r = await cloneTraceProductTech.prepare({ subject: "s", action: "reason avec un mot sensible", reason: "aucun secret ici" }, ctx);
    const persisted = await persistCloneTraceEvent(db, r.artifact!, { companyId: companyA });
    const correlationId = (persisted as { correlationId: string }).correlationId;
    const timeline = await reconstructCloneTraceTimelineByCorrelation(db, companyA, correlationId);
    const text = JSON.stringify(timeline);
    expect(text).not.toMatch(/api[_-]?key|password|bearer\s+[a-z0-9]/i);
  });

  it("6. CloneCall obtient désormais une référence persistée réelle (id non-UUID géré sans crash, jamais perdu)", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const call = await cloneCallProductTech.prepare({ employeeCalledId: "pierre", objective: "test D1 intégration", transcriptText: "prépare un rapport" }, ctx);
    expect(call.artifact!.traceEvent).not.toBeNull();
    const persisted = await persistCloneTraceEvent(db, call.artifact!.traceEvent!, { companyId: companyA });
    expect(persisted.ok).toBe(true);
    const correlationId = (persisted as { correlationId: string }).correlationId;
    const timeline = await reconstructCloneTraceTimelineByCorrelation(db, companyA, correlationId);
    expect(timeline.length).toBe(1);
    const meta = timeline[0].metadata as { original_mission_id?: string };
    expect(meta.original_mission_id).toBe(call.artifact!.sessionId); // "call-N" preserved, not dropped
  });

  it("7. CloneRoom obtient désormais une référence persistée réelle (même garantie fail-soft)", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const room = await cloneRoomProductTech.prepare(
      { roomId: `room-${newUuid()}`, participants: [{ id: "pierre", kind: "ai_employee" }], thread: [{ from: "pierre", content: "prépare une synthèse" }] },
      ctx,
    );
    expect(room.artifact!.traceEvent).not.toBeNull();
    const persisted = await persistCloneTraceEvent(db, room.artifact!.traceEvent!, { companyId: companyA });
    expect(persisted.ok).toBe(true);
  });

  it("8. idempotence : appeler persist() deux fois avec la MÊME correlation_id écrit deux lignes distinctes (append-only, jamais un doublon fusionné ni un crash)", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const correlationId = newUuid();
    const r = await cloneTraceProductTech.prepare({ subject: "s", action: "idempotence check" }, ctx);
    const p1 = await persistCloneTraceEvent(db, r.artifact!, { companyId: companyA, correlationId });
    const p2 = await persistCloneTraceEvent(db, r.artifact!, { companyId: companyA, correlationId });
    expect(p1.ok).toBe(true);
    expect(p2.ok).toBe(true); // append-only store — no unique constraint to violate, both succeed honestly
    const timeline = await reconstructCloneTraceTimelineByCorrelation(db, companyA, correlationId);
    expect(timeline.length).toBe(2); // both writes landed — append-only, confirmed by real count
  });

  it("9. erreur de persistance : company_id qui n'existe pas en base (FK company invalide) → ok:false honnête, jamais un succès mensonger", async () => {
    const db = await getTestRuntimeDb();
    const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: companyA };
    const r = await cloneTraceProductTech.prepare({ subject: "s", action: "a" }, ctx);
    const nonExistentCompany = newUuid(); // valid UUID format, never inserted into pierre_rt_companies
    const persisted = await persistCloneTraceEvent(db, r.artifact!, { companyId: nonExistentCompany });
    expect(persisted.ok).toBe(false);
  });
});
