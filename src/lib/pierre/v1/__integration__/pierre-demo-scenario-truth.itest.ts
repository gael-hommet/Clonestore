// src/lib/pierre/v1/__integration__/pierre-demo-scenario-truth.itest.ts
// PIERRE SELLABILITY STRESS TEST — §5 : reproduit EXACTEMENT le scénario central de la démo
// commerciale (src/lib/demo/presentation/content.ts SCENE_OPENING.initialMission) contre le VRAI
// moteur, planificateur LLM RÉEL activé (AI_RUNTIME_MODE=production requis à l'exécution — fait
// partie du budget des 24 appels OpenAI réels). Compare le résultat RÉEL à la richesse affichée
// dans la démo : "7 tâches organisées", "1 validation nécessaire".
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { apiCreateMission, apiGetMission, apiGetMissionTasks, apiGetMissionTimeline, apiDecideValidation } from "../api";

const DEMO_MISSION = "Prépare l'arrivée de notre nouvelle responsable commerciale à Lyon. Coordonne les documents, les validations et les communications nécessaires pour lundi.";
// Valeurs AFFICHÉES par la démo (SCENE_OPENING.comprehension + SCENE_SYSTEM.layers[0].facts) :
const DEMO_CLAIMED_TASKS = 7;
const DEMO_CLAIMED_VALIDATIONS = 1;

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("PIERRE — DEMO_SCENARIO_TRUTH (reproduction EXACTE, planificateur LLM réel)", () => {
  it("exécute la mission EXACTE de la démo et compare honnêtement au résultat affiché", async () => {
    const ctx = h.ctx("A");
    const created = await apiCreateMission(h.db, ctx, { instruction: DEMO_MISSION, idempotency_key: "demo-scenario-truth-1" });
    expect(created.mission_id).toBeTruthy();

    const reread = await apiGetMission(h.db, ctx, created.mission_id);
    const tasks = await apiGetMissionTasks(h.db, ctx, created.mission_id);
    const timeline = await apiGetMissionTimeline(h.db, ctx, created.mission_id);
    const timelineTypes = timeline.map((e) => e.type);

    // ANTI-FAUX-SUCCÈS : rien n'est jamais "terminé"/"envoyé" à la simple création.
    expect(reread.status).not.toBe("done");
    expect(tasks.every((t) => t.status !== "succeeded")).toBe(true);
    expect(timelineTypes).toContain("mission_received");
    expect(timelineTypes).toContain("analysis_completed");

    const realTaskCount = tasks.length;
    const realValidationCount = reread.approvals.length;
    const taskCountMatch = realTaskCount === DEMO_CLAIMED_TASKS;
    const validationCountMatch = realValidationCount === DEMO_CLAIMED_VALIDATIONS;

    // Verdict DEMO_SCENARIO_TRUTH — honnête, pas une note abstraite :
    //  VERIFIED           : la mission est réellement comprise + décomposée + gouvernée, ET les
    //                        volumes affichés (7/1) sont atteints ou raisonnablement approchés.
    //  PARTIALLY_VERIFIED : la mission est réellement comprise + décomposée + gouvernée (aucun
    //                        élément fictif), mais les volumes EXACTS affichés par la démo ne sont
    //                        pas atteints par le moteur réel.
    //  FALSE_OR_SIMULATED : un champ affiché ne correspond à AUCUN état réel (faux succès détecté).
    const structurallyReal = realTaskCount > 0 && timelineTypes.includes("analysis_completed") && reread.status !== "done";
    const verdict = !structurallyReal ? "FALSE_OR_SIMULATED" : (taskCountMatch && validationCountMatch) ? "VERIFIED" : "PARTIALLY_VERIFIED";

    // eslint-disable-next-line no-console
    console.log("DEMO_SCENARIO_TRUTH " + JSON.stringify({
      verdict, realTaskCount, demoClaimedTasks: DEMO_CLAIMED_TASKS, taskCountMatch,
      realValidationCount, demoClaimedValidations: DEMO_CLAIMED_VALIDATIONS, validationCountMatch,
      missionStatus: reread.status, risk: reread.risk, missingInfoCount: reread.missing_info.length,
      timelineTypes, taskTypes: tasks.map((t) => ({ type: t.type, status: t.status, approval_required: t.approval_required })),
      plannerHint: process.env.AI_RUNTIME_MODE === "production" ? "llm_attempted" : "deterministic_fallback_only",
    }));

    // Le test ne peut JAMAIS "réussir" par un faux succès — quel que soit l'écart de volume.
    expect(structurallyReal).toBe(true);

    // Si une validation existe réellement, prouve la reprise après validation (§5 : "reprise après validation").
    if (reread.approvals.length > 0) {
      const v = reread.approvals[0];
      const decided = await apiDecideValidation(h.db, ctx, v.id, "approve", 1);
      expect(decided.status).toBe("approved");
      const afterApproval = await apiGetMission(h.db, ctx, created.mission_id);
      // La mission progresse réellement après validation (jamais bloquée silencieusement).
      expect(["queued", "planned", "awaiting_validation", "completed", "in_progress"]).toContain(afterApproval.status);
    }
  }, 45000);
});
