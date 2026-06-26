// TECH-02 — Employee Registry Validator
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Validates EmployeeRuntimeContract and the full registry for:
// - structural integrity (required fields, non-empty arrays)
// - technology correctness (valid slugs, no duplicates)
// - permission safety (forbidden permissions must always be false)
// - launch readiness consistency

import type { EmployeeRuntimeContract } from "./employee-runtime-contract";
import { VALID_EMPLOYEE_TECHNOLOGY_SLUGS } from "./employee-runtime-contract";
import { EMPLOYEE_RUNTIME_REGISTRY } from "./employee-registry";

// ── Internal helpers ─────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function isNonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

const VALID_STATUSES = new Set(["active", "beta", "roadmap", "disabled", "deprecated"]);
const VALID_DOMAINS = new Set(["hr", "support", "finance", "legal", "sales", "ops", "marketing", "data", "custom"]);
const VALID_LAUNCH_STAGES = new Set(["launch_candidate", "beta_access", "internal_only", "roadmap", "concept"]);

// ── Contract validation result ────────────────────────────────────────────────

export type EmployeeContractValidationResult = {
  ok: boolean;
  slug: string;
  errors: string[];
  warnings: string[];
};

// ── Registry validation report ────────────────────────────────────────────────

export type EmployeeRegistryValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  employee_count: number;
  launch_ready_count: number;
  checked_at: string;
  per_employee: EmployeeContractValidationResult[];
};

// ── validateEmployeeRuntimeContract ──────────────────────────────────────────
// Validates a single EmployeeRuntimeContract for structural and safety correctness.
// Returns errors (hard failures) and warnings (soft issues).

export function validateEmployeeRuntimeContract(
  contract: EmployeeRuntimeContract,
): EmployeeContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const slug = typeof contract?.slug === "string" ? contract.slug : "(unknown)";

  // ── 1. Slug non vide ────────────────────────────────────────────────────────
  if (!isNonEmptyString(contract?.slug)) {
    errors.push("slug: required and must be a non-empty string.");
  }

  // ── 2. display_name non vide ────────────────────────────────────────────────
  if (!isNonEmptyString(contract?.display_name)) {
    errors.push("display_name: required and must be a non-empty string.");
  }

  // ── 3. domain non vide et valide ────────────────────────────────────────────
  if (!contract?.domain) {
    errors.push("domain: required.");
  } else if (!VALID_DOMAINS.has(contract.domain)) {
    errors.push(`domain: invalid value "${contract.domain}".`);
  }

  // ── 4. status cohérent ──────────────────────────────────────────────────────
  if (!contract?.status) {
    errors.push("status: required.");
  } else if (!VALID_STATUSES.has(contract.status)) {
    errors.push(`status: invalid value "${contract.status}".`);
  }

  // ── 5. launch_stage cohérent ────────────────────────────────────────────────
  if (contract?.launch_stage && !VALID_LAUNCH_STAGES.has(contract.launch_stage)) {
    warnings.push(`launch_stage: unexpected value "${contract.launch_stage}".`);
  }

  // ── 6. required_technologies non vide ───────────────────────────────────────
  if (!isNonEmptyArray(contract?.required_technologies)) {
    errors.push("required_technologies: must not be empty.");
  }

  // ── 7. aucune technologie inconnue ───────────────────────────────────────────
  if (Array.isArray(contract?.required_technologies)) {
    for (const tech of contract.required_technologies) {
      if (!tech?.slug) {
        errors.push("required_technologies: entry with missing slug found.");
      } else if (!VALID_EMPLOYEE_TECHNOLOGY_SLUGS.has(tech.slug as Parameters<typeof VALID_EMPLOYEE_TECHNOLOGY_SLUGS.has>[0])) {
        errors.push(
          `required_technologies: unknown technology slug "${tech.slug}". `
          + `Valid slugs: ${[...VALID_EMPLOYEE_TECHNOLOGY_SLUGS].join(", ")}.`,
        );
      }
    }
  }

  // ── 8. aucun doublon de required_technologies ────────────────────────────────
  if (Array.isArray(contract?.required_technologies)) {
    const seen = new Set<string>();
    for (const tech of contract.required_technologies) {
      if (!tech?.slug) continue;
      if (seen.has(tech.slug)) {
        errors.push(`required_technologies: duplicate technology slug "${tech.slug}".`);
      }
      seen.add(tech.slug);
    }
  }

  // ── 9. capabilities non vides ────────────────────────────────────────────────
  if (!isNonEmptyArray(contract?.capabilities)) {
    errors.push("capabilities: must not be empty.");
  }

  // ── 10. mission_types non vides ──────────────────────────────────────────────
  if (!isNonEmptyArray(contract?.mission_types)) {
    errors.push("mission_types: must not be empty.");
  }

  // ── 11. task_types non vides ─────────────────────────────────────────────────
  if (!isNonEmptyArray(contract?.task_types)) {
    errors.push("task_types: must not be empty.");
  }

  // ── 12. guard_profile présent ────────────────────────────────────────────────
  if (!contract?.guard_profile) {
    errors.push("guard_profile: required.");
  } else if (!isNonEmptyArray(contract.guard_profile.risk_domains)) {
    warnings.push("guard_profile.risk_domains: empty — no risk domains declared.");
  }

  // ── 13. trust_profile présent ────────────────────────────────────────────────
  if (!contract?.trust_profile) {
    errors.push("trust_profile: required.");
  }

  // ── 14. trace_profile présent ────────────────────────────────────────────────
  if (!contract?.trace_profile) {
    errors.push("trace_profile: required.");
  }

  // ── 15. adn_usage_profile présent ───────────────────────────────────────────
  if (!contract?.adn_usage_profile) {
    errors.push("adn_usage_profile: required.");
  }

  // ── 16. launch_readiness présent ────────────────────────────────────────────
  if (!contract?.launch_readiness) {
    errors.push("launch_readiness: required.");
  }

  // ── 17. permissions sensibles explicitement définies ────────────────────────
  if (!contract?.permissions) {
    errors.push("permissions: required.");
  } else {
    const p = contract.permissions as Record<string, unknown>;

    // ── 18. Interdit : can_make_legal_decision = true ────────────────────────
    if (p.can_make_legal_decision !== false) {
      errors.push(
        "permissions.can_make_legal_decision must be false. "
        + "AI employees are not lawyers and cannot make legal decisions.",
      );
    }

    // ── 19. Interdit : can_run_payroll_officially = true ─────────────────────
    if (p.can_run_payroll_officially !== false) {
      errors.push(
        "permissions.can_run_payroll_officially must be false. "
        + "Official payroll execution requires certified software and human validation.",
      );
    }

    // ── 20. Interdit : can_terminate_employee_autonomously = true ────────────
    if (p.can_terminate_employee_autonomously !== false) {
      errors.push(
        "permissions.can_terminate_employee_autonomously must be false. "
        + "Employee termination requires human decision and legal compliance.",
      );
    }

    // ── 21. Interdit : can_sign_contracts = true ─────────────────────────────
    if (p.can_sign_contracts !== false) {
      errors.push(
        "permissions.can_sign_contracts must be false. "
        + "Contract signing requires explicit human authorization.",
      );
    }
  }

  // ── 22. Aucun employé launch_ready si technologie critique absente ───────────
  if (
    contract?.launch_readiness?.product_runtime_ready === true &&
    Array.isArray(contract?.required_technologies)
  ) {
    const criticalMissing = contract.required_technologies
      .filter((t) => t.required)
      .filter((t) => !VALID_EMPLOYEE_TECHNOLOGY_SLUGS.has(t.slug as Parameters<typeof VALID_EMPLOYEE_TECHNOLOGY_SLUGS.has>[0]));
    if (criticalMissing.length > 0) {
      errors.push(
        `launch_readiness.product_runtime_ready is true but critical technologies are unknown: `
        + criticalMissing.map((t) => t.slug).join(", "),
      );
    }
  }

  // ── 23. Warnings supplementaires ────────────────────────────────────────────
  if (contract?.launch_readiness?.public_launch_ready === true) {
    errors.push(
      "launch_readiness.public_launch_ready cannot be true in the employee contract. "
      + "Public launch readiness is controlled exclusively by the Go-Live gate (GO-LIVE 01–10).",
    );
  }

  if (contract?.status === "active" && contract?.launch_stage === "roadmap") {
    warnings.push("Employee is status=active but launch_stage=roadmap — consider aligning.");
  }

  if (contract?.adn_usage_profile?.writes_to_adn === true) {
    warnings.push(
      "adn_usage_profile.writes_to_adn is true — ensure CloneLearn governance is in place "
      + "before allowing employee to write to CloneADN.",
    );
  }

  return { ok: errors.length === 0, slug, errors, warnings };
}

