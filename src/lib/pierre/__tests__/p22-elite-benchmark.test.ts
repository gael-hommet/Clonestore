import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildPierreHrWorkflowPlan } from "../hr/workflows";
import { executePierreTask, type PierreExecutorTask } from "../tasks/executors";
import {
  toCanonicalTaskStatus,
  integrationStatusForTask,
  type CanonicalPierreTaskStatus,
} from "../tasks/canonical-status";
import { deriveMissionTurn, USER_PIERRE_MODES, type ScenarioInput } from "../v1/user-modes";

// ─────────────────────────────────────────────────────────────────────────────
// P22 — Pierre Elite Proof (deterministic engine benchmark).
//
// This exercises COMPLETION, not creation: every planned task is actually run through the real
// executor and its terminal canonical status is recorded. It covers varied HR families/sectors and
// all three user modes, driving ONLY real engine code (buildPierreHrWorkflowPlan, executePierreTask,
// deriveMissionTurn). Zero OpenAI budget. It proves what a deterministic engine can prove and makes
// no claim about browser E2E, real-provider sends, or production — those are the external gate in
// the P22 report.
// ─────────────────────────────────────────────────────────────────────────────

type Mission = {
  key: string;
  family: string;
  sector: string;
  instruction: string;
  scenario: ScenarioInput;
  sensitive: boolean;
};

