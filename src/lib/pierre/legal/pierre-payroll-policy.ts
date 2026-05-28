// B47 — Pierre Payroll Policy
// Defines what Pierre can and cannot do for payroll-related tasks.
// Pure: no Supabase, no Next, no async. No throw.

export type PierrePayrollTaskType =
  | "variable_elements_collection"
  | "prepayroll_summary"
  | "anomaly_detection"
  | "absence_recap"
  | "bonus_list"
  | "advance_request"
  | "payslip_generation"
  | "dsn_submission"
  | "payroll_certification"
  | "official_payroll_calculation"
  | "salary_change_execution"
  | "payroll_export";

export type PierrePayrollTaskPolicy = {
  task_type: PierrePayrollTaskType;
  pierre_can_do: boolean;
  requires_expert_validation: boolean;
  requires_human_approval: boolean;
  is_official_act: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  safe_description: string;
  required_disclaimers: string[];
  safe_next_actions: string[];
};

const PAYROLL_TASK_POLICIES: Record<PierrePayrollTaskType, PierrePayrollTaskPolicy> = {
  variable_elements_collection: {
    task_type: "variable_elements_collection",
    pierre_can_do: true,
    requires_expert_validation: true,
    requires_human_approval: false,
    is_official_act: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre collecte et structure les éléments variables de paie (heures sup, absences, primes) — aucune valeur officielle.",
    required_disclaimers: ["PAYROLL_LIMIT"],
    safe_next_actions: ["review_with_payroll_expert", "cross_check_with_hr_manager"],
  },
  prepayroll_summary: {
    task_type: "prepayroll_summary",
    pierre_can_do: true,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre prépare un résumé pré-paie à des fins préparatoires uniquement — validation expert paie obligatoire.",
    required_disclaimers: ["PAYROLL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
    safe_next_actions: ["submit_to_payroll_expert", "validate_before_processing"],
  },
  anomaly_detection: {
    task_type: "anomaly_detection",
    pierre_can_do: true,
    requires_expert_validation: true,
    requires_human_approval: false,
    is_official_act: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre signale des anomalies potentielles dans les données de paie — pas de correction automatique.",
    required_disclaimers: ["PAYROLL_LIMIT"],
    safe_next_actions: ["flag_for_expert_review", "document_anomaly"],
  },
  absence_recap: {
    task_type: "absence_recap",
    pierre_can_do: true,
    requires_expert_validation: false,
    requires_human_approval: false,
    is_official_act: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre récapitule les absences saisies pour la période — à vérifier avant saisie paie.",
    required_disclaimers: ["PAYROLL_LIMIT"],
    safe_next_actions: ["verify_with_hr_manager", "confirm_before_payroll_entry"],
  },
  bonus_list: {
    task_type: "bonus_list",
    pierre_can_do: true,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre liste les primes et bonus à traiter — aucune décision finale, validation RH/direction requise.",
    required_disclaimers: ["PAYROLL_LIMIT", "HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["validate_with_hr_manager", "confirm_with_direction"],
  },
  advance_request: {
    task_type: "advance_request",
    pierre_can_do: true,
    requires_expert_validation: false,
    requires_human_approval: true,
    is_official_act: false,
    is_blocked: false,
    blocked_reason: null,
    safe_description: "Pierre enregistre une demande d'acompte — approbation manuelle obligatoire.",
    required_disclaimers: ["HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["escalate_to_hr_manager", "confirm_payment_with_accounting"],
  },
  payslip_generation: {
    task_type: "payslip_generation",
    pierre_can_do: false,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: true,
    is_blocked: true,
    blocked_reason: "Pierre ne génère pas de bulletins de paie officiels — acte réservé à un logiciel de paie certifié et/ou expert-comptable.",
    safe_description: "Génération de bulletins de paie officiels — BLOQUÉ.",
    required_disclaimers: ["PAYROLL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
    safe_next_actions: ["use_certified_payroll_software", "consult_payroll_expert"],
  },
  dsn_submission: {
    task_type: "dsn_submission",
    pierre_can_do: false,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: true,
    is_blocked: true,
    blocked_reason: "Pierre ne peut pas soumettre la DSN — acte officiel réservé à un logiciel certifié et/ou expert-comptable.",
    safe_description: "Soumission DSN — BLOQUÉ.",
    required_disclaimers: ["PAYROLL_LIMIT"],
    safe_next_actions: ["use_certified_dsn_software", "consult_payroll_expert"],
  },
  payroll_certification: {
    task_type: "payroll_certification",
    pierre_can_do: false,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: true,
    is_blocked: true,
    blocked_reason: "Pierre ne certifie pas la paie — certification réservée à l'expert-comptable ou logiciel agréé.",
    safe_description: "Certification de paie — BLOQUÉ.",
    required_disclaimers: ["PAYROLL_LIMIT"],
    safe_next_actions: ["consult_payroll_expert", "use_certified_payroll_software"],
  },
  official_payroll_calculation: {
    task_type: "official_payroll_calculation",
    pierre_can_do: false,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: true,
    is_blocked: true,
    blocked_reason: "Pierre ne calcule pas la paie officielle — calcul réservé à un logiciel de paie certifié.",
    safe_description: "Calcul officiel de la paie — BLOQUÉ.",
    required_disclaimers: ["PAYROLL_LIMIT"],
    safe_next_actions: ["use_certified_payroll_software", "consult_payroll_expert"],
  },
  salary_change_execution: {
    task_type: "salary_change_execution",
    pierre_can_do: false,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: true,
    is_blocked: true,
    blocked_reason: "Pierre ne peut pas exécuter un changement de salaire — décision humaine obligatoire + mise à jour dans le logiciel de paie.",
    safe_description: "Exécution d'un changement de salaire — BLOQUÉ.",
    required_disclaimers: ["PAYROLL_LIMIT", "HUMAN_RESPONSIBILITY"],
    safe_next_actions: ["escalate_to_hr_manager", "update_in_payroll_software"],
  },
  payroll_export: {
    task_type: "payroll_export",
    pierre_can_do: false,
    requires_expert_validation: true,
    requires_human_approval: true,
    is_official_act: true,
    is_blocked: true,
    blocked_reason: "Pierre ne peut pas exporter des données de paie officielles sans validation expert paie.",
    safe_description: "Export de paie officiel — BLOQUÉ.",
    required_disclaimers: ["PAYROLL_LIMIT", "OFFICIAL_DOCUMENT_VALIDATION"],
    safe_next_actions: ["validate_with_payroll_expert", "use_certified_export_tool"],
  },
};

// ── Functions ─────────────────────────────────────────────────────────────────

export function getPierrePayrollTaskPolicy(taskType: PierrePayrollTaskType): PierrePayrollTaskPolicy {
  return PAYROLL_TASK_POLICIES[taskType];
}

export function isPierrePayrollTaskAllowed(taskType: PierrePayrollTaskType): boolean {
  return PAYROLL_TASK_POLICIES[taskType]?.pierre_can_do ?? false;
}

export function isPierrePayrollTaskBlocked(taskType: PierrePayrollTaskType): boolean {
  return PAYROLL_TASK_POLICIES[taskType]?.is_blocked ?? true;
}

export function getAllPayrollTaskPolicies(): PierrePayrollTaskPolicy[] {
  return Object.values(PAYROLL_TASK_POLICIES);
}

export function getBlockedPayrollTasks(): PierrePayrollTaskPolicy[] {
  return Object.values(PAYROLL_TASK_POLICIES).filter((p) => p.is_blocked);
}

export function getAllowedPayrollTasks(): PierrePayrollTaskPolicy[] {
  return Object.values(PAYROLL_TASK_POLICIES).filter((p) => !p.is_blocked && p.pierre_can_do);
}

export function assertPierrePayrollNotOfficialSoftware(claim: string): { ok: boolean; violations: string[] } {
  const FORBIDDEN_PAYROLL_SOFTWARE_CLAIMS = [
    "logiciel de paie",
    "remplace la dsn",
    "génère des bulletins officiels",
    "certifie la paie",
    "calcul officiel de paie",
    "remplace l'expert-comptable",
    "expert-comptable",
    "logiciel certifié",
  ];
  const lower = claim.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const violations = FORBIDDEN_PAYROLL_SOFTWARE_CLAIMS.filter((p) =>
    lower.includes(p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")),
  );
  return { ok: violations.length === 0, violations };
}

export function buildPayrollCapabilitySummary(): {
  can_do: string[];
  cannot_do: string[];
  key_limit: string;
} {
  const can_do = getAllowedPayrollTasks().map((p) => p.safe_description);
  const cannot_do = getBlockedPayrollTasks().map((p) => p.blocked_reason ?? "Action bloquée");
  return {
    can_do,
    cannot_do,
    key_limit:
      "Pierre prépare et structure les éléments de pré-paie. Il ne génère pas de bulletins officiels, ne soumet pas la DSN, et ne remplace pas un logiciel de paie certifié ou un expert-comptable.",
  };
}
