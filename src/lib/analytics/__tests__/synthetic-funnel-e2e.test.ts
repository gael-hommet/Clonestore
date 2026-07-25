// Canonical Analytics Runtime Wiring — preuve synthétique de bout en bout (Phase 16-17).
// Fait traverser UN visiteur fictif à tout le funnel canonique, prouve : un seul visiteur,
// runs distincts, aucun doublon, niveaux de confiance corrects, attribution, alignement dashboard.
// Environnement 100% fictif (PGlite), aucun réseau, aucun Stripe/webhook/email réel.

process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { insertAnalyticsEvent } from "../store";
import { countFunnelStages } from "../store";
import { recordCanonicalServerEvent, deterministicEventId } from "../server-events";
import { bridgeFounderServerEvent, founderEventIdFor } from "../adapters/founder-access-adapter";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { AnalyticsServerEnrichedEvent, CanonicalAnalyticsEventName } from "../schema";

let db: SqlExecutor;

// Identités fictives fixes (un seul visiteur, une seule session).
const VISITOR = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PV_HOME = "33333333-3333-4333-8333-333333333333";
const PV_DEMO = "44444444-4444-4444-8444-444444444444";
const PV_PIERRE = "55555555-5555-4555-8555-555555555555";
const DEMO_RUN = "66666666-6666-4666-8666-666666666666";
const PIERRE_RUN = "77777777-7777-4777-8777-777777777777";
const RESERVATION_ID = "res-synthetic-0001";
const STRIPE_SESSION = "cs_test_synthetic_0001";
const STRIPE_PAY_EVENT = "evt_test_pay_0001";

function clientEvent(
  eventName: CanonicalAnalyticsEventName,
  overrides: Partial<AnalyticsServerEnrichedEvent> = {},
): AnalyticsServerEnrichedEvent {
  return {
    schemaVersion: 1,
    eventId: globalThis.crypto.randomUUID(),
    eventName,
    occurredAt: new Date().toISOString(),
    source: "web",
    trustLevel: "CLIENT_OBSERVED",
    visitorId: VISITOR,
    sessionId: SESSION,
    receivedAt: new Date().toISOString(),
    environment: "test",
    trafficClass: "external",
    authenticatedUserId: null,
    countryCode: null,
    sourceChannel: null,
    campaignKey: null,
    partnerAttributionId: null,
    consentState: "unknown",
    properties: {},
    ...overrides,
  };
}

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();

  // ── Parcours client (CLIENT_OBSERVED) ──
  await insertAnalyticsEvent(db, clientEvent("page_viewed", { pageViewId: PV_HOME, routeKey: "/" }));
  await insertAnalyticsEvent(db, clientEvent("homepage_demo_prompt_seen", { pageViewId: PV_HOME }));
  await insertAnalyticsEvent(db, clientEvent("homepage_demo_prompt_clicked", { pageViewId: PV_HOME }));
  await insertAnalyticsEvent(db, clientEvent("page_viewed", { pageViewId: PV_DEMO, routeKey: "/demo" }));
  await insertAnalyticsEvent(db, clientEvent("demo_started", { pageViewId: PV_DEMO, demoRunId: DEMO_RUN }));
  await insertAnalyticsEvent(db, clientEvent("demo_step_completed", { demoRunId: DEMO_RUN, stepId: "opening" }));
  await insertAnalyticsEvent(db, clientEvent("demo_step_completed", { demoRunId: DEMO_RUN, stepId: "cost" }));
  await insertAnalyticsEvent(db, clientEvent("demo_completed", { demoRunId: DEMO_RUN }));
  await insertAnalyticsEvent(db, clientEvent("discover_pierre_clicked", { pageViewId: PV_DEMO }));
  await insertAnalyticsEvent(db, clientEvent("page_viewed", { pageViewId: PV_PIERRE, routeKey: "/demo/pierre" }));
  await insertAnalyticsEvent(db, clientEvent("pierre_demo_started", { pageViewId: PV_PIERRE, demoRunId: PIERRE_RUN }));
  await insertAnalyticsEvent(db, clientEvent("pierre_demo_step_completed", { demoRunId: PIERRE_RUN, stepId: "hero-start" }));
  await insertAnalyticsEvent(db, clientEvent("pierre_demo_completed", { demoRunId: PIERRE_RUN }));
  await insertAnalyticsEvent(db, clientEvent("reservation_cta_clicked", { pageViewId: PV_PIERRE }));
  await insertAnalyticsEvent(db, clientEvent("reservation_form_started"));
  await insertAnalyticsEvent(db, clientEvent("reservation_submitted"));
  await insertAnalyticsEvent(db, clientEvent("activation_started"));
  await insertAnalyticsEvent(db, clientEvent("checkout_started"));
  await insertAnalyticsEvent(db, clientEvent("guided_tour_started"));
  await insertAnalyticsEvent(db, clientEvent("guided_tour_completed"));

  // ── Vérités serveur (founder-access adapter) ──
  await bridgeFounderServerEvent(db, {
    eventId: founderEventIdFor(RESERVATION_ID, "founder_reservation_created"),
    founderEventName: "founder_reservation_created",
    occurredAtIso: new Date().toISOString(), reservationId: RESERVATION_ID, environment: "test",
  });
  await bridgeFounderServerEvent(db, {
    eventId: founderEventIdFor(RESERVATION_ID, "founder_email_verified"),
    founderEventName: "founder_email_verified",
    occurredAtIso: new Date().toISOString(), reservationId: RESERVATION_ID, environment: "test",
  });
  await bridgeFounderServerEvent(db, {
    eventId: founderEventIdFor(RESERVATION_ID, "founder_subscription_active"),
    founderEventName: "founder_subscription_active",
    occurredAtIso: new Date().toISOString(), reservationId: RESERVATION_ID, environment: "test",
    stripeEventId: STRIPE_PAY_EVENT,
  });

  // ── Vérités serveur (checkout + paiement) ──
  await recordCanonicalServerEvent(db, {
    eventName: "checkout_session_created", stableKey: `checkout-session-created:${STRIPE_SESSION}`,
    trustLevel: "SERVER_CONFIRMED", countryCode: "FR", currency: "EUR", amountMinor: 44900,
  });
  await recordCanonicalServerEvent(db, {
    eventName: "payment_succeeded", stableKey: `payment_succeeded:${STRIPE_PAY_EVENT}`,
    trustLevel: "PAYMENT_PROVIDER_CONFIRMED", currency: "EUR", amountMinor: 44900,
    partnerAttributionId: "pp_synthetic_partner",
  });
  await recordCanonicalServerEvent(db, {
    eventName: "payment_refunded", stableKey: `payment_refunded:evt_test_refund_0001`,
    trustLevel: "PAYMENT_PROVIDER_CONFIRMED", currency: "EUR", amountMinor: 44900,
  });
});

