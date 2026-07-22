// src/lib/pierre/v1/__tests__/request-context-authority-p20.test.ts
// P20.1 — request-context-authority: company/entity/legal-country resolution, fail-closed on
// ambiguity, never trusts client input, never defaults to France. PGlite (PIERRE_E2E_TEST_MODE=1),
// never a real/production database.

import { describe, it, expect, beforeAll } from "vitest";
import { resolveRequestContextAuthority } from "../request-context-authority";
import { getTestRuntimeDb } from "../test-runtime-db";
import { newUuid } from "../sql";

process.env.PIERRE_E2E_TEST_MODE = "1"; // getRuntimeDb → PGlite (fail-closed en production)

describe("P20.1 — resolveRequestContextAuthority", () => {
  let companyFR: string;
  let companyCH: string;
  let companyNoCountry: string;
  let companySuspended: string;
  let userSingleFR: string;
  let userSingleCH: string;
  let userNoCompany: string;
  let userAmbiguous: string;
  let userOnlySuspended: string;
  let userNoCountry: string;

  beforeAll(async () => {
    const db = await getTestRuntimeDb();
    companyFR = newUuid();
    companyCH = newUuid();
    companyNoCountry = newUuid();
    companySuspended = newUuid();
    userSingleFR = newUuid();
    userSingleCH = newUuid();
    userNoCompany = newUuid();
    userAmbiguous = newUuid();
    userOnlySuspended = newUuid();
    userNoCountry = newUuid();

    await db.query(
      `insert into pierre_rt_companies (id, name, registration_country) values ($1,'A-FR','FR'), ($2,'B-CH','CH'), ($3,'C-NoCountry',null), ($4,'D-Suspended','FR')`,
      [companyFR, companyCH, companyNoCountry, companySuspended],
    );

    const memberships: Array<[string, string, string]> = [
      [companyFR, userSingleFR, "single-FR"],
      [companyCH, userSingleCH, "single-CH"],
      [companyFR, userAmbiguous, "ambiguous-in-FR"],
      [companyCH, userAmbiguous, "ambiguous-in-CH"], // SAME user, a DIFFERENT company → genuine ambiguity
      [companySuspended, userOnlySuspended, "only-suspended"],
      [companyNoCountry, userNoCountry, "no-country"],
    ];
    for (const [companyId, userId] of memberships) {
      await db.query(
        `insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`,
        [newUuid(), companyId, userId],
      );
    }
    // The row for userOnlySuspended must be excluded via the COMPANY's own status, not the membership row.
    await db.query(`update pierre_rt_companies set status = 'suspended' where id = $1`, [companySuspended]);
  }, 120_000);

  it("1. France vérifiée → resolved, legal_country FR", async () => {
    const r = await resolveRequestContextAuthority(userSingleFR, "2026-07-21T00:00:00Z");
    expect(r.status).toBe("resolved");
    expect(r.company_id).toBe(companyFR);
    expect(r.legal_country).toBe("FR");
    expect(r.provenance).toBe("v1_membership+geo_resolver");
  });

  it("2. Suisse vérifiée → resolved, legal_country CH", async () => {
    const r = await resolveRequestContextAuthority(userSingleCH, "2026-07-21T00:00:00Z");
    expect(r.status).toBe("resolved");
    expect(r.legal_country).toBe("CH");
  });

  it("3. aucune société (utilisateur inconnu) → no_company, fail-closed", async () => {
    const r = await resolveRequestContextAuthority(userNoCompany, "2026-07-21T00:00:00Z");
    expect(r.status).toBe("no_company");
    expect(r.company_id).toBeNull();
    expect(r.legal_country).toBeNull();
  });

  it("4. plusieurs memberships actives ambiguës → ambiguous_company, aucune sélection implicite", async () => {
    const r = await resolveRequestContextAuthority(userAmbiguous, "2026-07-21T00:00:00Z");
    expect(r.status).toBe("ambiguous_company");
    expect(r.company_id).toBeNull();
  });

  it("5. société suspendue → traitée comme no_company (aucune société ACTIVE) — jamais un accès silencieux", async () => {
    const r = await resolveRequestContextAuthority(userOnlySuspended, "2026-07-21T00:00:00Z");
    expect(r.status).toBe("no_company");
  });

  it("6. société sans pays résolu → country_unresolved, jamais un repli France", async () => {
    const r = await resolveRequestContextAuthority(userNoCountry, "2026-07-21T00:00:00Z");
    expect(r.status).toBe("country_unresolved");
    expect(r.company_id).toBe(companyNoCountry);
    expect(r.legal_country).toBeNull();
  });

  it("7. le résultat ne dépend jamais d'une entrée client — la fonction ne prend aucun paramètre pays/société en entrée", () => {
    // Structural guarantee: the function signature itself only accepts (userId, nowIso) — verified by
    // TypeScript at compile time (any attempt to pass a client-supplied country/company would not compile).
    expect(resolveRequestContextAuthority.length).toBe(2);
  });
});
