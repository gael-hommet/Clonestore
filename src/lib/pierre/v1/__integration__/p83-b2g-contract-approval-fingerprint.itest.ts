// src/lib/pierre/v1/__integration__/p83-b2g-contract-approval-fingerprint.itest.ts
// PHASE 8.3-B2G §6 — an approval is a real proof bound to the template fingerprint + content
// hash. If the template changes after approval, finalization is refused and the stale
// approval is explicitly invalidated (audited).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import { createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let emp: string; let templateId: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  templateId = await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

describe("§6 contract approval fingerprint", () => {
  it("approval records a bound proof (fingerprint + content hash)", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    const appr = (await h.db.query<{ template_fingerprint: string; content_hash: string; decision: string }>(`select template_fingerprint, content_hash, decision from pierre_rt_contract_approvals where contract_id=$1`, [c.id])).rows;
    expect(appr.length).toBe(1);
    expect(appr[0].decision).toBe("approved");
    expect(appr[0].template_fingerprint).toMatch(/.+:.+/);
    expect(appr[0].content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("a template change after approval blocks finalization and invalidates the approval", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    // publish a NEW template version → the published fingerprint drifts away from the approval
    const nv = await createTemplateVersion(h.db, owner, templateId, {
      body: "Contrat RÉVISÉ pour {{employee.first_name}} {{employee.last_name}}, poste {{employee.role_title}}, début {{employment.start_date}}.",
      renderer: "both",
      field_schema: [
        { field_key: "employee.first_name", source_path: "employee.first_name", required: true },
        { field_key: "employee.last_name", source_path: "employee.last_name", required: true },
        { field_key: "employee.role_title", source_path: "employee.role_title", required: true },
        { field_key: "employment.start_date", source_path: "employment.start_date", required: true },
      ],
    });
    await submitTemplateForReview(h.db, owner, nv.id); await approveTemplateVersion(h.db, owner, nv.id); await publishTemplateVersion(h.db, owner, nv.id);
    // finalize now refuses (fingerprint drift) and emits an invalidation event
    await expect(C.finalizeContract(h.db, owner, c.id)).rejects.toMatchObject({ code: "conflict" });
    const inval = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.approval_invalidated'`, [c.id]);
    expect(inval.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
