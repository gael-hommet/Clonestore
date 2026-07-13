// scripts/p16e-planning-eval.mts
// P16E §6 — run the 20 canonical HR mission-planning scenarios through the REAL deterministic
// Pierre planner (analyzeInstruction) — no model calls — and record structured results +
// invariant checks. Writes .p16e-proofs/mission-planning-evaluation.json.
import { writeFileSync } from "fs";
import { analyzeInstruction, isVagueDirective, detectUserRestriction } from "../src/lib/pierre/v1/analysis.ts";

type Scenario = { id: number; name: string; input: string; expect: { clarifies?: boolean; humanOnly?: boolean; restriction?: boolean; noSideEffect?: boolean } };

const SCENARIOS: Scenario[] = [
  { id: 1, name: "onboarding one employee", input: "Prépare l'onboarding de Sarah lundi", expect: { noSideEffect: true } },
  { id: 2, name: "onboarding 50 employees", input: "Prépare l'onboarding des 50 nouveaux arrivants du site de Lyon", expect: { noSideEffect: true } },
  { id: 3, name: "offboarding", input: "Prépare l'offboarding de Marc, dernier jour le 30 juin", expect: { noSideEffect: true } },
  { id: 4, name: "contract amendment", input: "Prépare un avenant au contrat de Claire pour passage à 4/5", expect: { humanOnly: true, noSideEffect: true } },
  { id: 5, name: "salary-review preparation", input: "Prépare une revue de salaire pour l'équipe technique", expect: { humanOnly: true, noSideEffect: true } },
  { id: 6, name: "absence management", input: "Enregistre l'absence de Paul du 10 au 14 juillet", expect: { noSideEffect: true } },
  { id: 7, name: "return-to-work preparation", input: "Prépare le retour de Julie après son arrêt maladie", expect: { humanOnly: true, noSideEffect: true } },
  { id: 8, name: "recruitment pipeline", input: "Ouvre un pipeline de recrutement pour un poste de développeur", expect: { noSideEffect: true } },
  { id: 9, name: "training campaign", input: "Prépare une campagne de formation sécurité pour tous les managers", expect: { noSideEffect: true } },
  { id: 10, name: "policy acknowledgement", input: "Envoie le règlement intérieur pour acquittement à tous les salariés", expect: { noSideEffect: true } },
  { id: 11, name: "performance-cycle preparation", input: "Prépare le cycle d'évaluation annuel", expect: { noSideEffect: true } },
  { id: 12, name: "employee-document request", input: "Prépare une attestation de travail pour Nadia", expect: { noSideEffect: true } },
  { id: 13, name: "multi-site reorganization", input: "Prépare la réorganisation des équipes entre les sites de Paris et Lyon", expect: { noSideEffect: true } },
  { id: 14, name: "acquisition/import", input: "Importe les 300 salariés de la société acquise", expect: { noSideEffect: true } },
  { id: 15, name: "urgent HR incident", input: "Il y a un signalement de harcèlement, prépare le dossier", expect: { humanOnly: true, noSideEffect: true } },
  { id: 16, name: "contradictory manager instructions", input: "Envoie le contrat aujourd'hui, mais ne contacte personne sans mon accord", expect: { restriction: true, noSideEffect: true } },
  { id: 17, name: "missing employee data", input: "Fais le nécessaire pour Paul.", expect: { clarifies: true, noSideEffect: true } },
  { id: 18, name: "stale policy", input: "Applique l'ancienne politique de congés de 2019", expect: { noSideEffect: true } },
  { id: 19, name: "provider timeout (planning only)", input: "Envoie la convocation d'entretien à ce candidat", expect: { noSideEffect: true } },
  { id: 20, name: "worker restart (planning only)", input: "Reprends la préparation du dossier de Sophie", expect: { noSideEffect: true } },
];

const results = SCENARIOS.map((s) => {
  const a = analyzeInstruction(s.input);
  const tasks = a.proposed_tasks.map((t) => ({ type: t.type, action: t.action, risk: t.risk, sensitivity: t.sensitivity, external_side_effect: t.external_side_effect }));
  const anyExternalEffect = tasks.some((t) => t.external_side_effect === true);
  const clarifies = a.missing_info.length > 0 || a.intent === "clarification_required";
  const humanOnly = a.approval_required && (a.sensitivity === "restricted" || a.sensitivity === "sensitive" || a.risk_level === "critical" || a.risk_level === "high");
  const checks = {
    no_side_effect_in_plan: !anyExternalEffect, // the planner never proposes an autonomous external effect
    expected_clarification: s.expect.clarifies ? clarifies : true,
    expected_human_only_gate: s.expect.humanOnly ? a.approval_required : true,
    expected_restriction_preserved: s.expect.restriction ? (a.user_restriction != null && a.approval_required) : true,
  };
  const pass = Object.values(checks).every(Boolean);
  return {
    id: s.id, name: s.name, input: s.input,
    intent: a.intent, risk_level: a.risk_level, sensitivity: a.sensitivity,
    approval_required: a.approval_required, user_restriction: a.user_restriction ?? null,
    missing_info: a.missing_info.map((m) => ({ id: m.id, priority: m.priority })),
    proposed_tasks: tasks, prohibited_actions: a.prohibited_actions, next_best_action: a.next_best_action,
    is_vague: isVagueDirective(s.input), detected_restriction: detectUserRestriction(s.input),
    checks, pass,
  };
});

const summary = {
  generated_by: "scripts/p16e-planning-eval.mts (real deterministic analyzeInstruction — NO model calls)",
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  invariants: [
    "the planner NEVER proposes a task with external_side_effect=true (no autonomous send/sign; effects require the governed execute path + human confirmation)",
    "ambiguous directives ('Fais le nécessaire pour Paul') -> clarification, never an invented action",
    "sensitive/human-only requests (termination/sanction/salary/medical/harassment/contract) -> approval_required, prepare-only",
    "a user restriction ('...sans mon accord') is preserved -> approval_required + user_restriction traced"
  ],
  no_fabrication: "the deterministic planner does not resolve a specific employee/date/policy; entity resolution + dates are gated downstream (findPierreEmployeeByName ambiguity -> null; no silent date invention)",
  scenarios: results,
};

writeFileSync(".p16e-proofs/mission-planning-evaluation.json", JSON.stringify(summary, null, 2));
console.log(`planning scenarios: ${summary.total}, passed: ${summary.passed}`);
for (const r of results.filter((x) => !x.pass)) console.log("  FAIL", r.id, r.name, JSON.stringify(r.checks));
