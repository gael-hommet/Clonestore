// BLOC 4 — QA verification-link route (Production QA sink) + server-authoritative traffic class.
// Real in-process Postgres (getTestRuntimeDb, founder + analytics schemas). No mocks.
process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_FOUNDER_SCHEMA = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import { mintQaVerificationLink } from "@/lib/founder-access/qa-verification-link";
import {
  bridgeFounderServerEvent,
  founderEventIdFor,
  resolveReservationTrafficClass,
} from "@/lib/analytics/adapters/founder-access-adapter";
import { createOrUpdateReservation, confirmReservation } from "@/lib/founder-access/store";
import { issueVerificationToken } from "@/lib/founder-access/token";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

const QA_TOKEN = "bloc4-qa-token-0123456789abcdef0123456789abcdef"; // 47 chars ≥ 32
const ORIGIN = "https://clonestore.pro";

let db: SqlExecutor;
beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();
});

/** Create a reservation and stamp its canonical reservation_created traffic class (server truth). */
async function makeReservation(email: string, qa: boolean): Promise<string> {
  const t = issueVerificationToken();
  const res = await createOrUpdateReservation(db, {
    email,
    email_normalized: email,
    email_domain_type: "professional",
    company_name: "QA Co",
    company_size: "1-49",
    verification_hash: t.hash,
    verification_expires_at: t.expiresAt,
    source: "test",
  });
  await bridgeFounderServerEvent(db, {
    eventId: founderEventIdFor(res.id, "founder_reservation_created"),
    founderEventName: "founder_reservation_created",
    occurredAtIso: new Date().toISOString(),
    reservationId: res.id,
    environment: "production",
    trafficClass: qa ? "test" : "external",
  });
  return res.id;
}

describe("BLOC4 — QA verification-link route + server-authoritative traffic class", () => {
  it("mints a REAL verify link for a QA reservation; it verifies via the real path; replay is idempotent; token stored hashed only", async () => {
    const rid = await makeReservation("qa-a@example.com", true);
    const r = await mintQaVerificationLink(db, {
      reservationId: rid, environment: "production", providedToken: QA_TOKEN, configuredToken: QA_TOKEN, origin: ORIGIN,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.verifyUrl).toContain(`/api/founder-access/verify?rid=${rid}&token=`);
    const token = new URL(r.verifyUrl).searchParams.get("token")!;
    // token is persisted only as a hash, never plaintext
    const row = await db.query<{ verification_token_hash: string | null }>(
      "select verification_token_hash from clonestore_founder_reservations where id=$1", [rid],
    );
    expect(row.rows[0].verification_token_hash).not.toBe(token);
    expect(row.rows[0].verification_token_hash).toMatch(/^[0-9a-f]{64}$/);
    // real verify route logic: first use succeeds, replay is idempotent (no second inconsistent state)
    expect((await confirmReservation(db, rid, token)).ok).toBe(true);
    expect((await confirmReservation(db, rid, token)).ok).toBe(true);
    const vf = await db.query<{ email_verified_at: string | null; c: number }>(
      "select email_verified_at, (select count(*)::int from clonestore_founder_funnel_events where reservation_id=$1 and event_name='founder_email_verified') as c from clonestore_founder_reservations where id=$1", [rid],
    );
    expect(vf.rows[0].email_verified_at).not.toBeNull();
    expect(vf.rows[0].c).toBe(1); // exactly one email_verified_at truth, never doubled
  });

  it("gate 1: refuses without token, with a wrong token, and OUTSIDE production even with the correct token", async () => {
    const rid = await makeReservation("qa-b@example.com", true);
    expect((await mintQaVerificationLink(db, { reservationId: rid, environment: "production", providedToken: null, configuredToken: QA_TOKEN, origin: ORIGIN })).ok).toBe(false);
    expect((await mintQaVerificationLink(db, { reservationId: rid, environment: "production", providedToken: "wrong-token-000000000000000000000000000", configuredToken: QA_TOKEN, origin: ORIGIN })).ok).toBe(false);
    const nonprod = await mintQaVerificationLink(db, { reservationId: rid, environment: "test", providedToken: QA_TOKEN, configuredToken: QA_TOKEN, origin: ORIGIN });
    expect(nonprod.ok).toBe(false);
    if (!nonprod.ok) expect(nonprod.status).toBe(403);
  });

  it("gate 2: a REAL (external) reservation can NEVER be targeted", async () => {
    const rid = await makeReservation("real-user@example.com", false);
    const r = await mintQaVerificationLink(db, { reservationId: rid, environment: "production", providedToken: QA_TOKEN, configuredToken: QA_TOKEN, origin: ORIGIN });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error).toBe("not_qa_reservation"); }
  });

  it("bad id → 400; a QA-classified event with no reservation row → 404", async () => {
    const bad = await mintQaVerificationLink(db, { reservationId: "not-a-uuid", environment: "production", providedToken: QA_TOKEN, configuredToken: QA_TOKEN, origin: ORIGIN });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe(400);
    const ghost = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await bridgeFounderServerEvent(db, {
      eventId: founderEventIdFor(ghost, "founder_reservation_created"), founderEventName: "founder_reservation_created",
      occurredAtIso: new Date().toISOString(), reservationId: ghost, environment: "production", trafficClass: "test",
    });
    const r = await mintQaVerificationLink(db, { reservationId: ghost, environment: "production", providedToken: QA_TOKEN, configuredToken: QA_TOKEN, origin: ORIGIN });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("resolveReservationTrafficClass is server-authoritative: test for a QA reservation, external for a real one", async () => {
    const qa = await makeReservation("cls-qa@example.com", true);
    const real = await makeReservation("cls-real@example.com", false);
    expect(await resolveReservationTrafficClass(db, qa, "production")).toBe("test");
    expect(await resolveReservationTrafficClass(db, real, "production")).toBe("external");
  });
});
