// PHASE 8.4-R1.3 — the communication webhook runs under the dedicated role
// `pierre_rt_communication_webhook`, DISTINCT from the signature ingress role. The signature role can
// NOT call a communication function; the comm role CAN ingest; the comm role can NOT raw-update a
// delivery, nor read a contract / employee. The executor module is fail-closed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import { newUuid } from "../sql";
import { createCommunicationWebhookExecutor, CommunicationWebhookDbError } from "../communication-webhook-db";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const ingest = `select * from pierre_rt_ingest_communication_provider_event($1,$2,$3,$4,$5,$6,$7,$8)`;

describe("R1.3 communication webhook DB role", () => {
  it("the webhook executor is fail-closed without a dedicated DSN", async () => {
    const prev = process.env.PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL;
    delete process.env.PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL;
    await expect(createCommunicationWebhookExecutor()).rejects.toBeInstanceOf(CommunicationWebhookDbError);
    if (prev !== undefined) process.env.PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL = prev;
  });

  it("the SIGNATURE ingress role can NOT call a communication function", async () => {
    expect(await refused(() => asRole(h, "pierre_rt_webhook_ingress", h.companyA, (q) => q(ingest, ["resend", newUuid(), null, "email.delivered", "hh", 100, null, true])))).toBe(true);
  });

  it("the COMMUNICATION webhook role CAN ingest a verified event", async () => {
    const out = await asRole(h, "pierre_rt_communication_webhook", h.companyA, (q) => q(ingest, ["resend", newUuid(), null, "email.delivered", "hh", 100, null, true]));
    expect(out.rows.length).toBe(1);
  });

  it("the communication webhook role can NOT raw-update a delivery, nor read a contract/employee", async () => {
    expect(await refused(() => asRole(h, "pierre_rt_communication_webhook", h.companyA, (q) => q(`update pierre_rt_communication_deliveries set status='delivered' where company_id=$1`, [h.companyA])))).toBe(true);
    expect(await refused(() => asRole(h, "pierre_rt_communication_webhook", h.companyA, (q) => q(`select count(*) from pierre_rt_employee_contracts`)))).toBe(true);
    expect(await refused(() => asRole(h, "pierre_rt_communication_webhook", h.companyA, (q) => q(`select count(*) from pierre_rt_employees`)))).toBe(true);
  });
});