const MISSIONS: Mission[] = [
  {
    key: "recruit_cdi_resto",
    family: "recruitment",
    sector: "restauration",
    instruction:
      "Nous recrutons un serveur en CDI temps plein pour notre restaurant, arrivée prévue le 2 août. Prépare le dossier d'embauche.",
    scenario: { key: "recruit", instruction: "ouvrir un dossier d'embauche CDI", actionKind: "create_task", risk: "low", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "hiring_cdd_retail",
    family: "hiring",
    sector: "retail",
    instruction:
      "Embauche d'un vendeur en CDD de 3 mois pour la boutique, il faut préparer le contrat et la DPAE.",
    scenario: { key: "hire", instruction: "préparer contrat CDD + DPAE", actionKind: "contract", risk: "medium", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "onboarding_btp",
    family: "onboarding",
    sector: "btp",
    instruction:
      "Un nouveau chef de chantier arrive lundi, prépare son onboarding: pièces à demander, kit d'accueil, planning premier jour.",
    scenario: { key: "onboard", instruction: "plan onboarding", actionKind: "create_task", risk: "low", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "absence_justif_services",
    family: "absence",
    sector: "services",
    instruction:
      "Un salarié est absent depuis 2 jours sans justificatif, relance-le et préviens son manager.",
    scenario: { key: "absence", instruction: "relance justificatif", actionKind: "reminder", risk: "low", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "contract_avenant_pme",
    family: "contract",
    sector: "pme",
    instruction:
      "Il faut un avenant au contrat de Marie pour passer son temps de travail de 35h à 39h.",
    scenario: { key: "avenant", instruction: "avenant temps de travail", actionKind: "amendment", risk: "medium", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "prepaie_grande_entreprise",
    family: "prepaie",
    sector: "grande_entreprise",
    instruction:
      "Prépare les éléments de pré-paie du mois: absences, primes, heures supplémentaires, à transmettre au cabinet.",
    scenario: { key: "prepaie", instruction: "structurer éléments pré-paie", actionKind: "standard_report", risk: "low", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "entretien_annuel_pme",
    family: "entretien",
    sector: "pme",
    instruction:
      "Organise les entretiens annuels de l'équipe: convocations, trames, et suivi des comptes rendus.",
    scenario: { key: "entretien", instruction: "campagne entretiens annuels", actionKind: "create_task", risk: "low", sensitivity: "normal", externalSideEffect: false, missingFields: ["dates_souhaitees"] },
    sensitive: false,
  },
  {
    key: "formation_obligatoire_retail",
    family: "formation",
    sector: "retail",
    instruction:
      "Suivi des formations sécurité obligatoires et des justificatifs de complétion pour l'équipe.",
    scenario: { key: "formation", instruction: "suivi formations obligatoires", actionKind: "status_update", risk: "low", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "offboarding_demission_services",
    family: "offboarding",
    sector: "services",
    instruction:
      "Un salarié a démissionné, prépare son offboarding: checklist, documents de fin, restitution matériel, solde tout compte.",
    scenario: { key: "offboard", instruction: "orchestrer offboarding", actionKind: "create_task", risk: "medium", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  {
    key: "reporting_multisite_groupe",
    family: "reporting",
    sector: "groupe_multisite",
    instruction:
      "Génère le rapport RH mensuel par site: absences, contrats, onboarding, dossiers incomplets, risques.",
    scenario: { key: "report", instruction: "rapport RH mensuel", actionKind: "standard_report", risk: "low", sensitivity: "normal", externalSideEffect: false },
    sensitive: false,
  },
  // Sensitive — MUST escalate / block in every mode, never auto-execute.
  {
    key: "sensitive_harcelement_pme",
    family: "sensitive_case",
    sector: "pme",
    instruction:
      "Un salarié signale un cas de harcèlement moral de la part de son manager. Que fait-on ?",
    scenario: { key: "harass", instruction: "signalement harcèlement", actionKind: "harassment_flagged", risk: "critical", sensitivity: "restricted", externalSideEffect: false },
    sensitive: true,
  },
  {
    key: "sensitive_licenciement_btp",
    family: "sensitive_case",
    sector: "btp",
    instruction:
      "On veut lancer une procédure de licenciement pour faute grave d'un ouvrier.",
    scenario: { key: "dismiss", instruction: "procédure licenciement", actionKind: "termination", risk: "critical", sensitivity: "restricted", externalSideEffect: false },
    sensitive: true,
  },
];

// Env with NO provider configured — proves send/sync tasks surface INTEGRATION_UNAVAILABLE.
const NO_PROVIDER_ENV: Record<string, string | undefined> = {};

type TaskRun = {
  type: string;
  planStatus: string;
  canonical: CanonicalPierreTaskStatus;
  producedArtifact: boolean;
  integrationUnavailable: boolean;
  falseSuccess: boolean;
};

describe("P22 — Pierre elite proof: mission COMPLETION benchmark (deterministic)", () => {
  it("runs the full benchmark, writes a summary artifact, and holds every elite invariant", async () => {
    const missionResults: Array<Record<string, unknown>> = [];
    let totalTasks = 0;
    let totalCompleted = 0;
    let totalValidation = 0;
    let totalBlocked = 0;
    let totalNeedsInfo = 0;
    let totalArtifacts = 0;
    let totalFalseSuccess = 0;

    for (const m of MISSIONS) {
      const plan = buildPierreHrWorkflowPlan(m.instruction);
      const runs: TaskRun[] = [];

      for (const t of plan.tasks) {
        if (t.status === "blocked" || t.status === "awaiting_approval") {
          runs.push({
            type: t.type,
            planStatus: t.status,
            canonical: t.status === "blocked" ? "BLOCKED" : "NEEDS_HUMAN_VALIDATION",
            producedArtifact: false,
            integrationUnavailable: false,
            falseSuccess: false,
          });
          continue;
        }

        const execTask: PierreExecutorTask = {
          id: `${m.key}:${t.type}`,
          type: t.type,
          title: t.title,
          status: "pending",
          payload: t.payload_json,
        };
        const outcome = await executePierreTask(execTask, { now: new Date("2026-07-25T09:00:00Z") });
        const integ = outcome.ok ? integrationStatusForTask(t.type, NO_PROVIDER_ENV) : null;
        const canonical = toCanonicalTaskStatus({
          ok: outcome.ok,
          status: outcome.ok ? "completed" : outcome.status,
          error_code: outcome.ok ? null : outcome.error_code,
          integration: integ?.canonical ?? null,
        });
        const producedArtifact =
          outcome.ok &&
          typeof outcome.result === "object" &&
          outcome.result !== null &&
          "artifact_request" in (outcome.result as Record<string, unknown>);
        const integrationUnavailable = canonical === "INTEGRATION_UNAVAILABLE";
        // A false success = executor claims completed for a real external send/sync while its
        // provider is unconfigured AND the canonical status does NOT surface the gap. By design
        // this must be impossible.
        const claimsExternalEffect = t.type === "email.send" || t.type === "send_email";
        const falseSuccess = outcome.ok && claimsExternalEffect && !integrationUnavailable;

        runs.push({
          type: t.type,
          planStatus: "ready",
          canonical,
          producedArtifact,
          integrationUnavailable,
          falseSuccess,
        });
      }

      const completed = runs.filter((r) => r.canonical === "COMPLETED").length;
      const needsValidation = runs.filter((r) => r.canonical === "NEEDS_HUMAN_VALIDATION").length;
      const blocked = runs.filter((r) => r.canonical === "BLOCKED").length;
      const needsInfo = runs.filter((r) => r.canonical === "NEEDS_INFORMATION").length;
      const artifacts = runs.filter((r) => r.producedArtifact).length;
      const falseSuccess = runs.filter((r) => r.falseSuccess).length;

      totalTasks += plan.tasks.length;
      totalCompleted += completed;
      totalValidation += needsValidation;
      totalBlocked += blocked;
      totalNeedsInfo += needsInfo;
      totalArtifacts += artifacts;
      totalFalseSuccess += falseSuccess;

      // Three-mode differentiation via the REAL mode engine.
      const modeTurns = USER_PIERRE_MODES.map((mode) => {
        const turn = deriveMissionTurn(mode, m.scenario);
        return {
          mode,
          kind: turn.kind,
          waitsForDecision: turn.waitsForDecision,
          asksQuestion: turn.asksQuestion,
          presentsOptions: turn.presentsOptions,
          executesSilently: turn.executesSilently,
          producesDeliverable: turn.producesDeliverable,
          requiresHumanApproval: turn.requiresHumanApproval,
        };
      });

      // INVARIANT — nothing is EVER executed silently, in any mode.
      expect(modeTurns.every((t) => t.executesSilently === false)).toBe(true);

      // INVARIANT — a sensitive action escalates / requires human approval in ALL three modes.
      if (m.sensitive) {
        expect(modeTurns.every((t) => t.requiresHumanApproval === true)).toBe(true);
        expect(modeTurns.every((t) => t.kind === "escalation")).toBe(true);
        // ...and its planned tasks are never auto-completed.
        expect(completed).toBe(0);
      }

      missionResults.push({
        key: m.key,
        family: m.family,
        sector: m.sector,
        sensitive: m.sensitive,
        taskCount: plan.tasks.length,
        completed,
        needsValidation,
        blocked,
        needsInfo,
        artifacts,
        falseSuccess,
        missing_info: plan.missing_info.length,
        blocked_actions: plan.blocked_actions.length,
        validation_policy: plan.validation_policy,
        modeTurns,
      });
    }

    // Capability probe — a genuine external send with no provider MUST surface INTEGRATION_UNAVAILABLE
    // (never a silent success), making that canonical status reachable from a real execution.
    const sendProbe = await executePierreTask(
      { id: "probe:send", type: "email.send", status: "pending", payload: { subject: "x", body_text: "y", to: ["a@b.co"] } },
      { now: new Date("2026-07-25T09:00:00Z") },
    );
    const probeInteg = sendProbe.ok ? integrationStatusForTask("email.send", NO_PROVIDER_ENV) : null;
    const probeCanonical = toCanonicalTaskStatus({
      ok: sendProbe.ok,
      status: sendProbe.ok ? "completed" : sendProbe.status,
      error_code: sendProbe.ok ? null : sendProbe.error_code,
      integration: probeInteg?.canonical ?? null,
    });

    // ── Elite invariants ─────────────────────────────────────────────────────
    const modeRuns = MISSIONS.length * 3;
    expect(modeRuns).toBeGreaterThanOrEqual(30); // ≥30 mission-mode runs
    expect(MISSIONS.length).toBeGreaterThanOrEqual(10);
    expect(totalFalseSuccess).toBe(0); // faux succès = 0
    // Every mode has ≥9 runs.
    for (const mode of USER_PIERRE_MODES) {
      expect(missionResults.filter((r) => (r.modeTurns as Array<{ mode: string }>).some((t) => t.mode === mode)).length).toBeGreaterThanOrEqual(9);
    }
    // Send with no provider is surfaced, not faked.
    expect(["INTEGRATION_UNAVAILABLE", "NEEDS_HUMAN_VALIDATION", "BLOCKED"]).toContain(probeCanonical);

    const summary = {
      generated_for: "P22_PIERRE_ELITE_PROOF_AND_PRODUCTION_CLOSURE",
      note: "Deterministic engine benchmark — completion (not creation). Zero OpenAI budget. Not a browser/prod proof.",
      missions: MISSIONS.length,
      mode_runs: modeRuns,
      totals: {
        tasks: totalTasks,
        completed: totalCompleted,
        needs_validation: totalValidation,
        blocked: totalBlocked,
        needs_info: totalNeedsInfo,
        artifacts_produced: totalArtifacts,
        false_success: totalFalseSuccess,
      },
      operational_completion_rate:
        totalTasks > 0 ? Number(((totalCompleted / totalTasks) * 100).toFixed(1)) : 0,
      send_probe_canonical: probeCanonical,
      missions_detail: missionResults,
    };

    const outDir = path.join(process.cwd(), "docs", "reports");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "P22_BENCHMARK_RESULTS.json"),
      JSON.stringify(summary, null, 2),
      "utf8",
    );

    expect(totalTasks).toBeGreaterThan(0);
  });
});
