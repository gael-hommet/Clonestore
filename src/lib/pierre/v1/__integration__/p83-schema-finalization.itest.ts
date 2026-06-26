// src/lib/pierre/v1/__integration__/p83-schema-finalization.itest.ts
// PHASE 8.3-B2 §1/§4 — webhook ingress isolation + tenant-safe composite FK matrix
// (same-tenant accepted, cross-tenant refused, unknown UUID refused) + delete semantics.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { withTenantTransaction } from "../tenant-tx";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const q = (sql: string, p: unknown[] = []) => h.db.query(sql, p);
async function id(sql: string, p: unknown[]): Promise<string> { return (await q(sql, p) as { rows: { id: string }[] }).rows[0].id; }
const mkEmployee = (co: string) => id(`insert into pierre_rt_employees (id,company_id,first_name,last_name,search_text) values ($1,$2,'a','b','a b') returning id`, [newUuid(), co]);
const mkSite = (co: string) => id(`insert into pierre_rt_sites (id,company_id,name) values ($1,$2,'S') returning id`, [newUuid(), co]);
const mkContract = (co: string, emp: string) => id(`insert into pierre_rt_employee_contracts (id,company_id,employee_id,contract_type) values ($1,$2,$3,'CDI_FULL_TIME') returning id`, [newUuid(), co, emp]);
const mkMission = (co: string) => id(`insert into pierre_rt_missions (id,company_id,requester_user_id,instruction,correlation_id,request_id,idempotency_key) values ($1,$2,$3,'x',$4,$5,$6) returning id`, [newUuid(), co, newUuid(), newUuid(), newUuid(), `k-${newUuid()}`]);
const mkFile = (co: string) => id(`insert into pierre_rt_files (id,company_id,bucket,object_key,upload_status,scan_status) values ($1,$2,'b',$3,'clean','clean') returning id`, [newUuid(), co, `k/${newUuid()}`]);
const mkDoc = (co: string, cols: Record<string, string> = {}) => {
  const keys = Object.keys(cols); const extra = keys.map((k) => `,${k}`).join(""); const ph = keys.map((_, i) => `,$${i + 3}`).join("");
  return id(`insert into pierre_rt_documents (id,company_id,document_type,title${extra}) values ($1,$2,'work_certificate','T'${ph}) returning id`, [newUuid(), co, ...keys.map((k) => cols[k])]);
};
const mkVersion = (co: string, doc: string, n: number, cols: Record<string, string> = {}) => {
  const keys = Object.keys(cols); const extra = keys.map((k) => `,${k}`).join(""); const ph = keys.map((_, i) => `,$${i + 5}`).join("");
  return id(`insert into pierre_rt_document_versions (id,company_id,document_id,version_number${extra}) values ($1,$2,$3,$4${ph}) returning id`, [newUuid(), co, doc, n, ...keys.map((k) => cols[k])]);
};
const mkTemplate = (co: string) => id(`insert into pierre_rt_document_templates (id,company_id,key,name,document_type) values ($1,$2,$3,'N','work_certificate') returning id`, [newUuid(), co, `tpl-${newUuid()}`]);
const mkTplVersion = (co: string, tpl: string) => id(`insert into pierre_rt_document_template_versions (id,company_id,template_id,version_number) values ($1,$2,$3,1) returning id`, [newUuid(), co, tpl]);
const mkSigReq = (co: string, doc: string, ver: string) => id(`insert into pierre_rt_signature_requests (id,company_id,document_id,document_version_id) values ($1,$2,$3,$4) returning id`, [newUuid(), co, doc, ver]);

const A = () => h.companyA; const B = () => h.companyB;
const reject = (fn: () => Promise<unknown>) => expect(fn()).rejects.toThrow();

