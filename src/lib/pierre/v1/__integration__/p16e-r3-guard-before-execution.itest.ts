// src/lib/pierre/v1/__integration__/p16e-r3-guard-before-execution.itest.ts
// P16E §4.C — R3 : un HARD_BLOCK ne peut JAMAIS survenir après un effet de bord irréversible.
//
// Avant P16E, le worker appelait `executor.run()` PUIS vérifiait le garde noir. Or l'exécuteur
// email_send enqueue dans l'outbox comme premier acte : une tâche à la fois `email_send` ET noire
// (risk='critical') créait donc une ligne d'outbox AVANT que le garde ne bloque. P16E évalue
// désormais CloneGuard AVANT l'exécuteur : une action noire n'atteint jamais `run()` et ne produit
// aucun effet (aucune ligne d'outbox, aucun brouillon, aucun état marqué complet).
//
// Reproduction sur Postgres réel (le test prouve l'ABSENCE d'effet de bord pour une tâche noire
// dont l'exécuteur, s'il tournait, écrirait dans l'outbox).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { runWorkerOnce } from "../worker";
import { enqueueJob } from "../queue";
import { apiCreateMission, apiGetMissionTasks } from "../api";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const outboxCount = async () =>
  Number((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1`, [h.companyA])).rows[0].n);

describe("P16E §4.C — R3 : le garde noir précède l'exécution (aucun effet de bord)", () => {
  it("une tâche email_send + risk=critical (noire) escalade SANS créer de ligne d'outbox", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Notifier l'équipe" });
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);

    // La tâche est à effet de bord (email_send) MAIS noire (critical) : l'exécuteur, s'il tournait,
    // enqueue dans l'outbox. Le garde AVANT exécution doit l'en empêcher.
    await h.db.query(`update pierre_rt_tasks set type='email_send', risk='critical', status='queued' where id=$1`, [tasks[0].id]);
    expect(await outboxCount()).toBe(0);
    await enqueueJob(h.db, { company_id: h.companyA, task_id: tasks[0].id, mission_id: v.mission_id, dedup_key: `blk:${tasks[0].id}` });

    const res = await runWorkerOnce(h.db, { worker_id: "wkr-r3", batch: 5, lease_ms: 60000 });

    // Aucun effet de bord : l'outbox reste vide (l'exécuteur email_send n'a jamais tourné).
    expect(await outboxCount()).toBe(0);
    // La tâche a bien été escaladée / bloquée, jamais réussie.
    const t = await h.db.query<{ status: string }>(`select status from pierre_rt_tasks where id=$1`, [tasks[0].id]);
    expect(t.rows[0].status).toBe("escalated");
    // L'attempt enregistré marque un blocage AVANT exécution.
    const att = await h.db.query<{ outcome: string; detail: unknown }>(`select outcome, detail from pierre_rt_execution_attempts where task_id=$1`, [tasks[0].id]);
    expect(att.rows.some((r) => r.outcome === "blocked")).toBe(true);
    expect(att.rows.some((r) => r.outcome === "succeeded")).toBe(false);
    expect(res.succeeded).toBe(0);
  });

  it("non-régression : une tâche email_send BÉNIGNE (non noire) enqueue bien dans l'outbox (awaiting_integration)", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Notifier l'équipe" });
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    // email_send low-risk : l'exécuteur DOIT tourner et préparer l'outbox (jamais succeeded).
    await h.db.query(`update pierre_rt_tasks set type='email_send', risk='low', sensitivity='normal', status='queued' where id=$1`, [tasks[0].id]);
    await enqueueJob(h.db, { company_id: h.companyA, task_id: tasks[0].id, mission_id: v.mission_id, dedup_key: `ok:${tasks[0].id}` });

    const res = await runWorkerOnce(h.db, { worker_id: "wkr-r3b", batch: 5, lease_ms: 60000 });
    expect(res.awaiting_integration).toBeGreaterThanOrEqual(1);
    expect(await outboxCount()).toBeGreaterThanOrEqual(1); // préparé transactionnellement
    const att = await h.db.query<{ outcome: string }>(`select outcome from pierre_rt_execution_attempts where task_id=$1`, [tasks[0].id]);
    expect(att.rows.some((r) => r.outcome === "awaiting_integration")).toBe(true);
    expect(att.rows.some((r) => r.outcome === "succeeded")).toBe(false);
  });
});
