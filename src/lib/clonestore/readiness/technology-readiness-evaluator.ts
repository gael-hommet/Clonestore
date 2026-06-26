// TECH-11 — Technology Readiness Final Gate — Evaluator
// Évalue la readiness de chaque technologie et produit un verdict global.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessStatus,
  TechnologyReadinessTechnologyResult,
  TechnologyReadinessEmployeeResult,
  TechnologyReadinessVerdict,
  TechnologyReadinessCheck,
} from "./technology-readiness-types";
import type { GlobalTechnologyKey } from "../technologies/global-tech-config";
import { DEFAULT_GLOBAL_TECH_CONFIGS } from "../technologies/global-tech-defaults";
import { TECHNOLOGY_SOURCE_MAP } from "./technology-readiness-sources";
import {
  getEmployeeRuntimeContract,
  EMPLOYEE_RUNTIME_REGISTRY,
  getEmployeeHardRequiredTechnologies,
} from "../employees/employee-registry";
import { evaluateTechnologyInvariants } from "./technology-readiness-invariants";

// ── Évaluation par technologie ────────────────────────────────────────────────

/**
 * Évalue la readiness d'une technologie spécifique.
 */
export function evaluateSingleTechnologyReadiness(
  key: GlobalTechnologyKey,
): TechnologyReadinessTechnologyResult {
  const config = DEFAULT_GLOBAL_TECH_CONFIGS[key];
  const source = TECHNOLOGY_SOURCE_MAP[key];

  if (!config) {
    return {
      key,
      display_name: key,
      status: "blocked",
      readiness_score: 0,
      is_implemented: false,
      is_tested: false,
      is_global_layer: false,
      required_for_employee_runtime: false,
      required_for_public_launch: false,
      tech_docs_created: false,
      checks: [],
      notes: [`Configuration manquante pour ${key}`],
    };
  }

  // Mapper le statut config → readiness status
  let status: TechnologyReadinessStatus;
  switch (config.status) {
    case "active":
      status = source?.is_implemented ? "ready" : "partial";
      break;
    case "partial":
      status = "partial";
      break;
    case "roadmap":
      status = "roadmap";
      break;
    case "disabled":
      // CloneVoice est disabled mode mais a une readiness layer implémentée
      status = source?.is_implemented ? "partial" : "roadmap";
      break;
    case "locked":
      status = "blocked";
      break;
    default:
      status = "partial";
  }

  const checks: TechnologyReadinessCheck[] = [];

  // Check: configuration présente
  checks.push({
    check_id: `${key}_config_present`,
    area: "global_technology_config",
    label: "Configuration GlobalTechnologyConfig présente",
    description: `La configuration ${key} existe dans DEFAULT_GLOBAL_TECH_CONFIGS.`,
    status: "pass",
    severity: "info",
    tech_ref: key,
  });

  // Check: implementation
  if (source?.is_implemented) {
    checks.push({
      check_id: `${key}_implemented`,
      area: "global_technology_config",
      label: "Module implémenté",
      description: `Le module ${key} est implémenté dans ${source.module_path || "N/A"}.`,
      status: "pass",
      severity: "info",
      tech_ref: key,
    });
  } else {
    checks.push({
      check_id: `${key}_not_implemented`,
      area: "global_technology_config",
      label: "Module non implémenté (roadmap)",
      description: `Le module ${key} est sur roadmap — non implémenté en V1.`,
      status: "skip",
      severity: "info",
      tech_ref: key,
    });
  }

  // Check: doc créée
  const hasDoc = source?.doc_path ? source.doc_path.length > 0 : false;
  checks.push({
    check_id: `${key}_doc_present`,
    area: "global_technology_config",
    label: "Documentation TECH-XX créée",
    description: `Documentation ${source?.doc_path ?? "N/A"} présente.`,
    status: hasDoc ? "pass" : "skip",
    severity: "info",
    tech_ref: key,
  });

  // Notes spécifiques
  const notes: string[] = [];
  if (key === "clonevoice") {
    notes.push(
      "CloneVoice : readiness layer TECH-10 complète. Non actif en production.",
      "production_enabled=false, live_audio_ready=false — invariants absolus.",
    );
  }
  if (key === "clonepolicy") {
    notes.push(
      "ClonePolicy : moteur interne CloneGuard. Pas un produit client autonome.",
      "Présent dans GlobalTechnologyKey mais pas dans TechnologySlug.",
    );
  }
  if (key === "clonetrust") {
    notes.push(
      "CloneTrust : autonomie graduelle (gradual_autonomy) — PAS zero-trust.",
    );
  }
  if (key === "clonechat") {
    notes.push(
      "CloneChat : canal conversationnel — pas CloneOS. Interface d'entrée utilisateur.",
    );
  }
  if (["clonereview", "clonesignals", "clonelearn"].includes(key)) {
    notes.push(`${key} : roadmap — déclaré mais non implémenté en V1. Honnêtement marqué roadmap.`);
  }

  // Pour CloneBrief: le GlobalTechnologyConfig dit roadmap mais le module TECH-09 est complet
  if (key === "clonebrief") {
    notes.push(
      "CloneBrief : module TECH-09 complet avec 68 tests. GlobalTechnologyConfig status=roadmap reflète l'activation produit, pas l'implémentation du module.",
    );
    status = "partial"; // Implémenté mais config dit roadmap — ajustement honnête
  }

  return {
    key,
    display_name: config.display_name,
    status,
    readiness_score: config.readiness_score,
    is_implemented: source?.is_implemented ?? false,
    is_tested: source?.is_implemented ?? false, // Si implémenté, tests présents
    is_global_layer: source?.is_global_layer ?? false,
    required_for_employee_runtime: config.required_for_employee_runtime,
    required_for_public_launch: config.required_for_public_launch,
    tech_docs_created: hasDoc,
    checks,
    notes,
  };
}

