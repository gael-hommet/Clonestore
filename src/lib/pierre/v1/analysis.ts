// src/lib/pierre/v1/analysis.ts
// PHASE 8.1 — Pierre Production Runtime Core — canonical request analysis.
//
// Deterministic, rule-based analyzer (NO AI call in P8.1 — the AI provider is
// wired in a later block; a mock provider must be impossible in production).
// Produces a strict, validated analysis contract that drives real persistence:
// assumptions are never turned into facts, unknowns produce awaiting_info,
// sensitive cases produce approval/blocks.

import type { ActionKind, RiskLevel, Sensitivity } from "./autonomy";

export type AnalyzedTask = {
  type: string;
  objective: string;
  action: ActionKind;
  risk: RiskLevel;
  sensitivity: Sensitivity;
  domain: string;
  channel: string;
  external_side_effect: boolean;
  expected_output: string;
  depends_on: number[]; // indexes within proposed_tasks
  priority: number;
};

export type MissingInfo = { id: string; question: string; priority: "high" | "medium" | "low" };

export type AnalysisResult = {
  intent: string;
  domain: string;
  summary: string;
  risk_level: RiskLevel;
  sensitivity: Sensitivity;
  approval_required: boolean;
  missing_info: MissingInfo[];
  proposed_tasks: AnalyzedTask[];
  prohibited_actions: string[];
  next_best_action: string;
  confidence: number;
};

const SENSITIVE_RULES: Array<{ re: RegExp; action: ActionKind; risk: RiskLevel; sensitivity: Sensitivity; intent: string }> = [
  { re: /\b(licenci|rupture|renvoy|d[ée]missionn)/i, action: "termination", risk: "critical", sensitivity: "restricted", intent: "termination" },
  { re: /\b(sanction|disciplinaire|avertissement|mise [àa] pied)/i, action: "sanction", risk: "high", sensitivity: "restricted", intent: "sanction" },
  { re: /\b(salaire|r[ée]mun[ée]ration|augmentation|prime exceptionnelle)/i, action: "compensation", risk: "high", sensitivity: "sensitive", intent: "compensation" },
  { re: /\b(contrat|cdi|cdd|avenant)/i, action: "contract", risk: "high", sensitivity: "sensitive", intent: "contract" },
  { re: /\b(arr[êe]t maladie|m[ée]dical|pathologie)/i, action: "sensitive_medical", risk: "critical", sensitivity: "restricted", intent: "medical" },
];

const OPERATIONAL_RULES: Array<{ re: RegExp; action: ActionKind; intent: string; expected: string }> = [
  { re: /\b(relance|relancer)/i, action: "reminder", intent: "reminder", expected: "Brouillon de relance prêt à valider" },
  { re: /\b(rappel|[ée]ch[ée]ance|deadline)/i, action: "deadline_reminder", intent: "deadline_reminder", expected: "Rappel d'échéance planifié" },
  { re: /\b(document manquant|pi[èe]ce manquante|justificatif)/i, action: "request_missing_info", intent: "request_missing_info", expected: "Demande d'information préparée" },
  { re: /\b(classer|classement|trier|ranger)/i, action: "classification", intent: "classification", expected: "Classement logique proposé" },
  { re: /\b(synth[èe]se|r[ée]sum[ée]|rapport)/i, action: "operational_summary", intent: "summary", expected: "Synthèse structurée" },
  { re: /\b(notifier|notification|pr[ée]venir)/i, action: "low_risk_notification", intent: "notification", expected: "Notification interne préparée" },
];

function detectMissingInfo(instruction: string): MissingInfo[] {
  const out: MissingInfo[] = [];
  // Accent-safe subject detection (JS \b does not handle accented chars). Either
  // an HR-subject stem, a civility, or a capitalized name token after a space.
  const hasSubject =
    /(salari|employ|candidat|[ée]quipe|manager|directeur|stagiaire|\bmme\b|\bm\.|\bmr\b)/i.test(instruction) ||
    /\s[A-ZÉÈÀ][a-zà-ÿ']{2,}/.test(instruction);
  if (!hasSubject) {
    out.push({ id: "who", question: "Quel salarié / candidat / équipe est concerné ?", priority: "high" });
  }
  const hasWhen = /([ée]ch[ée]ance|deadline|avant|date|vendredi|lundi|mardi|semaine|mois)/i.test(instruction);
  if (!hasWhen && /(relance|rappel)/i.test(instruction)) {
    out.push({ id: "deadline", question: "Quelle est l'échéance visée ?", priority: "medium" });
  }
  return out;
}

export function analyzeInstruction(instruction: string): AnalysisResult {
  const text = (instruction ?? "").trim();
  if (text.length === 0) {
    return {
      intent: "unknown", domain: "hr_ops", summary: "Demande vide", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [{ id: "instruction", question: "Quelle est la demande ?", priority: "high" }],
      proposed_tasks: [], prohibited_actions: [], next_best_action: "Préciser la demande", confidence: 0.1,
    };
  }

  const sensitive = SENSITIVE_RULES.find((r) => r.re.test(text));
  const missing = detectMissingInfo(text);
  const tasks: AnalyzedTask[] = [];

  if (sensitive) {
    tasks.push({
      type: "prepare_sensitive_draft",
      objective: `Préparer un dossier factuel pour: ${sensitive.intent}`,
      action: sensitive.action,
      risk: sensitive.risk,
      sensitivity: sensitive.sensitivity,
      domain: "hr_sensitive",
      channel: "internal",
      external_side_effect: false,
      expected_output: "Synthèse factuelle + points de vigilance (aucune décision)",
      depends_on: [],
      priority: 200,
    });
    return {
      intent: sensitive.intent, domain: "hr_sensitive", summary: `Cas sensible détecté: ${sensitive.intent}`,
      risk_level: sensitive.risk, sensitivity: sensitive.sensitivity, approval_required: true,
      missing_info: missing, proposed_tasks: tasks,
      prohibited_actions: ["decision_finale_autonome", "sanction_autonome", "envoi_autonome"],
      next_best_action: "Préparer et soumettre à validation humaine", confidence: 0.75,
    };
  }

  const matched = OPERATIONAL_RULES.filter((r) => r.re.test(text));
  const rules = matched.length > 0 ? matched : [{ re: /.*/, action: "create_task" as ActionKind, intent: "general", expected: "Tâche RH préparée" }];

  rules.forEach((r, idx) => {
    tasks.push({
      type: r.action, // executor key == action kind (see executors.ts registry)
      objective: `${r.intent} — ${text.slice(0, 140)}`,
      action: r.action,
      risk: "low",
      sensitivity: "normal",
      domain: "hr_ops",
      channel: r.action === "low_risk_notification" ? "internal" : "internal",
      external_side_effect: false,
      expected_output: r.expected,
      depends_on: idx > 0 ? [0] : [],
      priority: 100 - idx,
    });
  });

  const approval_required = missing.some((m) => m.priority === "high");
  return {
    intent: rules[0].intent, domain: "hr_ops", summary: `Demande opérationnelle: ${rules.map((r) => r.intent).join(", ")}`,
    risk_level: "low", sensitivity: "normal", approval_required,
    missing_info: missing, proposed_tasks: tasks, prohibited_actions: [],
    next_best_action: missing.length > 0 ? "Collecter les informations manquantes" : "Exécuter les tâches faibles risques",
    confidence: matched.length > 0 ? 0.8 : 0.5,
  };
}
