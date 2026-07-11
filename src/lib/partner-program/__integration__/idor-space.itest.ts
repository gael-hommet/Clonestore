// IDOR / isolation de l'espace cabinet sur la VRAIE route GET /api/partners/me + vraie base.
// La route résout le cabinet depuis la SESSION (aucun id d'entrée) → un cabinet ne peut
// jamais obtenir les données d'un autre. On prouve que la session de A ne voit que A.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { __setPartnerDbForTests, withService } from "../server/runtime";
import { attachAttributionAtSignup } from "../server/attribution";
import { applyPartnerCommercialEvent } from "../server/commission";
import { createApplication, acceptApplication } from "../server/applications";

// Session Supabase mockée : renvoie l'utilisateur courant piloté par `current`.
const current = { userId: "", email: "" };
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: current.userId, email: current.email } }, error: null }) } }),
}));

let h: PartnerHarness;
beforeAll(async () => {
  h = await createPartnerHarness();
  __setPartnerDbForTests(h.db);
});
afterAll(async () => { __setPartnerDbForTests(null); await h.close(); });

async function seedPartnerWithCommission(tag: string, accountUserId: string, subject: string, invoiceId: string): Promise<string> {
  const partnerId = await withService(h.db, async (tx) => {
    const app = await createApplication(tx, { cabinetName: `Cabinet ${tag}`, firstName: "A", lastName: "B", email: `${tag}@cab-${tag}.fr`, country: "FR", cabinetType: "expertise_comptable", consentContact: true, consentPrivacy: true });
    if (!app.ok) throw new Error("app");
    const acc = await acceptApplication(tx, app.applicationId, "admin", "ok");
    if (!acc.ok) throw new Error("acc");
    await tx.query(`update clonestore_pp_partners set status='active', account_user_id=$2, reserve_days=0 where id=$1`, [acc.partnerId, accountUserId]);
    const t = await tx.query<{ touch_key: string }>(`insert into clonestore_pp_referral_touches (partner_id, source, expires_at) values ($1,'link', now()+interval '90 days') returning touch_key`, [acc.partnerId]);
    await attachAttributionAtSignup(tx, { subjectUserId: subject, subjectEmail: `c${tag}@soc.fr`, touchKey: t.rows[0].touch_key });
    return acc.partnerId;
  });
  await withService(h.db, (tx) => applyPartnerCommercialEvent(tx, { eventId: `evt_${tag}`, type: "invoice.paid", livemode: false, eventCreated: 1, subscriptionId: `sub_${tag}`, customerId: `cus_${tag}`, subjectUserId: subject, invoiceId, paymentIntentId: `pi_${tag}`, totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880, currency: "eur" }));
  return partnerId;
}

describe("GET /api/partners/me — isolation par session (anti-IDOR)", () => {
  it("chaque cabinet ne voit QUE ses données ; jamais celles d'un autre", async () => {
    const userA = "00000000-0000-4000-8000-00000000000a";
    const userB = "00000000-0000-4000-8000-00000000000b";
    await seedPartnerWithCommission("mine", userA, "00000000-0000-4000-8000-0000000000a1", "in_mine");
    await seedPartnerWithCommission("other", userB, "00000000-0000-4000-8000-0000000000b1", "in_other");

    const { GET } = await import("@/app/api/partners/me/route");

    // Session A → seulement les données de A.
    current.userId = userA; current.email = "mine@cab-mine.fr";
    const resA = await GET();
    const bodyA = await resA.json();
    expect(resA.status).toBe(200);
    expect(bodyA.partner.displayName).toBe("Cabinet mine");
    expect(bodyA.commissions).toHaveLength(1);
    expect(bodyA.commissions[0].stripeInvoiceId).toBe("in_mine");
    // Ne contient JAMAIS la facture de l'autre cabinet.
    expect(JSON.stringify(bodyA)).not.toContain("in_other");

    // Session B → seulement les données de B.
    current.userId = userB; current.email = "other@cab-other.fr";
    const resB = await GET();
    const bodyB = await resB.json();
    expect(bodyB.partner.displayName).toBe("Cabinet other");
    expect(bodyB.commissions[0].stripeInvoiceId).toBe("in_other");
    expect(JSON.stringify(bodyB)).not.toContain("in_mine");
  });

  it("session d'un utilisateur SANS cabinet → 404 NOT_A_PARTNER (aucune fuite)", async () => {
    const { GET } = await import("@/app/api/partners/me/route");
    current.userId = "00000000-0000-4000-8000-00000000ffff"; current.email = "nobody@example.com";
    const res = await GET();
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_A_PARTNER");
  });
});
