// PHASE 8.4-R1.10 — secure-link resolution. A valid link resolves the object in-tenant; a tenant
// mismatch, a recipient mismatch, an expired token, an unknown object type, or a missing object are
// each refused (fail-closed). The token never exposes an object key — only an app-relative view path.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedDocument } from "./p84-helpers";
import { createSecureLink, SecureLinkError } from "../communication-secure-links";
import { resolveSecureLinkAccess } from "../communication-secure-access";

let h: Harness; let owner: TenantContext; let doc: string;
const SECRET = "test-link-secret";
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); doc = await seedDocument(h, owner); });
afterEach(async () => { await h.close(); });

function link(opts: { object_type?: string; object_id?: string; recipient?: string | null; ttl?: number; now?: number } = {}) {
  return createSecureLink({ company_id: h.companyA, object_type: opts.object_type ?? "document", object_id: opts.object_id ?? doc, recipient_user_id: opts.recipient === undefined ? h.userA : opts.recipient, secret: SECRET, ttl_seconds: opts.ttl, now_seconds: opts.now });
}

describe("R1.10 secure-link access resolution", () => {
  it("a valid link for the recipient resolves the object (no object key exposed)", async () => {
    const { token } = link();
    const r = await resolveSecureLinkAccess(h.db, { token, secret: SECRET, sessionUserId: h.userA, sessionCompanyId: h.companyA });
    expect(r.object_type).toBe("document");
    expect(r.object_id).toBe(doc);
    expect(r.view_path).toContain("/agents/pierre/use");
    expect(JSON.stringify(r)).not.toMatch(/object_key|bucket|storage/i);
  });

  it("a tenant mismatch is refused", async () => {
    const { token } = link();
    await expect(resolveSecureLinkAccess(h.db, { token, secret: SECRET, sessionUserId: h.userA, sessionCompanyId: h.companyB })).rejects.toMatchObject({ code: "tenant_mismatch" });
  });

  it("a recipient mismatch is refused", async () => {
    const { token } = link({ recipient: h.userA });
    await expect(resolveSecureLinkAccess(h.db, { token, secret: SECRET, sessionUserId: h.userB, sessionCompanyId: h.companyA })).rejects.toBeInstanceOf(SecureLinkError);
  });

  it("an expired token is refused", async () => {
    const { token } = link({ now: 1000, ttl: 60 });
    await expect(resolveSecureLinkAccess(h.db, { token, secret: SECRET, sessionUserId: h.userA, sessionCompanyId: h.companyA, nowSeconds: 100000 })).rejects.toMatchObject({ code: "expired" });
  });

  it("an unauthenticated session is refused", async () => {
    const { token } = link();
    await expect(resolveSecureLinkAccess(h.db, { token, secret: SECRET, sessionUserId: null, sessionCompanyId: h.companyA })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("a non document/template object type is refused (claim consistency)", async () => {
    const { token } = link({ object_type: "contract" });
    await expect(resolveSecureLinkAccess(h.db, { token, secret: SECRET, sessionUserId: h.userA, sessionCompanyId: h.companyA })).rejects.toMatchObject({ code: "bad_object_type" });
  });
});
