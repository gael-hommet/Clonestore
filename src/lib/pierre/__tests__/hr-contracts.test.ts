import { describe, expect, it } from "vitest";

import {
  normalizePierreHrDomain,
  normalizePierreHrRiskLevel,
  classifyPierreHrActionRequirement,
} from "../hr/contracts";
import { executePierreTask } from "../tasks/executors";

// ─── normalizePierreHrDomain ─────────────────────────────────────────────────

describe("normalizePierreHrDomain", () => {
  it("retourne un domaine valide tel quel", () => {
    expect(normalizePierreHrDomain("hiring")).toBe("hiring");
    expect(normalizePierreHrDomain("recruitment_ops")).toBe("recruitment_ops");
    expect(normalizePierreHrDomain("onboarding")).toBe("onboarding");
    expect(normalizePierreHrDomain("sensitive_case")).toBe("sensitive_case");
  });

  it("normalise casse et espaces", () => {
    expect(normalizePierreHrDomain("  HIRING  ")).toBe("hiring");
    expect(normalizePierreHrDomain("Internal_Communication")).toBe("internal_communication");
  });

  it("retourne unknown pour une valeur inconnue", () => {
    expect(normalizePierreHrDomain("xyz_invalid")).toBe("unknown");
    expect(normalizePierreHrDomain("")).toBe("unknown");
    expect(normalizePierreHrDomain(null)).toBe("unknown");
    expect(normalizePierreHrDomain(undefined)).toBe("unknown");
    expect(normalizePierreHrDomain(42)).toBe("unknown");
  });
});

// ─── normalizePierreHrRiskLevel ───────────────────────────────────────────────

describe("normalizePierreHrRiskLevel", () => {
  it("retourne les niveaux couleur natifs", () => {
    expect(normalizePierreHrRiskLevel("green")).toBe("green");
    expect(normalizePierreHrRiskLevel("orange")).toBe("orange");
    expect(normalizePierreHrRiskLevel("red")).toBe("red");
    expect(normalizePierreHrRiskLevel("black")).toBe("black");
  });

  it("fait le pont avec PierreRiskLevel (low/medium/high)", () => {
    expect(normalizePierreHrRiskLevel("low")).toBe("green");
    expect(normalizePierreHrRiskLevel("medium")).toBe("orange");
    expect(normalizePierreHrRiskLevel("high")).toBe("red");
  });

  it("fait le pont avec PierreMissionRiskLevel (normal/sensitive/critical)", () => {
    expect(normalizePierreHrRiskLevel("normal")).toBe("green");
    expect(normalizePierreHrRiskLevel("sensitive")).toBe("orange");
    expect(normalizePierreHrRiskLevel("critical")).toBe("red");
  });

  it("fait le pont avec les vocabulaires UI (blocked/forbidden/human_only)", () => {
    expect(normalizePierreHrRiskLevel("blocked")).toBe("black");
    expect(normalizePierreHrRiskLevel("forbidden")).toBe("black");
    expect(normalizePierreHrRiskLevel("human_only")).toBe("black");
  });

  it("retourne green par défaut pour toute valeur inconnue", () => {
    expect(normalizePierreHrRiskLevel("garbage")).toBe("green");
    expect(normalizePierreHrRiskLevel(null)).toBe("green");
    expect(normalizePierreHrRiskLevel(undefined)).toBe("green");
    expect(normalizePierreHrRiskLevel(42)).toBe("green");
  });
});

// ─── classifyPierreHrActionRequirement ───────────────────────────────────────

describe("classifyPierreHrActionRequirement — action verte", () => {
  it("relance → auto_executable / none / green / not blocked", () => {
    const req = classifyPierreHrActionRequirement({ kind: "relance" });
    expect(req.action_class).toBe("auto_executable");
    expect(req.approval_policy).toBe("none");
    expect(req.risk_level).toBe("green");
    expect(req.blocked).toBe(false);
  });

  it("demande_info → auto_executable / none / green", () => {
    const req = classifyPierreHrActionRequirement({ kind: "demande_info" });
    expect(req.action_class).toBe("auto_executable");
    expect(req.approval_policy).toBe("none");
    expect(req.risk_level).toBe("green");
    expect(req.blocked).toBe(false);
  });
});

