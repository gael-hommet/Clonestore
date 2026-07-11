// Valide que les migrations clonestore_pp s'appliquent sur un vrai Postgres (PGlite)
// et que la RLS isole réellement les cabinets (service voit tout, un cabinet ne voit que soi).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { withService, withPartner } from "../server/runtime";

let h: PartnerHarness;
beforeAll(async () => { h = await createPartnerHarness(); });
afterAll(async () => { await h.close(); });

describe("migrations clonestore_pp — application + RLS", () => {
  it("crée les tables du noyau et de la finance", async () => {
    const { rows } = await h.db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_name like 'clonestore_pp_%' order by table_name`,
    );
    const names = rows.map((r) => r.table_name);
    for (const t of [
      "clonestore_pp_applications",
      "clonestore_pp_partners",
      "clonestore_pp_partner_codes",
      "clonestore_pp_referral_touches",
      "clonestore_pp_introductions",
      "clonestore_pp_attributions",
      "clonestore_pp_customers",
      "clonestore_pp_commission_entries",
      "clonestore_pp_transfers",
      "clonestore_pp_stripe_events",
      "clonestore_pp_admin_audit",
      "clonestore_pp_approval_requests",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("isolation RLS : un cabinet ne voit QUE ses lignes", async () => {
    const [a, b] = await withService(h.db, async (tx) => {
      const r1 = await tx.query<{ id: string }>(
        `insert into clonestore_pp_partners (email, email_normalized, display_name, country, public_slug)
         values ('a@x.fr','a@x.fr','Cabinet A','FR','cabinet-a') returning id`,
      );
      const r2 = await tx.query<{ id: string }>(
        `insert into clonestore_pp_partners (email, email_normalized, display_name, country, public_slug)
         values ('b@x.fr','b@x.fr','Cabinet B','FR','cabinet-b') returning id`,
      );
      return [r1.rows[0].id, r2.rows[0].id];
    });

    // En mode SERVICE : les deux visibles.
    const all = await withService(h.db, (tx) => tx.query(`select id from clonestore_pp_partners`));
    expect(all.rows.length).toBeGreaterThanOrEqual(2);

    // En mode PARTNER A : seul A visible.
    const seenByA = await withPartner(h.db, a, (tx) => tx.query<{ id: string }>(`select id from clonestore_pp_partners`));
    expect(seenByA.rows.map((r) => r.id)).toEqual([a]);

    // A ne voit pas B.
    const aSeesB = await withPartner(h.db, a, (tx) => tx.query(`select id from clonestore_pp_partners where id = $1`, [b]));
    expect(aSeesB.rows).toHaveLength(0);
  });

  it("ledger de commissions : les colonnes financières sont immuables", async () => {
    const partnerId = await withService(h.db, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `insert into clonestore_pp_partners (email, email_normalized, display_name, country, public_slug)
         values ('c@x.fr','c@x.fr','Cabinet C','FR','cabinet-c') returning id`,
      );
      const p = r.rows[0].id;
      await tx.query(
        `insert into clonestore_pp_commission_entries
           (partner_id, stripe_invoice_id, stripe_event_id, currency, eligible_net_minor, rate_bps, commission_minor, entry_type, status, available_at)
         values ($1,'in_1','evt_1','eur',44900,2000,8980,'commission','pending', now())`,
        [p],
      );
      return p;
    });

    // Muter un montant doit échouer (trigger d'immuabilité).
    await expect(
      withService(h.db, (tx) =>
        tx.query(`update clonestore_pp_commission_entries set commission_minor = 99999 where partner_id = $1`, [partnerId]),
      ),
    ).rejects.toThrow();

    // Muter le STATUT est permis (cycle de vie de l'écriture).
    await expect(
      withService(h.db, (tx) =>
        tx.query(`update clonestore_pp_commission_entries set status = 'available' where partner_id = $1`, [partnerId]),
      ),
    ).resolves.toBeDefined();
  });

  it("ledger de commissions : DELETE interdit", async () => {
    await expect(
      withService(h.db, (tx) => tx.query(`delete from clonestore_pp_commission_entries where stripe_event_id = 'evt_1'`)),
    ).rejects.toThrow();
  });
});
