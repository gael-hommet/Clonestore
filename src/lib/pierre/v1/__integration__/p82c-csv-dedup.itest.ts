// src/lib/pierre/v1/__integration__/p82c-csv-dedup.itest.ts
// PHASE 8.2-C correction — CSV dedup uses OR semantics (a row is a duplicate when
// ANY single configured key matches), with per-duplicate detail. Real Postgres.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { previewImport, commitImport } from "../employee-import";
import { createEmployee } from "../employees";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const HEADER = "prénom,nom,matricule,email pro,ref";
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

describe("CSV dedup — OR semantics", () => {
  it("same email, different matricule → duplicate matched on professional_email", async () => {
    const ctx = h.ctx("A");
    const pv = await previewImport(h.db, ctx, {
      csv: csv("Marc,Dubois,E001,marc@acme.test,R1", "Marc,Dupond,E002,marc@acme.test,R2"),
      dedup_keys: ["employee_number", "professional_email"],
    });
    expect(pv.valid_rows).toBe(1);
    expect(pv.duplicate_rows).toBe(1);
    const dupRow = pv.rows.find((r) => r.outcome === "duplicate")!;
    expect(dupRow.duplicate?.matched_key).toBe("professional_email");
    expect(dupRow.duplicate?.scope).toBe("internal");
    expect(dupRow.duplicate?.matched_value).toContain("***"); // email masked
  });

  it("same matricule, different email → duplicate matched on employee_number", async () => {
    const pv = await previewImport(h.db, h.ctx("A"), {
      csv: csv("Marc,Dubois,E007,a@acme.test,R1", "Luc,Martin,E007,b@acme.test,R2"),
      dedup_keys: ["employee_number", "professional_email"],
    });
    expect(pv.valid_rows).toBe(1);
    expect(pv.duplicate_rows).toBe(1);
    expect(pv.rows.find((r) => r.outcome === "duplicate")!.duplicate?.matched_key).toBe("employee_number");
  });

  it("same external_ref → duplicate when external_ref is a configured key", async () => {
    const pv = await previewImport(h.db, h.ctx("A"), {
      csv: csv("A,A,E010,a@acme.test,SAME", "B,B,E011,b@acme.test,SAME"),
      dedup_keys: ["employee_number", "professional_email", "external_ref"],
    });
    expect(pv.valid_rows).toBe(1);
    expect(pv.rows.find((r) => r.outcome === "duplicate")!.duplicate?.matched_key).toBe("external_ref");
  });

  it("existing DB duplicate is detected with existing_employee_id + accent/case-insensitive", async () => {
    const ctx = h.ctx("A");
    const e = await createEmployee(h.db, ctx, { first_name: "Hélène", last_name: "Émard", employee_number: "E100", professional_email: "Helene@Acme.test" } as never);
    const pv = await previewImport(h.db, ctx, {
      csv: csv("Helene,Emard,E100,helene@acme.test,RX"),
      dedup_keys: ["employee_number", "professional_email"],
    });
    expect(pv.duplicate_rows).toBe(1);
    const d = pv.rows[0].duplicate!;
    expect(d.scope).toBe("existing");
    expect(d.existing_employee_id).toBe(e.id);
    expect(d.matched_key).toBe("employee_number");
  });

  it("rows with no configured keys present are NOT duplicates (valid)", async () => {
    const pv = await previewImport(h.db, h.ctx("A"), {
      csv: csv("Anne,Sansref,,,", "Anne,Sansref,,,"), // no matricule/email/ref
      dedup_keys: ["employee_number", "professional_email", "external_ref"],
    });
    expect(pv.valid_rows).toBe(2);
    expect(pv.duplicate_rows).toBe(0);
  });

  it("custom key config: only external_ref → same matricule but different ref are both valid", async () => {
    const pv = await previewImport(h.db, h.ctx("A"), {
      csv: csv("A,A,E200,a@acme.test,R1", "B,B,E200,b@acme.test,R2"),
      dedup_keys: ["external_ref"],
    });
    expect(pv.valid_rows).toBe(2);
    expect(pv.duplicate_rows).toBe(0);
  });

  it("internal duplicate carries the first-seen row number; decision = skip", async () => {
    const pv = await previewImport(h.db, h.ctx("A"), {
      csv: csv("A,A,E300,x@acme.test,R1", "B,B,E300,y@acme.test,R2"),
      dedup_keys: ["employee_number"],
    });
    const d = pv.rows.find((r) => r.outcome === "duplicate")!.duplicate!;
    expect(d.first_seen_row).toBe(1);
    expect(d.decision).toBe("skip");
    expect(d.existing_employee_id).toBeNull();
  });
});

describe("CSV import — batch path (set-based, not per-row)", () => {
  it("commits a multi-row valid batch via set-based inserts and back-links rows", async () => {
    const ctx = h.ctx("A");
    const lines = Array.from({ length: 250 }, (_, i) => `P${i},N${i},E${i},u${i}@acme.test,R${i}`);
    const pv = await previewImport(h.db, ctx, { csv: csv(...lines), dedup_keys: ["employee_number", "professional_email"] });
    expect(pv.valid_rows).toBe(250);
    const committed = await commitImport(h.db, ctx, pv.batch_id);
    expect(committed.inserted_rows).toBe(250);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1`, [h.companyA]);
    expect(n.rows[0].n).toBe(250);
    // every inserted row is back-linked + has a status-history + import event
    const linked = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_import_rows where batch_id=$1 and outcome='inserted' and employee_id is not null`, [pv.batch_id]);
    expect(linked.rows[0].n).toBe(250);
    const sh = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_status_history where company_id=$1`, [h.companyA]);
    expect(sh.rows[0].n).toBeGreaterThanOrEqual(250);
  });
});
