// PHASE 8.4-R1.14 — communication preference ownership. A user may set ONLY their own preferences;
// an authorized admin may set another member's, but only within the SAME tenant. A non-admin setting
// someone else's, an other-tenant target, or a non-member target is refused.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { addMember } from "./p84-r1-helpers";
import { newUuid } from "../sql";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const pref = (uid: string) => ({ user_id: uid, category: "operational", channel: "email" as const, enabled: false });
function withoutAdmin(ctx: TenantContext): TenantContext { return { ...ctx, permissions: ctx.permissions.filter((p) => p !== "tenancy.admin") }; }

describe("R1.14 preference ownership auth", () => {
  it("a user may set their OWN preferences", async () => {
    await expect(Comm.setCommunicationPreference(h.db, owner, pref(h.userA))).resolves.toBeUndefined();
  });

  it("an admin may set another SAME-TENANT member's preferences", async () => {
    const second = await addMember(h, h.companyA, "hr_operator");
    await expect(Comm.setCommunicationPreference(h.db, owner, pref(second.user_id))).resolves.toBeUndefined();
  });

  it("a NON-admin may NOT set another user's preferences", async () => {
    const second = await addMember(h, h.companyA, "hr_operator");
    await expect(Comm.setCommunicationPreference(h.db, withoutAdmin(owner), pref(second.user_id))).rejects.toThrow();
  });

  it("an admin may NOT set a NON-member's preferences", async () => {
    await expect(Comm.setCommunicationPreference(h.db, owner, pref(newUuid()))).rejects.toThrow();
  });

  it("an admin may NOT set an OTHER-tenant user's preferences", async () => {
    await expect(Comm.setCommunicationPreference(h.db, owner, pref(h.userB))).rejects.toThrow();
  });
});
