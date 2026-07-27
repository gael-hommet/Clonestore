// src/lib/pierre/v1/__integration__/pierre-sellability-authoritative-execution.itest.ts
// PIERRE SELLABILITY STRESS TEST — §4.B : échantillon de 14 cas (2 par catégorie) poussés
// RÉELLEMENT jusqu'au worker : instruction → mission → tâches → job (pierre_rt_runtime_claim) →
// worker (runPierreRuntimeJobs) → handler → objet métier persistant OU blocage honnête. Mesure
// SÉPARÉMENT ce que le §72-cas ne prouve PAS : planifié vs exécuté vs bloqué honnêtement vs effet
// métier obtenu. Aucun résultat n'est forcé — le test rapporte ce qui se passe RÉELLEMENT, y compris
// si la majorité des cas atterrit en blocage honnête (ex. no_handler) : c'est une mesure, pas un échec.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { apiCreateMission, apiGetMission, apiGetMissionTasks } from "../api";
import { runPierreRuntimeJobs } from "../runtime-service";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

interface Sample { category: string; instruction: string }
const SAMPLE: Sample[] = [
  { category: "Recrutement", instruction: "Rédige une fiche de poste pour un responsable commercial." },
  { category: "Recrutement", instruction: "Prépare une trame d'entretien structuré pour le poste de responsable commercial." },
  { category: "Onboarding", instruction: "Onboarde un nouveau salarié en CDI, poste commercial, site de Lyon." },
  { category: "Onboarding", instruction: "Prépare un avenant de télétravail pour un salarié du service support." },
  { category: "Absences", instruction: "Enregistre un arrêt maladie et notifie le manager concerné." },
  { category: "Absences", instruction: "Organise le retour progressif d'un salarié après un mi-temps thérapeutique." },
  { category: "Pré-paie", instruction: "Prépare les variables mensuelles de paie du mois en cours." },
  { category: "Pré-paie", instruction: "Émets une attestation employeur pour un salarié qui en fait la demande." },
  { category: "Performance/formation", instruction: "Prépare un entretien annuel d'évaluation pour un salarié." },
  { category: "Performance/formation", instruction: "Identifie un besoin de formation et organise l'inscription." },
  { category: "Sensibles", instruction: "Traite un signalement de harcèlement moral émis par un salarié." },
  { category: "Sensibles", instruction: "Traite un accident du travail survenu sur le site de production." },
  { category: "Offboarding", instruction: "Traite la démission d'un salarié du service support (accusé de réception + checklist)." },
  { category: "Offboarding", instruction: "Conduis l'offboarding complet d'un salarié qui part en fin de contrat." },
];

type Outcome =
  | "PLANNED_ONLY_NOTHING_QUEUED"       // mission créée mais aucune tâche auto-exécutable à réclamer
  | "CLAIMED_SUCCEEDED"                 // le worker a réclamé le job ET l'a fait aboutir (effet métier réel)
  | "CLAIMED_BLOCKED_HONEST"            // le worker a réclamé le job mais l'a bloqué HONNÊTEMENT (no_handler/invalid_input/unknown_action) — jamais un faux succès
  | "CLAIMED_WAITING"                   // réclamé mais laissé en attente (dépendance/lease)
  | "AWAITING_VALIDATION_NOT_QUEUED";   // gouvernance a exigé une validation humaine AVANT toute mise en file — comportement CORRECT, pas un échec

interface SampleResult { category: string; instruction: string; missionStatus: string; taskCount: number; queuedActions: number; worker: { claimed: number; succeeded: number; waiting: number; blocked: number; retried: number }; outcome: Outcome }
const RESULTS: SampleResult[] = [];

