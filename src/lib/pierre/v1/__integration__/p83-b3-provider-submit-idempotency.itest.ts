// PHASE 8.3-B3.3 — submission is real, idempotent, and timeout-safe (no duplicate provider request).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const deps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });

describe("B3.3 provider submission + idempotency", () => {
  it("submitting twice returns the same provider request (idempotent, no second request)", async () => {
    const id = await readyForSignatureContract(h, owner, sd, emp);
    const a = await S.submitContractToSignatureProvider(h.db, owner, id, {}, deps());
    const b = await S.submitContractToSignatureProvider(h.db, owner, id, {}, deps());
    expect(b.idempotent).toBe(true);
    expect(b.provider_request_id).toBe(a.provider_request_id);
    const reqs = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_requests where company_id=$1 and provider_request_id is not null`, [h.companyA])).rows[0].n;
    expect(reqs).toBe(1);
  });

  it("a timeout AFTER provider creation is transparently recovered (no second provider request)", async () => {
    const id = await readyForSignatureContract(h, owner, sd, emp);
    provider.opts.timeoutAfterCreate = true; // the provider DID create the request; the response 'timed out'
    // the submission recovers the existing request by its idempotency key instead of re-creating it
    const res = await S.submitContractToSignatureProvider(h.db, owner, id, {}, deps());
    expect(res.provider_request_id).toBeTruthy();
    // R1.5 — the idempotency anchor is the deterministic external_id (Yousign external_id[eq]).
    const key = (await h.db.query<{ external_id: string }>(`select external_id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1`, [h.companyA])).rows[0].external_id;
    expect(key).toBeTruthy();
    const found = await provider.findRequestByIdempotencyKey(key);
    expect(found?.provider_request_id).toBe(res.provider_request_id); // exactly the one created during the 'timed out' call
  });

  it("submit is refused unless the contract is ready_for_signature", async () => {
    const c = await (await import("../contracts")).createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await expect(S.submitContractToSignatureProvider(h.db, owner, c.id, {}, deps())).rejects.toMatchObject({ code: "conflict" });
  });
});
