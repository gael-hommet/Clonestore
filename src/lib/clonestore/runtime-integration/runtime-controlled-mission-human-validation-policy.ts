// src/lib/clonestore/runtime-integration/runtime-controlled-mission-human-validation-policy.ts
// PHASE 4.11 — Controlled Mission Human Validation — Policy / Classification
//
// Module PUR. Classe la sensibilité / le risque d'une candidate et détermine les
// validateurs humains requis. Pas de base de données. Pas de réseau. Pas de write.
// Pas d'import Pierre. Aucune exécution.
//
// Cas RH sensibles détectés : licenciement, rupture, sanction, disciplinaire,
// avertissement, harcèlement, discrimination, conflit salarié, accident du travail,
// arrêt maladie, maladie, handicap, grossesse, paie, salaire.
// Cas juridiques (legal_sensitive) : contrat, avenant, prud'hommes, contentieux,
// RGPD, données personnelles sensibles, licenciement, sanction.

import type {
  RuntimeMissionPromotionContract,
} from "./runtime-mission-promotion-types";
import type {
  RuntimeControlledMissionHumanValidationSensitivity,
  RuntimeControlledMissionHumanValidationRiskLevel,
  RuntimeControlledMissionHumanValidator,
  RuntimeControlledMissionHumanValidationRequirement,
} from "./runtime-controlled-mission-human-validation-types";

// ── Mots-clés (détection — jamais des secrets) ────────────────────────────────

const SENSITIVE_HR_KEYWORDS: string[] = [
  "licenciement", "rupture", "sanction", "disciplinaire", "avertissement",
  "harcèlement", "discrimination", "conflit salarié", "accident du travail",
  "arrêt maladie", "maladie", "handicap", "grossesse", "paie", "salaire",
];

const LEGAL_SENSITIVE_KEYWORDS: string[] = [
  "contrat", "avenant", "prud'hommes", "prudhommes", "contentieux",
  "rgpd", "données personnelles sensibles", "licenciement", "sanction",
];

const SECOND_VALIDATOR_KEYWORDS: string[] = [
  "sanction", "licenciement", "harcèlement", "discrimination",
  "paie", "contrat", "contentieux",
];

// ── Policy result ─────────────────────────────────────────────────────────────

export type RuntimeControlledMissionHumanValidationPolicy = {
  sensitivity: RuntimeControlledMissionHumanValidationSensitivity;
  risk_level: RuntimeControlledMissionHumanValidationRiskLevel;
  second_validator_required: boolean;
  legal_reviewer_required: boolean;
  hr_manager_required: boolean;
  cloneguard_required: true;
  clonetrace_required: true;
  no_execution_required: true;
  required_validators: RuntimeControlledMissionHumanValidator[];
  requirements: RuntimeControlledMissionHumanValidationRequirement[];
  matched_keywords: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scanContractText(contract: RuntimeMissionPromotionContract): string {
  const cm = contract.controlled_mission;
  const parts = [
    cm?.title ?? "",
    cm?.objective ?? "",
    cm?.summary ?? "",
    cm?.domain ?? "",
    contract.decision.message ?? "",
  ];
  return parts.join(" ").toLowerCase();
}

function matchKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((k) => text.includes(k));
}

function hasBlockers(contract: RuntimeMissionPromotionContract): boolean {
  return contract.decision.blocking_gates.length > 0;
}

// ── Classification ────────────────────────────────────────────────────────────

