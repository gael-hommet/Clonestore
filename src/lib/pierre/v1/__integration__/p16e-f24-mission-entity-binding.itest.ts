// src/lib/pierre/v1/__integration__/p16e-f24-mission-entity-binding.itest.ts
// P16E §4 — F24 : createMission ne peut pas lier une mission à un salarié/site étranger.
//
// DÉFAUT CORRIGÉ (confirmé) — `employee_id`/`site_id` venaient du corps de requête et étaient
// persistés sans vérifier l'appartenance à l'entreprise active. Correctif : vérification
// AVANT tout INSERT, échec FERMÉ et NON révélateur (id étranger indiscernable d'un id inexistant),
// aucune mission / tâche / événement d'audit créé sur échec.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { apiCreateMission } from "../api";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

async function seedEmployee(company: string, over: { status?: string; site_id?: string | null } = {}): Promise<string> {
  const id = newUuid();
  await h.db.query(
    `insert into pierre_rt_employees (id, company_id, first_name, last_name, status, site_id) values ($1,$2,'Marie','Martin',$3,$4)`,
    [id, company, over.status ?? "active", over.site_id ?? null]);
  return id;
}
async function seedSite(company: string): Promise<string> {
  const id = newUuid();
  await h.db.query(`insert into pierre_rt_sites (id, company_id, name) values ($1,$2,'Siège')`, [id, company]);
  return id;
}
const missionCount = async () =>
  Number((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_missions where company_id=$1`, [h.companyA])).rows[0].n);

describe("P16E §4 F24 — liaison salarié/site fail-closed", () => {
  it("mission A avec un employee_id de l'entreprise B ⇒ refus, AUCUNE mission créée", async () => {
    const empB = await seedEmployee(h.companyB);
    const before = await missionCount();
    await expect(apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un document", employee_id: empB })).rejects.toBeTruthy();
    expect(await missionCount()).toBe(before); // aucun effet
  });

  it("mission A avec un site_id de l'entreprise B ⇒ refus, aucune mission créée", async () => {
    const siteB = await seedSite(h.companyB);
    const before = await missionCount();
    await expect(apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un document", site_id: siteB })).rejects.toBeTruthy();
    expect(await missionCount()).toBe(before);
  });

  it("un identifiant salarié INCONNU est refusé avec la MÊME réponse qu'un étranger (non révélateur)", async () => {
    let foreignMsg = ""; let unknownMsg = "";
    const empB = await seedEmployee(h.companyB);
    try { await apiCreateMission(h.db, h.ctx("A"), { instruction: "X", employee_id: empB }); } catch (e) { foreignMsg = (e as Error).message; }
    try { await apiCreateMission(h.db, h.ctx("A"), { instruction: "X", employee_id: newUuid() }); } catch (e) { unknownMsg = (e as Error).message; }
    expect(foreignMsg).toBe(unknownMsg); // aucune fuite d'existence
    expect(foreignMsg).toBeTruthy();
  });

  it("salarié du site A lié explicitement au site B (incohérent) ⇒ refus", async () => {
    const siteA1 = await seedSite(h.companyA);
    const siteA2 = await seedSite(h.companyA);
    const empOnSite1 = await seedEmployee(h.companyA, { site_id: siteA1 });
    await expect(apiCreateMission(h.db, h.ctx("A"), { instruction: "X", employee_id: empOnSite1, site_id: siteA2 })).rejects.toBeTruthy();
  });

  it("un salarié 'left' (inéligible) est refusé", async () => {
    const empLeft = await seedEmployee(h.companyA, { status: "left" });
    await expect(apiCreateMission(h.db, h.ctx("A"), { instruction: "X", employee_id: empLeft })).rejects.toBeTruthy();
  });

  it("non-régression : un salarié + site valides de la MÊME entreprise fonctionnent", async () => {
    const siteA = await seedSite(h.companyA);
    const empA = await seedEmployee(h.companyA, { site_id: siteA });
    const before = await missionCount();
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un document", employee_id: empA, site_id: siteA });
    expect(v.mission_id).toBeTruthy();
    expect(await missionCount()).toBe(before + 1);
    // l'identifiant vérifié est bien lié à la mission
    const bound = await h.db.query<{ employee_id: string; site_id: string }>(`select employee_id, site_id from pierre_rt_missions where id=$1`, [v.mission_id]);
    expect(bound.rows[0].employee_id).toBe(empA);
    expect(bound.rows[0].site_id).toBe(siteA);
  });
});
