process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { bridgeFounderServerEvent, founderEventIdFor } from "../founder-access-adapter";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { isUuid } from "../../schema";

let db: SqlExecutor;

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();
});

describe("founder-access → canonical analytics adapter", () => {
  it("founderEventIdFor produces a valid, stable UUID-shaped id for the same input", () => {
    const a = founderEventIdFor("reservation-123", "founder_payment_completed");
    const b = founderEventIdFor("reservation-123", "founder_payment_completed");
    expect(a).toBe(b);
    expect(isUuid(a)).toBe(true);
  });

  it("founderEventIdFor produces DIFFERENT ids for different reservations", () => {
    const a = founderEventIdFor("reservation-A", "founder_payment_completed");
    const b = founderEventIdFor("reservation-B", "founder_payment_completed");
    expect(a).not.toBe(b);
  });

  it("maps founder_payment_completed to payment_succeeded at PAYMENT_PROVIDER_CONFIRMED trust", async () => {
    const reservationId = "res-1";
    const eventId = founderEventIdFor(reservationId, "founder_payment_completed");
    const result = await bridgeFounderServerEvent(db, {
      eventId,
      founderEventName: "founder_payment_completed",
      occurredAtIso: new Date().toISOString(),
      reservationId,
      environment: "test",
      stripeEventId: "evt_test_123",
    });
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("inserted");

    const row = await db.query<{ event_name: string; trust_level: string }>(
      "select event_name, trust_level from clonestore_analytics_events_v1 where event_id = $1",
      [eventId],
    );
    expect(row.rows[0]?.event_name).toBe("payment_succeeded");
    expect(row.rows[0]?.trust_level).toBe("PAYMENT_PROVIDER_CONFIRMED");
  });

  it("replaying the same founder event (same deterministic id) never creates a second row", async () => {
    const reservationId = "res-replay";
    const eventId = founderEventIdFor(reservationId, "founder_subscription_active");
    const first = await bridgeFounderServerEvent(db, {
      eventId, founderEventName: "founder_subscription_active", occurredAtIso: new Date().toISOString(),
      reservationId, environment: "test",
    });
    const second = await bridgeFounderServerEvent(db, {
      eventId, founderEventName: "founder_subscription_active", occurredAtIso: new Date().toISOString(),
      reservationId, environment: "test",
    });
    expect(first.outcome).toBe("inserted");
    expect(second.outcome).toBe("duplicate");
    const count = await db.query<{ c: number }>("select count(*)::int as c from clonestore_analytics_events_v1 where event_id = $1", [eventId]);
    expect(count.rows[0]!.c).toBe(1);
  });

  it("an unmapped founder event name is a no-op (ok:false, reason NOT_MAPPED), never throws", async () => {
    const result = await bridgeFounderServerEvent(db, {
      eventId: founderEventIdFor("res-x", "founder_unsubscribed" as never),
      founderEventName: "founder_unsubscribed" as never,
      occurredAtIso: new Date().toISOString(),
      reservationId: "res-x",
      environment: "test",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("NOT_MAPPED");
  });

  it("founder_email_verified maps to reservation_email_confirmed at SERVER_CONFIRMED (no Stripe event id)", async () => {
    const reservationId = "res-email";
    const eventId = founderEventIdFor(reservationId, "founder_email_verified");
    await bridgeFounderServerEvent(db, {
      eventId, founderEventName: "founder_email_verified", occurredAtIso: new Date().toISOString(),
      reservationId, environment: "test",
    });
    const row = await db.query<{ event_name: string; trust_level: string }>(
      "select event_name, trust_level from clonestore_analytics_events_v1 where event_id = $1", [eventId],
    );
    expect(row.rows[0]?.event_name).toBe("reservation_email_confirmed");
    expect(row.rows[0]?.trust_level).toBe("SERVER_CONFIRMED");
  });

  it("defaults trafficClass to 'external'; a QA synthetic reservation is isolated as 'test' (excluded from the owner funnel)", async () => {
    const realId = founderEventIdFor("res-real", "founder_reservation_created");
    const qaId = founderEventIdFor("res-qa-synthetic", "founder_reservation_created");
    await bridgeFounderServerEvent(db, {
      eventId: realId, founderEventName: "founder_reservation_created", occurredAtIso: new Date().toISOString(),
      reservationId: "res-real", environment: "test",
    });
    await bridgeFounderServerEvent(db, {
      eventId: qaId, founderEventName: "founder_reservation_created", occurredAtIso: new Date().toISOString(),
      reservationId: "res-qa-synthetic", environment: "test", trafficClass: "test",
    });
    const rows = await db.query<{ event_id: string; traffic_class: string }>(
      "select event_id, traffic_class from clonestore_analytics_events_v1 where event_id = any($1)", [[realId, qaId]],
    );
    const byId = new Map(rows.rows.map((r) => [r.event_id, r.traffic_class]));
    expect(byId.get(realId)).toBe("external"); // vraie conversion → comptée
    expect(byId.get(qaId)).toBe("test");        // QA synthétique → exclue du funnel externe par défaut
  });
});
