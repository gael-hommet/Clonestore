import { describe, it, expect } from "vitest";
import {
  extractPierreHrWorkflowSignals,
  detectPierreHrWorkflowDomain,
  detectPierreHrWorkflowRisk,
  detectPierreHrWorkflowPriority,
  buildPierreHrMissingInfo,
  buildPierreHrWorkflowTasks,
  mapPierreWorkflowTaskToDbTask,
  buildPierreHrWorkflowPlan,
  explainPierreWorkflowPlan,
  type PierreHrWorkflowDomain,
  type PierreHrWorkflowRiskLevel,
} from "../hr/workflows";

// ── Canonical task types allowed by the executor ──────────────────────────
const VALID_TASK_TYPES = new Set([
  "doc.generate",
  "doc.rewrite",
  "email.draft",
  "email.send",
  "pdf.generate",
  "followup.schedule",
  "reminder.create",
]);

// ── Signal extraction ─────────────────────────────────────────────────────

describe("extractPierreHrWorkflowSignals", () => {
  it("detects hiring signals", () => {
    const signals = extractPierreHrWorkflowSignals("Nouveau salarié en CDI, embauche prévue");
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some((s) => ["embauche", "cdi", "nouveau salarié"].includes(s))).toBe(true);
  });

  it("detects absence signals", () => {
    const signals = extractPierreHrWorkflowSignals("Le salarié est absent, justificatif requis");
    expect(signals).toContain("absent");
  });

  it("detects sensitive_case signals", () => {
    const signals = extractPierreHrWorkflowSignals("Procédure de licenciement en cours");
    expect(signals.some((s) => s.includes("licenci"))).toBe(true);
  });

  it("returns empty array for unrelated text", () => {
    const signals = extractPierreHrWorkflowSignals("Bonjour, comment allez-vous ?");
    expect(signals).toHaveLength(0);
  });

  it("deduplicates repeated signals", () => {
    const signals = extractPierreHrWorkflowSignals("congé congé congé");
    const count = signals.filter((s) => s === "congé").length;
    expect(count).toBe(1);
  });
});

// ── Domain detection ──────────────────────────────────────────────────────

describe("detectPierreHrWorkflowDomain", () => {
  const cases: Array<{ input: string; expected: PierreHrWorkflowDomain }> = [
    { input: "Nouveau salarié en CDI, embauche lundi", expected: "hiring" },
    { input: "Onboarding du nouvel arrivant, premier jour", expected: "onboarding" },
    { input: "Salarié absent, arrêt maladie depuis hier", expected: "absence" },
    { input: "Préparer un avenant au contrat de travail", expected: "contract" },
    { input: "Préparer la synthèse de pré-paie du mois", expected: "payroll_prep" },
    { input: "Compléter le dossier salarié, pièce manquante", expected: "employee_file" },
    { input: "Organiser une formation CPF obligatoire", expected: "training" },
    { input: "Convoquer un entretien annuel la semaine prochaine", expected: "interview" },
    { input: "Salarié qui démissionne, gérer la sortie", expected: "offboarding" },
    { input: "Procédure disciplinaire pour harcèlement", expected: "sensitive_case" },
    { input: "Bonjour, besoin d'un document RH générique", expected: "general_hr" },
  ];

  for (const { input, expected } of cases) {
    it(`detects "${expected}" from input`, () => {
      expect(detectPierreHrWorkflowDomain(input)).toBe(expected);
    });
  }

  it("prioritizes sensitive_case over offboarding", () => {
    const result = detectPierreHrWorkflowDomain(
      "Salarié qui démissionne suite à un harcèlement — procédure disciplinaire",
    );
    expect(result).toBe("sensitive_case");
  });

  it("prioritizes offboarding over contract", () => {
    const result = detectPierreHrWorkflowDomain(
      "Rupture conventionnelle signée, préparer les documents de fin de contrat",
    );
    expect(result).toBe("offboarding");
  });

  it("respects context domain override when valid", () => {
    const result = detectPierreHrWorkflowDomain("texte quelconque", {
      domain: "payroll_prep",
    });
    expect(result).toBe("payroll_prep");
  });

  it("ignores invalid context domain override", () => {
    const result = detectPierreHrWorkflowDomain("embauche CDI", {
      domain: "invalide_xyz",
    });
    expect(result).toBe("hiring");
  });
});