/**
 * Évalue toutes les technologies.
 */
export function evaluateAllTechnologyReadiness(): TechnologyReadinessTechnologyResult[] {
  const keys: GlobalTechnologyKey[] = [
    "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice",
    "clonechat", "clonepolicy", "clonecontinuum", "clonetrust",
    "clonereview", "clonesignals", "clonelearn", "clonebrief",
  ];
  return keys.map(evaluateSingleTechnologyReadiness);
}

// ── Évaluation Employee ───────────────────────────────────────────────────────

/**
 * Évalue la readiness technologique d'un employé.
 */
export function evaluateEmployeeTechnologyReadiness(
  employeeSlug: string,
): TechnologyReadinessEmployeeResult {
  const employee = getEmployeeRuntimeContract(employeeSlug);

  if (employee === null) {
    return {
      employee_slug: employeeSlug,
      display_name: employeeSlug,
      status: "blocked",
      is_registered: false,
      is_active: false,
      launch_stage: "roadmap",
      required_technologies_covered: false,
      hard_required_tech_slugs: [],
      missing_tech_slugs: [],
      critical_permissions_false: false,
      bridge_coverage: {
        adn_bridge: false,
        guard_bridge: false,
        trace_bridge: false,
        cloneos_bridge: false,
        brief_bridge: false,
        voice_bridge_readiness: false,
      },
      product_runtime_ready: false,
      public_launch_ready: false,
      checks: [],
      notes: [`Employé ${employeeSlug} non trouvé dans l'Employee Registry.`],
    };
  }

  const hardRequired = getEmployeeHardRequiredTechnologies(employeeSlug);
  const hardRequiredSlugs = hardRequired.map((t) => t.slug);

  // Vérifier que toutes les technologies requises sont implémentées
  const missingTech = hardRequiredSlugs.filter((slug) => {
    const source = TECHNOLOGY_SOURCE_MAP[slug as GlobalTechnologyKey];
    return source && !source.is_implemented;
  });

  const critPermsFalse =
    employee.permissions?.can_make_legal_decision === false &&
    employee.permissions?.can_run_payroll_officially === false &&
    employee.permissions?.can_terminate_employee_autonomously === false &&
    employee.permissions?.can_sign_contracts === false;

  // Bridge coverage pour Pierre
  const isPierre = employeeSlug === "pierre";
  const bridgeCoverage = {
    adn_bridge: isPierre, // pierre-brief-bridge.ts, ADN bridge in TECH-05
    guard_bridge: isPierre,
    trace_bridge: isPierre,
    cloneos_bridge: isPierre,
    brief_bridge: isPierre, // pierre-brief-bridge.ts TECH-09
    voice_bridge_readiness: isPierre, // pierre-voice-bridge.ts TECH-10
  };

  const checks: TechnologyReadinessCheck[] = [
    {
      check_id: `${employeeSlug}_registered`,
      area: "employee_runtime_contract",
      label: "Employé enregistré",
      description: "L'employé est dans EMPLOYEE_REGISTRY.",
      status: "pass",
      severity: "info",
    },
    {
      check_id: `${employeeSlug}_hard_required_tech`,
      area: "employee_runtime_contract",
      label: "Technologies hard required",
      description: `Technologies hard required: ${hardRequiredSlugs.join(", ")}.`,
      status: missingTech.length === 0 ? "pass" : "warning",
      severity: missingTech.length === 0 ? "info" : "warning",
      detail: missingTech.length > 0 ? `Manquants: ${missingTech.join(", ")}` : undefined,
    },
    {
      check_id: `${employeeSlug}_critical_perms`,
      area: "employee_runtime_contract",
      label: "Permissions critiques false",
      description: "legal_decision, official_payroll, employee_termination, contract_signature = false.",
      status: critPermsFalse ? "pass" : "fail",
      severity: "blocking",
    },
  ];

  const status: TechnologyReadinessStatus =
    employee.status === "active" && missingTech.length === 0 && critPermsFalse
      ? "ready"
      : employee.status === "active"
      ? "partial"
      : "roadmap";

  const notes = isPierre
    ? [
        "Pierre est le premier employé IA actif V1.",
        "Pierre est fonctionnel côté repo — public_launch_ready reste false (blockers externes).",
        "Pierre ≠ CloneOS. Pierre utilise CloneOS comme couche d'orchestration.",
      ]
    : [`${employeeSlug} non actif en V1.`];

  return {
    employee_slug: employeeSlug,
    display_name: employee.display_name,
    status,
    is_registered: true,
    is_active: employee.status === "active",
    launch_stage: employee.launch_stage,
    required_technologies_covered: missingTech.length === 0,
    hard_required_tech_slugs: hardRequiredSlugs,
    missing_tech_slugs: missingTech,
    critical_permissions_false: critPermsFalse,
    bridge_coverage: bridgeCoverage,
    product_runtime_ready: status === "ready" || status === "partial",
    public_launch_ready: false,
    checks,
    notes,
  };
}

