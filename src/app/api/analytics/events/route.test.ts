// Analytics ingestion route — preuve d'intégration de l'authentification QA Production.
//
// Prouve deux propriétés à la fois :
//  1. En Production, un secret QA valide (en-tête privé) classe l'événement `test` — et seulement
//     lui : un en-tête public `x-clonestore-test` seul, un mauvais token ou l'absence de token
//     restent `external` (fail-closed). Le secret n'apparaît jamais dans la ligne persistée.
//  2. Le token QA ne débride RIEN d'autre : la validation de schéma, le rejet des vérités serveur
//     (source=server, reservation_created), le rejet des noms inconnus, la borne de taille (413) et
//     le rate limiting restent strictement appliqués, avec ou sans token.
//
// Base 100% fictive (PGlite, vrai Postgres 16), aucun réseau, aucun secret réel.

process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { __setAnalyticsDbForTests } from "@/lib/analytics/runtime";
import { POST } from "./route";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

// Secret FICTIF (47 chars ≥ 32). Jamais un vrai token.
const QA_TOKEN = "qa_fake_route_test_secret_0123456789_abcdef_ghi";

let db: SqlExecutor;
let ipCounter = 0;

/** IP unique par appel → chaque test possède son propre bucket de rate limit (évite les collisions
 *  inter-tests). Le test de rate limit dédié fixe volontairement une IP unique et boucle. */
function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

function makeReq(body: unknown, headers: Record<string, string> = {}, ip = freshIp()): Request {
  return new Request("https://clonestore.pro/api/analytics/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "CloneStore-QA-Measurement/1.0",
      "x-forwarded-for": ip,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    eventId: globalThis.crypto.randomUUID(),
    eventName: "page_viewed",
    occurredAt: new Date().toISOString(),
    source: "web",
    pageViewId: globalThis.crypto.randomUUID(),
    routeKey: "/demo",
    properties: { device: "desktop" },
    ...overrides,
  };
}

/** Force le runtime à résoudre l'environnement analytique `production` (restauré par afterEach). */
function stubProduction(withToken: boolean): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  if (withToken) vi.stubEnv("CLONESTORE_ANALYTICS_QA_TOKEN", QA_TOKEN);
}

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();
  __setAnalyticsDbForTests(db);
});

afterAll(() => {
  __setAnalyticsDbForTests(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function rowFor(eventId: string): Promise<{ environment: string; traffic_class: string; event_name: string; blob: string } | null> {
  const r = await db.query<{ environment: string; traffic_class: string; event_name: string; blob: string }>(
    "select environment, traffic_class, event_name, row_to_json(t)::text as blob from clonestore_analytics_events_v1 t where event_id = $1",
    [eventId],
  );
  return r.rows[0] ?? null;
}

describe("analytics route · classification QA Production authentifiée", () => {
  it("Production + secret QA valide → 202 inserted, ligne persistée environment=production traffic_class=test", async () => {
    stubProduction(true);
    const ev = validEvent();
    const res = await POST(makeReq(ev, { "x-clonestore-qa-token": QA_TOKEN, "x-clonestore-test": "1" }));
    expect(res.status).toBe(202);
    const json = (await res.json()) as { accepted: boolean; outcome: string };
    expect(json.accepted).toBe(true);
    expect(json.outcome).toBe("inserted");

    const row = await rowFor(ev.eventId as string);
    expect(row).not.toBeNull();
    expect(row!.environment).toBe("production");
    expect(row!.traffic_class).toBe("test");
    expect(row!.event_name).toBe("page_viewed");
    // Le secret ne fuit dans AUCUNE colonne de la ligne persistée.
    expect(row!.blob).not.toContain(QA_TOKEN);
  });

  it("Production SANS token → 202 mais traffic_class=external (le secret est requis)", async () => {
    stubProduction(true); // secret CONFIGURÉ côté serveur…
    const ev = validEvent();
    const res = await POST(makeReq(ev)); // …mais AUCUN en-tête fourni
    expect(res.status).toBe(202);
    const row = await rowFor(ev.eventId as string);
    expect(row!.traffic_class).toBe("external");
  });

  it("Production + MAUVAIS token → 202 mais traffic_class=external", async () => {
    stubProduction(true);
    const ev = validEvent();
    const res = await POST(makeReq(ev, { "x-clonestore-qa-token": "x".repeat(QA_TOKEN.length) }));
    expect(res.status).toBe(202);
    const row = await rowFor(ev.eventId as string);
    expect(row!.traffic_class).toBe("external");
  });

  it("Production + x-clonestore-test seul (aucun secret QA) → 202 mais traffic_class=external : un en-tête public ne suffit jamais", async () => {
    stubProduction(false); // aucun secret configuré côté serveur
    const ev = validEvent();
    const res = await POST(makeReq(ev, { "x-clonestore-test": "1" }));
    expect(res.status).toBe(202);
    const row = await rowFor(ev.eventId as string);
    expect(row!.traffic_class).toBe("external");
  });
});

describe("analytics route · un token QA valide ne débride AUCUN autre contrôle", () => {
  it("reservation_created (vérité serveur) depuis le client, MÊME avec un token QA valide → 422 SERVER_ONLY_EVENT_REJECTED", async () => {
    stubProduction(true);
    const res = await POST(makeReq(validEvent({ eventName: "reservation_created" }), { "x-clonestore-qa-token": QA_TOKEN }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("SERVER_ONLY_EVENT_REJECTED");
  });

  it("source=server depuis le client, MÊME avec token QA → 422 INVALID_SOURCE", async () => {
    stubProduction(true);
    const res = await POST(makeReq(validEvent({ source: "server" }), { "x-clonestore-qa-token": QA_TOKEN }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("INVALID_SOURCE");
  });

  it("nom d'événement inconnu, MÊME avec token QA → 422 UNKNOWN_EVENT_NAME", async () => {
    stubProduction(true);
    const res = await POST(makeReq(validEvent({ eventName: "totally_unknown_event" }), { "x-clonestore-qa-token": QA_TOKEN }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("UNKNOWN_EVENT_NAME");
  });

  it("payload excessif (> borne), MÊME avec token QA → 413", async () => {
    stubProduction(true);
    const oversized = JSON.stringify(validEvent({ properties: { blob: "A".repeat(9000) } }));
    const res = await POST(makeReq(oversized, { "x-clonestore-qa-token": QA_TOKEN }));
    expect(res.status).toBe(413);
  });

  it("le rate limiting reste appliqué avec un token QA valide (61e requête même IP → 429)", async () => {
    // Env non-prod ici : on prouve l'invariant de débit indépendamment de la classification. Le
    // token est présent sur les 61 requêtes ; il ne doit accorder aucun budget supplémentaire.
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      const res = await POST(makeReq(validEvent(), { "x-clonestore-qa-token": QA_TOKEN }, ip));
      statuses.push(res.status);
    }
    // Les 60 premières acceptées, la 61e refusée pour dépassement de débit.
    expect(statuses.slice(0, 60).every((s) => s === 202)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
