// PHASE 8.4-R1.1 — the dispatch worker runs under the dedicated least-privilege role
// `pierre_rt_communication_worker`: the app role can NOT claim; the worker CAN; submit/fail require
// the worker to own a valid lease; and the worker can NOT read a contract or an employee. The
// executor module is fail-closed (no dedicated DSN → throws; never the service/app role).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { asRole, refused } from "./p84-r1-helpers";
import * as Comm from "../communications";
import { createCommunicationWorkerExecutor, CommunicationWorkerDbError } from "../communication-worker-db";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

async function seedQueued(): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.signature_ready", { document_id: doc }); // in_app only
  await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
  return (await h.db.query<{ id: string }>(`select id from pierre_rt_communication_deliveries where company_id=$1 and channel='in_app'`, [h.companyA])).rows[0].id;
}
const claim = `select * from pierre_rt_claim_communication_deliveries($1,$2,$3,$4,now())`;

describe("R1.1 worker DB executor + role isolation", () => {
  it("the worker executor is fail-closed without a dedicated DSN (never the service/app role)", async () => {
    const prev = process.env.PIERRE_COMMUNICATION_WORKER_DATABASE_URL;
    delete process.env.PIERRE_COMMUNICATION_WORKER_DATABASE_URL;
    await expect(createCommunicationWorkerExecutor()).rejects.toBeInstanceOf(CommunicationWorkerDbError);
    if (prev !== undefined) process.env.PIERRE_COMMUNICATION_WORKER_DATABASE_URL = prev;
  });

  it("the APP role can NOT claim; the WORKER role CAN", async () => {
    await seedQueued();
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(claim, [h.companyA, 10, "w", 60])))).toBe(true);
    const claimed = await asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(claim, [h.companyA, 10, "w", 60]));
    expect(claimed.rows.length).toBe(1);
  });

  it("the worker can NOT read a contract or an employee (no business-table grant)", async () => {
    expect(await refused(() => asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(`select count(*) from pierre_rt_employee_contracts`)))).toBe(true);
    expect(await refused(() => asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(`select count(*) from pierre_rt_employees`)))).toBe(true);
  });

  it("worker B can NOT submit/fail a delivery claimed by worker A (lease ownership)", async () => {
    const id = await seedQueued();
    await asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(claim, [h.companyA, 10, "wA", 60]));
    expect(await refused(() => asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(`select pierre_rt_fail_communication_delivery($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, id, "wB", "x", "retry", 60, 5])))).toBe(true);
  });
});