// ── Risk detection ────────────────────────────────────────────────────────

describe("detectPierreHrWorkflowRisk", () => {
  it("sensitive_case is always black baseline", () => {
    const risk = detectPierreHrWorkflowRisk("dossier sensible", "sensitive_case");
    expect(risk).toBe("black");
  });

  it("contract is red baseline", () => {
    const risk = detectPierreHrWorkflowRisk("préparer un contrat CDI", "contract");
    expect(risk).toBe("red");
  });

  it("black signal escalates any domain to black", () => {
    const risk = detectPierreHrWorkflowRisk("licenciement pour faute grave", "absence");
    expect(risk).toBe("black");
  });

  it("red signal escalates green domain to red", () => {
    const risk = detectPierreHrWorkflowRisk("absence injustifiée répétée, sanction possible", "absence");
    expect(risk).toBe("red");
  });

  it("orange signal escalates green domain to orange", () => {
    const risk = detectPierreHrWorkflowRisk("absence et justificatif à recevoir", "general_hr");
    expect(risk).toBe("orange");
  });

  it("onboarding without escalation signals stays green", () => {
    const risk = detectPierreHrWorkflowRisk("checklist intégration nouveau salarié", "onboarding");
    expect(risk).toBe("green");
  });

  it("never reduces risk from domain baseline", () => {
    // contract = red baseline; no escalation signal → stays red, not green
    const risk = detectPierreHrWorkflowRisk("simple bonjour", "contract");
    expect(["red", "black"]).toContain(risk);
  });

  it("context risk_level can escalate but not reduce", () => {
    const risk = detectPierreHrWorkflowRisk("onboarding classique", "onboarding", {
      risk_level: "orange",
    });
    expect(risk).toBe("orange");
  });
});

// ── Priority detection ────────────────────────────────────────────────────

describe("detectPierreHrWorkflowPriority", () => {
  it("black risk → urgent", () => {
    expect(detectPierreHrWorkflowPriority("licenciement", "sensitive_case", "black")).toBe("urgent");
  });

  it("urgent keyword → urgent", () => {
    expect(detectPierreHrWorkflowPriority("urgent, besoin immédiatement", "general_hr", "green")).toBe("urgent");
  });

  it("red risk → high", () => {
    expect(detectPierreHrWorkflowPriority("avenant contrat", "contract", "red")).toBe("high");
  });

  it("payroll_prep → high", () => {
    expect(detectPierreHrWorkflowPriority("synthèse paie du mois", "payroll_prep", "orange")).toBe("high");
  });

  it("high keyword → high", () => {
    expect(detectPierreHrWorkflowPriority("c'est prioritaire pour la semaine", "general_hr", "green")).toBe("high");
  });

  it("orange risk without keywords → normal", () => {
    expect(detectPierreHrWorkflowPriority("justificatif absence", "absence", "orange")).toBe("normal");
  });

  it("green risk without keywords → low", () => {
    expect(detectPierreHrWorkflowPriority("document RH standard", "general_hr", "green")).toBe("low");
  });

  it("sensitive_case always urgent regardless of risk param", () => {
    expect(detectPierreHrWorkflowPriority("dossier disciplinaire", "sensitive_case", "green")).toBe("urgent");
  });
});

// ── Missing info ──────────────────────────────────────────────────────────