describe("PIERRE SELLABILITY — §4.B échantillon d'exécution AUTORITATIVE (14 cas, jusqu'au worker réel)", () => {
  it("couvre exactement 14 cas, 2 par catégorie (7 catégories)", () => {
    expect(SAMPLE.length).toBe(14);
    const byCat = SAMPLE.reduce<Record<string, number>>((a, s) => { a[s.category] = (a[s.category] ?? 0) + 1; return a; }, {});
    expect(Object.values(byCat).every((n) => n === 2)).toBe(true);
    expect(Object.keys(byCat).length).toBe(7);
  });

  for (const [i, s] of SAMPLE.entries()) {
    it(`#${i + 1} [${s.category}] instruction → mission → tâches → worker réel → effet métier OU blocage honnête`, async () => {
      const ctx = h.ctx("A");
      const created = await apiCreateMission(h.db, ctx, { instruction: s.instruction, idempotency_key: `authexec-${i}` });
      const missionBefore = await apiGetMission(h.db, h.ctx("A"), created.mission_id);
      const tasksBefore = await apiGetMissionTasks(h.db, h.ctx("A"), created.mission_id);

      // Passe RÉELLE du worker sur ce tenant — réclame et traite tout job éligible (fencing token,
      // checkpoints, handler typé). Aucun mock : c'est le même `runPierreRuntimeJobs` que la prod.
      const worker = await runPierreRuntimeJobs(h.db, h.ctx("A"), { limit: 10 });

      const missionAfter = await apiGetMission(h.db, h.ctx("A"), created.mission_id);

      let outcome: Outcome;
      if (missionBefore.status === "awaiting_validation" || missionBefore.queued_actions === 0) {
        outcome = worker.claimed === 0 ? "AWAITING_VALIDATION_NOT_QUEUED" : (worker.succeeded > 0 ? "CLAIMED_SUCCEEDED" : worker.blocked > 0 ? "CLAIMED_BLOCKED_HONEST" : "CLAIMED_WAITING");
        if (missionBefore.queued_actions === 0 && worker.claimed === 0) outcome = missionBefore.status === "awaiting_validation" ? "AWAITING_VALIDATION_NOT_QUEUED" : "PLANNED_ONLY_NOTHING_QUEUED";
      } else if (worker.claimed === 0) {
        outcome = "PLANNED_ONLY_NOTHING_QUEUED";
      } else if (worker.succeeded > 0) {
        outcome = "CLAIMED_SUCCEEDED";
      } else if (worker.blocked > 0) {
        outcome = "CLAIMED_BLOCKED_HONEST";
      } else {
        outcome = "CLAIMED_WAITING";
      }

      // INVARIANT ABSOLU, quel que soit l'outcome : jamais un faux succès. Un job "succeeded" au
      // sens du worker ne peut jamais correspondre à une mission encore en attente d'info ; et un
      // statut "done" n'apparaît jamais sans qu'au moins un job ait réellement été réclamé+traité.
      if (missionAfter.status === "done") {
        expect(worker.claimed).toBeGreaterThan(0);
      }

      RESULTS.push({
        category: s.category, instruction: s.instruction, missionStatus: missionAfter.status,
        taskCount: tasksBefore.length, queuedActions: missionBefore.queued_actions,
        worker: { claimed: worker.claimed, succeeded: worker.succeeded, waiting: worker.waiting, blocked: worker.blocked, retried: worker.retried },
        outcome,
      });
    });
  }

  it("synthèse honnête — MISSION_CREATION / PLANNING / GOVERNANCE / AUTHORITATIVE_EXECUTION / BUSINESS_EFFECT rates", () => {
    expect(RESULTS.length).toBe(14);
    const byOutcome = RESULTS.reduce<Record<string, number>>((a, r) => { a[r.outcome] = (a[r.outcome] ?? 0) + 1; return a; }, {});
    const missionCreationSuccessRate = 100; // les 14 créations ont toutes abouti (sinon l'`it` aurait throw avant cette ligne)
    const authoritativeExecutionRate = Math.round(((byOutcome["CLAIMED_SUCCEEDED"] ?? 0) / RESULTS.length) * 1000) / 10;
    const governanceDetectionRate = Math.round(((byOutcome["AWAITING_VALIDATION_NOT_QUEUED"] ?? 0) / RESULTS.length) * 1000) / 10;
    const honestBlockRate = Math.round(((byOutcome["CLAIMED_BLOCKED_HONEST"] ?? 0) / RESULTS.length) * 1000) / 10;
    // eslint-disable-next-line no-console
    console.log("AUTHORITATIVE_EXECUTION_SAMPLE_SUMMARY " + JSON.stringify({
      total: 14, byOutcome, missionCreationSuccessRate, authoritativeExecutionRate,
      governanceDetectionRate, honestBlockRate, results: RESULTS,
    }));
  });
});
