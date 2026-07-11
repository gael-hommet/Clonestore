// Reprise des candidatures héritées (§12) — sur PostgreSQL réel.
// Prouve : simulation par défaut (aucune écriture), application réelle, idempotence
// (aucun cabinet en double, aucun e-mail en double), revue humaine préservée pour les
// dossiers réellement risqués, et audit nominatif.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPartnerHarness, type PartnerHarness } from "./partner-harness";
import { withService } from "../server/runtime";
import { backfillLegacyApplications } from "../server/backfill";

let h: PartnerHarness;
beforeAll(async () => { h = await createPartnerHarness(); });
afterAll(async () => { await h.close(); });

/** Insère une candidature EXACTEMENT comme l'ancien parcours la laissait : `received`. */
async function legacyApplication(tag: string, email: string, country = "FR"): Promise<string> {
  return withService(h.db, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into clonestore_pp_applications
         (cabinet_name, first_name, last_name, email, email_normalized, country, cabinet_type,
          consent_contact, consent_privacy, status, dedupe_key)
       values ($1,'Ancien','Dossier',$2,$2,$3,'expertise_comptable',true,true,'received',$4)
       returning id`,
      [`Cabinet ${tag}`, email, country, `dedupe-${tag}`],
    );
    return r.rows[0].id;
  });
}

async function partnersFor(email: string): Promise<number> {
  const r = await withService(h.db, (tx) => tx.query<{ n: number }>(
    `select count(*)::int n from clonestore_pp_partners where email_normalized=$1`, [email],
  ));
  return r.rows[0].n;
}

async function accessEmailsFor(email: string): Promise<number> {
  const r = await withService(h.db, (tx) => tx.query<{ n: number }>(
    `select count(*)::int n from clonestore_pp_email_outbox where to_email=$1 and kind='onboarding_access'`, [email],
  ));
  return r.rows[0].n;
}

describe("§12 — reprise des candidatures héritées", () => {
  it("simulation par défaut : un plan, ZÉRO écriture", async () => {
    await legacyApplication("legacy-a", "a@cabinet-legacy-a.fr");
    await legacyApplication("legacy-b", "b@cabinet-legacy-b.fr");

    const plan = await backfillLegacyApplications(h.db, withService); // aucun dryRun passé → simulation
    expect(plan.dryRun).toBe(true);
    expect(plan.scanned).toBe(2);
    expect(plan.provisioned).toBe(2);
    expect(plan.items.every((i) => i.action === "provision")).toBe(true);

    // Rien n'a été écrit : ni cabinet, ni e-mail, ni changement de statut.
    expect(await partnersFor("a@cabinet-legacy-a.fr")).toBe(0);
    expect(await accessEmailsFor("a@cabinet-legacy-a.fr")).toBe(0);
    const st = await withService(h.db, (tx) => tx.query<{ status: string }>(
      `select status from clonestore_pp_applications where email_normalized='a@cabinet-legacy-a.fr'`,
    ));
    expect(st.rows[0].status).toBe("received");
  });

  it("application réelle : cabinets provisionnés, accès envoyé, audit nominatif", async () => {
    const res = await backfillLegacyApplications(h.db, withService, { dryRun: false, actor: "ops@clonestore.pro" });
    expect(res.dryRun).toBe(false);
    expect(res.provisioned).toBe(2);
    expect(res.errors).toBe(0);

    expect(await partnersFor("a@cabinet-legacy-a.fr")).toBe(1);
    expect(await accessEmailsFor("a@cabinet-legacy-a.fr")).toBe(1);

    const p = await withService(h.db, (tx) => tx.query<{ status: string; public_slug: string }>(
      `select status, public_slug from clonestore_pp_partners where email_normalized='a@cabinet-legacy-a.fr'`,
    ));
    expect(p.rows[0].status).toBe("onboarding_pending"); // même état qu'une candidature d'aujourd'hui
    expect(p.rows[0].public_slug).toMatch(/^[a-z0-9-]+$/);

    const app = await withService(h.db, (tx) => tx.query<{ status: string; created_partner_id: string | null; reviewed_by: string }>(
      `select status, created_partner_id, reviewed_by from clonestore_pp_applications where email_normalized='a@cabinet-legacy-a.fr'`,
    ));
    expect(app.rows[0].status).toBe("auto_approved");
    expect(app.rows[0].created_partner_id).toBeTruthy();
    expect(app.rows[0].reviewed_by).toBe("ops@clonestore.pro");

    const traced = await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestore_pp_admin_audit where action='application.auto_approved' and actor='ops@clonestore.pro'`,
    ));
    expect(traced.rows[0].n).toBe(2); // chaque décision est tracée sous un acteur nommé
  });

  it("idempotence : relancer ne crée AUCUN doublon (ni cabinet, ni e-mail)", async () => {
    const again = await backfillLegacyApplications(h.db, withService, { dryRun: false, actor: "ops@clonestore.pro" });
    // Les dossiers repris ne sont plus `received` → ils ne sont même plus candidats.
    expect(again.scanned).toBe(0);
    expect(again.provisioned).toBe(0);
    expect(await partnersFor("a@cabinet-legacy-a.fr")).toBe(1);
    expect(await accessEmailsFor("a@cabinet-legacy-a.fr")).toBe(1);
  });

  it("idempotence dure : un dossier `received` dont le cabinet existe déjà est IGNORÉ", async () => {
    // Cas réel : le partenaire a été créé à la main, la candidature est restée `received`.
    await legacyApplication("legacy-dup", "a@cabinet-legacy-a.fr");
    const res = await backfillLegacyApplications(h.db, withService, { dryRun: false, actor: "ops@clonestore.pro" });
    expect(res.scanned).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.provisioned).toBe(0);
    expect(await partnersFor("a@cabinet-legacy-a.fr")).toBe(1); // toujours UN seul cabinet
    expect(await accessEmailsFor("a@cabinet-legacy-a.fr")).toBe(1); // toujours UN seul e-mail
  });

  it("un dossier réellement risqué part en revue humaine, sans cabinet", async () => {
    await legacyApplication("legacy-risk", "x@cabinet-risque.fr", "US"); // pays hors périmètre
    const res = await backfillLegacyApplications(h.db, withService, { dryRun: false, actor: "ops@clonestore.pro" });
    expect(res.manualReview).toBe(1);
    const risky = res.items.find((i) => i.email === "x@cabinet-risque.fr");
    expect(risky?.blocking).toContain("country_not_allowed");
    expect(await partnersFor("x@cabinet-risque.fr")).toBe(0); // aucun cabinet créé

    const app = await withService(h.db, (tx) => tx.query<{ status: string }>(
      `select status from clonestore_pp_applications where email_normalized='x@cabinet-risque.fr'`,
    ));
    expect(app.rows[0].status).toBe("manual_review");
    const flag = await withService(h.db, (tx) => tx.query<{ kind: string; status: string }>(
      `select kind, status from clonestore_pp_risk_flags where entity_type='application' and kind='country_not_allowed'`,
    ));
    expect(flag.rows[0].status).toBe("open");
  });
});