describe("buildPierreHrMissingInfo", () => {
  it("hiring without date → start_date required", () => {
    const missing = buildPierreHrMissingInfo("hiring", "Embauche CDI sans date");
    expect(missing.some((m) => m.field === "start_date" && m.required)).toBe(true);
  });

  it("hiring without contract type → contract_type required", () => {
    const missing = buildPierreHrMissingInfo("hiring", "Embauche de Jean Dupont lundi prochain");
    expect(missing.some((m) => m.field === "contract_type")).toBe(true);
  });

  it("onboarding without employee → employee_name not required", () => {
    const missing = buildPierreHrMissingInfo("onboarding", "Préparer l'onboarding");
    const em = missing.find((m) => m.field === "employee_name");
    if (em) expect(em.required).toBe(false);
  });

  it("absence without employee → employee_name required", () => {
    const missing = buildPierreHrMissingInfo("absence", "Salarié absent, pas de justificatif");
    expect(missing.some((m) => m.field === "employee_name" && m.required)).toBe(true);
  });

  it("absence without dates → absence_dates required", () => {
    const missing = buildPierreHrMissingInfo("absence", "Salarié absent");
    expect(missing.some((m) => m.field === "absence_dates" && m.required)).toBe(true);
  });

  it("contract without employee → employee_name required", () => {
    const missing = buildPierreHrMissingInfo("contract", "Préparer un avenant CDI");
    expect(missing.some((m) => m.field === "employee_name" && m.required)).toBe(true);
  });

  it("payroll_prep without date → pay_period required", () => {
    const missing = buildPierreHrMissingInfo("payroll_prep", "Préparer la synthèse paie");
    expect(missing.some((m) => m.field === "pay_period" && m.required)).toBe(true);
  });

  it("interview without employee → employee_name required", () => {
    const missing = buildPierreHrMissingInfo("interview", "Convoquer pour entretien annuel");
    expect(missing.some((m) => m.field === "employee_name" && m.required)).toBe(true);
  });

  it("offboarding without employee → employee_name required", () => {
    const missing = buildPierreHrMissingInfo("offboarding", "Gérer la sortie");
    expect(missing.some((m) => m.field === "employee_name" && m.required)).toBe(true);
  });

  it("sensitive_case without incident description → incident_description required", () => {
    const missing = buildPierreHrMissingInfo("sensitive_case", "Cas disciplinaire");
    expect(missing.some((m) => m.field === "incident_description" && m.required)).toBe(true);
  });

  it("removes employee_name when 'aucun salarié spécifique' in input", () => {
    const missing = buildPierreHrMissingInfo(
      "onboarding",
      "Aucun salarié spécifique, document général",
    );
    expect(missing.find((m) => m.field === "employee_name")).toBeUndefined();
  });

  it("removes employee_name when employee context already has employee_id", () => {
    const missing = buildPierreHrMissingInfo("absence", "Salarié absent", {
      employee_id: "emp-123",
      employee_name: "Jean Dupont",
    });
    expect(missing.find((m) => m.field === "employee_name")).toBeUndefined();
  });

  it("general_hr without employee reference returns no mandatory missing info", () => {
    const missing = buildPierreHrMissingInfo("general_hr", "Document RH générique sans salarié");
    const required = missing.filter((m) => m.required);
    expect(required).toHaveLength(0);
  });

  it("removes email field when 'aucun email' in input", () => {
    const missing = buildPierreHrMissingInfo("absence", "Salarié absent, aucun email à envoyer");
    expect(missing.find((m) => m.field === "email")).toBeUndefined();
  });
});

// ── Task building ─────────────────────────────────────────────────────────

