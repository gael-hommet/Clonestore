// Canonical Analytics Runtime Wiring — preuve synthétique CORRÉLÉE de bout en bout (Phase G).
// Supersède `synthetic-funnel-e2e.test.ts` : ne se contente plus de placer des événements
// indépendants dans la même table, mais prouve qu'ils appartiennent tous au MÊME parcours
// visiteur, via la table de liaison de corrélation — y compris pour les vérités serveur émises
// SANS cookie (email confirmé, activation, webhook paiement).

process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { insertAnalyticsEvent, countFunnelStages } from "../store";
import { recordCanonicalServerEvent } from "../server-events";
import { bridgeFounderServerEvent, founderEventIdFor } from "../adapters/founder-access-adapter";
import { upsertConversionLink, resolveCorrelationByReservation, resolveCorrelationByOrderRef, hashRef } from "../correlation";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { AnalyticsServerEnrichedEvent, CanonicalAnalyticsEventName } from "../schema";

let db: SqlExecutor;

// Un SEUL visiteur fictif traverse tout le parcours.
const VISITOR = "10000000-0000-4000-8000-000000000001";
const SESSION = "20000000-0000-4000-8000-000000000002";
const USER = "30000000-0000-4000-8000-000000000003";
const PV_HOME = "40000000-0000-4000-8000-000000000004";
const PV_DEMO = "40000000-0000-4000-8000-000000000005";
const PV_PIERRE = "40000000-0000-4000-8000-000000000006";
const DEMO_RUN = "50000000-0000-4000-8000-000000000007";
const PIERRE_RUN = "50000000-0000-4000-8000-000000000008";
const RESERVATION = "res-corr-0001";
const STRIPE_SESSION = "cs_test_corr_0001";
const SUBSCRIPTION = "sub_test_corr_0001";
const PAY_EVENT = "evt_test_corr_pay_0001";
const ENV = "test" as const;

function clientEvent(eventName: CanonicalAnalyticsEventName, o: Partial<AnalyticsServerEnrichedEvent> = {}): AnalyticsServerEnrichedEvent {
  return {
    schemaVersion: 1, eventId: globalThis.crypto.randomUUID(), eventName, occurredAt: new Date().toISOString(),
    source: "web", trustLevel: "CLIENT_OBSERVED", visitorId: VISITOR, sessionId: SESSION,
    receivedAt: new Date().toISOString(), environment: "test", trafficClass: "external",
    authenticatedUserId: null, countryCode: null, sourceChannel: null, campaignKey: null,
    partnerAttributionId: null, consentState: "unknown", properties: {}, ...o,
  };
}

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();

  // 1) Client : home → demo → pierre (mêmes visitor/session).
  await insertAnalyticsEvent(db, clientEvent("page_viewed", { pageViewId: PV_HOME, routeKey: "/" }));
  await insertAnalyticsEvent(db, clientEvent("demo_started", { pageViewId: PV_DEMO, demoRunId: DEMO_RUN }));
  await insertAnalyticsEvent(db, clientEvent("demo_completed", { demoRunId: DEMO_RUN }));
  await insertAnalyticsEvent(db, clientEvent("pierre_demo_started", { pageViewId: PV_PIERRE, demoRunId: PIERRE_RUN }));
  await insertAnalyticsEvent(db, clientEvent("pierre_demo_completed", { demoRunId: PIERRE_RUN }));
  await insertAnalyticsEvent(db, clientEvent("reservation_cta_clicked", { pageViewId: PV_PIERRE }));
  await insertAnalyticsEvent(db, clientEvent("reservation_submitted"));

  // 2) Réservation serveur : lie visitor/session à la réservation (comme le fait la route).
  await upsertConversionLink(db, { reservationId: RESERVATION, environment: ENV, visitorId: VISITOR, sessionId: SESSION });
  {
    const corr = await resolveCorrelationByReservation(db, RESERVATION, ENV);
    await bridgeFounderServerEvent(db, {
      eventId: founderEventIdFor(RESERVATION, "founder_reservation_created"),
      founderEventName: "founder_reservation_created", occurredAtIso: new Date().toISOString(),
      reservationId: RESERVATION, environment: ENV, visitorId: corr?.visitorId, sessionId: corr?.sessionId,
    });
  }

  // 3) Email confirmé (SANS cookie) : corrélation résolue par reservation_id.
  {
    const corr = await resolveCorrelationByReservation(db, RESERVATION, ENV);
    await bridgeFounderServerEvent(db, {
      eventId: founderEventIdFor(RESERVATION, "founder_email_verified"),
      founderEventName: "founder_email_verified", occurredAtIso: new Date().toISOString(),
      reservationId: RESERVATION, environment: ENV, visitorId: corr?.visitorId, sessionId: corr?.sessionId,
    });
  }

  // 4) Checkout serveur : lie user + refs, émet checkout_session_created corrélé.
  {
    await upsertConversionLink(db, {
      reservationId: RESERVATION, environment: ENV, authenticatedUserId: USER,
      checkoutSessionRef: hashRef(STRIPE_SESSION), visitorId: VISITOR, sessionId: SESSION,
    });
    const corr = await resolveCorrelationByReservation(db, RESERVATION, ENV);
    await recordCanonicalServerEvent(db, {
      eventName: "checkout_session_created", stableKey: `checkout-session-created:${STRIPE_SESSION}`,
      trustLevel: "SERVER_CONFIRMED", countryCode: "FR", currency: "EUR", amountMinor: 44900,
      authenticatedUserId: USER, visitorId: corr?.visitorId, sessionId: corr?.sessionId,
    });
  }

  // 5) Activation (webhook, SANS cookie) : lie order_ref, résout corrélation, émet corrélé.
  {
    await upsertConversionLink(db, { reservationId: RESERVATION, environment: ENV, orderRef: hashRef(SUBSCRIPTION) });
    const corr = await resolveCorrelationByReservation(db, RESERVATION, ENV);
    await bridgeFounderServerEvent(db, {
      eventId: founderEventIdFor(RESERVATION, "founder_subscription_active"),
      founderEventName: "founder_subscription_active", occurredAtIso: new Date().toISOString(),
      reservationId: RESERVATION, environment: ENV, stripeEventId: PAY_EVENT,
      visitorId: corr?.visitorId, sessionId: corr?.sessionId, authenticatedUserId: corr?.authenticatedUserId,
    });
  }

  // 6) Paiement (webhook, SANS cookie) : corrélation par order_ref (abonnement haché).
  {
    const corr = await resolveCorrelationByOrderRef(db, hashRef(SUBSCRIPTION)!, ENV);
    await recordCanonicalServerEvent(db, {
      eventName: "payment_succeeded", stableKey: `payment_succeeded:${PAY_EVENT}`,
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED", currency: "EUR", amountMinor: 44900,
      partnerAttributionId: "pp_corr_partner", visitorId: corr?.visitorId, sessionId: corr?.sessionId,
      authenticatedUserId: corr?.authenticatedUserId,
    });
  }
});