describe("classifyPierreHrActionRequirement — action orange", () => {
  it("email_salarie → validation_recommended / recommended / orange / not blocked", () => {
    const req = classifyPierreHrActionRequirement({ kind: "email_salarie" });
    expect(req.action_class).toBe("validation_recommended");
    expect(req.approval_policy).toBe("recommended");
    expect(req.risk_level).toBe("orange");
    expect(req.blocked).toBe(false);
  });

  it("onboarding_prep → validation_recommended / recommended / orange", () => {
    const req = classifyPierreHrActionRequirement({ kind: "onboarding_prep" });
    expect(req.action_class).toBe("validation_recommended");
    expect(req.approval_policy).toBe("recommended");
    expect(req.risk_level).toBe("orange");
    expect(req.blocked).toBe(false);
  });
});

describe("classifyPierreHrActionRequirement — action rouge", () => {
  it("contrat → validation_required / required / red / not blocked", () => {
    const req = classifyPierreHrActionRequirement({ kind: "contrat" });
    expect(req.action_class).toBe("validation_required");
    expect(req.approval_policy).toBe("required");
    expect(req.risk_level).toBe("red");
    expect(req.blocked).toBe(false);
  });

  it("remuneration → validation_required / required / red", () => {
    const req = classifyPierreHrActionRequirement({ kind: "remuneration" });
    expect(req.action_class).toBe("validation_required");
    expect(req.approval_policy).toBe("required");
    expect(req.risk_level).toBe("red");
    expect(req.blocked).toBe(false);
  });
});

describe("classifyPierreHrActionRequirement — action noire", () => {
  it("decision_licenciement → blocked_without_human / human_only / black / blocked true", () => {
    const req = classifyPierreHrActionRequirement({ kind: "decision_licenciement" });
    expect(req.action_class).toBe("blocked_without_human");
    expect(req.approval_policy).toBe("human_only");
    expect(req.risk_level).toBe("black");
    expect(req.blocked).toBe(true);
  });

  it("decision_sanction → blocked_without_human / human_only / black / blocked true", () => {
    const req = classifyPierreHrActionRequirement({ kind: "decision_sanction" });
    expect(req.action_class).toBe("blocked_without_human");
    expect(req.approval_policy).toBe("human_only");
    expect(req.risk_level).toBe("black");
    expect(req.blocked).toBe(true);
  });

  it("interpretation_droit → blocked_without_human / human_only / black / blocked true", () => {
    const req = classifyPierreHrActionRequirement({ kind: "interpretation_droit" });
    expect(req.action_class).toBe("blocked_without_human");
    expect(req.approval_policy).toBe("human_only");
    expect(req.risk_level).toBe("black");
    expect(req.blocked).toBe(true);
  });
});

describe("classifyPierreHrActionRequirement — kind inconnu", () => {
  it("retourne validation_required / required / red par prudence", () => {
    const req = classifyPierreHrActionRequirement({ kind: "xyz_unknown_kind" });
    expect(req.action_class).toBe("validation_required");
    expect(req.approval_policy).toBe("required");
    expect(req.risk_level).toBe("red");
    expect(req.blocked).toBe(false);
  });

  it("null/undefined kind → validation_required par prudence", () => {
    const req = classifyPierreHrActionRequirement({ kind: null });
    expect(req.action_class).toBe("validation_required");
    expect(req.approval_policy).toBe("required");
  });
});

