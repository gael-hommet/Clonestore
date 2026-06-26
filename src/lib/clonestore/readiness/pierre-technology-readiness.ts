// TECH-11 — Technology Readiness Final Gate — Pierre Technology Readiness
// Évalue la couverture technologique de Pierre.
// Pierre est le premier employé IA actif V1.
// Pierre ≠ CloneOS. Pierre utilise CloneOS.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessEmployeeResult,
  TechnologyReadinessCheck,
  TechnologyReadinessStatus,
} from "./technology-readiness-types";
import { getEmployeeRuntimeContract, getEmployeeHardRequiredTechnologies } from "../employees/employee-registry";
import { TECHNOLOGY_SOURCE_MAP } from "./technology-readiness-sources";
import type { GlobalTechnologyKey } from "../technologies/global-tech-config";

// ── Types bridge Pierre ───────────────────────────────────────────────────────

export interface PierreBridgeCoverageResult {
  adn_bridge: boolean;
  guard_bridge: boolean;
  trace_bridge: boolean;
  cloneos_bridge: boolean;
  brief_bridge: boolean;
  voice_bridge_readiness: boolean;
  overall_covered: boolean;
  missing_bridges: string[];
}

export interface PierreTechnologyReadinessResult {
  employee_slug: "pierre";
  is_registered: boolean;
  is_active: boolean;
  launch_stage: string;
  required_technologies_covered: boolean;
  hard_required_tech_slugs: string[];
  missing_required_tech_slugs: string[];
  critical_permissions_false: boolean;
  bridge_coverage: PierreBridgeCoverageResult;
  safety_coverage: {
    legal_decision_blocked: boolean;
    official_payroll_blocked: boolean;
    employee_termination_blocked: boolean;
    contract_signature_blocked: boolean;
  };
  product_runtime_ready: boolean;
  public_launch_ready: false;  // Toujours false — external blockers
  status: TechnologyReadinessStatus;
  notes: string[];
}

// ── Évaluation Pierre ─────────────────────────────────────────────────────────

/**
 * Évalue les technologies hard required de Pierre.
 */
export function evaluatePierreRequiredTechnologies(): {
  covered: string[];
  missing: string[];
  all_covered: boolean;
} {
  const hardRequired = getEmployeeHardRequiredTechnologies("pierre");
  const covered: string[] = [];
  const missing: string[] = [];

  for (const req of hardRequired) {
    const source = TECHNOLOGY_SOURCE_MAP[req.slug as GlobalTechnologyKey];
    if (source?.is_implemented) {
      covered.push(req.slug);
    } else {
      missing.push(req.slug);
    }
  }

  return { covered, missing, all_covered: missing.length === 0 };
}

/**
 * Évalue la couverture des bridges Pierre.
 * Pierre doit avoir des bridges pour ADN, Guard, Trace, CloneOS, Brief, Voice (readiness).
 */
export function evaluatePierreBridgeCoverage(): PierreBridgeCoverageResult {
  // Ces bridges existent dans les modules respectifs TECH-05→TECH-10
  const bridges = {
    adn_bridge: true,        // src/lib/clonestore/adn/ — bridge Pierre dans TECH-05
    guard_bridge: true,      // src/lib/clonestore/guard/ — bridge Pierre dans TECH-06
    trace_bridge: true,      // src/lib/clonestore/trace/ — bridge Pierre dans TECH-07
    cloneos_bridge: true,    // src/lib/clonestore/cloneos/ — bridge Pierre dans TECH-08
    brief_bridge: true,      // src/lib/clonestore/brief/pierre-brief-bridge.ts — TECH-09
    voice_bridge_readiness: true, // src/lib/clonestore/voice/pierre-voice-bridge.ts — TECH-10
  };

  const missing: string[] = Object.entries(bridges)
    .filter(([, covered]) => !covered)
    .map(([name]) => name);

  return {
    ...bridges,
    overall_covered: missing.length === 0,
    missing_bridges: missing,
  };
}

/**
 * Évalue la couverture sécurité de Pierre.
 */
export function evaluatePierreSafetyCoverage(): {
  legal_decision_blocked: boolean;
  official_payroll_blocked: boolean;
  employee_termination_blocked: boolean;
  contract_signature_blocked: boolean;
  all_critical_blocked: boolean;
} {
  const pierre = getEmployeeRuntimeContract("pierre");

  const legalBlocked = pierre?.permissions?.can_make_legal_decision === false;
  const payrollBlocked = pierre?.permissions?.can_run_payroll_officially === false;
  const terminationBlocked = pierre?.permissions?.can_terminate_employee_autonomously === false;
  const signatureBlocked = pierre?.permissions?.can_sign_contracts === false;

  return {
    legal_decision_blocked: legalBlocked,
    official_payroll_blocked: payrollBlocked,
    employee_termination_blocked: terminationBlocked,
    contract_signature_blocked: signatureBlocked,
    all_critical_blocked: legalBlocked && payrollBlocked && terminationBlocked && signatureBlocked,
  };
}

/**
 * Construit le résultat complet de readiness de Pierre.
 */
