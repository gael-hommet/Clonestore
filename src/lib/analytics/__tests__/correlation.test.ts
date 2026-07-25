process.env.PIERRE_E2E_TEST_MODE = "1";
process.env.PIERRE_E2E_ANALYTICS_SCHEMA = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getTestRuntimeDb, resetTestRuntimeDb } from "@/lib/pierre/v1/test-runtime-db";
import {
  upsertConversionLink,
  resolveCorrelationByReservation,
  resolveCorrelationByOrderRef,
  hashRef,
} from "../correlation";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let db: SqlExecutor;
const VISITOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeAll(async () => {
  await resetTestRuntimeDb();
  db = await getTestRuntimeDb();
});

describe("conversion correlation link table", () => {
  it("hashRef never returns the raw value and is stable", () => {
    const a = hashRef("cs_test_secret_session");
    const b = hashRef("cs_test_secret_session");
    expect(a).toBe(b);
    expect(a).not.toContain("cs_test_secret_session");
    expect(hashRef(null)).toBeNull();
  });

  it("upserts a link at reservation time (visitor/session), resolvable by reservation", async () => {
    await upsertConversionLink(db, { reservationId: "res-1", environment: "test", visitorId: VISITOR, sessionId: SESSION });
    const corr = await resolveCorrelationByReservation(db, "res-1", "test");
    expect(corr?.visitorId).toBe(VISITOR);
    expect(corr?.sessionId).toBe(SESSION);
  });

  it("merges later checkout data (user + refs) without losing the original visitor/session (coalesce)", async () => {
    const checkoutRef = hashRef("cs_test_checkout_1");
    const orderRef = hashRef("sub_test_1");
    await upsertConversionLink(db, {
      reservationId: "res-1", environment: "test",
      authenticatedUserId: USER, checkoutSessionRef: checkoutRef, orderRef,
      visitorId: null, sessionId: null, // a null must NOT wipe the existing origin
    });
    const corr = await resolveCorrelationByReservation(db, "res-1", "test");
    expect(corr?.visitorId).toBe(VISITOR); // preserved
    expect(corr?.sessionId).toBe(SESSION); // preserved
    expect(corr?.authenticatedUserId).toBe(USER);
    expect(corr?.checkoutSessionReference).toBe(checkoutRef);
    expect(corr?.orderReference).toBe(orderRef);
  });

  it("resolves the same correlation by order_ref (webhook path, no cookie)", async () => {
    const orderRef = hashRef("sub_test_1")!;
    const corr = await resolveCorrelationByOrderRef(db, orderRef, "test");
    expect(corr?.visitorId).toBe(VISITOR);
    expect(corr?.reservationId).toBe("res-1");
  });

  it("is idempotent — repeated upserts never create a second row per (reservation, environment)", async () => {
    await upsertConversionLink(db, { reservationId: "res-1", environment: "test", visitorId: VISITOR });
    const r = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_conversion_links_v1 where reservation_id = $1 and environment = 'test'",
      ["res-1"],
    );
    expect(r.rows[0]!.c).toBe(1);
  });

  it("keeps environments isolated (same reservation id in two environments = two rows)", async () => {
    await upsertConversionLink(db, { reservationId: "res-env", environment: "test", visitorId: VISITOR });
    await upsertConversionLink(db, { reservationId: "res-env", environment: "development", visitorId: VISITOR });
    const r = await db.query<{ c: number }>(
      "select count(*)::int as c from clonestore_analytics_conversion_links_v1 where reservation_id = $1",
      ["res-env"],
    );
    expect(r.rows[0]!.c).toBe(2);
  });

  it("never stores a non-uuid visitor/session (guards against garbage)", async () => {
    await upsertConversionLink(db, { reservationId: "res-bad", environment: "test", visitorId: "not-a-uuid", sessionId: "x" });
    const corr = await resolveCorrelationByReservation(db, "res-bad", "test");
    expect(corr?.visitorId).toBeNull();
    expect(corr?.sessionId).toBeNull();
  });
});
