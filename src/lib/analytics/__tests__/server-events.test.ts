process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import {
  recordCanonicalServerEvent,
  deterministicEventId,
  amountBucket,
  resolveAnalyticsEnvironment,
} from "../server-events";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { isUuid } from "../schema";

let db: SqlExecutor;

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();
});

describe("recordCanonicalServerEvent — single server-truth write API", () => {
  it("persists a checkout_session_created event at SERVER_CONFIRMED", async () => {
    const r = await recordCanonicalServerEvent(db, {
      eventName: "checkout_session_created",
      stableKey: "checkout-session-created:cs_test_synthetic_1",
      trustLevel: "SERVER_CONFIRMED",
      countryCode: "FR",
      currency: "EUR",
      amountMinor: 44900,
    });
    expect(r.ok).toBe(true);
    expect(r.outcome).toBe("inserted");

    const row = await db.query<{ event_name: string; trust_level: string; source: string; country_code: string; properties_json: unknown }>(
      "select event_name, trust_level, source, country_code, properties_json from clonestore_analytics_events_v1 where event_id = $1",
      [deterministicEventId("checkout-session-created:cs_test_synthetic_1")],
    );
    expect(row.rows[0]?.event_name).toBe("checkout_session_created");
    expect(row.rows[0]?.trust_level).toBe("SERVER_CONFIRMED");
    expect(row.rows[0]?.source).toBe("server");
    expect(row.rows[0]?.country_code).toBe("FR");
  });

  it("persists payment_succeeded at PAYMENT_PROVIDER_CONFIRMED with source=stripe", async () => {
    const r = await recordCanonicalServerEvent(db, {
      eventName: "payment_succeeded",
      stableKey: "payment-succeeded:evt_test_1",
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED",
      currency: "CHF",
      amountMinor: 49900,
    });
    expect(r.ok).toBe(true);
    const row = await db.query<{ source: string; trust_level: string }>(
      "select source, trust_level from clonestore_analytics_events_v1 where event_id = $1",
      [deterministicEventId("payment-succeeded:evt_test_1")],
    );
    expect(row.rows[0]?.source).toBe("stripe");
    expect(row.rows[0]?.trust_level).toBe("PAYMENT_PROVIDER_CONFIRMED");
  });

  it("is idempotent — the same stableKey never writes twice (replay-safe)", async () => {
    const input = {
      eventName: "payment_succeeded" as const,
      stableKey: "payment-succeeded:evt_replay",
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED" as const,
    };
    const first = await recordCanonicalServerEvent(db, input);
    const second = await recordCanonicalServerEvent(db, input);
    expect(first.outcome).toBe("inserted");
    expect(second.outcome).toBe("duplicate");
    const count = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_events_v1 where event_id = $1",
      [deterministicEventId("payment-succeeded:evt_replay")],
    );
    expect(count.rows[0]!.c).toBe(1);
  });

  it("REFUSES a client-emittable event routed through the server API (source separation)", async () => {
    const r = await recordCanonicalServerEvent(db, {
      eventName: "demo_started" as never, // not a server-only event
      stableKey: "should-never-persist",
      trustLevel: "SERVER_ACCEPTED",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("NOT_A_SERVER_EVENT");
  });

  it("never stores an exact amount — only a bounded bucket in properties", async () => {
    await recordCanonicalServerEvent(db, {
      eventName: "checkout_session_created",
      stableKey: "checkout-session-created:cs_amount_check",
      trustLevel: "SERVER_CONFIRMED",
      amountMinor: 44900,
    });
    const row = await db.query<{ properties_json: Record<string, unknown> }>(
      "select properties_json from clonestore_analytics_events_v1 where event_id = $1",
      [deterministicEventId("checkout-session-created:cs_amount_check")],
    );
    const props = row.rows[0]!.properties_json;
    expect(props.amountBucket).toBe("100_to_500");
    // The exact 44900 must never appear as a stored value.
    expect(JSON.stringify(props)).not.toContain("44900");
  });

  it("rejects a non-uuid authenticatedUserId rather than storing garbage (never an email)", async () => {
    await recordCanonicalServerEvent(db, {
      eventName: "activation_completed",
      stableKey: "activation-completed:res_email_guard",
      trustLevel: "SERVER_CONFIRMED",
      authenticatedUserId: "user@example.com", // an email must never land in authenticated_user_id
    });
    const row = await db.query<{ authenticated_user_id: string | null }>(
      "select authenticated_user_id from clonestore_analytics_events_v1 where event_id = $1",
      [deterministicEventId("activation-completed:res_email_guard")],
    );
    expect(row.rows[0]?.authenticated_user_id).toBeNull();
  });

  it("carries a resolved partner attribution id and marks sourceChannel=partner", async () => {
    await recordCanonicalServerEvent(db, {
      eventName: "payment_succeeded",
      stableKey: "payment-succeeded:evt_partner",
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED",
      partnerAttributionId: "pp_internal_abc123",
    });
    const row = await db.query<{ partner_attribution_id: string | null; source_channel: string | null }>(
      "select partner_attribution_id, source_channel from clonestore_analytics_events_v1 where event_id = $1",
      [deterministicEventId("payment-succeeded:evt_partner")],
    );
    expect(row.rows[0]?.partner_attribution_id).toBe("pp_internal_abc123");
    expect(row.rows[0]?.source_channel).toBe("partner");
  });
});

describe("deterministicEventId", () => {
  it("is stable and uuid-shaped", () => {
    const a = deterministicEventId("payment-succeeded:evt_x");
    const b = deterministicEventId("payment-succeeded:evt_x");
    expect(a).toBe(b);
    expect(isUuid(a)).toBe(true);
  });
  it("differs for different keys", () => {
    expect(deterministicEventId("a")).not.toBe(deterministicEventId("b"));
  });
  it("never contains the raw key", () => {
    const id = deterministicEventId("payment-succeeded:evt_secret_stripe_id");
    expect(id).not.toContain("evt_secret_stripe_id");
  });
});

describe("amountBucket", () => {
  it("buckets known price points without encoding the exact price", () => {
    expect(amountBucket(44900)).toBe("100_to_500");
    expect(amountBucket(49900)).toBe("100_to_500");
    expect(amountBucket(0)).toBe("zero");
    expect(amountBucket(null)).toBe("unknown");
    expect(amountBucket(undefined)).toBe("unknown");
    expect(amountBucket(150000)).toBe("gte_1000");
  });
});

describe("resolveAnalyticsEnvironment", () => {
  it("returns a valid closed environment value", () => {
    expect(["production", "preview", "development", "test"]).toContain(resolveAnalyticsEnvironment());
  });
});
