// src/lib/pierre/v1/__integration__/p16e-enterprise-simulation.itest.ts
// P16E §6 — REAL end-to-end accelerated simulation on the SMALL fixture, executed through the
// actual local Pierre runtime on real PGlite (planner + createMission + worker + isolation). No
// model calls, no live provider, no remote DB. Proves the hard invariants at runtime, not just
// at the planner level. The larger scales are proven at the deterministic invariant level
// (scripts/p16e-enterprise-sim.mts -> enterprise-simulation-results.json).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { apiCreateMission, apiGetMission } from "../api";
import { drainQueue } from "../worker";
import { generateRoster } from "./enterprise-fixtures";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

async function seedRoster(company: string, count: number): Promise<string[]> {
  const roster = generateRoster("small").slice(0, count);
  const ids: string[] = [];
  for (const e of roster) {
    const id = newUuid();
    await h.db.query(
      `insert into pierre_rt_employees (id, company_id, first_name, last_name, status) values ($1,$2,$3,$4,$5)`,
      [id, company, e.first_name, e.last_name, e.status === "left" ? "left" : "active"]);
    ids.push(id);
  }
  return ids;
}

describe("P16E §6 — simulation entreprise SMALL sur le vrai runtime", () => {
  it("15 salariés/tenant × 2 tenants : missions gouvernées, isolation, aucun effet autonome, audit attribué", async () => {
    const empA = await seedRoster(h.companyA, 15);
    const empB = await seedRoster(h.companyB, 15);
    expect(empA.length).toBe(15);
    expect(empB.length).toBe(15);

    const ownerA = h.ctx("A");
    const ownerB = h.ctx("B");

    // Semaine accélérée : plusieurs missions par tenant (onboarding, attestation, contrat sensible).
    const mA1 = await apiCreateMission(h.db, ownerA, { instruction: "Prépare une attestation de travail pour Marie", employee_id: empA[0] });
    const mA2 = await apiCreateMission(h.db, ownerA, { instruction: "Prépare un avenant au contrat de Paul", employee_id: empA[1] }); // sensible
    const mB1 = await apiCreateMission(h.db, ownerB, { instruction: "Prépare une attestation de travail pour Sarah", employee_id: empB[0] });

    // Idempotence : rejouer la même création ne crée pas de doublon.
    const mA1dup = await apiCreateMission(h.db, ownerA, { instruction: "Prépare une attestation de travail pour Marie", employee_id: empA[0] });
    expect(mA1dup.mission_id).toBe(mA1.mission_id);

    // Draine la file (worker réel) jusqu'à quiescence.
    const res = await drainQueue(h.db, { worker_id: "sim", batch: 20, lease_ms: 60000 });
    expect(res.dead_lettered).toBe(0);

    // 1) ISOLATION : aucune mission de A ne référence un employé de B, et réciproquement.
    const aRefsB = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_missions where company_id=$1 and employee_id = any($2)`, [h.companyA, empB]);
    expect(aRefsB.rows[0].n).toBe(0);
    const bRefsA = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_missions where company_id=$1 and employee_id = any($2)`, [h.companyB, empA]);
    expect(bRefsA.rows[0].n).toBe(0);

    // 2) Un tenant ne peut pas LIRE la mission d'un autre (fail-closed).
    await expect(apiGetMission(h.db, ownerB, mA1.mission_id)).rejects.toBeTruthy();

    // 3) AUCUN effet de bord externe autonome : aucune tâche « succeeded » de type email/effet externe.
    const externalSucceeded = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_tasks where company_id=$1 and status='succeeded' and type in ('email_send','document_generate','file_store')`, [h.companyA]);
    expect(externalSucceeded.rows[0].n).toBe(0);

    // 4) La mission sensible (avenant) exige une validation humaine (jamais auto-exécutée).
    const viewA2 = await apiGetMission(h.db, ownerA, mA2.mission_id);
    const sensitiveDone = viewA2.tasks.filter((t) => t.status === "succeeded" && t.approval_required);
    expect(sensitiveDone.length).toBe(0);

    // 5) AUDIT attribué : les événements 'mission_received' portent un actor_id humain.
    const audited = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_events where company_id=$1 and type='mission_received' and actor_type='user' and actor_id is not null`, [h.companyA]);
    expect(audited.rows[0].n).toBeGreaterThanOrEqual(2); // mA1 + mA2 (dup rejoue, pas de nouvel événement)

    // 6) Statuts véridiques : aucune mission 'done' avec des tâches bloquées.
    const doneWithBlocked = await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_missions m where m.company_id=$1 and m.status='done'
        and exists (select 1 from pierre_rt_tasks t where t.mission_id=m.id and t.status in ('blocked','failed','escalated'))`, [h.companyA]);
    expect(doneWithBlocked.rows[0].n).toBe(0);

    expect(mB1.mission_id).toBeTruthy();
  });
});
