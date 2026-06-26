// src/lib/pierre/v1/cloneguard.ts
// PHASE 8.1 — Pierre Production Runtime Core — CloneGuard, in the real path.
//
// Every task passes through CloneGuard before queue, before resume, before
// execution, and on retry after a context change. Sensitive HR actions are
// hard-blocked or escalated. This is a pure, deterministic evaluator; its
// decision is persisted to CloneTrace by the caller.

import type { ActionKind, RiskLevel, Sensitivity } from "./autonomy";

export type GuardLevel = "green" | "orange" | "red" | "black";

export type GuardInput = {
  action: ActionKind;
  risk: RiskLevel;
  sensitivity: Sensitivity;
  text?: string;
};

export type GuardDecision = {
  level: GuardLevel;
  allow: boolean;
  requires_approval: boolean;
  explanation: string;
  prohibited_actions: string[];
  safe_alternatives: string[];
  policy_sources: string[];
};

// Actions that are always blocked from autonomous execution (decision is human).
const HARD_BLOCK: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "sanction", "termination", "dismissal", "sensitive_medical",
  "discrimination_flagged", "harassment_flagged", "final_recruitment_decision",
]);

// Actions allowed only with human approval.
const APPROVAL_ONLY: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "contract", "amendment", "compensation", "sensitive_legal_letter",
]);

const PROHIBITED_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(licenci|renvoy|vir[ée]r?)\b/i, label: "termination_decision" },
  { re: /\bsanction|avertissement disciplinaire|mise [àa] pied\b/i, label: "disciplinary_sanction" },
  { re: /\b(origine|religion|handicap|grossesse|syndic|orientation sexuelle)\b/i, label: "protected_characteristic" },
  { re: /\b(harc[èe]l)/i, label: "harassment" },
  { re: /\b(arr[êe]t maladie|dossier m[ée]dical|pathologie)\b/i, label: "sensitive_medical" },
];

export function evaluateGuard(input: GuardInput): GuardDecision {
  const sources: string[] = ["CloneGuard:hr_absolute_rules_v1"];
  const prohibited: string[] = [];

  const textHits = (input.text ? PROHIBITED_PATTERNS.filter((p) => p.re.test(input.text!)) : []).map((p) => p.label);
  for (const h of textHits) prohibited.push(h);

  // Black: absolute-blocked HR decisions.
  if (HARD_BLOCK.has(input.action) || input.risk === "critical") {
    return {
      level: "black",
      allow: false,
      requires_approval: false,
      explanation: "Action relève d'une décision RH sensible réservée à l'humain — exécution autonome interdite, escalade.",
      prohibited_actions: Array.from(new Set([input.action, ...prohibited])),
      safe_alternatives: ["Préparer une synthèse factuelle", "Créer une demande de validation humaine", "Escalader au responsable RH"],
      policy_sources: [...sources, "CloneGuard:absolute_block"],
    };
  }

  // Red: approval-only / restricted.
  if (APPROVAL_ONLY.has(input.action) || input.sensitivity === "restricted" || textHits.length > 0) {
    return {
      level: "red",
      allow: false,
      requires_approval: true,
      explanation: "Action sensible — validation humaine requise avant toute exécution.",
      prohibited_actions: Array.from(new Set(prohibited)),
      safe_alternatives: ["Préparer le brouillon et demander validation", "Documenter les points de vigilance"],
      policy_sources: [...sources, "CloneGuard:approval_required"],
    };
  }

  // Orange: caution, allowed but notify.
  if (input.risk === "high" || input.sensitivity === "sensitive") {
    return {
      level: "orange",
      allow: true,
      requires_approval: false,
      explanation: "Action à risque modéré — exécution autorisée avec notification et trace renforcée.",
      prohibited_actions: prohibited,
      safe_alternatives: [],
      policy_sources: sources,
    };
  }

  // Green: safe low-risk.
  return {
    level: "green",
    allow: true,
    requires_approval: false,
    explanation: "Action faible risque — exécution autorisée.",
    prohibited_actions: [],
    safe_alternatives: [],
    policy_sources: sources,
  };
}