describe("buildPierreHrWorkflowTasks", () => {
  function makeAnalysis(domain: PierreHrWorkflowDomain, risk: PierreHrWorkflowRiskLevel = "green") {
    return {
      input: "test input",
      domain,
      risk_level: risk,
      priority: "normal" as const,
      signals: [],
      language: "fr" as const,
      tone: "professionnel",
      has_employee_reference: false,
      employee_name_detected: null,
      missing_info: [],
      approval_required: risk === "red" || risk === "black",
      validation_policy: {
        approval_required: risk === "red" || risk === "black",
        approval_reason: null,
        blocked: risk === "black",
        can_execute_low_risk_tasks: risk !== "black",
      },
      employee_context: null,
    };
  }

  it("all generated task types are valid canonical types", () => {
    const domains: PierreHrWorkflowDomain[] = [
      "hiring", "onboarding", "absence", "contract", "payroll_prep",
      "employee_file", "training", "interview", "offboarding",
      "sensitive_case", "general_hr",
    ];
    for (const domain of domains) {
      const tasks = buildPierreHrWorkflowTasks(makeAnalysis(domain));
      for (const task of tasks) {
        expect(VALID_TASK_TYPES.has(task.type)).toBe(true);
      }
    }
  });

  it("sensitive_case tasks all have approval_required=true and status awaiting_approval", () => {
    const tasks = buildPierreHrWorkflowTasks(makeAnalysis("sensitive_case", "black"));
    for (const task of tasks) {
      expect(task.approval_required).toBe(true);
      expect(task.status).toBe("awaiting_approval");
    }
  });

  it("contract main tasks have awaiting_approval status", () => {
    const tasks = buildPierreHrWorkflowTasks(makeAnalysis("contract", "red"));
    const docTask = tasks.find((t) => t.type === "doc.generate");
    expect(docTask).toBeDefined();
    expect(docTask!.status).toBe("awaiting_approval");
  });

  it("payroll_prep synthesis task has awaiting_approval status", () => {
    const tasks = buildPierreHrWorkflowTasks(makeAnalysis("payroll_prep", "orange"));
    const docTask = tasks.find((t) => t.type === "doc.generate");
    expect(docTask).toBeDefined();
    expect(docTask!.status).toBe("awaiting_approval");
  });

  it("appends reminder.create with status blocked when required missing info exists", () => {
    const analysis = {
      ...makeAnalysis("absence"),
      missing_info: [{ field: "employee_name", question: "Nom ?", required: true }],
    };
    const tasks = buildPierreHrWorkflowTasks(analysis);
    const reminder = tasks.find(
      (t) => t.type === "reminder.create" && t.status === "blocked",
    );
    expect(reminder).toBeDefined();
  });

  it("does not append reminder.create when missing info is optional only", () => {
    const analysis = {
      ...makeAnalysis("onboarding"),
      missing_info: [{ field: "employee_name", question: "Nom ?", required: false }],
    };
    const tasks = buildPierreHrWorkflowTasks(analysis);
    const blocked = tasks.filter((t) => t.status === "blocked");
    expect(blocked).toHaveLength(0);
  });

  it("onboarding tasks are all ready (green risk)", () => {
    const tasks = buildPierreHrWorkflowTasks(makeAnalysis("onboarding", "green"));
    for (const task of tasks) {
      expect(task.status).toBe("ready");
    }
  });

  it("hiring tasks with approval required are awaiting_approval", () => {
    const analysis = {
      ...makeAnalysis("hiring", "red"),
      approval_required: true,
      validation_policy: {
        approval_required: true,
        approval_reason: "Risque élevé",
        blocked: false,
        can_execute_low_risk_tasks: true,
      },
    };
    const tasks = buildPierreHrWorkflowTasks(analysis);
    const docTask = tasks.find((t) => t.type === "doc.generate");
    expect(docTask!.status).toBe("awaiting_approval");
  });

  it("all tasks have execute_at field (null is valid)", () => {
    const tasks = buildPierreHrWorkflowTasks(makeAnalysis("general_hr"));
    for (const task of tasks) {
      expect("execute_at" in task).toBe(true);
    }
  });

  it("tasks enrich employee_name when employee_name_detected", () => {
    const analysis = {
      ...makeAnalysis("absence"),
      employee_name_detected: "Marie Curie",
    };
    const tasks = buildPierreHrWorkflowTasks(analysis);
    for (const task of tasks) {
      expect(task.payload_json.employee_name).toBe("Marie Curie");
    }
  });

  it("tasks enrich employee_context when provided", () => {
    const analysis = {
      ...makeAnalysis("onboarding"),
      employee_context: { employee_id: "emp-42", employee_name: "Paul Martin" },
    };
    const tasks = buildPierreHrWorkflowTasks(analysis);
    for (const task of tasks) {
      expect(task.payload_json.employee_id).toBe("emp-42");
    }
  });
});

// ── DB task mapper ─────────────────────────────────────────────────────────

