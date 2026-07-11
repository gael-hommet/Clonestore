// src/lib/pierre/v1/ultimate/p16a/sensitive-floor.ts
// P16A — DEEPENED final-decision human-only floor (owner §12). This does NOT replace or weaken any
// existing control: it REUSES analyzeInstruction (the deterministic sensitive detector) + evaluateGuard
// (the authoritative CloneGuard) and only ever RAISES the floor. It closes a real detection gap — the
// base SENSITIVE_RULES matches the noun "augmentation" but not the verb "augmente"; the base set also
// lacks promotion / explicit legal-conclusion / protected-class-assessment cues. A detected FINAL
// decision (dismissal / sanction / salary change / promotion / legal or medical conclusion / protected-
// class assessment / irreversible act) is ALWAYS human-only — independent of the autonomy mode — because
// Pierre must never make the final sensitive decision. Pure & deterministic.

import { analyzeInstruction } from "../../analysis";
import { evaluateGuard, type GuardLevel } from "../../cloneguard";
import type { ActionKind, RiskLevel, Sensitivity } from "../../autonomy";
import type { FinalDecisionCategory, P16AHumanOnlyDecision } from "./types";

function strip(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Detector = { category: FinalDecisionCategory; re: RegExp; action: ActionKind; risk: RiskLevel; sensitivity: Sensitivity; reason: string };

// SUPPLEMENTARY detectors — additive to analyzeInstruction (never lowers its verdict). Stems are used so a
// verb form ("augmente") is caught, not only the noun ("augmentation").
const DETECTORS: readonly Detector[] = [
  { category: "dismissal", re: /\b(licenci|renvoy|vir[ée]?r?|rupture\s+conventionn|mets?\s+fin\s+au\s+contrat|rompre?\s+le\s+contrat)/i, action: "dismissal", risk: "critical", sensitivity: "restricted", reason: "Licenciement / rupture = décision finale réservée à un humain." },
  { category: "sanction", re: /\b(sanction|disciplinaire|avertissement|mise\s+[àa]\s+pied|blame)/i, action: "sanction", risk: "high", sensitivity: "restricted", reason: "Sanction disciplinaire = décision finale réservée à un humain." },
  { category: "salary_change", re: /\b(augment|revaloris|baiss\w*\s+(?:le\s+)?salaire|r[ée]dui\w*\s+(?:le\s+)?salaire|diminu\w*\s+(?:le\s+)?salaire|change\w*\s+(?:le\s+)?salaire|\bprime\b)/i, action: "compensation", risk: "high", sensitivity: "sensitive", reason: "Changement de rémunération = décision finale réservée à un humain." },
  { category: "promotion", re: /\b(promo(?:tion|us|uvoir)?|promeus|passe\w*\s+cadre|nomm\w*\s+(?:au\s+poste|chef|responsable|manager|directeur))/i, action: "compensation", risk: "high", sensitivity: "sensitive", reason: "Promotion = décision finale réservée à un humain." },
  { category: "protected_class_assessment", re: /\b(origine|religion|handicap|grossesse|enceinte|syndic|orientation\s+sexuelle|ethni)/i, action: "discrimination_flagged", risk: "critical", sensitivity: "restricted", reason: "Évaluation touchant une caractéristique protégée = réservée à un humain." },
  { category: "legal_conclusion", re: /\b(est-ce\s+l[ée]gal|c'?est\s+l[ée]gal|conforme\s+au\s+droit|l[ée]galement|juridiquement|conclusion\s+juridique|avis\s+juridique|est-ce\s+conforme)/i, action: "sensitive_legal_letter", risk: "high", sensitivity: "restricted", reason: "Conclusion juridique = réservée à une revue humaine qualifiée." },
  { category: "medical_conclusion", re: /\b(inaptitude|aptitude\s+m[ée]dicale|apte\s+au\s+travail|diagnostic|pathologie|arr[êe]t\s+maladie\s+justif)/i, action: "sensitive_medical", risk: "critical", sensitivity: "restricted", reason: "Conclusion médicale = réservée à un professionnel de santé." },
];

// Map an analyzeInstruction intent → a final-decision category (the base detector's own verdict, reused).
const INTENT_TO_CATEGORY: Readonly<Record<string, FinalDecisionCategory>> = {
  termination: "dismissal",
  sanction: "sanction",
  compensation: "salary_change",
  medical: "medical_conclusion",
};

export type FinalDecisionFloor = {
  readonly humanOnly: boolean;
  readonly categories: readonly FinalDecisionCategory[];
  readonly decisions: readonly P16AHumanOnlyDecision[];
  readonly guardLevel: GuardLevel;         // strongest guard level observed
  readonly prohibited: readonly string[];  // CloneGuard prohibited_action labels
};

const GUARD_ORDER: readonly GuardLevel[] = ["green", "orange", "red", "black"];
function strongest(a: GuardLevel, b: GuardLevel): GuardLevel {
  return GUARD_ORDER.indexOf(a) >= GUARD_ORDER.indexOf(b) ? a : b;
}

/**
 * Classify the instruction's FINAL-decision floor. Any detected final-decision category is human-only,
 * regardless of the autonomy mode. The floor is the MAX over: analyzeInstruction's own verdict, the
 * supplementary detectors, and CloneGuard's text patterns. Never weakens.
 */
export function classifyFinalDecisionFloor(instruction: string): FinalDecisionFloor {
  const t = strip(instruction);
  const found = new Map<FinalDecisionCategory, P16AHumanOnlyDecision>();
  let guardLevel: GuardLevel = "green";
  const prohibited = new Set<string>();

  const record = (category: FinalDecisionCategory, action: ActionKind, risk: RiskLevel, sensitivity: Sensitivity, reason: string, evidence: string) => {
    const guard = evaluateGuard({ action, risk, sensitivity, text: instruction });
    guardLevel = strongest(guardLevel, guard.level);
    for (const p of guard.prohibited_actions) prohibited.add(p);
    if (!found.has(category)) {
      found.set(category, { category, reason, evidence, guardLevel: guard.level });
    }
  };

  // 1) Reuse the base deterministic detector's verdict (authoritative, never lowered).
  const base = analyzeInstruction(instruction);
  const baseCategory = INTENT_TO_CATEGORY[base.intent];
  if (baseCategory) {
    const d = DETECTORS.find((x) => x.category === baseCategory);
    if (d) record(baseCategory, d.action, d.risk, d.sensitivity, d.reason, `analyzeInstruction:intent=${base.intent}`);
  }

  // 2) Supplementary detectors (close the verb / promotion / legal / protected-class gaps).
  for (const d of DETECTORS) {
    if (d.re.test(t) || d.re.test(instruction)) {
      const m = instruction.match(d.re);
      record(d.category, d.action, d.risk, d.sensitivity, d.reason, m ? m[0] : d.category);
    }
  }

  const categories = [...found.keys()];
  return {
    humanOnly: categories.length > 0,
    categories,
    decisions: [...found.values()],
    guardLevel,
    prohibited: [...prohibited],
  };
}