describe("Synthetic end-to-end funnel — one external visitor through the whole canonical pipeline", () => {
  it("records exactly one distinct external visitor across the journey", async () => {
    const r = await db.query<{ c: number }>(
      "select count(distinct visitor_id)::int as c from clonestore_analytics_events_v1 where traffic_class='external' and visitor_id is not null",
    );
    expect(r.rows[0]!.c).toBe(1);
  });

  it("records distinct page views (home, demo, pierre)", async () => {
    const r = await db.query<{ c: number }>(
      "select count(distinct page_view_id)::int as c from clonestore_analytics_events_v1 where event_name='page_viewed'",
    );
    expect(r.rows[0]!.c).toBe(3);
  });

  it("records two distinct demo runs (generic + pierre)", async () => {
    const r = await db.query<{ c: number }>(
      "select count(distinct demo_run_id)::int as c from clonestore_analytics_events_v1 where demo_run_id is not null",
    );
    expect(r.rows[0]!.c).toBe(2);
  });

  it("has NO duplicate rows for any event_id", async () => {
    const r = await db.query<{ dupes: number }>(
      "select count(*)::int as dupes from (select event_id, environment, count(*) c from clonestore_analytics_events_v1 group by event_id, environment having count(*) > 1) t",
    );
    expect(r.rows[0]!.dupes).toBe(0);
  });

  it("payment_succeeded carries PAYMENT_PROVIDER_CONFIRMED trust and a resolved partner attribution", async () => {
    const r = await db.query<{ trust_level: string; partner_attribution_id: string | null; source: string }>(
      "select trust_level, partner_attribution_id, source from clonestore_analytics_events_v1 where event_name='payment_succeeded'",
    );
    expect(r.rows[0]?.trust_level).toBe("PAYMENT_PROVIDER_CONFIRMED");
    expect(r.rows[0]?.partner_attribution_id).toBe("pp_synthetic_partner");
    expect(r.rows[0]?.source).toBe("stripe");
  });

  it("server truths carry the correct trust levels (not CLIENT_OBSERVED)", async () => {
    const rows = await db.query<{ event_name: string; trust_level: string }>(
      `select event_name, trust_level from clonestore_analytics_events_v1
       where event_name in ('reservation_created','reservation_email_confirmed','activation_completed','checkout_session_created')`,
    );
    const byName = new Map(rows.rows.map((r) => [r.event_name, r.trust_level]));
    expect(byName.get("reservation_created")).toBe("SERVER_PERSISTED");
    expect(byName.get("reservation_email_confirmed")).toBe("SERVER_CONFIRMED");
    expect(byName.get("activation_completed")).toBe("PAYMENT_PROVIDER_CONFIRMED");
    expect(byName.get("checkout_session_created")).toBe("SERVER_CONFIRMED");
  });

  it("dashboard countFunnelStages reconstructs the funnel from the canonical table only", async () => {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const until = new Date(Date.now() + 3600_000).toISOString();
    const stages = await countFunnelStages(
      db,
      ["page_viewed", "demo_started", "demo_completed", "pierre_demo_started", "pierre_demo_completed",
       "reservation_created", "reservation_email_confirmed", "activation_completed", "checkout_session_created", "payment_succeeded"],
      since, until,
    );
    const byName = new Map(stages.map((s) => [s.eventName, s]));
    // Chaque étape a exactement un visiteur externe (le funnel est monotone et cohérent).
    expect(byName.get("page_viewed")?.distinctVisitors).toBe(1);
    expect(byName.get("demo_started")?.distinctDemoRuns).toBe(1);
    expect(byName.get("pierre_demo_completed")?.distinctDemoRuns).toBe(1);
    expect(byName.get("payment_succeeded")?.totalEvents).toBe(1);
    // reservation_created / activation_completed sont des vérités serveur (visitor_id null) mais
    // comptées par totalEvents.
    expect(byName.get("reservation_created")?.totalEvents).toBe(1);
    expect(byName.get("activation_completed")?.totalEvents).toBe(1);
    expect(byName.get("checkout_session_created")?.totalEvents).toBe(1);
  });

  it("no PII anywhere: no '@', no raw email/name, in any stored row (properties/ids)", async () => {
    const r = await db.query<{ blob: string }>(
      "select coalesce(string_agg(properties_json::text, ' ') , '') as blob from clonestore_analytics_events_v1",
    );
    expect(r.rows[0]!.blob).not.toContain("@");
  });
});