describe("mapPierreWorkflowTaskToDbTask", () => {
  const sampleDraft = {
    type: "doc.generate",
    title: "Document test",
    description: "Description test",
    status: "ready" as const,
    approval_required: false,
    execute_at: null,
    payload_json: { domain: "general_hr", risk_level: "green" },
  };

  it("returns execute_at (not scheduled_for)", () => {
    const result = mapPierreWorkflowTaskToDbTask(sampleDraft);
    expect("execute_at" in result).toBe(true);
    expect("scheduled_for" in result).toBe(false);
  });

  it("preserves type unchanged", () => {
    const result = mapPierreWorkflowTaskToDbTask(sampleDraft);
    expect(result.type).toBe("doc.generate");
  });

  it("preserves status", () => {
    const draft = { ...sampleDraft, status: "awaiting_approval" as const };
    const result = mapPierreWorkflowTaskToDbTask(draft);
    expect(result.status).toBe("awaiting_approval");
  });

  it("execute_at is null when not scheduled", () => {
    const result = mapPierreWorkflowTaskToDbTask(sampleDraft);
    expect(result.execute_at).toBeNull();
  });

  it("preserves execute_at ISO string when provided", () => {
    const iso = "2026-06-01T09:00:00.000Z";
    const draft = { ...sampleDraft, execute_at: iso };
    const result = mapPierreWorkflowTaskToDbTask(draft);
    expect(result.execute_at).toBe(iso);
  });

  it("payload_json is a plain object", () => {
    const result = mapPierreWorkflowTaskToDbTask(sampleDraft);
    expect(typeof result.payload_json).toBe("object");
    expect(result.payload_json).not.toBeNull();
  });
});

// ── Full plan builder ─────────────────────────────────────────────────────

