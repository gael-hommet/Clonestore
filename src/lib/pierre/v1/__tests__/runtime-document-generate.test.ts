import { describe, it, expect } from "vitest";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";
import {
  RUNTIME_ACTION_HANDLERS,
  buildRuntimeDocumentBody,
  type RuntimeActionContext,
} from "../runtime-action-handlers";
import { getRuntimeActionDefinition, validateRuntimeActionInput } from "../runtime-action-registry";

// ─────────────────────────────────────────────────────────────────────────────
// P22 continuation — the authoritative runtime can now PRODUCE a real document artifact.
// Previously the closed action registry had document.read but no document.generate, so every
// document-producing mission-pack step could only bind to mission.noop. This test drives the
// authoritative action interface (not createDocument directly) and asserts a governed, versioned
// document row + version row are actually persisted, linked to the mission and employee.
// A faithful in-memory SqlExecutor stands in for Postgres (no embedded PG needed).
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeInMemoryDb() {
  const documents: Row[] = [];
  const versions: Row[] = [];
  const links: Row[] = [];
  const auditLog: Row[] = [];

  const run = async (text: string, params: readonly unknown[] = []): Promise<{ rows: Row[] }> => {
    const t = text.trim();
    if (t.startsWith("select set_config")) return { rows: [] };

    if (t.startsWith("insert into pierre_rt_documents")) {
      // params: id, company_id, document_type, title, description, sensitivity, employee_id, site_id, contract_id, mission_id, task_id, created_by, search_text
      const doc: Row = {
        id: params[0], company_id: params[1], document_type: params[2], title: params[3],
        description: params[4], sensitivity: params[5], status: "draft",
        employee_id: params[6], site_id: params[7], contract_id: params[8], mission_id: params[9],
        task_id: params[10], created_by: params[11], current_version: 0, version: 0, deleted_at: null,
      };
      documents.push(doc);
      return { rows: [doc] };
    }
    if (t.startsWith("insert into pierre_rt_document_links")) {
      // Two forms: generic `values ($1,$2,$3,$4,$5)` (link_type=$4, target=$5) and the employee
      // convenience `values ($1,$2,$3,'employee',$4)` (link_type literal, target=$4=params[3]).
      if (t.includes("'employee'")) {
        links.push({ document_id: params[2], link_type: "employee", target_id: params[3] });
      } else {
        links.push({ document_id: params[2], link_type: params[3], target_id: params[4] });
      }
      return { rows: [] };
    }
    if (t.startsWith("insert into pierre_rt_document_access_log")) {
      auditLog.push({ document_id: params[2], action: params[5] });
      return { rows: [] };
    }
    if (t.startsWith("select * from pierre_rt_documents")) {
      const id = params[1];
      const doc = documents.find((d) => d.id === id);
      return { rows: doc ? [doc] : [] };
    }
    if (t.startsWith("update pierre_rt_document_versions")) {
      return { rows: [] };
    }
    if (t.startsWith("insert into pierre_rt_document_versions")) {
      // params: id, company_id, document_id, version_number, source_file_id, rendered_pdf_file_id, rendered_docx_file_id, content_hash, template_version_id, generation_context_hash, change_summary, created_by
      const ver: Row = {
        id: params[0], company_id: params[1], document_id: params[2], version_number: params[3],
        content_hash: params[7], generation_context_hash: params[9], change_summary: params[10],
        status: "draft", created_by: params[11],
      };
      versions.push(ver);
      return { rows: [ver] };
    }
    if (t.startsWith("update pierre_rt_documents")) {
      const id = params[1];
      const doc = documents.find((d) => d.id === id);
      if (doc) { doc.current_version = params[2]; doc.status = "draft"; }
      return { rows: [] };
    }
    return { rows: [] };
  };

  const db: SqlExecutor = {
    query: async <T = Row>(text: string, params?: readonly unknown[]) =>
      (await run(text, params ?? [])) as { rows: T[] },
    transaction: async <T>(fn: (tx: SqlExecutor) => Promise<T>) => fn(db),
  };

  return { db, documents, versions, links, auditLog };
}

