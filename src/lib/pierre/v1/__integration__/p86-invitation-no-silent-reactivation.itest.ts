// src/lib/pierre/v1/__integration__/p86-invitation-no-silent-reactivation.itest.ts
// PHASE 8.6 — accepting an invitation must NEVER silently reactivate a REVOKED (removed) or LEFT (or
// suspended) membership. Restoring such access requires a governed reactivation, not the implicit side
// effect of accepting an invite. A brand-new membership is created normally; re-accepting an already
// active membership is idempotent.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import { newUuid } from "../sql";
import { createHash } from "crypto";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

// create a governed invitation for an email (app role, tenant bound); returns the raw token.
async function invite(company: string, email: string, invitedBy: string): Promise<string> {
  const token = newUuid() + newUuid();
  await asRole(h, APP, company, (q) =>
    q(`select pierre_rt_create_membership_invitation($1,$2,$3,$4,$5,$6,$7)`,
      [company, email, email.toLowerCase(), ["VIEWER"], sha(token), invitedBy, new Date(Date.now() + 3600_000).toISOString()]));
  return token;
}
const accept = (company: string, token: string, user: string, email: string) =>
  asRole(h, APP, company, (q) => q(`select pierre_rt_accept_membership_invitation($1,$2,$3,now()) as m`, [sha(token), user, email.toLowerCase()]));

describe("P8.6 invitation acceptance never silently reactivates a gone membership", () => {
  for (const goneStatus of ["removed", "left", "suspended"] as const) {
    it(`refuses to reactivate a ${goneStatus} membership via invitation acceptance`, async () => {
      const company = h.companyA;
      const user = newUuid();
      const email = `${goneStatus}.${newUuid()}@ex.test`;
      // existing membership in the gone state
      await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'viewer',$4)`, [newUuid(), company, user, goneStatus]);
      const token = await invite(company, email, h.userA);
      // accepting must be REFUSED — governed reactivation is required, not an implicit invite side effect
      expect(await refused(() => accept(company, token, user, email))).toBe(true);
      // the membership status is UNCHANGED (no silent reactivation)
      const status = (await h.pg.query<{ status: string }>(`select status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, user])).rows[0].status;
      expect(status).toBe(goneStatus);
    });
  }

  it("creates a brand-new membership normally, and re-accepting an active one is idempotent", async () => {
    const company = h.companyA;
    const user = newUuid();
    const email = `fresh.${newUuid()}@ex.test`;
    const token = await invite(company, email, h.userA);
    const m1 = (await accept(company, token, user, email)).rows[0] as { m: string };
    expect(m1.m).toBeTruthy();
    expect((await h.pg.query<{ status: string }>(`select status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, user])).rows[0].status).toBe("active");
    // replay (same token, same verified user/email) → same membership id, still active
    const m2 = (await accept(company, token, user, email)).rows[0] as { m: string };
    expect(m2.m).toBe(m1.m);
    expect((await h.pg.query<{ n: number }>(`select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [company, user])).rows[0].n).toBe(1);
  });
});