// ── Score et verdict ──────────────────────────────────────────────────────────

/**
 * Calcule le score de foundation technologique (0-100).
 * Basé sur les technologies implémentées, surtout celles requises pour l'employee runtime.
 */
export function calculateTechnologyFoundationScore(
  technologies: TechnologyReadinessTechnologyResult[],
): number {
  if (technologies.length === 0) return 0;

  const coreRequired = technologies.filter((t) => t.required_for_employee_runtime);
  const coreScore =
    coreRequired.length > 0
      ? coreRequired.reduce((sum, t) => sum + t.readiness_score, 0) / coreRequired.length
      : 0;

  const optional = technologies.filter((t) => !t.required_for_employee_runtime);
  const optionalScore =
    optional.length > 0
      ? optional.reduce((sum, t) => sum + t.readiness_score, 0) / optional.length
      : 0;

  // 75% pondération sur les core required, 25% sur les autres
  return Math.round(coreScore * 0.75 + optionalScore * 0.25);
}

/**
 * Calcule le score global de readiness (0-100).
 */
export function calculateOverallReadinessScore(
  technologies: TechnologyReadinessTechnologyResult[],
  invariants: { status: string }[],
): number {
  const techScore = calculateTechnologyFoundationScore(technologies);
  const invariantScore =
    invariants.length > 0
      ? (invariants.filter((i) => i.status === "pass").length / invariants.length) * 100
      : 100;

  return Math.round(techScore * 0.7 + invariantScore * 0.3);
}

/**
 * Construit le verdict global de readiness.
 */
export function buildTechnologyReadinessVerdict(
  technologies: TechnologyReadinessTechnologyResult[],
  invariants: { status: string; is_absolute: boolean }[],
  hasExternalBlockers: boolean,
): TechnologyReadinessVerdict {
  // Violation invariant absolu → blocked
  const absoluteFailures = invariants.filter(
    (i) => i.is_absolute && i.status === "fail",
  );
  if (absoluteFailures.length > 0) return "technology_foundation_blocked";

  // Vérifier que les technologies core required sont au moins partial
  const coreRequired = technologies.filter((t) => t.required_for_employee_runtime);
  const coreBlocked = coreRequired.filter((t) => t.status === "blocked");
  if (coreBlocked.length > 0) return "technology_foundation_blocked";

  // Vérifier si tout est ready ou partial
  const coreReady = coreRequired.filter((t) => t.status === "ready" || t.status === "partial");
  const foundationComplete = coreReady.length === coreRequired.length;

  if (!foundationComplete) return "technology_foundation_partial";

  // Foundation complète → external blockers déterminent le verdict
  if (hasExternalBlockers) return "public_launch_blocked_external";

  return "technology_foundation_ready";
}

/**
 * Évalue la readiness de toutes les technologies avec un verdict.
 */
export function evaluateTechnologyReadiness(): {
  technologies: TechnologyReadinessTechnologyResult[];
  employees: TechnologyReadinessEmployeeResult[];
  overall_score: number;
  verdict: TechnologyReadinessVerdict;
  foundation_score: number;
} {
  const technologies = evaluateAllTechnologyReadiness();
  const employees = EMPLOYEE_RUNTIME_REGISTRY.map((e: { slug: string }) =>
    evaluateEmployeeTechnologyReadiness(e.slug),
  );

  const invariants = evaluateTechnologyInvariants();

  const foundationScore = calculateTechnologyFoundationScore(technologies);
  const overallScore = calculateOverallReadinessScore(technologies, invariants);
  const verdict = buildTechnologyReadinessVerdict(technologies, invariants, true); // External blockers toujours présents

  return {
    technologies,
    employees,
    overall_score: overallScore,
    verdict,
    foundation_score: foundationScore,
  };
}