describe("classifyPierreHrActionRequirement — override_risk (escalade seulement)", () => {
  it("override_risk black sur action verte → risk_level black, validation_required, not blocked", () => {
    // Une relance (verte) avec contexte noir → blocage contextuel mais pas absolu
    const req = classifyPierreHrActionRequirement({
      kind: "relance",
      override_risk: "black",
    });
    expect(req.risk_level).toBe("black");
    expect(req.action_class).toBe("validation_required");
    expect(req.approval_policy).toBe("required");
    expect(req.blocked).toBe(false);
  });

  it("override_risk green sur action noire → reste black / blocked (pas de réduction)", () => {
    const req = classifyPierreHrActionRequirement({
      kind: "decision_licenciement",
      override_risk: "green",
    });
    expect(req.action_class).toBe("blocked_without_human");
    expect(req.risk_level).toBe("black");
    expect(req.blocked).toBe(true);
  });

  it("override_risk red sur action verte → escalade à red", () => {
    const req = classifyPierreHrActionRequirement({
      kind: "relance",
      override_risk: "red",
    });
    expect(req.risk_level).toBe("red");
    expect(req.approval_policy).toBe("required");
    expect(req.blocked).toBe(false);
  });

  it("override_risk orange sur action orange → reste orange (pas de changement)", () => {
    const req = classifyPierreHrActionRequirement({
      kind: "email_salarie",
      override_risk: "orange",
    });
    expect(req.risk_level).toBe("orange");
    expect(req.action_class).toBe("validation_recommended");
  });
});

// ─── executePierreTask — HR gate ──────────────────────────────────────────────

describe("executePierreTask — HR gate", () => {
  it("bloque une tâche avec hr_action_class blocked_without_human", async () => {
    const outcome = await executePierreTask({
      id: "task-test-1",
      type: "generate_document",
      status: "running",
      payload: {
        source: "mission_engine",
        hr_action_class: "blocked_without_human",
        hr_approval_policy: "human_only",
        hr_risk_level: "black",
        hr_task_kind: "decision_licenciement",
        human_note: "Décision humaine exclusive.",
      },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error_code).toBe("HR_BLOCKED_ACTION");
      expect(outcome.status).toBe("blocked");
      expect(outcome.log.event).toBe("executor_hr_blocked");
    }
  });

  it("bloque une tâche avec hr_approval_policy human_only même si action_class absent", async () => {
    const outcome = await executePierreTask({
      id: "task-test-2",
      type: "prepare_email",
      status: "running",
      payload: {
        source: "mission_engine",
        hr_approval_policy: "human_only",
        hr_risk_level: "black",
      },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error_code).toBe("HR_BLOCKED_ACTION");
      expect(outcome.status).toBe("blocked");
    }
  });

  it("n'exécute pas une tâche noire même avec un type légitime", async () => {
    const outcome = await executePierreTask({
      id: "task-test-3",
      type: "structure_mission",
      status: "running",
      payload: {
        source: "mission_engine",
        hr_action_class: "blocked_without_human",
        hr_approval_policy: "human_only",
        hr_task_kind: "decision_salariale_finale",
        human_note: "Décision salariale finale : humain uniquement.",
      },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error_code).toBe("HR_BLOCKED_ACTION");
    }
  });

  it("laisse passer une tâche verte auto_executable avec payload valide", async () => {
    const outcome = await executePierreTask({
      id: "task-test-4",
      type: "generate_document",
      status: "running",
      payload: {
        source: "mission_engine",
        hr_action_class: "auto_executable",
        hr_approval_policy: "none",
        hr_risk_level: "green",
        hr_task_kind: "rapport_standard",
      },
    });

    // Sans contenu dans le payload, l'executor retourne ok:true avec artifact_pending
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.log.event).toBe("document_artifact_planned");
    }
  });

  it("laisse passer une tâche orange sans HR payload (pas de gate active)", async () => {
    const outcome = await executePierreTask({
      id: "task-test-5",
      type: "generate_document",
      status: "running",
      payload: {
        source: "mission_engine",
      },
    });

    expect(outcome.ok).toBe(true);
  });

  it("retourne HR_BLOCKED_ACTION dans le log.payload avec les détails HR", async () => {
    const outcome = await executePierreTask({
      id: "task-test-6",
      type: "generate_document",
      status: "running",
      payload: {
        source: "mission_engine",
        hr_action_class: "blocked_without_human",
        hr_approval_policy: "human_only",
        hr_risk_level: "black",
        hr_task_kind: "modification_politique_rh",
        human_note: "Modification de politique RH : décision humaine exclusive.",
      },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.log.payload?.hr_action_class).toBe("blocked_without_human");
      expect(outcome.log.payload?.hr_task_kind).toBe("modification_politique_rh");
      expect(outcome.log.payload?.hr_risk_level).toBe("black");
    }
  });
});
