// PHASE 8.3-B3-R2.4 — the signature-event worker claim is bound to the SESSION tenant. The
// SECURITY DEFINER function derives the tenant from app.current_company (never a free p_company):
// an unset session is refused, a mismatched p_company is refused, and a worker can never claim
// another tenant's events.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

// seed a pending signature event for a tenant (bypassing the app grant — harness is superuser)
async function seedEvent(company: string): Promise<string> {
  const doc = newUuid(), ver = newUuid(), req = newUuid(), evt = newUuid();
  await h.pg.query(`insert into pierre_rt_documents(id,company_id,document_type,title) values($1,$2,'employment_contract','T')`, [doc, company]);
  await h.pg.query(`insert into pierre_rt_document_versions(id,company_id,document_id,version_number) values($1,$2,$3,1)`, [ver, company, doc]);
  await h.pg.query(`insert into pierre_rt_signature_requests(id,company_id,document_id,document_version_id,provider,provider_request_id,status,idempotency_key) values($1,$2,$3,$4,'fake_provider',$5,'submitted',$6)`, [req, company, doc, ver, "p-" + req.slice(0, 6), newUuid()]);
  await h.pg.query(`insert into pierre_rt_signature_events(id,company_id,signature_request_id,event_type,provider_event_id,application_status,occurred_at) values($1,$2,$3,'request.completed',$4,'pending',now())`, [evt, company, req, "e-" + evt.slice(0, 6)]);
  return evt;
}
async function claimAs(sessionCompany: string | null, pCompany: string): Promise<{ ok: boolean; ids: string[]; err?: string }> {
  try {
    return await h.db.transaction(async (tx) => {
      if (sessionCompany) await tx.query(`select set_config('app.current_company', $1, true)`, [sessionCompany]);
      const r = await tx.query<{ id: string }>(`select id from pierre_rt_claim_signature_events($1,$2,$3,$4)`, [pCompany, 10, "w", 60]);
      return { ok: true, ids: r.rows.map((x) => x.id) };
    });
  } catch (e) { return { ok: false, ids: [], err: (e as Error).message }; }
}

describe("B3-R2.4 worker tenant binding (signature events)", () => {
  it("an unset session tenant is REFUSED", async () => {
    await seedEvent(h.companyA);
    const r = await claimAs(null, h.companyA);
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/tenant not bound/i);
  });
  it("a p_company different from the session tenant is REFUSED", async () => {
    await seedEvent(h.companyA);
    const r = await claimAs(h.companyA, h.companyB); // session A, asks for B
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/tenant mismatch/i);
  });
  it("a worker bound to tenant A never claims tenant B's events", async () => {
    const evtA = await seedEvent(h.companyA);
    await seedEvent(h.companyB);
    const a = await claimAs(h.companyA, h.companyA);
    expect(a.ok).toBe(true);
    expect(a.ids).toEqual([evtA]); // only A's event, never B's
  });
  it("two workers on the same tenant get DISJOINT claims (lease held)", async () => {
    await seedEvent(h.companyA);
    const w1 = await claimAs(h.companyA, h.companyA);
    const w2 = await claimAs(h.companyA, h.companyA);
    expect(w1.ids.length).toBe(1);
    expect(w2.ids.length).toBe(0); // w1 holds the lease
  });
});
