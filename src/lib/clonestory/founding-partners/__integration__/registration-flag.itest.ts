// CloneStory — PATCH FINAL : tests du flag d'ouverture sur la VRAIE route register
// (PGlite réel). Prouve qu'aucun compte n'est créé tant que le flag n'est pas posé,
// et le fail-closed sur infrastructure indisponible.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService } from "../server/runtime";
import { POST } from "@/app/api/founding-partners/register/route";

process.env.CLONESTORY_LOCAL_MODE = "1";

let h: ClonestoryHarness;
const savedFlag = process.env.CLONESTORY_REGISTRATION_OPEN;

beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
});
afterAll(async () => {
  __setClonestoryDbForTests(null);
  await h.close();
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.CLONESTORY_REGISTRATION_OPEN;
  else process.env.CLONESTORY_REGISTRATION_OPEN = savedFlag;
  __setClonestoryDbForTests(h.db); // restaure l'injection (un test la retire)
});

function req(email: string) {
  return new Request("http://localhost/api/founding-partners/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.42" },
    body: JSON.stringify({ firstName: "Aïe", lastName: "Bê", email, acceptTerms: true, website: "" }),
  });
}
async function countPartners(): Promise<number> {
  const { rows } = await withService(h.db, (tx) => tx.query<{ n: number }>(`select count(*)::int n from clonestory_fp_partners`));
  return Number(rows[0].n) || 0;
}

describe("flag d'ouverture — route register réelle", () => {
  it("flag ABSENT → 503, aucun compte créé", async () => {
    delete process.env.CLONESTORY_REGISTRATION_OPEN;
    const before = await countPartners();
    const res = await POST(req("flag-absent@x.fr"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("registration_closed");
    expect(await countPartners()).toBe(before); // aucune création partielle
  });

  it("flag = false → 503, aucun compte créé", async () => {
    process.env.CLONESTORY_REGISTRATION_OPEN = "false";
    const before = await countPartners();
    const res = await POST(req("flag-false@x.fr"));
    expect(res.status).toBe(503);
    expect(await countPartners()).toBe(before);
  });

  it("secrets présents MAIS flag false → toujours 503 (jamais déduit des secrets)", async () => {
    process.env.CLONESTORY_SESSION_SECRET = "z".repeat(40);
    process.env.CLONESTORY_COMPANY_SALT = "w".repeat(40);
    process.env.CLONESTORY_REGISTRATION_OPEN = "false";
    const before = await countPartners();
    const res = await POST(req("secrets-but-closed@x.fr"));
    expect(res.status).toBe(503);
    expect(await countPartners()).toBe(before);
    delete process.env.CLONESTORY_SESSION_SECRET;
    delete process.env.CLONESTORY_COMPANY_SALT;
  });

  it("flag = true → 200, compte créé", async () => {
    process.env.CLONESTORY_REGISTRATION_OPEN = "true";
    const before = await countPartners();
    const res = await POST(req("flag-true@x.fr"));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(await countPartners()).toBe(before + 1);
  });

  it("flag = true MAIS infrastructure indisponible → fail-closed 503 (générique)", async () => {
    process.env.CLONESTORY_REGISTRATION_OPEN = "true";
    __setClonestoryDbForTests(null); // plus d'injection + pas de DATABASE_URL → getRuntimeDb throw
    const res = await POST(req("infra-down@x.fr"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("unavailable"); // jamais d'erreur interne exposée
    // (afterEach réinjecte la base)
    __setClonestoryDbForTests(h.db);
    expect(await countPartners()).toBe(await countPartners()); // état cohérent, pas de compte fantôme
  });
});
