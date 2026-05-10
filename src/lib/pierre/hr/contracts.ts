/**
 * Pierre HR Engine — Contrats métier RH
 *
 * Fondation du moteur RH opérationnel de Pierre.
 * Domaines, niveaux de risque, niveaux d'autonomie, matrice action/validation.
 *
 * Vocabulaire des risques dans ce projet :
 *   - types.ts        → PierreRiskLevel = "low" | "medium" | "high"
 *   - mission/risk.ts → PierreMissionRiskLevel = "normal" | "sensitive" | "critical"
 *   - hr/contracts.ts → PierreHrRiskLevel = "green" | "orange" | "red" | "black"
 *
 * Règle absolue :
 *   Un override de risque peut seulement escalader le risque, jamais le réduire.
 *   Exemple : un contrat reste rouge même si override_risk = "green".
 */

// ══════════════════════════════════════════════════════════
// 1. DOMAINES RH
// ══════════════════════════════════════════════════════════

export const PIERRE_HR_DOMAINS = [
  "recruitment_ops",
  "hiring",
  "contract",
  "amendment",
  "onboarding",
  "employee_file",
  "absence",
  "leave",
  "lateness",
  "payroll_prep",
  "internal_communication",
  "hr_helpdesk",
  "interview",
  "performance_ops",
  "training_ops",
  "compensation_benefits_ops",
  "employee_relations",
  "compliance_workflow",
  "reporting",
  "offboarding",
  "multi_site_coordination",
  "sensitive_case",
  "unknown",
] as const;

export type PierreHrDomain = (typeof PIERRE_HR_DOMAINS)[number];

// ══════════════════════════════════════════════════════════
// 2. RISQUE RH COULEUR
// ══════════════════════════════════════════════════════════

export const PIERRE_HR_RISK_LEVELS = [
  "green",
  "orange",
  "red",
  "black",
] as const;

export type PierreHrRiskLevel = (typeof PIERRE_HR_RISK_LEVELS)[number];

// Compat douce si une partie du code avait déjà commencé à importer ce nom.
export const PIERRE_RISK_LEVELS = PIERRE_HR_RISK_LEVELS;

const PIERRE_HR_RISK_RANK: Record<PierreHrRiskLevel, number> = {
  green: 0,
  orange: 1,
  red: 2,
  black: 3,
};

function isPierreHrRiskLevel(value: unknown): value is PierreHrRiskLevel {
  return (
    value === "green" ||
    value === "orange" ||
    value === "red" ||
    value === "black"
  );
}

export function getPierreHrRiskRank(value: PierreHrRiskLevel): number {
  return PIERRE_HR_RISK_RANK[value];
}

export function getHighestPierreHrRiskLevel(
  baseRisk: PierreHrRiskLevel,
  overrideRisk?: PierreHrRiskLevel | null,
): PierreHrRiskLevel {
  if (!overrideRisk) return baseRisk;

  return getPierreHrRiskRank(overrideRisk) > getPierreHrRiskRank(baseRisk)
    ? overrideRisk
    : baseRisk;
}

// ══════════════════════════════════════════════════════════
// 3. NIVEAUX D'AUTONOMIE
// ══════════════════════════════════════════════════════════

export const PIERRE_AUTONOMY_LEVELS = [
  "draft_only",
  "low_risk_execution",
  "validation_smart",
  "advanced_operations",
  "enterprise_rules",
] as const;

export type PierreAutonomyLevel = (typeof PIERRE_AUTONOMY_LEVELS)[number];

// ══════════════════════════════════════════════════════════
// 4. POLITIQUE DE VALIDATION
// ══════════════════════════════════════════════════════════

export const PIERRE_APPROVAL_POLICIES = [
  "none",
  "recommended",
  "required",
  "human_only",
] as const;

export type PierreApprovalPolicy = (typeof PIERRE_APPROVAL_POLICIES)[number];

// ══════════════════════════════════════════════════════════
// 5. CLASSES D'ACTION
// ══════════════════════════════════════════════════════════

export const PIERRE_HR_ACTION_CLASSES = [
  "auto_executable",
  "validation_recommended",
  "validation_required",
  "blocked_without_human",
] as const;

export type PierreHrActionClass = (typeof PIERRE_HR_ACTION_CLASSES)[number];

// ══════════════════════════════════════════════════════════
// 6. KINDS DE TÂCHE RH
// ══════════════════════════════════════════════════════════

export const PIERRE_HR_TASK_KINDS = [
  // Auto-exécutable
  "relance",
  "rappel_echeance",
  "demande_info",
  "creation_tache",
  "synthese_interne",
  "rapport_standard",

  // Validation recommandée
  "email_salarie",
  "email_candidat",
  "document_rh",
  "compte_rendu",
  "trame_entretien",
  "synthese_manager",
  "onboarding_prep",
  "prepaie_prep",

  // Validation obligatoire
  "contrat",
  "avenant",
  "document_contractuel",
  "refus_candidat_formel",
  "remuneration",
  "employee_relations_doc",
  "absence_sensible",
  "sujet_medical",
  "conflit_prelim",
  "courrier_disciplinaire_prep",
  "offboarding_sensible",

  // Blocage humain obligatoire
  "decision_sanction",
  "decision_licenciement",
  "decision_salariale_finale",
  "interpretation_droit",
  "decision_discriminatoire",
  "modification_politique_rh",
  "envoi_juridique_sensible",
  "resolution_conflit_humain",
] as const;

