// src/lib/pierre/v1/cognitive-runtime/cognitive-analyzer.ts
// PHASE 8.14 — the LIVE-PATH planner. Produces the SAME AnalysisResult shape that createMission already
// consumes (so the whole governed pipeline — guard, decideValidation, validations, queue, worker,
// server re-read — is reused, NO 2nd runtime), but the AUTHORITATIVE source is the LLM cognitive runtime,
// not regex. Regex `analyzeInstruction` remains ONLY as: (a) the degraded safe mode when no model is
// available, and (b) a SAFETY FLOOR the LLM can never breach (a detected sensitive/high-risk verdict is
// never downgraded by the model). This is exactly "model proposes, deterministic runtime governs".

import { analyzeInstruction, type AnalysisResult, type AnalyzedTask } from "../analysis";
import type { ActionKind, RiskLevel, Sensitivity } from "../autonomy";
import { runCloneAIContract } from "../../../cloneos/ai/runtime";
import { isCognitivePlannerEnabled } from "./config";

export type PlannerSource = "llm" | "deterministic_fallback";
export type CognitiveAnalysis = AnalysisResult & { planner_source: PlannerSource };

// The interpreter contract (DI): returns candidate tasks + meta, or null if unavailable/failed.
export type CognitiveInterpret = (instruction: string) => Promise<Partial<AnalysisResult> | null>;

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high", "critical"];
const SENS_ORDER: Sensitivity[] = ["normal", "sensitive", "restricted"];
const maxRisk = (a: RiskLevel, b: RiskLevel): RiskLevel => (RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b);
const maxSens = (a: Sensitivity, b: Sensitivity): Sensitivity => (SENS_ORDER.indexOf(a) >= SENS_ORDER.indexOf(b) ? a : b);