// ── validateEmployeeRuntimeRegistry ─────────────────────────────────────────
// Validates all contracts in the registry.

export function validateEmployeeRuntimeRegistry(
  registry: EmployeeRuntimeContract[],
): EmployeeRegistryValidationReport {
  const now = new Date().toISOString();
  const perEmployee: EmployeeContractValidationResult[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  if (!Array.isArray(registry) || registry.length === 0) {
    return {
      ok: false,
      errors: ["registry: must be a non-empty array."],
      warnings: [],
      employee_count: 0,
      launch_ready_count: 0,
      checked_at: now,
      per_employee: [],
    };
  }

  // Check for duplicate slugs across registry
  const slugs = new Set<string>();
  for (const contract of registry) {
    const s = contract?.slug;
    if (s && slugs.has(s)) {
      allErrors.push(`registry: duplicate employee slug "${s}".`);
    }
    if (s) slugs.add(s);
  }

  // Validate each contract
  for (const contract of registry) {
    const result = validateEmployeeRuntimeContract(contract);
    perEmployee.push(result);
    allErrors.push(...result.errors.map((e) => `[${result.slug}] ${e}`));
    allWarnings.push(...result.warnings.map((w) => `[${result.slug}] ${w}`));
  }

  const launchReadyCount = registry.filter(
    (e) => e.status === "active" && e.launch_readiness?.product_runtime_ready,
  ).length;

  return {
    ok: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    employee_count: registry.length,
    launch_ready_count: launchReadyCount,
    checked_at: now,
    per_employee: perEmployee,
  };
}

// ── getEmployeeRuntimeValidationReport ───────────────────────────────────────
// Validates the active EMPLOYEE_RUNTIME_REGISTRY and returns the full report.

export function getEmployeeRuntimeValidationReport(): EmployeeRegistryValidationReport {
  return validateEmployeeRuntimeRegistry(EMPLOYEE_RUNTIME_REGISTRY);
}