export type PierreHrTaskKind = (typeof PIERRE_HR_TASK_KINDS)[number];

function isPierreHrTaskKind(value: unknown): value is PierreHrTaskKind {
  return (
    typeof value === "string" &&
    (PIERRE_HR_TASK_KINDS as readonly string[]).includes(value)
  );
}

export function normalizePierreHrTaskKind(
  value: unknown,
): PierreHrTaskKind | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().toLowerCase();

  return isPierreHrTaskKind(trimmed) ? trimmed : null;
}

// ══════════════════════════════════════════════════════════
// 7. STATUTS RH
// ══════════════════════════════════════════════════════════

export type PierreHrMissionStatus =
  | "draft"
  | "active"
  | "awaiting_info"
  | "awaiting_approval"
  | "scheduled"
  | "done"
  | "blocked"
  | "cancelled"
  | "error";

export type PierreHrTaskStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "awaiting_approval"
  | "running"
  | "done"
  | "blocked"
  | "retry"
  | "error"
  | "cancelled";

// ══════════════════════════════════════════════════════════
// 8. EXIGENCE DE VALIDATION
// ══════════════════════════════════════════════════════════

export type PierreHrValidationRequirement = {
  action_class: PierreHrActionClass;
  approval_policy: PierreApprovalPolicy;
  risk_level: PierreHrRiskLevel;
  blocked: boolean;
  human_note: string;
};

// ══════════════════════════════════════════════════════════
// 9. SOURCE DE VÉRITÉ
// ══════════════════════════════════════════════════════════

export const PIERRE_SOURCE_TRUTH_KINDS = [
  "user_input",
  "company_memory",
  "legal_ref",
  "policy_doc",
  "collective_agreement",
  "previous_document",
] as const;

export type PierreHrSourceTruthKind =
  (typeof PIERRE_SOURCE_TRUTH_KINDS)[number];

// ══════════════════════════════════════════════════════════
// 10. MATRICE ACTION / VALIDATION
// ══════════════════════════════════════════════════════════

export type PierreHrActionRule = {
  kinds: PierreHrTaskKind[];
  action_class: PierreHrActionClass;
  approval_policy: PierreApprovalPolicy;
  risk_level: PierreHrRiskLevel;
  human_note: string;
};

const ACTION_RULES: PierreHrActionRule[] = [
  {
    kinds: [
      "relance",
      "rappel_echeance",
      "demande_info",
      "creation_tache",
      "synthese_interne",
      "rapport_standard",
    ],
    action_class: "auto_executable",
    approval_policy: "none",
    risk_level: "green",
    human_note:
      "Action RH faible risque : Pierre peut l'exécuter automatiquement si l'entreprise l'autorise.",
  },
  {
    kinds: [
      "email_salarie",
      "email_candidat",
      "document_rh",
      "compte_rendu",
      "trame_entretien",
      "synthese_manager",
      "onboarding_prep",
      "prepaie_prep",
    ],
    action_class: "validation_recommended",
    approval_policy: "recommended",
    risk_level: "orange",
    human_note:
      "Validation recommandée avant diffusion : Pierre prépare, l'humain peut relire avant envoi ou usage.",
  },
  {
    kinds: [
      "contrat",
      "avenant",
      "document_contractuel",
      "refus_candidat_formel",
      "remuneration",
      "employee_relations_doc",
      "absence_sensible",
      "sujet_medical",
      "conflit_prelim",
      "courrier_disciplinaire_prep",
      "offboarding_sensible",
    ],
    action_class: "validation_required",
    approval_policy: "required",
    risk_level: "red",
    human_note:
      "Validation humaine obligatoire : Pierre prépare, mais l'humain doit valider explicitement avant tout envoi, signature ou action.",
  },
  {
    kinds: [
      "decision_sanction",
      "decision_licenciement",
      "decision_salariale_finale",
      "interpretation_droit",
      "decision_discriminatoire",
      "modification_politique_rh",
      "envoi_juridique_sensible",
      "resolution_conflit_humain",
    ],
    action_class: "blocked_without_human",
    approval_policy: "human_only",
    risk_level: "black",
    human_note:
      "Décision humaine exclusive : Pierre ne peut pas agir seul. Il peut seulement préparer un dossier, une synthèse ou une trace pour revue humaine.",
  },
];

const ACTION_CLASS_INDEX = new Map<PierreHrTaskKind, PierreHrActionRule>();

for (const rule of ACTION_RULES) {
  for (const kind of rule.kinds) {
    ACTION_CLASS_INDEX.set(kind, rule);
  }
}