export function classifyRuntimeControlledMissionHumanValidationSensitivity(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionHumanValidationSensitivity {
  const verdict = contract.decision.verdict;
  if (verdict === "blocked") return "blocked";

  const text = scanContractText(contract);
  if (matchKeywords(text, LEGAL_SENSITIVE_KEYWORDS).length > 0) return "legal_sensitive";
  if (matchKeywords(text, SENSITIVE_HR_KEYWORDS).length > 0) return "sensitive_hr";

  const cmRisk = contract.controlled_mission?.risk_level;
  if (cmRisk === "blocked") return "blocked";
  if (cmRisk === "sensitive") return "sensitive_hr";
  if (verdict === "not_eligible") return "high";
  if (cmRisk === "high") return "high";
  if (verdict === "requires_human_validation") return "medium";
  if (cmRisk === "medium") return "medium";
  return "low";
}

export function classifyRuntimeControlledMissionHumanValidationRisk(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionHumanValidationRiskLevel {
  const sensitivity = classifyRuntimeControlledMissionHumanValidationSensitivity(contract);
  if (sensitivity === "blocked") return "blocked";
  if (sensitivity === "legal_sensitive" || sensitivity === "sensitive_hr") return "sensitive";
  if (sensitivity === "high") return "high";
  if (sensitivity === "medium") return "medium";
  return "low";
}

export function requiresRuntimeControlledMissionSecondValidator(
  contract: RuntimeMissionPromotionContract
): boolean {
  const sensitivity = classifyRuntimeControlledMissionHumanValidationSensitivity(contract);
  if (sensitivity === "legal_sensitive" || sensitivity === "sensitive_hr" || sensitivity === "blocked") return true;
  const risk = classifyRuntimeControlledMissionHumanValidationRisk(contract);
  if (risk === "high" || risk === "sensitive" || risk === "blocked") return true;
  const text = scanContractText(contract);
  return matchKeywords(text, SECOND_VALIDATOR_KEYWORDS).length > 0;
}

export function requiresRuntimeControlledMissionLegalReviewer(
  contract: RuntimeMissionPromotionContract
): boolean {
  const sensitivity = classifyRuntimeControlledMissionHumanValidationSensitivity(contract);
  if (sensitivity === "legal_sensitive") return true;
  const text = scanContractText(contract);
  return matchKeywords(text, LEGAL_SENSITIVE_KEYWORDS).length > 0;
}

export function requiresRuntimeControlledMissionHrManager(
  contract: RuntimeMissionPromotionContract
): boolean {
  // Tout workflow Pierre RH (employé routé) ou toute candidate non triviale requiert
  // un HR manager comme validateur.
  const sensitivity = classifyRuntimeControlledMissionHumanValidationSensitivity(contract);
  if (sensitivity !== "low") return true;
  return contract.controlled_mission?.employee_key === "pierre";
}

// ── Validators / requirements ─────────────────────────────────────────────────

export function buildRuntimeControlledMissionRequiredValidators(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionHumanValidator[] {
  const validators: RuntimeControlledMissionHumanValidator[] = [
    { role: "validator", required: true, reason: "Validation humaine obligatoire avant toute mission réelle.", assigned_id: null },
  ];
  if (requiresRuntimeControlledMissionHrManager(contract)) {
    validators.push({ role: "hr_manager", required: true, reason: "Workflow RH — validation HR manager requise.", assigned_id: null });
  }
  if (requiresRuntimeControlledMissionSecondValidator(contract)) {
    validators.push({ role: "second_validator", required: true, reason: "Cas sensible — double validation requise.", assigned_id: null });
  }
  if (requiresRuntimeControlledMissionLegalReviewer(contract)) {
    validators.push({ role: "legal_reviewer", required: true, reason: "Cas juridique — revue légale requise.", assigned_id: null });
  }
  // Validateurs systèmes (gouvernance automatique, non humaine).
  validators.push({ role: "cloneguard", required: true, reason: "CloneGuard obligatoire.", assigned_id: null });
  validators.push({ role: "clonetrace", required: true, reason: "CloneTrace obligatoire.", assigned_id: null });
  return validators;
}

export function buildRuntimeControlledMissionHumanValidationRequirements(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionHumanValidationRequirement[] {
  const sensitivity = classifyRuntimeControlledMissionHumanValidationSensitivity(contract);
  const reqs: RuntimeControlledMissionHumanValidationRequirement[] = [
    {
      requirement_id: "req_human_validation",
      label: "Validation humaine",
      reason: "Une mission contrôlée requiert une validation humaine avant toute exécution future.",
      sensitivity,
      required_role: "validator",
      blocks_real_mission: true,
    },
  ];
  if (requiresRuntimeControlledMissionSecondValidator(contract)) {
    reqs.push({
      requirement_id: "req_second_validation",
      label: "Double validation",
      reason: "Cas sensible — double validation requise.",
      sensitivity,
      required_role: "second_validator",
      blocks_real_mission: true,
    });
  }
  if (requiresRuntimeControlledMissionLegalReviewer(contract)) {
    reqs.push({
      requirement_id: "req_legal_review",
      label: "Revue légale",
      reason: "Cas juridique — revue légale requise.",
      sensitivity,
      required_role: "legal_reviewer",
      blocks_real_mission: true,
    });
  }
  if (hasBlockers(contract)) {
    reqs.push({
      requirement_id: "req_missing_context_review",
      label: "Revue de contexte manquant",
      reason: "Des gates bloquants / contexte manquant doivent être revus.",
      sensitivity,
      required_role: "validator",
      blocks_real_mission: true,
    });
  }
  return reqs;
}

// ── Policy ────────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationPolicy(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionHumanValidationPolicy {
  const text = scanContractText(contract);
  const matched = Array.from(
    new Set([
      ...matchKeywords(text, SENSITIVE_HR_KEYWORDS),
      ...matchKeywords(text, LEGAL_SENSITIVE_KEYWORDS),
    ])
  );
  return {
    sensitivity: classifyRuntimeControlledMissionHumanValidationSensitivity(contract),
    risk_level: classifyRuntimeControlledMissionHumanValidationRisk(contract),
    second_validator_required: requiresRuntimeControlledMissionSecondValidator(contract),
    legal_reviewer_required: requiresRuntimeControlledMissionLegalReviewer(contract),
    hr_manager_required: requiresRuntimeControlledMissionHrManager(contract),
    cloneguard_required: true,
    clonetrace_required: true,
    no_execution_required: true,
    required_validators: buildRuntimeControlledMissionRequiredValidators(contract),
    requirements: buildRuntimeControlledMissionHumanValidationRequirements(contract),
    matched_keywords: matched,
  };
}

export function explainRuntimeControlledMissionHumanValidationPolicy(
  policy: RuntimeControlledMissionHumanValidationPolicy
): string {
  return [
    `[Human Validation Policy] sensibilité : ${policy.sensitivity} · risque : ${policy.risk_level}`,
    `  Double validation : ${policy.second_validator_required} · Revue légale : ${policy.legal_reviewer_required} · HR manager : ${policy.hr_manager_required}`,
    `  CloneGuard obligatoire · CloneTrace obligatoire · No-execution obligatoire.`,
    `  Validateurs requis : ${policy.required_validators.map((v) => v.role).join(", ")}`,
    `  Design only — aucune approbation appliquée, aucune exécution. Scale 80k non prouvé.`,
  ].join("\n");
}