// ── §1 webhook ingress ───────────────────────────────────────────────────────
describe("§1 webhook ingress isolation", () => {
  async function asRole<T>(role: string, fn: (tx: { query: (s: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<T>): Promise<T> {
    return h.pg.transaction(async (tx) => { await tx.exec(`set local role ${role}`); return fn({ query: async (s, p) => { const r = await tx.query(s, p ? [...p] : undefined); return { rows: r.rows as unknown[] }; } }); }) as Promise<T>;
  }
  const evtRow = () => [newUuid(), `evt-${newUuid()}`];

  it("pierre_rt_app cannot SELECT / INSERT / UPDATE / DELETE the webhook table", async () => {
    await reject(() => asRole("pierre_rt_app", (tx) => tx.query(`select * from pierre_rt_signature_webhooks`)));
    await reject(() => asRole("pierre_rt_app", (tx) => tx.query(`insert into pierre_rt_signature_webhooks (id,provider,provider_event_id) values ($1,'p',$2)`, evtRow())));
    await reject(() => asRole("pierre_rt_app", (tx) => tx.query(`update pierre_rt_signature_webhooks set status='x'`)));
    await reject(() => asRole("pierre_rt_app", (tx) => tx.query(`delete from pierre_rt_signature_webhooks`)));
  });

  it("pierre_rt_webhook_ingress can SELECT but must use the governed function to write (B2F)", async () => {
    // B2F §3 — the ingress role no longer has raw INSERT/UPDATE/DELETE: the only write path is
    // the governed SECURITY DEFINER function. Raw writes are denied; the function is allowed.
    const [, eid] = evtRow();
    await reject(() => asRole("pierre_rt_webhook_ingress", (tx) => tx.query(`insert into pierre_rt_signature_webhooks (id,provider,provider_event_id,status) values ($1,'local_sandbox',$2,'received')`, [newUuid(), eid])));
    await reject(() => asRole("pierre_rt_webhook_ingress", (tx) => tx.query(`update pierre_rt_signature_webhooks set status='processed'`)));
    await reject(() => asRole("pierre_rt_webhook_ingress", (tx) => tx.query(`delete from pierre_rt_signature_webhooks`)));
    // governed function write succeeds, and the row is then SELECT-able by the ingress role
    await asRole("pierre_rt_webhook_ingress", (tx) => tx.query(`select pierre_rt_ingest_signature_webhook('local_sandbox',$1,'signature.completed','h',10,null,null,true,null)`, [eid]));
    const sel = await asRole("pierre_rt_webhook_ingress", (tx) => tx.query(`select status from pierre_rt_signature_webhooks where provider_event_id=$1`, [eid]));
    expect((sel.rows[0] as { status: string }).status).toBe("received");
  });

  it("no tenant can see webhook rows; resolution is by (provider, provider_request_id) server-side", async () => {
    const [rid, eid] = evtRow();
    await h.db.query(`insert into pierre_rt_signature_webhooks (id,provider,provider_event_id,status) values ($1,'local_sandbox',$2,'received')`, [rid, eid]);
    await reject(() => withTenantTransaction(h.db, { company_id: A(), user_id: "u" }, (tx) => tx.query(`select * from pierre_rt_signature_webhooks`)));
    await reject(() => withTenantTransaction(h.db, { company_id: B(), user_id: "u" }, (tx) => tx.query(`select * from pierre_rt_signature_webhooks`)));
    // service-role resolution path (the only legitimate reader)
    const svc = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_webhooks where provider='local_sandbox' and provider_event_id=$1`, [eid]);
    expect(svc.rows[0].n).toBe(1);
  });
});

// ── §4 tenant-safe reference matrix ──────────────────────────────────────────
describe("§4 tenant-safe composite foreign keys", () => {
  it("document → employee/site/contract/mission: cross-tenant + unknown refused, same-tenant accepted", async () => {
    const empB = await mkEmployee(B()); const siteB = await mkSite(B());
    const empA = await mkEmployee(A()); const contractB = await mkContract(B(), empB); const missionB = await mkMission(B());
    await reject(() => mkDoc(A(), { employee_id: empB }));
    await reject(() => mkDoc(A(), { site_id: siteB }));
    await reject(() => mkDoc(A(), { contract_id: contractB }));
    await reject(() => mkDoc(A(), { mission_id: missionB }));
    await reject(() => mkDoc(A(), { employee_id: newUuid() })); // unknown uuid
    await expect(mkDoc(A(), { employee_id: empA })).resolves.toBeTruthy(); // same-tenant ok
  });

  it("document_version → document/files/template_version: cross-tenant refused", async () => {
    const docA = await mkDoc(A()); const docB = await mkDoc(B());
    const fileB = await mkFile(B()); const tplB = await mkTplVersion(B(), await mkTemplate(B()));
    await reject(() => mkVersion(A(), docB, 1)); // version in A pointing at B's document
    await reject(() => mkVersion(A(), docA, 1, { source_file_id: fileB }));
    await reject(() => mkVersion(A(), docA, 1, { rendered_pdf_file_id: fileB }));
    await reject(() => mkVersion(A(), docA, 1, { template_version_id: tplB }));
    const fileA = await mkFile(A());
    await expect(mkVersion(A(), docA, 1, { source_file_id: fileA })).resolves.toBeTruthy();
  });

  it("signature request/recipient + contract_version: cross-tenant refused", async () => {
    const docA = await mkDoc(A()); const verA = await mkVersion(A(), docA, 1);
    const docB = await mkDoc(B()); const verB = await mkVersion(B(), docB, 1);
    await reject(() => mkSigReq(A(), docB, verA)); // document of B
    await reject(() => mkSigReq(A(), docA, verB)); // version of B
    const reqA = await mkSigReq(A(), docA, verA);
    const reqB = await mkSigReq(B(), docB, verB);
    await reject(() => q(`insert into pierre_rt_signature_recipients (id,company_id,signature_request_id,name,email) values ($1,$2,$3,'n','e@x')`, [newUuid(), A(), reqB]));
    await expect(q(`insert into pierre_rt_signature_recipients (id,company_id,signature_request_id,name,email) values ($1,$2,$3,'n','e@x')`, [newUuid(), A(), reqA])).resolves.toBeTruthy();
    // contract_version → document_version (RESTRICT) cross-tenant
    const empA = await mkEmployee(A()); const cA = await mkContract(A(), empA);
    await reject(() => q(`insert into pierre_rt_employee_contract_versions (id,company_id,contract_id,version,document_version_id) values ($1,$2,$3,1,$4)`, [newUuid(), A(), cA, verB]));
  });
});

// ── §2 delete semantics ──────────────────────────────────────────────────────
describe("§2 delete semantics", () => {
  it("document → version CASCADE; version → file RESTRICT; document → employee NO ACTION", async () => {
    const empA = await mkEmployee(A());
    const doc = await mkDoc(A(), { employee_id: empA });
    const file = await mkFile(A());
    const ver = await mkVersion(A(), doc, 1, { source_file_id: file });
    void ver;
    // sanity: the reference is actually set + the constraint is RESTRICT
    const chk = await h.db.query<{ source_file_id: string | null }>(`select source_file_id from pierre_rt_document_versions where id=$1`, [ver]);
    expect(chk.rows[0].source_file_id).toBe(file);
    const con = await h.db.query<{ confdeltype: string }>(`select confdeltype from pg_constraint where conname='fk_dv_srcfile_ct'`);
    expect(con.rows[0]?.confdeltype).toBe("r"); // restrict
    // version → file is RESTRICT: deleting the referenced file is blocked
    await reject(() => q(`delete from pierre_rt_files where id=$1`, [file]));
    // document → employee is NO ACTION: deleting the employee referenced by a document is blocked
    await reject(() => q(`delete from pierre_rt_employees where id=$1`, [empA]));
    // document → version is CASCADE: deleting the document removes its versions
    await q(`delete from pierre_rt_documents where id=$1`, [doc]);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_versions where document_id=$1`, [doc]);
    expect(n.rows[0].n).toBe(0);
  });
});
