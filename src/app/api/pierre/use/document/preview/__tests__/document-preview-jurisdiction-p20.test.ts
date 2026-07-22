// src/app/api/pierre/use/document/preview/__tests__/document-preview-jurisdiction-p20.test.ts
// P20.1 (D11 fix) — /api/pierre/use/document/preview must never render a jurisdictional document
// without a server-resolved, verified legal country. Real PGlite for company/membership/country
// (PIERRE_E2E_TEST_MODE=1), mocked Supabase auth/access only (the boundary this route cannot avoid).

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.PIERRE_E2E_TEST_MODE = "1"; // getRuntimeDb → PGlite (fail-closed en production)
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"; // dummy — createClient is mocked below
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-service-role-key-for-tests";

let currentMockUserId = "user-none";

// Table-aware mock: `orders` (hasPierreAccess, 3 chained .eq()) always grants access ;
// `pierre_company_memory` (loadCompanyMemory, 2 chained .eq()) returns no legacy memory (safe — the
// jurisdiction gate must work correctly with or without legacy memory present).
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: currentMockUserId } }, error: null }),
    },
    from: (table: string) => {
      const maybeSingle = async () =>
        table === "orders" ? { data: { id: "order-1" }, error: null } : { data: null, error: null };
      const chain = { eq: () => chain, limit: () => ({ maybeSingle }) };
      return { select: () => chain };
    },
  }),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/pierre/use/document/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}

let companyFR: string;
let companyCH: string;
let companyNoCountry: string;
let userFR: string;
let userCH: string;
let userNoCompany: string;
let userAmbiguous: string;
let userNoCountry: string;

beforeAll(async () => {
  const { getTestRuntimeDb } = await import("../../../../../../../lib/pierre/v1/test-runtime-db");
  const { newUuid } = await import("../../../../../../../lib/pierre/v1/sql");
  const db = await getTestRuntimeDb();

  companyFR = newUuid();
  companyCH = newUuid();
  companyNoCountry = newUuid();
  userFR = newUuid();
  userCH = newUuid();
  userNoCompany = newUuid();
  userAmbiguous = newUuid();
  userNoCountry = newUuid();

  await db.query(
    `insert into pierre_rt_companies (id, name, registration_country) values ($1,'FR-Co','FR'), ($2,'CH-Co','CH'), ($3,'NoCountry-Co',null)`,
    [companyFR, companyCH, companyNoCountry],
  );
  const memberships: Array<[string, string]> = [
    [companyFR, userFR],
    [companyCH, userCH],
    [companyFR, userAmbiguous],
    [companyCH, userAmbiguous],
    [companyNoCountry, userNoCountry],
  ];
  for (const [companyId, userId] of memberships) {
    await db.query(
      `insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`,
      [newUuid(), companyId, userId],
    );
  }
}, 120_000);

describe("P20.1 — POST /use/document/preview jurisdiction gate (D11)", () => {
  it("1. FR vérifiée, document non-jurisdictionnel (note) → 200, jamais bloqué", async () => {
    currentMockUserId = userFR;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "note", instructions: "synthèse" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.jurisdiction.jurisdictional).toBe(false);
  });

  it("2. FR vérifiée, contrat de travail (jurisdictionnel, AVAILABLE_VERIFIED) → 200, finalization_allowed", async () => {
    currentMockUserId = userFR;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "contrat de travail" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.jurisdiction.jurisdictional).toBe(true);
    expect(json.jurisdiction.country).toBe("FR");
  });

  it("3. Suisse (CH), contrat de travail (DISABLED_UNTIL_VERIFIED) → 422 bloqué, JAMAIS le modèle FR", async () => {
    currentMockUserId = userCH;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "contrat de travail" }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("DOCUMENT_JURISDICTION_BLOCKED");
  });

  it("4. pays client falsifié (body.country='FR') sur une société CH → toujours bloqué (le champ client est ignoré, jamais lu)", async () => {
    currentMockUserId = userCH;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "contrat de travail", country: "FR", legal_country: "FR" }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.code).toBe("DOCUMENT_JURISDICTION_BLOCKED");
  });

  it("5. société introuvable (aucun membership) → 422 DOCUMENT_CONTEXT_NO_COMPANY, aucun rendu", async () => {
    currentMockUserId = userNoCompany;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "note" }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.code).toBe("DOCUMENT_CONTEXT_NO_COMPANY");
  });

  it("6. membership inter-tenant ambigu (2 sociétés actives) → 409 DOCUMENT_CONTEXT_AMBIGUOUS_COMPANY, aucune sélection implicite", async () => {
    currentMockUserId = userAmbiguous;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "note" }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("DOCUMENT_CONTEXT_AMBIGUOUS_COMPANY");
  });

  it("7. pays absent (société sans registration_country) → 422 DOCUMENT_CONTEXT_COUNTRY_UNRESOLVED, jamais un repli France", async () => {
    currentMockUserId = userNoCountry;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ doc_type: "contrat de travail" }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.code).toBe("DOCUMENT_CONTEXT_COUNTRY_UNRESOLVED");
  });
});