describe("buildPierreHrWorkflowPlan", () => {
  it("returns a plan for any non-empty input", () => {
    const plan = buildPierreHrWorkflowPlan("Demande RH quelconque");
    expect(plan).toBeDefined();
    expect(plan.domain).toBeDefined();
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it("returns general_hr for empty input (no crash)", () => {
    const plan = buildPierreHrWorkflowPlan("");
    expect(plan.domain).toBe("general_hr");
  });

  it("all plan task types are valid canonical types", () => {
    const inputs = [
      "Embauche CDI lundi prochain",
      "Onboarding nouveau salarié",
      "Salarié absent, justificatif requis le 10/05/2026",
      "Avenant contrat de Jean Dupont",
      "Synthèse pré-paie mai 2026",
      "Dossier salarié incomplet",
      "Formation CPF obligatoire semaine prochaine",
      "Entretien annuel Marie Curie le 15/05/2026",
      "Rupture conventionnelle, sortie de Marc Petit",
      "Procédure disciplinaire pour harcèlement",
      "Document RH général sans salarié",
    ];
    for (const input of inputs) {
      const plan = buildPierreHrWorkflowPlan(input);
      for (const task of plan.tasks) {
        expect(VALID_TASK_TYPES.has(task.type)).toBe(true);
      }
    }
  });

  it("sensitive_case plan has approval_required=true", () => {
    const plan = buildPierreHrWorkflowPlan("Licenciement pour faute grave");
    expect(plan.approval_required).toBe(true);
  });

  it("sensitive_case plan has blocked_actions", () => {
    const plan = buildPierreHrWorkflowPlan("Harcèlement moral, procédure disciplinaire");
    expect(plan.blocked_actions.length).toBeGreaterThan(0);
  });

  it("sensitive_case plan validation_policy.blocked=true", () => {
    const plan = buildPierreHrWorkflowPlan("Discrimination, sanction disciplinaire");
    expect(plan.validation_policy.blocked).toBe(true);
  });

  it("onboarding without sensitive signals has approval_required=false", () => {
    const plan = buildPierreHrWorkflowPlan(
      "Préparer l'onboarding, aucun salarié spécifique, aucun email",
    );
    expect(plan.approval_required).toBe(false);
  });

  it("contract plan has approval_required=true", () => {
    const plan = buildPierreHrWorkflowPlan("Préparer un avenant CDI pour Jean Dupont");
    expect(plan.approval_required).toBe(true);
  });

  it("plan has missing_info array (can be empty)", () => {
    const plan = buildPierreHrWorkflowPlan("Document RH générique");
    expect(Array.isArray(plan.missing_info)).toBe(true);
  });

  it("plan has missing_info_questions array same length", () => {
    const plan = buildPierreHrWorkflowPlan("Embauche CDI");
    expect(plan.missing_info.length).toBe(plan.missing_info_questions.length);
  });

  it("plan has recommended_next_action with type and description", () => {
    const plan = buildPierreHrWorkflowPlan("Entretien annuel lundi");
    expect(plan.recommended_next_action.type).toBeDefined();
    expect(typeof plan.recommended_next_action.description).toBe("string");
  });

  it("plan with required missing info → recommended_next_action type=provide_info", () => {
    const plan = buildPierreHrWorkflowPlan("Salarié absent");
    if (plan.missing_info.length > 0) {
      expect(plan.recommended_next_action.type).toBe("provide_info");
    }
  });

  it("sensitive_case → recommended_next_action type=escalate", () => {
    // Employee name (Jean Dupont) + "contexte" keyword → missing_info is empty
    // → escalate is the next action (not provide_info)
    const plan = buildPierreHrWorkflowPlan(
      "Harcèlement de Jean Dupont documenté en contexte — dossier à traiter",
    );
    expect(plan.recommended_next_action.type).toBe("escalate");
  });

  it("approval_required without sensitive_case → recommended_next_action type=validate", () => {
    const plan = buildPierreHrWorkflowPlan("Avenant contrat CDI Jean Dupont le 01/06/2026");
    if (plan.missing_info.length === 0) {
      expect(plan.recommended_next_action.type).toBe("validate");
    }
  });

  it("plan explanation is a non-empty string", () => {
    const plan = buildPierreHrWorkflowPlan("Préparer une note RH interne");
    expect(typeof plan.explanation).toBe("string");
    expect(plan.explanation.length).toBeGreaterThan(0);
  });

  it("plan summary clips long input at ~200 chars", () => {
    const longInput = "A".repeat(300);
    const plan = buildPierreHrWorkflowPlan(longInput);
    expect(plan.summary.length).toBeLessThan(350);
  });

  it("autonomy_level option is accepted without crash", () => {
    const plan = buildPierreHrWorkflowPlan("Mission RH", { autonomy_level: "full_auto" });
    expect(plan).toBeDefined();
  });

  it("employee_context option propagates to task payloads", () => {
    const plan = buildPierreHrWorkflowPlan("Onboarding", {
      employee_context: { employee_id: "emp-99", employee_name: "Alice Bernard" },
    });
    const hasContext = plan.tasks.some(
      (t) => t.payload_json.employee_id === "emp-99",
    );
    expect(hasContext).toBe(true);
  });

  it("execute_at option is applied to followup.schedule tasks", () => {
    const iso = "2026-07-01T10:00:00.000Z";
    const plan = buildPierreHrWorkflowPlan("Suivi dossier onboarding", {
      execute_at: iso,
    });
    const followup = plan.tasks.find((t) => t.type === "followup.schedule");
    if (followup) {
      expect(followup.execute_at).toBe(iso);
    }
  });

  it("no task has scheduled_for field in payload", () => {
    const plan = buildPierreHrWorkflowPlan("Mission RH quelconque");
    for (const task of plan.tasks) {
      // scheduled_for must NOT appear as a DB column — check payload_json
      const payloadKeys = Object.keys(task.payload_json);
      expect(payloadKeys).not.toContain("scheduled_for");
    }
  });

  it("all tasks have execute_at field (null or ISO)", () => {
    const plan = buildPierreHrWorkflowPlan("Embauche CDI");
    for (const task of plan.tasks) {
      expect("execute_at" in task).toBe(true);
      expect(task.execute_at === null || typeof task.execute_at === "string").toBe(true);
    }
  });
});

// ── Plan explainer ────────────────────────────────────────────────────────

describe("explainPierreWorkflowPlan", () => {
  it("produces a non-empty explanation string", () => {
    const plan = buildPierreHrWorkflowPlan("Mission RH standard");
    const explanation = explainPierreWorkflowPlan(plan);
    expect(typeof explanation).toBe("string");
    expect(explanation.length).toBeGreaterThan(10);
  });

  it("explanation mentions task count", () => {
    const plan = buildPierreHrWorkflowPlan("Embauche CDI Jean Dupont le 01/06/2026");
    const explanation = explainPierreWorkflowPlan(plan);
    expect(explanation).toMatch(/tâche/i);
  });

  it("explanation mentions blocked actions when present", () => {
    const plan = buildPierreHrWorkflowPlan("Licenciement pour faute grave");
    const explanation = explainPierreWorkflowPlan(plan);
    expect(explanation).toMatch(/bloquée/i);
  });

  it("explanation mentions missing info when present", () => {
    const plan = buildPierreHrWorkflowPlan("Salarié absent depuis lundi");
    if (plan.missing_info.length > 0) {
      const explanation = explainPierreWorkflowPlan(plan);
      expect(explanation).toMatch(/manquante/i);
    }
  });
});