function makeCtx(db: SqlExecutor, payload: Record<string, unknown>): RuntimeActionContext {
  const tenant: TenantContext = {
    company_id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    role_keys: ["OWNER"],
    permissions: ["document.write", "document.read", "document.sensitive.write", "document.sensitive.read"],
  } as unknown as TenantContext;
  return {
    appDb: db,
    tenant,
    companyId: tenant.company_id,
    missionId: "33333333-3333-3333-3333-333333333333",
    missionRunId: "44444444-4444-4444-4444-444444444444",
    stepRunId: "55555555-5555-5555-5555-555555555555",
    jobId: "66666666-6666-6666-6666-666666666666",
    idempotencyKey: "idem-1",
    payload,
    deps: {},
    assertLease: async () => {},
    checkpoint: async () => {},
  };
}

describe("document.generate — authoritative runtime action (P22 continuation)", () => {
  it("is a registered runtime action with input validation", () => {
    expect(getRuntimeActionDefinition("document.generate")).not.toBeNull();
    expect(validateRuntimeActionInput("document.generate", {}).ok).toBe(false);
    expect(
      validateRuntimeActionInput("document.generate", { document_type: "generic_hr_document", title: "T" }).ok,
    ).toBe(true);
  });

  it("persists a governed, versioned document artifact linked to mission + employee", async () => {
    const { db, documents, versions, links } = makeInMemoryDb();
    const handler = RUNTIME_ACTION_HANDLERS["document.generate"];
    const employeeId = "77777777-7777-7777-7777-777777777777";
    const ctx = makeCtx(db, {
      document_type: "work_certificate",
      title: "Certificat de travail — Marie Durant",
      employee_id: employeeId,
      content_text: "Nous certifions que Marie Durant a été employée en qualité de vendeuse.",
    });

    const result = await handler(ctx);

    expect(result.status).toBe("succeeded");
    expect(result.output?.kind).toBe("document");
    expect(result.output?.status).toBe("draft");
    expect(typeof result.output?.document_id).toBe("string");
    expect(typeof result.output?.version_id).toBe("string");
    expect(typeof result.output?.content_hash).toBe("string");

    // Real persistence: one document, one version, both tenant-scoped and mission/employee-linked.
    expect(documents).toHaveLength(1);
    expect(documents[0].mission_id).toBe(ctx.missionId);
    expect(documents[0].employee_id).toBe(employeeId);
    expect(documents[0].document_type).toBe("work_certificate");
    expect(versions).toHaveLength(1);
    expect(versions[0].document_id).toBe(documents[0].id);
    expect(versions[0].content_hash).toBe(result.output?.content_hash);
    // employee link row created.
    expect(links.some((l) => l.link_type === "employee" && l.target_id === employeeId)).toBe(true);
  });

  it("blocks (never fakes) an unknown document type — governed refusal", async () => {
    const { db, documents } = makeInMemoryDb();
    const handler = RUNTIME_ACTION_HANDLERS["document.generate"];
    const ctx = makeCtx(db, { document_type: "not_a_real_type", title: "X" });
    const result = await handler(ctx);
    expect(result.status).toBe("blocked");
    expect(result.blockerCode).toBe("document_generation_refused");
    expect(documents).toHaveLength(0); // nothing persisted on refusal
  });

  it("buildRuntimeDocumentBody prefers provided content and never returns blank", () => {
    expect(buildRuntimeDocumentBody({ document_type: "x", title: "T", content_text: "  hello  " })).toBe("hello");
    const scaffold = buildRuntimeDocumentBody({ document_type: "onboarding_pack", title: "Bienvenue", variables: { employee: "Marie" } });
    expect(scaffold.length).toBeGreaterThan(0);
    expect(scaffold).toContain("Bienvenue");
    expect(scaffold).toContain("Marie");
  });
});
