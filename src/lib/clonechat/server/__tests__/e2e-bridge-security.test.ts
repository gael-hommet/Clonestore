// src/lib/clonechat/server/__tests__/e2e-bridge-security.test.ts
// C1.8 — SÉCURITÉ du pont d'identité e2e de CloneChat + garde-fou DB de production.
//
// Le pont permet d'AUTHENTIFIER CloneChat en test (pour prouver l'historique authentifié dans un
// vrai navigateur). Deux propriétés de sécurité doivent tenir SANS navigateur :
//   1. hors mode test / en production, le pont est INERTE (code mort) ;
//   2. en mode test, l'historique authentifié n'atteint JAMAIS une DB DISTANTE (jamais la PROD).

import { describe, it, expect, afterEach } from "vitest";
import { readE2EIdentityFromRequest, signE2EIdentity, isE2EModeEnabled } from "@/lib/pierre/v1/e2e-test-identity";
import { resolveClonechatDbUrl } from "@/lib/clonechat/durable/pg";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

function reqWithCookie(token: string): Request {
  return new Request("http://x/api/assistant/conversations", { headers: { cookie: `pierre_e2e_session=${encodeURIComponent(token)}` } });
}

describe("C1.8 — le pont e2e est FAIL-CLOSED (production = code mort)", () => {
  it("en mode test + secret, un cookie signé donne bien l'identité (le pont fonctionne)", () => {
    process.env.PIERRE_E2E_TEST_MODE = "1";
    process.env.NODE_ENV = "development";
    process.env.PIERRE_E2E_SECRET = "route-secret-1234";
    const token = signE2EIdentity({ user_id: "u-test", email: "t@e.com", email_verified: true });
    const id = readE2EIdentityFromRequest(reqWithCookie(token));
    expect(id?.user_id).toBe("u-test");
    expect(isE2EModeEnabled()).toBe(true);
  });

  it("EN PRODUCTION, le même cookie signé est IGNORÉ (le pont est inerte)", () => {
    // token forgé en mode test…
    process.env.PIERRE_E2E_TEST_MODE = "1";
    process.env.NODE_ENV = "development";
    process.env.PIERRE_E2E_SECRET = "route-secret-1234";
    const token = signE2EIdentity({ user_id: "u-attaquant", email: "a@e.com", email_verified: true });
    // …présenté en PRODUCTION.
    process.env.NODE_ENV = "production";
    expect(isE2EModeEnabled()).toBe(false);
    expect(readE2EIdentityFromRequest(reqWithCookie(token))).toBeNull();
  });

  it("sans PIERRE_E2E_TEST_MODE, le pont est inerte", () => {
    process.env.PIERRE_E2E_TEST_MODE = "0";
    process.env.NODE_ENV = "development";
    process.env.PIERRE_E2E_SECRET = "route-secret-1234";
    expect(readE2EIdentityFromRequest(reqWithCookie("x.y"))).toBeNull();
  });

  it("sans secret configuré, le pont est inerte", () => {
    process.env.PIERRE_E2E_TEST_MODE = "1";
    process.env.NODE_ENV = "development";
    delete process.env.PIERRE_E2E_SECRET;
    expect(readE2EIdentityFromRequest(reqWithCookie("x.y"))).toBeNull();
  });

  it("un cookie qui INJECTE une autorité (rôle/entreprise) voit cette autorité DÉPOUILLÉE", () => {
    process.env.PIERRE_E2E_TEST_MODE = "1";
    process.env.NODE_ENV = "development";
    process.env.PIERRE_E2E_SECRET = "route-secret-1234";
    // On forge un token dont le corps contient des champs d'autorité en plus.
    const forged = { user_id: "u1", email: "e@e.com", email_verified: true, role: "OWNER", company_id: "c-volee", entitlement: "active" };
    const token = signE2EIdentity(forged as never);
    const id = readE2EIdentityFromRequest(reqWithCookie(token)) as Record<string, unknown> | null;
    expect(id?.user_id).toBe("u1");
    // Seuls id + email vérifié survivent : aucune autorité ne peut être injectée par le cookie.
    expect(id).not.toHaveProperty("role");
    expect(id).not.toHaveProperty("company_id");
    expect(id).not.toHaveProperty("entitlement");
  });
});

describe("C1.8 — l'historique authentifié de TEST n'atteint JAMAIS une DB distante", () => {
  it("en mode test, une URL DISTANTE (Supabase/PROD) est REFUSÉE ⇒ repli in-memory", () => {
    process.env.PIERRE_E2E_TEST_MODE = "1";
    process.env.NODE_ENV = "development";
    delete process.env.CLONECHAT_DB_URL;
    process.env.DATABASE_URL = "postgresql://postgres:secret@db.zdoigpfkyhilpzcsrdmc.supabase.co:5432/postgres";
    expect(resolveClonechatDbUrl()).toBeNull(); // ← jamais la prod en test
  });

  it("en mode test, une URL LOCALE reste admissible (PGlite/Postgres local)", () => {
    process.env.PIERRE_E2E_TEST_MODE = "1";
    process.env.NODE_ENV = "development";
    process.env.CLONECHAT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:5432/clonechat_test";
    expect(resolveClonechatDbUrl()).toContain("127.0.0.1");
  });

  it("HORS mode test, la résolution d'URL est inchangée (aucune régression)", () => {
    process.env.PIERRE_E2E_TEST_MODE = "0";
    delete process.env.CLONECHAT_DB_URL;
    process.env.DATABASE_URL = "postgresql://postgres:secret@db.example.supabase.co:5432/postgres";
    expect(resolveClonechatDbUrl()).toContain("supabase.co");
  });

  it("aucune URL ⇒ in-memory, quel que soit le mode", () => {
    process.env.PIERRE_E2E_TEST_MODE = "1";
    delete process.env.CLONECHAT_DB_URL;
    process.env.DATABASE_URL = "";
    expect(resolveClonechatDbUrl()).toBeNull();
  });
});