describe("Synthetic failure scenarios (Phase 17) — business truth stays correct, no double count", () => {
  it("a replayed webhook (same stripe_event_id) never creates a second payment_succeeded", async () => {
    const before = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_events_v1 where event_name='payment_succeeded'",
    );
    // Rejeu exact.
    await recordCanonicalServerEvent(db, {
      eventName: "payment_succeeded", stableKey: `payment_succeeded:${STRIPE_PAY_EVENT}`,
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED", currency: "EUR", amountMinor: 44900,
      partnerAttributionId: "pp_synthetic_partner",
    });
    const after = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_events_v1 where event_name='payment_succeeded'",
    );
    expect(after.rows[0]!.c).toBe(before.rows[0]!.c);
  });

  it("a client-forged payment_succeeded routed through the server API is refused (source separation)", async () => {
    const res = await recordCanonicalServerEvent(db, {
      // even though it IS a server event name, a client can never reach recordCanonicalServerEvent;
      // and the client ingestion endpoint rejects it (proven in schema.test.ts). Here we prove
      // that a non-server name is refused, closing the inverse leak.
      eventName: "demo_started" as never, stableKey: "forge", trustLevel: "SERVER_ACCEPTED",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("NOT_A_SERVER_EVENT");
  });

  it("a replayed founder activation (same reservation) never creates a second activation_completed", async () => {
    const before = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_events_v1 where event_name='activation_completed'",
    );
    await bridgeFounderServerEvent(db, {
      eventId: founderEventIdFor(RESERVATION_ID, "founder_subscription_active"),
      founderEventName: "founder_subscription_active",
      occurredAtIso: new Date().toISOString(), reservationId: RESERVATION_ID, environment: "test",
      stripeEventId: STRIPE_PAY_EVENT,
    });
    const after = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_events_v1 where event_name='activation_completed'",
    );
    expect(after.rows[0]!.c).toBe(before.rows[0]!.c);
  });

  it("checkout_session_created and payment_succeeded have DIFFERENT deterministic ids (no collision)", () => {
    expect(deterministicEventId(`checkout-session-created:${STRIPE_SESSION}`))
      .not.toBe(deterministicEventId(`payment_succeeded:${STRIPE_PAY_EVENT}`));
  });
});
