// src/lib/pierre/v1/__integration__/p83-b2g-contract-state-machine.itest.ts
// PHASE 8.3-B2G §5 — the contract workflow state machine is enforced both as a pure function
// AND at the DB level (trigger), for direct superuser SQL and the application role.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { withTenantTransaction } from "../tenant-tx";
import { assertContractTransition, canContractTransition, ContractTransitionError } from "../contract-state";
import { seedEmployee } from "./b2g-helpers";
import { createGovernedContract } from "../contracts";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

describe("§5 contract state machine", () => {
  it("the pure machine permits legal transitions and refuses illegal ones", () => {
    expect(canContractTransition("draft", "under_review")).toBe(true);
    expect(canContractTransition("approved", "final")).toBe(true);
    expect(canContractTransition("signed", "superseded")).toBe(true);
    expect(canContractTransition("draft", "signed")).toBe(false);
    expect(canContractTransition("draft", "final")).toBe(false);
    expect(() => assertContractTransition("draft", "signed")).toThrow(ContractTransitionError);
  });

  it("the DB trigger blocks an illegal workflow transition via direct superuser SQL", async () => {
    const emp = await seedEmployee(h, h.companyA);
    const c = await createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await expect(h.db.query(`update pierre_rt_employee_contracts set workflow_status='signed' where id=$1`, [c.id])).rejects.toThrow(/illegal contract workflow transition/);
    // a legal transition succeeds
    await h.db.query(`update pierre_rt_employee_contracts set workflow_status='under_review' where id=$1`, [c.id]);
  });

  it("the DB trigger blocks an illegal transition via the application role too", async () => {
    const emp = await seedEmployee(h, h.companyA);
    const c = await createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await expect(withTenantTransaction(h.db, owner, (tx) => tx.query(`update pierre_rt_employee_contracts set workflow_status='final' where company_id=$1 and id=$2`, [h.companyA, c.id]))).rejects.toThrow(/illegal contract workflow transition/);
  });
});
