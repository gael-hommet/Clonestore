import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks des lectures P8 (aucun vrai runtime) — on teste la LOGIQUE fail-closed.
const getRuntimeDb = vi.fn();
const listCompaniesForUser = vi.fn();
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: () => getRuntimeDb() }));
vi.mock("@/lib/pierre/v1/members", () => ({ listCompaniesForUser: (db: unknown, u: string) => listCompaniesForUser(db, u) }));

import { resolveCloneChatTenant, resolveCloneChatCompany, userScopedTenant } from "../company";

// db factice : pref + sites contrôlés par test.
function fakeDb(pref: string | null, sites: string[] = []) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("user_company_prefs")) return { rows: pref ? [{ last_company_id: pref }] : [], rowCount: pref ? 1 : 0 };
      if (sql.includes("member_sites")) return { rows: sites.map((s) => ({ site_id: s })), rowCount: sites.length };
      return { rows: [], rowCount: 0 };
    }),
  };
}
const CA = "11111111-1111-4111-8111-111111111111";
const CB = "22222222-2222-4222-8222-222222222222";

beforeEach(() => { getRuntimeDb.mockReset(); listCompaniesForUser.mockReset(); delete process.env.CLONECHAT_ALLOW_USER_TENANT_FALLBACK; });

describe("P9.4.2 §1 — company resolution FAIL-CLOSED", () => {
  it("1 membership actif → entreprise réelle + rôle + sites", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null, ["site-1"]));
    listCompaniesForUser.mockResolvedValue([{ id: CA, name: "Acme", role: "owner", status: "active", member_status: "active" }]);
    const r = await resolveCloneChatTenant("u1");
    expect(r).toMatchObject({ ok: true, companyId: CA, role: "owner", real: true });
    if (r.ok) expect(r.siteIds).toEqual(["site-1"]);
  });

  it("aucun membership → MEMBERSHIP_REQUIRED (fail-closed, pas de fausse entreprise)", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([]);
    expect(await resolveCloneChatTenant("u1")).toEqual({ ok: false, code: "MEMBERSHIP_REQUIRED" });
  });

  it("membership suspendu (aucun actif) → MEMBERSHIP_SUSPENDED", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([{ id: CA, name: "Acme", role: "member", status: "active", member_status: "suspended" }]);
    expect(await resolveCloneChatTenant("u1")).toEqual({ ok: false, code: "MEMBERSHIP_SUSPENDED" });
  });

  it("entreprise suspendue (santé) → aucun actif → MEMBERSHIP_SUSPENDED", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([{ id: CA, name: "Acme", role: "owner", status: "suspended", member_status: "active" }]);
    expect(await resolveCloneChatTenant("u1")).toEqual({ ok: false, code: "MEMBERSHIP_SUSPENDED" });
  });

  it("plusieurs entreprises actives, PAS de préférence → COMPANY_SELECTION_REQUIRED (jamais arbitraire)", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([
      { id: CA, name: "Acme", role: "owner", status: "active", member_status: "active" },
      { id: CB, name: "Beta", role: "member", status: "active", member_status: "active" },
    ]);
    const r = await resolveCloneChatTenant("u1");
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.code).toBe("COMPANY_SELECTION_REQUIRED"); expect(r.companies?.map((c) => c.id).sort()).toEqual([CA, CB].sort()); }
  });

  it("plusieurs entreprises + préférence valide → l'entreprise préférée (déterministe)", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(CB));
    listCompaniesForUser.mockResolvedValue([
      { id: CA, name: "Acme", role: "owner", status: "active", member_status: "active" },
      { id: CB, name: "Beta", role: "member", status: "active", member_status: "active" },
    ]);
    const r = await resolveCloneChatTenant("u1");
    expect(r).toMatchObject({ ok: true, companyId: CB, role: "member" });
  });

  it("panne runtime (getRuntimeDb throw) → COMPANY_UNAVAILABLE (fail-closed, PAS de continuation)", async () => {
    getRuntimeDb.mockRejectedValue(new Error("db down"));
    expect(await resolveCloneChatTenant("u1")).toEqual({ ok: false, code: "COMPANY_UNAVAILABLE" });
  });

  it("erreur de requête membership → COMPANY_UNAVAILABLE", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockRejectedValue(new Error("query failed"));
    expect(await resolveCloneChatTenant("u1")).toEqual({ ok: false, code: "COMPANY_UNAVAILABLE" });
  });
});

describe("P9.4.2 §1 — repli par-utilisateur SEULEMENT sous flag explicite", () => {
  it("sans flag : MEMBERSHIP_REQUIRED remonte (pas de repli)", async () => {
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([]);
    expect(await resolveCloneChatCompany("u9")).toEqual({ ok: false, code: "MEMBERSHIP_REQUIRED" });
  });
  it("avec flag : MEMBERSHIP_REQUIRED → repli u:<id> (real=false)", async () => {
    process.env.CLONECHAT_ALLOW_USER_TENANT_FALLBACK = "1";
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([]);
    const r = await resolveCloneChatCompany("u9");
    expect(r).toMatchObject({ ok: true, companyId: userScopedTenant("u9"), real: false });
  });
  it("avec flag : une PANNE DB reste fail-closed (jamais de repli sur erreur DB)", async () => {
    process.env.CLONECHAT_ALLOW_USER_TENANT_FALLBACK = "1";
    getRuntimeDb.mockRejectedValue(new Error("db down"));
    expect(await resolveCloneChatCompany("u9")).toEqual({ ok: false, code: "COMPANY_UNAVAILABLE" });
  });
  it("avec flag : COMPANY_SELECTION_REQUIRED ne retombe JAMAIS (choix requis)", async () => {
    process.env.CLONECHAT_ALLOW_USER_TENANT_FALLBACK = "1";
    getRuntimeDb.mockResolvedValue(fakeDb(null));
    listCompaniesForUser.mockResolvedValue([
      { id: CA, name: "Acme", role: "owner", status: "active", member_status: "active" },
      { id: CB, name: "Beta", role: "member", status: "active", member_status: "active" },
    ]);
    expect((await resolveCloneChatCompany("u9")).ok).toBe(false);
  });
});
