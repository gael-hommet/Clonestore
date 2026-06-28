// PHASE 8.4.9 — secure links are server-generated, signed, short-lived, tenant-bound (and
// recipient-bound when set). A tampered or expired link is refused; a link signed by one tenant's
// claims cannot be re-used to assert another tenant.
import { describe, it, expect } from "vitest";
import { createSecureLink, verifySecureLink, SecureLinkError } from "../communication-secure-links";

const SECRET = "test-secure-link-secret";

describe("P8.4.9 secure links", () => {
  it("a freshly created link verifies and carries the tenant + object claims", () => {
    const { token, path } = createSecureLink({ company_id: "co_a", object_type: "document", object_id: "doc_1", recipient_user_id: "user_1", secret: SECRET, now_seconds: 1000 });
    expect(path).toContain("/secure/");
    const claims = verifySecureLink(token, SECRET, 1010);
    expect(claims.c).toBe("co_a"); expect(claims.ot).toBe("document"); expect(claims.oid).toBe("doc_1"); expect(claims.r).toBe("user_1");
  });
  it("the link does NOT embed an object_key / bucket / internal url", () => {
    const { path } = createSecureLink({ company_id: "co_a", object_type: "document", object_id: "doc_1", secret: SECRET });
    expect(path).not.toMatch(/bucket|object_key|supabase|https?:\/\//i);
  });
  it("a tampered token is refused", () => {
    const { token } = createSecureLink({ company_id: "co_a", object_type: "document", object_id: "doc_1", secret: SECRET, now_seconds: 1000 });
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(() => verifySecureLink(tampered, SECRET, 1010)).toThrow(SecureLinkError);
  });
  it("an expired link is refused", () => {
    const { token } = createSecureLink({ company_id: "co_a", object_type: "document", object_id: "doc_1", secret: SECRET, ttl_seconds: 60, now_seconds: 1000 });
    expect(() => verifySecureLink(token, SECRET, 1000 + 61)).toThrow(/expired/i);
  });
  it("a link signed with a different secret is refused (cannot forge another tenant's claims)", () => {
    const { token } = createSecureLink({ company_id: "co_b", object_type: "document", object_id: "doc_9", secret: "other-secret", now_seconds: 1000 });
    expect(() => verifySecureLink(token, SECRET, 1010)).toThrow(/signature/i);
  });
});
