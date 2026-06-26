// src/lib/clonestore/runtime-integration/runtime-integration-guardrails.ts
// PHASE 4.1 — Runtime Operational Integration — Guardrails Contract (CloneGuard)
//
// Module pur. CloneGuard est une étape OBLIGATOIRE avant toute action sensible.
// Aucun bypass. Pas de Supabase, pas de write, pas d'import Pierre.

import type {
  RuntimeIntegrationIntent,
  RuntimeIntegrationIntentRoute,
  RuntimeIntegrationPlanStep,
  RuntimeIntegrationGuardDecision,
  RuntimeIntegrationRiskLevel,
  RuntimeIntegrationIssue,
} from "./runtime-integration-types";

// ── Sujets sensibles RH (validation humaine requise) ──────────────────────────

const SENSITIVE_HR_TOPICS: Array<[string, string[]]> = [
  ["licenciement", ["licenciement", "licencier", "rupture"]],
  ["sanction", ["sanction", "avertissement"]],
  ["contrat", ["contrat", "cdi", "cdd", "embauche"]],
  ["avenant", ["avenant"]],
  ["paie", ["paie", "salaire", "rémunération", "bulletin", "fiche de paie"]],
  ["donnees_personnelles", ["données personnelles", "rgpd", "donnée personnelle"]],
  ["arret_maladie", ["arrêt maladie", "arret maladie", "maladie"]],
  ["conflit_salarie", ["conflit", "litige salarié"]],
  ["harcelement", ["harcèlement", "harcelement"]],
  ["disciplinaire", ["disciplinaire", "faute grave"]],
];

// ── Sujets bloqués (action juridique / disciplinaire finale) ──────────────────

const BLOCKED_FINAL_TOPICS: Array<[string, string[]]> = [
  ["final_legal_decision", ["décision légale", "decision legale", "décision juridique", "action en justice"]],
  ["final_disciplinary_action", ["sanction disciplinaire finale", "licenciement effectif", "exécuter le licenciement"]],
  ["contract_signature", ["signer le contrat", "signature du contrat", "signer définitivement"]],
  ["official_payroll_run", ["exécuter la paie", "lancer la paie officielle", "valider la paie officielle"]],
];

// ── External comm topics (review recommended/required) ────────────────────────

const EXTERNAL_COMM_TOPICS = ["email externe", "envoyer un email", "courrier externe", "communication externe"];

// ── Classification du risque ──────────────────────────────────────────────────

export function classifyRuntimeIntegrationRisk(text: string): RuntimeIntegrationRiskLevel {
  const lower = (text ?? "").toLowerCase();

  if (BLOCKED_FINAL_TOPICS.some(([, kws]) => kws.some((k) => lower.includes(k)))) {
    return "blocked";
  }
  if (SENSITIVE_HR_TOPICS.some(([, kws]) => kws.some((k) => lower.includes(k)))) {
    return "sensitive";
  }
  if (EXTERNAL_COMM_TOPICS.some((k) => lower.includes(k))) {
    return "high";
  }
  if (lower.includes("document") || lower.includes("onboarding") || lower.includes("absence")) {
    return "medium";
  }
  return "low";
}

function detectSensitiveTopics(text: string): string[] {
  const lower = (text ?? "").toLowerCase();
  const topics: string[] = [];
  for (const [topic, kws] of [...SENSITIVE_HR_TOPICS, ...BLOCKED_FINAL_TOPICS]) {
    if (kws.some((k) => lower.includes(k))) topics.push(topic);
  }
  return topics;
}

// ── Human validation requirement ──────────────────────────────────────────────

export function requiresRuntimeIntegrationHumanValidation(
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute
): boolean {
  if (route.requires_human_validation) return true;
  const risk = intent.risk_level;
  return risk === "sensitive" || risk === "high" || risk === "blocked";
}

// ── Guard decision ────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationGuardDecision(
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute,
  planSteps: RuntimeIntegrationPlanStep[]
): RuntimeIntegrationGuardDecision {
  const sensitiveTopics = detectSensitiveTopics(intent.normalized_text);
  const risk = intent.risk_level;
  const reasons: string[] = [];

  let decision: RuntimeIntegrationGuardDecision["decision"];
  if (risk === "blocked") {
    decision = "block";
    reasons.push("Action juridique / disciplinaire finale — bloquée en autonomie IA.");
  } else if (requiresRuntimeIntegrationHumanValidation(intent, route)) {
    decision = "require_human_validation";
    reasons.push("Sujet sensible — validation humaine requise via CloneGuard.");
  } else {
    decision = "allow_plan_only";
    reasons.push("Plan-only autorisé — aucune exécution. CloneGuard reste obligatoire avant toute action.");
  }

  if (planSteps.some((s) => s.validation_mode === "human_validation_required")) {
    if (decision === "allow_plan_only") decision = "require_human_validation";
  }

  return {
    decision,
    risk_level: risk,
    reasons,
    sensitive_topics: sensitiveTopics,
    cloneguard_required: true,
    human_validation_required: decision !== "allow_plan_only",
    bypass_allowed: false,
  };
}

// ── Issues ────────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationGuardIssues(
  intent: RuntimeIntegrationIntent,
  route: RuntimeIntegrationIntentRoute
): RuntimeIntegrationIssue[] {
  const issues: RuntimeIntegrationIssue[] = [];
  if (intent.risk_level === "blocked") {
    issues.push({ code: "guard_blocked_final_action", message: "CloneGuard : action finale bloquée en autonomie IA.", severity: "blocking" });
  }
  if (requiresRuntimeIntegrationHumanValidation(intent, route)) {
    issues.push({ code: "guard_human_validation_required", message: "CloneGuard : validation humaine requise.", severity: "warning" });
  }
  return issues;
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeIntegrationGuardDecision(
  decision: RuntimeIntegrationGuardDecision
): string {
  return [
    `[CloneGuard] Décision : ${decision.decision}`,
    `  Risque : ${decision.risk_level}`,
    `  Validation humaine requise : ${decision.human_validation_required}`,
    `  Bypass autorisé : ${decision.bypass_allowed}`,
    `  CloneGuard obligatoire — aucune action sensible sans validation.`,
  ].join("\n");
}
