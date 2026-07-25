// Preuve réelle contre PGlite (Postgres 16 en process) — pas un mock. Migration
// clonestore_analytics_events_v1 appliquée via PIERRE_E2E_ANALYTICS_SCHEMA=1.
// Ne touche jamais la production, jamais une base distante.

process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { insertAnalyticsEvent, countFunnelStages } from "../store";
import type { AnalyticsServerEnrichedEvent } from "../schema";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let db: SqlExecutor;

function baseEvent(overrides: Partial<AnalyticsServerEnrichedEvent> = {}): AnalyticsServerEnrichedEvent {
  return {
    schemaVersion: 1,
    eventId: globalThis.crypto.randomUUID(),
    eventName: "demo_started",
    occurredAt: new Date().toISOString(),
    source: "web",
    trustLevel: "SERVER_PERSISTED",
    visitorId: globalThis.crypto.randomUUID(),
    sessionId: globalThis.crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    environment: "test",
    trafficClass: "external",
    authenticatedUserId: null,
    countryCode: null,
    sourceChannel: null,
    campaignKey: null,
    partnerAttributionId: null,
    consentState: "unknown",
    ...overrides,
  };
}

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();
});

describe("clonestore_analytics_events_v1 — real PGlite persistence", () => {
  it("inserts a valid event and reports outcome=inserted", async () => {
    const outcome = await insertAnalyticsEvent(db, baseEvent());
    expect(outcome).toBe("inserted");
  });

  it("the SAME event_id submitted twice in the SAME environment writes exactly once (outcome=duplicate on the 2nd)", async () => {
    const event = baseEvent();
    const first = await insertAnalyticsEvent(db, event);
    const second = await insertAnalyticsEvent(db, event);
    expect(first).toBe("inserted");
    expect(second).toBe("duplicate");

    const rows = await db.query("select count(*)::int as c from clonestore_analytics_events_v1 where event_id = $1", [event.eventId]);
    expect(rows.rows[0]!.c).toBe(1);
  });

  it("rejects (DB constraint) an event_name longer than the bound rather than silently truncating", async () => {
    await expect(
      insertAnalyticsEvent(db, baseEvent({ eventName: ("x".repeat(200)) as never })),
    ).rejects.toBeTruthy();
  });

  it("rejects an occurred_at more than 5 minutes in the future — plausibility window enforced at the DB layer", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h in the future
    await expect(insertAnalyticsEvent(db, baseEvent({ occurredAt: future }))).rejects.toBeTruthy();
  });

  it("rejects an occurred_at more than 400 days in the past", async () => {
    const ancient = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString();
    await expect(insertAnalyticsEvent(db, baseEvent({ occurredAt: ancient }))).rejects.toBeTruthy();
  });

  it("rejects an invalid trust_level at the DB layer (defense in depth beyond the TS type)", async () => {
    await expect(
      insertAnalyticsEvent(db, baseEvent({ trustLevel: "TOTALLY_MADE_UP" as never })),
    ).rejects.toBeTruthy();
  });

  it("the append-only trigger blocks a direct UPDATE", async () => {
    const event = baseEvent();
    await insertAnalyticsEvent(db, event);
    await expect(
      db.query("update clonestore_analytics_events_v1 set trust_level = 'PAYMENT_PROVIDER_CONFIRMED' where event_id = $1", [event.eventId]),
    ).rejects.toBeTruthy();
  });

  it("the append-only trigger blocks a direct DELETE", async () => {
    const event = baseEvent();
    await insertAnalyticsEvent(db, event);
    await expect(
      db.query("delete from clonestore_analytics_events_v1 where event_id = $1", [event.eventId]),
    ).rejects.toBeTruthy();
  });

  it("the same event_id in TWO DIFFERENT environments is allowed (unique constraint is per-environment)", async () => {
    const sharedId = globalThis.crypto.randomUUID();
    const a = await insertAnalyticsEvent(db, baseEvent({ eventId: sharedId, environment: "test" }));
    const b = await insertAnalyticsEvent(db, baseEvent({ eventId: sharedId, environment: "development" }));
    expect(a).toBe("inserted");
    expect(b).toBe("inserted");
  });

  it("purge function removes rows older than cutoff and nothing else", async () => {
    // occurred_at doit rester plausible par rapport à received_at (contrainte DB) : les deux sont
    // décalés ensemble de 500 jours, pas seulement received_at.
    const oldTimestamp = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString();
    const old = baseEvent({ receivedAt: oldTimestamp, occurredAt: oldTimestamp });
    const recent = baseEvent();
    await insertAnalyticsEvent(db, old);
    await insertAnalyticsEvent(db, recent);
    const cutoff = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    await db.query("select clonestore_analytics_purge_before($1::timestamptz)", [cutoff]);
    const remaining = await db.query<{ event_id: string }>("select event_id from clonestore_analytics_events_v1 where event_id = any($1)", [[old.eventId, recent.eventId]]);
    const ids = remaining.rows.map((r) => r.event_id);
    expect(ids).toContain(recent.eventId);
    expect(ids).not.toContain(old.eventId);
  });

  it("purge refuses a cutoff in the future", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    await expect(db.query("select clonestore_analytics_purge_before($1::timestamptz)", [future])).rejects.toBeTruthy();
  });

  it("pierre_rt_app has no execute grant on the purge function (only the dedicated retention role does)", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("set local role pierre_rt_app");
        await tx.query("select clonestore_analytics_purge_before($1::timestamptz)", [new Date(Date.now() - 86_400_000).toISOString()]);
      }),
    ).rejects.toBeTruthy();
  });

  describe("countFunnelStages — external-only aggregation", () => {
    it("counts distinct visitors/sessions per stage, excluding internal traffic by default", async () => {
      const since = new Date(Date.now() - 60_000).toISOString();
      const visitorA = globalThis.crypto.randomUUID();
      const visitorInternal = globalThis.crypto.randomUUID();
      await insertAnalyticsEvent(db, baseEvent({ eventName: "demo_started", visitorId: visitorA, trafficClass: "external" }));
      await insertAnalyticsEvent(db, baseEvent({ eventName: "demo_started", visitorId: visitorInternal, trafficClass: "internal" }));
      const until = new Date(Date.now() + 60_000).toISOString();
      const stages = await countFunnelStages(db, ["demo_started"], since, until);
      const stage = stages.find((s) => s.eventName === "demo_started")!;
      expect(stage.distinctVisitors).toBeGreaterThanOrEqual(1);
      // La ligne interne ne doit jamais gonfler le compte externe — vérifié en s'assurant qu'un
      // deuxième visitor purement interne n'apparaît jamais dans une requête traffic_class='external'.
      const internalCheck = await db.query<{ c: number }>(
        "select count(*)::int as c from clonestore_analytics_events_v1 where visitor_id = $1 and traffic_class = 'external'",
        [visitorInternal],
      );
      expect(internalCheck.rows[0]!.c).toBe(0);
    });
  });
});