// Map a free-text task "type"/title from the model to a registered ActionKind (default: safe create_task).
function toActionKind(type: string, title: string): ActionKind {
  const t = `${type} ${title}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/licenci|termination|rupture|renvoy/.test(t)) return "termination";
  if (/sanction|disciplinaire|avertissement/.test(t)) return "sanction";
  if (/salaire|remuner|compensation|augment|prime/.test(t)) return "compensation";
  if (/contrat|avenant|amendment/.test(t)) return /avenant|amendment/.test(t) ? "amendment" : "contract";
  if (/medical|arret maladie|patholog/.test(t)) return "sensitive_medical";
  if (/harcel|harass/.test(t)) return "harassment_flagged";
  if (/discrimin/.test(t)) return "discrimination_flagged";
  if (/relance|reminder/.test(t)) return "reminder";
  if (/echeance|deadline|rappel/.test(t)) return "deadline_reminder";
  if (/document manquant|piece manquante|justificatif|missing/.test(t)) return "request_missing_info";
  if (/class|trier|ranger/.test(t)) return "classification";
  if (/synth|resume|rapport|report|brief/.test(t)) return "operational_summary";
  if (/notif|prevenir|inform/.test(t)) return "low_risk_notification";
  return "create_task";
}
const APPROVAL_ACTIONS = new Set<ActionKind>(["contract", "amendment", "compensation", "sanction", "termination", "dismissal", "sensitive_medical", "discrimination_flagged", "harassment_flagged", "final_recruitment_decision", "sensitive_legal_letter"]);
function riskForAction(a: ActionKind): RiskLevel {
  if (a === "termination" || a === "dismissal" || a === "sensitive_medical") return "critical";
  if (APPROVAL_ACTIONS.has(a)) return "high";
  return "low";
}
function sensForAction(a: ActionKind): Sensitivity {
  if (a === "termination" || a === "dismissal" || a === "sensitive_medical") return "restricted";
  if (APPROVAL_ACTIONS.has(a)) return "sensitive";
  return "normal";
}

/** Default production interpreter: real LLM task planning via the existing contract runtime. */
const defaultInterpret: CognitiveInterpret = async (instruction) => {
  const res = await runCloneAIContract({ useCase: "pierre.brain.task_plan", variables: { brain_interpretation: instruction } });
  if (!res.ok || !res.json || typeof res.json !== "object") return null;
  const j = res.json as { tasks?: unknown };
  if (!Array.isArray(j.tasks) || j.tasks.length === 0) return null;
  const proposed: AnalyzedTask[] = [];
  for (const raw of j.tasks) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const type = typeof o.type === "string" ? o.type : "create_task";
    const title = typeof o.title === "string" ? o.title : "";
    const action = toActionKind(type, title);
    const risk = riskForAction(action);
    const sensitivity = sensForAction(action);
    proposed.push({
      type, action, risk, sensitivity,
      objective: typeof o.description === "string" ? o.description : title || type,
      domain: "hr_ops", channel: "internal",
      external_side_effect: /email|send|communication|signature/.test(`${type} ${title}`.toLowerCase()),
      expected_output: typeof o.expected_artifact === "string" ? o.expected_artifact : "Résultat préparé",
      depends_on: [], priority: typeof o.priority === "number" ? o.priority : 50,
    });
  }
  if (proposed.length === 0) return null;
  const anySensitive = proposed.some((t) => t.sensitivity !== "normal");
  return {
    intent: "cognitive_plan",
    domain: "hr_ops",
    summary: `Plan cognitif: ${proposed.length} tâche(s)`,
    risk_level: proposed.reduce<RiskLevel>((r, t) => maxRisk(r, t.risk), "low"),
    sensitivity: proposed.reduce<Sensitivity>((s, t) => maxSens(s, t.sensitivity), "normal"),
    approval_required: anySensitive,
    missing_info: [],
    proposed_tasks: proposed,
    next_best_action: "Revue puis exécution gouvernée",
    confidence: 0.7,
  };
};

// Supplementary sensitivity floor: catches legally-sensitive situations the base regex misses
// (harassment, discrimination, restructuring, medical/incapacity, whistleblower/retaliation). Additive —
// it only ever RAISES the floor, never lowers it. Keeps the base detector (analysis.ts) untouched.
const EXTRA_SENSITIVE = /\b(harcel|harass|discrimin|reorganis|restructur|inaptitude|arret\s+maladie|maladie\s+professionn|represaille|lanceur\s+d'?alerte|whistlebl|plainte|proteg)\w*/i;
// PIERRE SELLABILITY STRESS TEST (2026-07-25) — DÉFAUT RACINE CORRIGÉ : EXTRA_SENSITIVE n'attrapait
// que le mot littéral "discrimin(ation)". Une consigne d'exclusion discriminatoire PARAPHRASÉE
// (« écarter systématiquement les candidatures de plus de 50 ans ») passait entièrement sous le
// plancher, classée risque faible, zéro validation. Correctif GÉNÉRAL (pas un cas particulier) : le
// plancher se déclenche aussi sur la CO-OCCURRENCE d'une intention d'exclusion (écarter/exclure/
// éliminer/refuser/rejeter) et d'un proxy de caractéristique protégée (âge, sexe, origine, religion,
// grossesse, handicap, orientation sexuelle, appartenance syndicale, nationalité) — qu'importe l'ordre
// ou la formulation exacte des mots.
const EXCLUSION_INTENT = /\b(ecart\w*|exclu\w*|elimin\w*|refus\w*|rejet\w*)\b/i;
const PROTECTED_CHARACTERISTIC_PROXY = /\b(plus\s+de\s+\d{2}\s*ans|moins\s+de\s+\d{2}\s*ans|l'?age|selon\s+l'?age|sexe\w*|genre\w*|origine\w*|religion\w*|grossesse\w*|enceinte\w*|handicap\w*|orientation\s+sexuelle|appartenance\s+syndicale|nationalite\w*)\b/i;
function looksLikeDiscriminatoryExclusion(t: string): boolean {
  return EXCLUSION_INTENT.test(t) && PROTECTED_CHARACTERISTIC_PROXY.test(t);
}
function raiseFloor(base: AnalysisResult, instruction: string): AnalysisResult {
  const t = instruction.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!EXTRA_SENSITIVE.test(t) && !looksLikeDiscriminatoryExclusion(t)) return base;
  const flooredTasks = base.proposed_tasks.map((tk) => ({ ...tk, risk: maxRisk(tk.risk, "high"), sensitivity: maxSens(tk.sensitivity, "sensitive") }));
  const tasks = flooredTasks.length > 0 ? flooredTasks : [{
    type: "prepare_sensitive_draft", action: "sensitive_legal_letter" as ActionKind, risk: "high" as RiskLevel, sensitivity: "restricted" as Sensitivity,
    objective: "Préparer un dossier factuel (aucune décision) — situation sensible", domain: "hr_sensitive", channel: "internal",
    external_side_effect: false, expected_output: "Synthèse factuelle + points de vigilance", depends_on: [], priority: 200,
  }];
  return {
    ...base,
    risk_level: maxRisk(base.risk_level, "high"),
    sensitivity: maxSens(base.sensitivity, "sensitive"),
    approval_required: true,
    proposed_tasks: tasks,
  };
}

/** Merge the regex floor into the LLM plan so the model can never downgrade a detected sensitive verdict. */
function applySafetyFloor(base: AnalysisResult, llm: Partial<AnalysisResult>): AnalysisResult {
  const tasks = (llm.proposed_tasks && llm.proposed_tasks.length > 0) ? llm.proposed_tasks : base.proposed_tasks;
  // If the deterministic detector flagged a sensitive/restricted case, ensure the plan carries that floor.
  const flooredTasks = tasks.map((t) => ({
    ...t,
    risk: maxRisk(t.risk, base.sensitivity !== "normal" ? base.risk_level : "low"),
    sensitivity: maxSens(t.sensitivity, base.sensitivity),
  }));
  // If base detected a sensitive obligation the LLM omitted entirely, prepend base's sensitive tasks.
  const baseSensitive = base.proposed_tasks.filter((t) => t.sensitivity !== "normal");
  const llmHasSensitive = flooredTasks.some((t) => t.sensitivity !== "normal");
  const merged = (baseSensitive.length > 0 && !llmHasSensitive) ? [...baseSensitive, ...flooredTasks] : flooredTasks;
  return {
    intent: llm.intent ?? base.intent,
    domain: llm.domain ?? base.domain,
    summary: llm.summary ?? base.summary,
    risk_level: maxRisk(base.risk_level, llm.risk_level ?? "low"),
    sensitivity: maxSens(base.sensitivity, llm.sensitivity ?? "normal"),
    approval_required: base.approval_required || (llm.approval_required ?? false) || merged.some((t) => t.sensitivity !== "normal"),
    missing_info: [...base.missing_info, ...(llm.missing_info ?? [])],
    proposed_tasks: merged,
    prohibited_actions: base.prohibited_actions,
    next_best_action: llm.next_best_action ?? base.next_best_action,
    confidence: llm.confidence ?? base.confidence,
  };
}

/**
 * Authoritative live-path analysis. LLM when enabled+available; regex as degraded fallback + safety floor.
 * @param opts.enabled override (tests). @param opts.interpret inject a deterministic interpreter (tests).
 */
export async function cognitiveAnalyze(
  instruction: string,
  opts?: { enabled?: boolean; interpret?: CognitiveInterpret },
): Promise<CognitiveAnalysis> {
  const base = raiseFloor(analyzeInstruction(instruction), instruction);
  const enabled = opts?.enabled ?? isCognitivePlannerEnabled();
  if (!enabled) return { ...base, planner_source: "deterministic_fallback" };

  let llm: Partial<AnalysisResult> | null = null;
  try { llm = await (opts?.interpret ?? defaultInterpret)(instruction); } catch { llm = null; }
  if (!llm || !llm.proposed_tasks || llm.proposed_tasks.length === 0) {
    return { ...base, planner_source: "deterministic_fallback" };
  }
  return { ...applySafetyFloor(base, llm), planner_source: "llm" };
}
