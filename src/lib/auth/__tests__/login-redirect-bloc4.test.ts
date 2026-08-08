// BLOC 4 — post-login redirect must honor the middleware's `?next=` param (defect #4).
// Middleware redirects sessionless /cockpit → /login?next=/cockpit; the login page previously read
// only `?redirect=`, so users landed on the default instead of their destination. Open-redirect
// protection (isSafeRelativeRedirect) must remain enforced on whichever param is chosen.

import { describe, it, expect } from "vitest";
import { resolvePostLoginTarget } from "../login-helpers";
import { getDefaultPostLoginPath } from "../redirects";

const DEFAULT = getDefaultPostLoginPath();

describe("BLOC4 — resolvePostLoginTarget (next/redirect)", () => {
  it("returns the middleware `?next=` destination", () => {
    expect(resolvePostLoginTarget("?next=/cockpit")).toBe("/cockpit");
    expect(resolvePostLoginTarget("next=/mon-clonestore/setup")).toBe("/mon-clonestore/setup");
  });

  it("still honors the legacy `?redirect=`", () => {
    expect(resolvePostLoginTarget("?redirect=/profile/agents")).toBe("/profile/agents");
  });

  it("prefers `next` over `redirect` when both are present", () => {
    expect(resolvePostLoginTarget("?next=/cockpit&redirect=/profile")).toBe("/cockpit");
  });

  it("blocks open redirects on either param → safe internal default", () => {
    expect(resolvePostLoginTarget("?next=https://evil.example")).toBe(DEFAULT);
    expect(resolvePostLoginTarget("?next=//evil.example")).toBe(DEFAULT);
    expect(resolvePostLoginTarget("?next=javascript:alert(1)")).toBe(DEFAULT);
    expect(resolvePostLoginTarget("?redirect=http://evil.example")).toBe(DEFAULT);
  });

  it("empty / unknown / URLSearchParams input → safe default", () => {
    expect(resolvePostLoginTarget("")).toBe(DEFAULT);
    expect(resolvePostLoginTarget("?foo=bar")).toBe(DEFAULT);
    expect(resolvePostLoginTarget(new URLSearchParams())).toBe(DEFAULT);
    expect(resolvePostLoginTarget(null)).toBe(DEFAULT);
  });
});