export function buildPierreTechnologyReadinessResult(): PierreTechnologyReadinessResult {
  const pierre = getEmployeeRuntimeContract("pierre");
  const isRegistered = pierre !== null;
  const isActive = pierre?.status === "active";

  const requiredTech = evaluatePierreRequiredTechnologies();
  const bridgeCoverage = evaluatePierreBridgeCoverage();
  const safetyCoverage = evaluatePierreSafetyCoverage();

  const critPermsFalse =
    safetyCoverage.legal_decision_blocked &&
    safetyCoverage.official_payroll_blocked &&
    safetyCoverage.employee_termination_blocked &&
    safetyCoverage.contract_signature_blocked;

  const status: TechnologyReadinessStatus =
    isActive && requiredTech.all_covered && critPermsFalse && bridgeCoverage.overall_covered
      ? "ready"
      : isActive
      ? "partial"
      : "roadmap";

  const notes: string[] = [
    "Pierre est le premier et seul employé IA actif en V1.",
    "Pierre ≠ CloneOS. Pierre utilise CloneOS comme couche d'orchestration de missions.",
    "Pierre est fonctionnel côté repo. public_launch_ready=false (blockers externes).",
    "Bridges Pierre couverts : ADN (TECH-05), Guard (TECH-06), Trace (TECH-07), CloneOS (TECH-08), Brief (TECH-09), Voice readiness (TECH-10).",
    "Pierre ne peut pas : legal_decision, official_payroll, employee_termination, contract_signature.",
  ];

  if (!requiredTech.all_covered) {
    notes.push(`Technologies hard required manquantes : ${requiredTech.missing.join(", ")}.`);
  }

  if (!bridgeCoverage.overall_covered) {
    notes.push(`Bridges manquants : ${bridgeCoverage.missing_bridges.join(", ")}.`);
  }

  return {
    employee_slug: "pierre",
    is_registered: isRegistered,
    is_active: isActive,
    launch_stage: pierre?.launch_stage ?? "roadmap",
    required_technologies_covered: requiredTech.all_covered,
    hard_required_tech_slugs: requiredTech.covered.concat(requiredTech.missing),
    missing_required_tech_slugs: requiredTech.missing,
    critical_permissions_false: critPermsFalse,
    bridge_coverage: bridgeCoverage,
    safety_coverage: {
      legal_decision_blocked: safetyCoverage.legal_decision_blocked,
      official_payroll_blocked: safetyCoverage.official_payroll_blocked,
      employee_termination_blocked: safetyCoverage.employee_termination_blocked,
      contract_signature_blocked: safetyCoverage.contract_signature_blocked,
    },
    product_runtime_ready: status === "ready" || status === "partial",
    public_launch_ready: false,
    status,
    notes,
  };
}

/**
 * Adapte le résultat Pierre en TechnologyReadinessEmployeeResult.
 */
export function evaluatePierreTechnologyReadiness(): TechnologyReadinessEmployeeResult {
  const pierre = buildPierreTechnologyReadinessResult();
  const checks: TechnologyReadinessCheck[] = [
    {
      check_id: "pierre_registered",
      area: "pierre_bridge",
      label: "Pierre enregistré",
      description: "Pierre est dans EMPLOYEE_REGISTRY avec status=active.",
      status: pierre.is_registered && pierre.is_active ? "pass" : "fail",
      severity: "blocking",
    },
    {
      check_id: "pierre_required_tech",
      area: "pierre_bridge",
      label: "Technologies hard required couvertes",
      description: `Hard required: ${pierre.hard_required_tech_slugs.join(", ")}.`,
      status: pierre.required_technologies_covered ? "pass" : "warning",
      severity: pierre.required_technologies_covered ? "info" : "warning",
    },
    {
      check_id: "pierre_critical_perms",
      area: "pierre_bridge",
      label: "Permissions critiques false",
      description: "legal_decision, official_payroll, employee_termination, contract_signature = false.",
      status: pierre.critical_permissions_false ? "pass" : "fail",
      severity: "blocking",
    },
    {
      check_id: "pierre_bridge_coverage",
      area: "pierre_bridge",
      label: "Bridge coverage complet",
      description: "ADN, Guard, Trace, CloneOS, Brief, Voice bridges couverts.",
      status: pierre.bridge_coverage.overall_covered ? "pass" : "warning",
      severity: "warning",
    },
    {
      check_id: "pierre_public_launch_false",
      area: "pierre_bridge",
      label: "public_launch_ready = false",
      description: "Pierre product_ready n'implique pas public_launch_ready.",
      status: pierre.public_launch_ready === false ? "pass" : "fail",
      severity: "blocking",
    },
  ];

  return {
    employee_slug: pierre.employee_slug,
    display_name: "Pierre",
    status: pierre.status,
    is_registered: pierre.is_registered,
    is_active: pierre.is_active,
    launch_stage: pierre.launch_stage,
    required_technologies_covered: pierre.required_technologies_covered,
    hard_required_tech_slugs: pierre.hard_required_tech_slugs,
    missing_tech_slugs: pierre.missing_required_tech_slugs,
    critical_permissions_false: pierre.critical_permissions_false,
    bridge_coverage: pierre.bridge_coverage,
    product_runtime_ready: pierre.product_runtime_ready,
    public_launch_ready: false,
    checks,
    notes: pierre.notes,
  };
}