export const PIERRE_ACTION_VALIDATION_MATRIX: readonly PierreHrActionRule[] =
  ACTION_RULES;

// ══════════════════════════════════════════════════════════
// 11. FONCTIONS PURES
// ══════════════════════════════════════════════════════════

export function normalizePierreHrDomain(value: unknown): PierreHrDomain {
  if (typeof value !== "string") return "unknown";

  const trimmed = value.trim().toLowerCase();

  if ((PIERRE_HR_DOMAINS as readonly string[]).includes(trimmed)) {
    return trimmed as PierreHrDomain;
  }

  return "unknown";
}

export function normalizePierreHrRiskLevel(value: unknown): PierreHrRiskLevel {
  if (typeof value !== "string") return "green";

  const trimmed = value.trim().toLowerCase();

  if (isPierreHrRiskLevel(trimmed)) {
    return trimmed;
  }

  // Compat avec types.ts
  if (trimmed === "low") return "green";
  if (trimmed === "medium") return "orange";
  if (trimmed === "high") return "red";

  // Compat avec mission/risk.ts
  if (trimmed === "normal") return "green";
  if (trimmed === "sensitive") return "orange";
  if (trimmed === "critical") return "red";

  // Compat avec vocabulaire UI / sécurité possible
  if (trimmed === "blocked") return "black";
  if (trimmed === "forbidden") return "black";
  if (trimmed === "human_only") return "black";

  return "green";
}

type ClassifyInput = {
  kind: unknown;
  domain?: unknown;
  override_risk?: unknown;
};

function resolveRequirementFromRisk(params: {
  rule: PierreHrActionRule;
  effectiveRisk: PierreHrRiskLevel;
}): PierreHrValidationRequirement {
  const { rule, effectiveRisk } = params;

  // Les actions noires par nature restent toujours noires.
  if (rule.action_class === "blocked_without_human") {
    return {
      action_class: "blocked_without_human",
      approval_policy: "human_only",
      risk_level: "black",
      blocked: true,
      human_note: rule.human_note,
    };
  }

  // Black contextuel : validation obligatoire, mais pas blocage absolu par nature.
  // Exemple : une relance simple peut devenir très sensible selon le contexte.
  if (effectiveRisk === "black") {
    return {
      action_class: "validation_required",
      approval_policy: "required",
      risk_level: "black",
      blocked: false,
      human_note:
        "Contexte RH très sensible : Pierre peut préparer l'action, mais une validation humaine explicite est obligatoire avant toute exécution.",
    };
  }

  if (effectiveRisk === "red") {
    return {
      action_class: "validation_required",
      approval_policy: "required",
      risk_level: "red",
      blocked: false,
      human_note:
        rule.risk_level === "red"
          ? rule.human_note
          : "Risque RH escaladé : validation humaine obligatoire avant toute exécution.",
    };
  }

  if (effectiveRisk === "orange") {
    return {
      action_class: "validation_recommended",
      approval_policy: "recommended",
      risk_level: "orange",
      blocked: false,
      human_note:
        rule.risk_level === "orange"
          ? rule.human_note
          : "Risque RH modéré : validation humaine recommandée avant diffusion ou exécution.",
    };
  }

  return {
    action_class: rule.action_class,
    approval_policy: rule.approval_policy,
    risk_level: rule.risk_level,
    blocked: false,
    human_note: rule.human_note,
  };
}

/**
 * Classifie une action RH et retourne son exigence de validation.
 *
 * Sécurité importante :
 * - Le risque de base de la matrice ne peut jamais être diminué.
 * - override_risk sert uniquement à escalader.
 * - Les actions noires par nature restent bloquées humainement.
 * - Les actions inconnues passent en red / validation_required par prudence.
 */
export function classifyPierreHrActionRequirement(
  input: ClassifyInput,
): PierreHrValidationRequirement {
  const normalizedKind = normalizePierreHrTaskKind(input.kind);
  const normalizedOverrideRisk =
    input.override_risk === undefined || input.override_risk === null
      ? null
      : normalizePierreHrRiskLevel(input.override_risk);

  if (!normalizedKind) {
    return {
      action_class: "validation_required",
      approval_policy: "required",
      risk_level: getHighestPierreHrRiskLevel(
        "red",
        normalizedOverrideRisk,
      ),
      blocked: false,
      human_note:
        "Type de tâche RH non classifié : validation humaine obligatoire par prudence.",
    };
  }

  const rule = ACTION_CLASS_INDEX.get(normalizedKind);

  if (!rule) {
    return {
      action_class: "validation_required",
      approval_policy: "required",
      risk_level: getHighestPierreHrRiskLevel(
        "red",
        normalizedOverrideRisk,
      ),
      blocked: false,
      human_note:
        "Type de tâche RH absent de la matrice : validation humaine obligatoire par prudence.",
    };
  }

  const effectiveRisk = getHighestPierreHrRiskLevel(
    rule.risk_level,
    normalizedOverrideRisk,
  );

  return resolveRequirementFromRisk({
    rule,
    effectiveRisk,
  });
}