// Routes publiques du programme sur vraie base (PGlite) : candidature persistée réellement,
// flag fail-closed, honeypot neutre, clic → touch serveur + cookie signé.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { __setPartnerDbForTests, withService } from "../server/runtime";

let h: PartnerHarness;
const savedFlag = process.env.PARTNER_PROGRAM_ENABLED;

beforeAll(async () => {
  h = await createPartnerHarness();
  __setPartnerDbForTests(h.db);
  process.env.CLONESTORE_PP_COOKIE_SECRET = "test_pp_cookie_secret_0123456789";
});
afterAll(async () => { __setPartnerDbForTests(null); await h.close(); });
beforeEach(() => { process.env.PARTNER_PROGRAM_ENABLED = "true"; });
afterEach(() => {
  if (savedFlag === undefined) delete process.env.PARTNER_PROGRAM_ENABLED;
  else process.env.PARTNER_PROGRAM_ENABLED = savedFlag;
  __setPartnerDbForTests(h.db);
});

const applyReq = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/partners/apply", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });

const validBody = (email: string) => ({
  cabinetName: "Cabinet Test", firstName: "Léa", lastName: "Martin", email,
  country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true, website_hp: "",
});

async function countApplications(): Promise<number> {
  const r = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestore_pp_applications`));
  return Number(r.rows[0].n) || 0;
}

describe("POST /api/partners/apply — candidature réelle", () => {
  it("flag OFF → 503, aucune ligne", async () => {
    process.env.PARTNER_PROGRAM_ENABLED = "false";
    const before = await countApplications();
    const { POST } = await import("@/app/api/partners/apply/route");
    const res = await POST(applyReq(validBody("a@cabinet-a.fr")));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("partner_program_disabled");
    expect(await countApplications()).toBe(before);
  });

  it("candidature valide → 200 et une ligne persistée + email enfilé", async () => {
    const before = await countApplications();
    const { POST } = await import("@/app/api/partners/apply/route");
    const res = await POST(applyReq(validBody("b@cabinet-b.fr")));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(await countApplications()).toBe(before + 1);
    // Email « candidature reçue » enfilé dans l'outbox.
    const email = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_email_outbox where kind='application_received' and to_email='b@cabinet-b.fr'`));
    expect(email.rows).toHaveLength(1);
  });

  it("honeypot rempli → 200 neutre, AUCUNE ligne", async () => {
    const before = await countApplications();
    const { POST } = await import("@/app/api/partners/apply/route");
    const res = await POST(applyReq({ ...validBody("spam@x.fr"), website_hp: "http://spam" }));
    expect(res.status).toBe(200);
    expect(await countApplications()).toBe(before);
  });

  it("consentement manquant → 422", async () => {
    const { POST } = await import("@/app/api/partners/apply/route");
    const res = await POST(applyReq({ ...validBody("c@cabinet-c.fr"), consentPrivacy: false }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("consent_required");
  });

  it("email invalide → 422", async () => {
    const { POST } = await import("@/app/api/partners/apply/route");
    const res = await POST(applyReq({ ...validBody("pasunemail"), email: "pasunemail" }));
    expect(res.status).toBe(422);
  });
});

describe("GET /api/partners/click — touch serveur + cookie signé", () => {
  it("clic sur un cabinet actif → enregistre un touch et pose le cookie", async () => {
    // Cabinet actif avec slug connu.
    await withService(h.db, (tx) => tx.query(
      `insert into clonestore_pp_partners (email, email_normalized, display_name, country, public_slug, status)
       values ('k@cab.fr','k@cab.fr','Cabinet K','FR','cabinet-k','active')`,
    ));
    const { GET } = await import("@/app/api/partners/click/route");
    const res = await GET(new Request("http://localhost/api/partners/click?partner=cabinet-k", { headers: { "x-forwarded-for": "203.0.113.10" } }));
    expect([302, 307, 308]).toContain(res.status);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("cs_pp_ref=");
    const touches = await withService(h.db, (tx) => tx.query(`select 1 from clonestore_pp_referral_touches t join clonestore_pp_partners p on p.id=t.partner_id where p.public_slug='cabinet-k'`));
    expect(touches.rows).toHaveLength(1);
  });

  it("clic sur un slug inconnu → redirige sans cookie ni touch", async () => {
    const { GET } = await import("@/app/api/partners/click/route");
    const res = await GET(new Request("http://localhost/api/partners/click?partner=inexistant"));
    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
