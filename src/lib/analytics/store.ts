// Persistance canonique — table append-only clonestore_analytics_events_v1.
// Idempotence garantie par la contrainte unique (event_id, environment) en base : un doublon
// n'est jamais une erreur, jamais une deuxième ligne.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { AnalyticsServerEnrichedEvent } from "./schema";

export type InsertOutcome = "inserted" | "duplicate";

export async function insertAnalyticsEvent(
  db: SqlExecutor,
  event: AnalyticsServerEnrichedEvent,
): Promise<InsertOutcome> {
  const result = await db.query<{ inserted: boolean }>(
    `insert into clonestore_analytics_events_v1
       (event_id, schema_version, event_name, occurred_at, received_at, source, trust_level,
        environment, traffic_class, visitor_id, session_id, page_view_id, demo_run_id,
        authenticated_user_id, route_key, step_id, country_code, source_channel, campaign_key,
        partner_attribution_id, properties_json, consent_state)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     on conflict (event_id, environment) do nothing
     returning true as inserted`,
    [
      event.eventId,
      event.schemaVersion,
      event.eventName,
      event.occurredAt,
      event.receivedAt,
      event.source,
      event.trustLevel,
      event.environment,
      event.trafficClass,
      event.visitorId,
      event.sessionId,
      event.pageViewId ?? null,
      event.demoRunId ?? null,
      event.authenticatedUserId,
      event.routeKey ?? null,
      event.stepId ?? null,
      event.countryCode,
      event.sourceChannel,
      event.campaignKey,
      event.partnerAttributionId,
      JSON.stringify(event.properties ?? {}),
      event.consentState,
    ],
  );
  return result.rows.length > 0 ? "inserted" : "duplicate";
}

export interface FunnelStageCount {
  eventName: string;
  distinctVisitors: number;
  distinctSessions: number;
  distinctDemoRuns: number;
  totalEvents: number;
}

/**
 * Compte, pour un ensemble d'étapes, les visiteurs/sessions/démo-runs distincts externes
 * uniquement (trafic interne/test/automatisé exclu par défaut — Phase 15/20).
 */
export async function countFunnelStages(
  db: SqlExecutor,
  eventNames: readonly string[],
  sinceIso: string,
  untilIso: string,
): Promise<FunnelStageCount[]> {
  const result = await db.query<FunnelStageCount>(
    `select
       event_name as "eventName",
       count(distinct visitor_id) as "distinctVisitors",
       count(distinct session_id) as "distinctSessions",
       count(distinct demo_run_id) as "distinctDemoRuns",
       count(*) as "totalEvents"
     from clonestore_analytics_events_v1
     where event_name = any($1)
       and occurred_at >= $2 and occurred_at < $3
       and traffic_class = 'external'
     group by event_name`,
    [eventNames, sinceIso, untilIso],
  );
  return result.rows;
}

export interface MeasurementHealthCounts {
  eventsAccepted: number;
  duplicatesAvoided: number;
  eventsByTrustLevel: Record<string, number>;
}

export async function measurementHealthSnapshot(
  db: SqlExecutor,
  sinceIso: string,
): Promise<MeasurementHealthCounts> {
  const totalResult = await db.query<{ count: string }>(
    `select count(*)::text as count from clonestore_analytics_events_v1 where received_at >= $1`,
    [sinceIso],
  );
  const byTrust = await db.query<{ trust_level: string; count: string }>(
    `select trust_level, count(*)::text as count from clonestore_analytics_events_v1
     where received_at >= $1 group by trust_level`,
    [sinceIso],
  );
  return {
    eventsAccepted: Number(totalResult.rows[0]?.count ?? 0),
    duplicatesAvoided: 0, // dérivé côté application (compteur en mémoire de process, voir route.ts) — la DB seule ne peut pas distinguer un conflit évité après coup sans journal séparé
    eventsByTrustLevel: Object.fromEntries(byTrust.rows.map((r) => [r.trust_level, Number(r.count)])),
  };
}
