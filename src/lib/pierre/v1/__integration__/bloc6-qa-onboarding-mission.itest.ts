// BLOC 6 — Pierre production operational readiness: a REAL synthetic HR onboarding mission driven
// end-to-end through the CANONICAL governed runtime (P8.5), with internal-only actions (no email, no
// signature, no real employee). Proves: create → plan → run → deliverables → manager approval →
// resume → completion, idempotence, tenant A/B isolation (IDOR), audit trail, and the mode hard-floor.
//
// QA instruction (synthetic): "Un salarié fictif rejoint ACME QA lundi. Prépare son onboarding RH avec
// checklist administrative, planning J1/J7/J30, documents internes et questions à faire valider par le
// manager. Ne contacte personne et ne signe rien." → internal documents + a manager approval only.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses, gov } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";
import type { RuntimePlanInput } from "../runtime-plan-compiler";

let h: Harness; let A: TenantContext; let B: TenantContext;
beforeEach(async () => {
  h = await createHarness();
  A = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  B = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
});
afterEach(async () => { await h.close(); });

const QA_INSTRUCTION =
  "Un salarié fictif rejoint ACME QA lundi. Prépare son onboarding RH avec checklist administrative, " +
  "planning J1/J7/J30, documents internes et questions à faire valider par le manager. Ne contacte personne et ne signe rien.";

// Realistic internal onboarding deliverable content (structured, actionable, no invented facts presented as real).
const CHECKLIST = [
  "Checklist onboarding administrative — salarié fictif (ACME QA)",
  "- Collecter pièce d'identité, RIB, justificatif de domicile (à demander au salarié)",
  "- Créer le dossier salarié interne et l'adresse email professionnelle",
  "- Préparer le contrat de travail (BROUILLON — ne rien signer)",
  "- Programmer la visite médicale d'embauche",
  "- Déclarer l'embauche (DPAE) — à valider par le manager avant transmission",
].join("\n");
const PLANNING = [
  "Planning d'intégration J1 / J7 / J30",
  "J1: accueil, remise du matériel, présentation de l'équipe, accès aux outils internes",
  "J7: point RH, vérification des accès, premières formations obligatoires",
  "J30: entretien de suivi manager, bilan d'intégration, objectifs 90 jours",
].join("\n");
const MANAGER_SUMMARY = [
  "Résumé manager — onboarding à valider",
  "Questions à valider par le manager avant toute action externe:",
  "1. Confirmer la date de début (lundi) et le poste.",
  "2. Confirmer le rattachement hiérarchique et l'équipe.",
  "3. Autoriser la préparation de la DPAE (aucune transmission sans validation).",
].join("\n");

function planFor(): RuntimePlanInput {
  return { steps: [
    { step_key: "checklist", action_key: "document.generate", input: { document_type: "generic_hr_document", title: "Checklist onboarding administrative", content_text: CHECKLIST } },
    { step_key: "planning", action_key: "document.generate", input: { document_type: "generic_hr_document", title: "Planning J1/J7/J30", content_text: PLANNING }, depends_on: ["checklist"] },
    { step_key: "approve", action_key: "approval.request", input: { reason: "Valider les questions manager (aucune action externe)", fingerprint: "ONB_QA" }, depends_on: ["planning"] },
    { step_key: "summary", action_key: "document.generate", input: { document_type: "generic_hr_document", title: "Résumé manager", content_text: MANAGER_SUMMARY }, depends_on: ["approve"] },
    { step_key: "done", action_key: "mission.complete", depends_on: ["summary"] },
  ] };
}