async function visitorOf(eventName: string): Promise<string | null> {
  const r = await db.query<{ visitor_id: string | null }>(
    "select visitor_id from clonestore_analytics_events_v1 where event_name = $1 order by received_at desc limit 1",
    [eventName],
  );
  return r.rows[0]?.visitor_id ?? null;
}

describe("Correlated synthetic funnel — the SAME visitor threads the whole journey", () => {
  it("reservation_created.visitor_id is not null and equals the demo visitor", async () => {
    expect(await visitorOf("reservation_created")).toBe(VISITOR);
  });
  it("reservation_email_confirmed correlates to the ORIGINAL visitor (no cookie at confirm time)", async () => {
    expect(await visitorOf("reservation_email_confirmed")).toBe(VISITOR);
  });
  it("checkout_session_created.visitor_id is not null and equals the demo visitor", async () => {
    expect(await visitorOf("checkout_session_created")).toBe(VISITOR);
  });
  it("activation_completed.visitor_id correlates to the original visitor (webhook, no cookie)", async () => {
    expect(await visitorOf("activation_completed")).toBe(VISITOR);
  });
  it("payment_succeeded belongs to the same visitor as the demo (resolved by order_ref, no cookie)", async () => {
    expect(await visitorOf("payment_succeeded")).toBe(VISITOR);
  });

  it("EVERY major stage is retrievable under the same visitor_id — a real cohort of 1", async () => {
    const stages = ["demo_started", "pierre_demo_completed", "reservation_created", "reservation_email_confirmed",
      "checkout_session_created", "activation_completed", "payment_succeeded"];
    for (const s of stages) {
      expect(await visitorOf(s), `${s} must correlate to the demo visitor`).toBe(VISITOR);
    }
    // The dashboard aggregation sees exactly ONE external visitor across the whole funnel.
    const r = await db.query<{ c: number }>(
      "select count(distinct visitor_id)::int as c from clonestore_analytics_events_v1 where visitor_id is not null and traffic_class='external'",
    );
    expect(r.rows[0]!.c).toBe(1);
  });

  it("no double payment / double checkout even across the correlated journey", async () => {
    const dupes = await db.query<{ dupes: number }>(
      "select count(*)::int as dupes from (select event_id, environment, count(*) c from clonestore_analytics_events_v1 group by event_id, environment having count(*)>1) t",
    );
    expect(dupes.rows[0]!.dupes).toBe(0);
    for (const e of ["checkout_session_created", "payment_succeeded", "activation_completed"]) {
      const c = await db.query<{ c: number }>("select count(*)::int as c from clonestore_analytics_events_v1 where event_name=$1", [e]);
      expect(c.rows[0]!.c, `${e} exactly once`).toBe(1);
    }
  });

  it("payment carries the resolved partner attribution and no PII", async () => {
    const r = await db.query<{ partner_attribution_id: string | null }>(
      "select partner_attribution_id from clonestore_analytics_events_v1 where event_name='payment_succeeded'",
    );
    expect(r.rows[0]?.partner_attribution_id).toBe("pp_corr_partner");
    const blob = await db.query<{ b: string }>("select coalesce(string_agg(properties_json::text,' '),'') as b from clonestore_analytics_events_v1");
    expect(blob.rows[0]!.b).not.toContain("@");
  });

  it("dashboard countFunnelStages reconstructs the full 1-visitor cohort from demo to payment", async () => {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const until = new Date(Date.now() + 3600_000).toISOString();
    const stages = await countFunnelStages(db, ["demo_started", "payment_succeeded"], since, until);
    const byName = new Map(stages.map((s) => [s.eventName, s]));
    expect(byName.get("demo_started")?.distinctVisitors).toBe(1);
    expect(byName.get("payment_succeeded")?.distinctVisitors).toBe(1);
  });
});