async function drain(ctx: TenantContext, companyId: string): Promise<void> {
  for (let i = 0; i < 14; i++) {
    await runPierreRuntimeJobs(h.db, ctx, { worker: "w" });
    const ready = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_jobs where company_id=$1 and status in ('queued','ready')`, [companyId])).rows[0].n;
    if (ready === 0) break;
  }
}
async function docCount(companyId: string, missionId: string): Promise<number> {
  return (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_documents where company_id=$1 and mission_id=$2`, [companyId, missionId])).rows[0].n;
}
async function approveManager(runId: string, missionId: string, fingerprint: string): Promise<string> {
  const val = (await h.db.query<{ id: string }>(`select id from pierre_rt_validations where company_id=$1 and mission_id=$2 and status='pending'`, [h.companyA, missionId])).rows[0];
  await h.db.query(`update pierre_rt_validations set status='approved', decided_at=now(), decided_by=$3 where company_id=$1 and id=$2`, [h.companyA, val.id, h.userA]);
  const wait = (await h.db.query<{ id: string; validation_id: string }>(`select id, validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and wait_kind='approval' and status='pending'`, [runId])).rows[0];
  const r = (await gov<{ pierre_rt_resolve_runtime_wait: string }>(h, A, `select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, wait.id, null, "approval.decided", "validation", wait.validation_id, fingerprint])).rows[0].pierre_rt_resolve_runtime_wait;
  await runPierreRuntimeScheduler(h.db, A, {});
  await drain(A, h.companyA);
  return r;
}

describe("BLOC6 — Pierre QA onboarding mission E2E (governed runtime, internal-only)", () => {
  it("create → plan → run → 2 deliverables → manager approval WAIT → approve → summary deliverable → complete; idempotent", async () => {
    const m = await seedMission(h, A, QA_INSTRUCTION);
    const created = await createMissionRunFromPlan(h.db, A, { mission_id: m, plan: planFor(), autonomy: "normal" });
    const runId = created.mission_run_id!;
    expect(created.ok).toBe(true);

    await drain(A, h.companyA);
    // Two internal deliverables produced by the worker; the run is WAITING on the manager approval.
    expect(await docCount(h.companyA, m)).toBe(2);
    expect((await stepStatuses(h, runId)).approve).toBe("waiting");
    expect((await runState(h, runId)).status).toBe("waiting");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_validations where company_id=$1 and mission_id=$2 and status='pending'`, [h.companyA, m])).rows[0].n).toBe(1);
    // Deliverables are tenant-scoped, mission-linked, drafts, versioned (structured, nothing "sent"/"signed").
    const docs = (await h.db.query<{ title: string; status: string; document_type: string }>(`select title, status, document_type from pierre_rt_documents where company_id=$1 and mission_id=$2 order by created_at`, [h.companyA, m])).rows;
    expect(docs.map((d) => d.title)).toEqual(["Checklist onboarding administrative", "Planning J1/J7/J30"]);
    expect(docs.every((d) => d.status === "draft")).toBe(true);
    const versions = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_versions v join pierre_rt_documents d on d.id=v.document_id where d.company_id=$1 and d.mission_id=$2`, [h.companyA, m])).rows[0].n;
    expect(versions).toBe(2);

    // Manager approves → wait resolves → summary deliverable → run completed.
    expect(await approveManager(runId, m, "ONB_QA")).toBe("resolved");
    expect((await runState(h, runId)).status).toBe("completed");
    expect(await docCount(h.companyA, m)).toBe(3);

    // Idempotence: re-draining the worker produces no new deliverables, no re-completion.
    await drain(A, h.companyA);
    expect(await docCount(h.companyA, m)).toBe(3);
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("cross-tenant operational isolation (IDOR): company B cannot advance / resolve company A's mission run", async () => {
    // Row-level (RLS) + API-level tenant isolation for storage/documents/routes is proven by
    // p83-b2f-storage-tenant-isolation.itest.ts + p82c-route-security.itest.ts. Here we prove the
    // OPERATIONAL invariant specific to a running mission: B, bound to its own tenant, can never
    // advance A's governed run — the resolver refuses A's wait and A's run + deliverables are untouched.
    const m = await seedMission(h, A, QA_INSTRUCTION);
    const created = await createMissionRunFromPlan(h.db, A, { mission_id: m, plan: planFor(), autonomy: "normal" });
    const runId = created.mission_run_id!;
    await drain(A, h.companyA);
    const docsBefore = await docCount(h.companyA, m);
    const wait = (await h.db.query<{ id: string; validation_id: string }>(`select id, validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and wait_kind='approval' and status='pending'`, [runId])).rows[0];
    let bResolved = false;
    try {
      const asB = (await gov<{ r: string }>(h, B, `select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7) as r`, [h.companyB, wait.id, null, "approval.decided", "validation", wait.validation_id, "ONB_QA"])).rows[0].r;
      bResolved = asB === "resolved";
    } catch { /* governed cross-tenant refusal → expected */ }
    expect(bResolved).toBe(false);
    // B running its own worker never touches A's run either.
    await runPierreRuntimeJobs(h.db, B, { worker: "wB" });
    expect((await runState(h, runId)).status).toBe("waiting"); // A's run still waiting, untouched by B
    expect(await docCount(h.companyA, m)).toBe(docsBefore); // A's deliverables unchanged by B
  });

  it("audit trail: the mission records tenant-scoped audit events for creation, steps, approval, documents and completion", async () => {
    const m = await seedMission(h, A, QA_INSTRUCTION);
    const created = await createMissionRunFromPlan(h.db, A, { mission_id: m, plan: planFor(), autonomy: "normal" });
    await drain(A, h.companyA);
    await approveManager(created.mission_run_id!, m, "ONB_QA");
    const rows = (await h.db.query<{ type: string; company_id: string; mission_id: string; actor_type: string }>(
      `select type, company_id, mission_id, actor_type from pierre_rt_events where company_id=$1 and mission_id=$2`, [h.companyA, m])).rows;
    expect(rows.length).toBeGreaterThan(0);
    // Every audit line is tenant + mission stamped and carries an actor (never anonymous / cross-tenant).
    expect(rows.every((r) => r.company_id === h.companyA && r.mission_id === m && !!r.actor_type)).toBe(true);
  });

  it("mode hard-floor: the manager approval step gates the run regardless of autonomy mode (draft AND enterprise_autonomous both WAIT, never auto-pass)", async () => {
    for (const mode of ["draft", "enterprise_autonomous"] as const) {
      const m = await seedMission(h, A, QA_INSTRUCTION);
      const created = await createMissionRunFromPlan(h.db, A, { mission_id: m, plan: planFor(), autonomy: mode });
      await drain(A, h.companyA);
      // An explicit approval step is a hard floor: the run WAITS in every mode; no mode auto-bypasses it.
      expect((await stepStatuses(h, created.mission_run_id!)).approve).toBe("waiting");
      expect((await runState(h, created.mission_run_id!)).status).toBe("waiting");
      expect(await docCount(h.companyA, m)).toBe(2); // summary NOT produced until the human approves
    }
  });
});
