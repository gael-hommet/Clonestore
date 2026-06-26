// TECH-08 — CloneOS Command Center — Employee Router
// Route une commande vers l'employé IA déclaré dans l'Employee Registry.
// Seul Pierre est actif en V1. Emma/Lucas/Sophie ne sont pas déclarés.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSClassifiedCommand,
  CloneOSEmployeeRoute,
  CloneOSCommandDomain,
} from "./cloneos-command-types";
import {
  getEmployeeRuntimeContract,
  listEmployeeRuntimeContracts,
  getEmployeeHardRequiredTechnologies,
  isEmployeeLaunchReady,
} from "../employees/employee-registry";
import type { EmployeeRuntimeContract } from "../employees/employee-runtime-contract";

// ── Fonctions d'accès ─────────────────────────────────────────────────────────

/**
 * Liste les employés disponibles pour une commande classifiée.
 * Ne retourne que les employés déclarés dans le registry.
 */
export function listAvailableEmployeesForCommand(
  classified: CloneOSClassifiedCommand,
): EmployeeRuntimeContract[] {
  const allContracts = listEmployeeRuntimeContracts();
  const activeContracts = allContracts.filter(
    (c) => c.status === "active" || c.status === "beta",
  );

  if (classified.candidate_employee_slugs.length > 0) {
    return activeContracts.filter((c) =>
      classified.candidate_employee_slugs.includes(c.slug),
    );
  }

  // Filtrer par domaine
  return activeContracts.filter((c) => c.domain === classified.domain);
}

/**
 * Construit un itinéraire de routage vide (aucun employé disponible).
 */
export function buildNoEmployeeAvailableRoute(
  classified: CloneOSClassifiedCommand,
): CloneOSEmployeeRoute {
  const warnings: string[] = [];

  if (classified.domain !== "hr") {
    warnings.push(
      `Aucun employé IA actif pour le domaine "${classified.domain}". `
      + "En V1, seul Pierre (RH) est opérationnel.",
    );
  } else {
    warnings.push("Aucun employé IA disponible pour cette commande.");
  }

  return {
    employee_slug: "",
    employee_display_name: "Aucun employé disponible",
    domain: classified.domain,
    route_reason: "Aucun employé IA déclaré et actif pour ce domaine en V1.",
    is_available: false,
    readiness_status: "no_employee",
    hard_required_technologies: [],
    soft_required_technologies: [],
    missing_required_technologies: [],
    confidence: 0,
    route_warnings: warnings,
  };
}

/**
 * Construit un itinéraire de routage pour un contrat employé donné.
 */
export function buildEmployeeRoute(
  contract: EmployeeRuntimeContract,
  classified: CloneOSClassifiedCommand,
): CloneOSEmployeeRoute {
  const hardRequired = getEmployeeHardRequiredTechnologies(contract.slug).map((t) => t.slug);
  const softRequired = contract.required_technologies
    .filter((t) => !t.required)
    .map((t) => t.slug);

  // En V1, on considère que toutes les technologies requises sont disponibles
  // (pas de vrai readiness check vers Supabase)
  const missingRequired: string[] = [];

  const isReady = isEmployeeLaunchReady(contract.slug);
  const readinessStatus = isReady
    ? "ready"
    : hardRequired.length > 0
    ? "not_ready"
    : "partially_ready";

  const warnings: string[] = [];
  if (contract.status === "beta") {
    warnings.push(`${contract.display_name} est en mode bêta.`);
  }
  if (classified.risk_level === "critical") {
    warnings.push("Risque critique — validation humaine obligatoire.");
  }

  const domainMatch = contract.domain === classified.domain ||
    classified.candidate_employee_slugs.includes(contract.slug);

  return {
    employee_slug: contract.slug,
    employee_display_name: contract.display_name,
    domain: contract.domain as CloneOSCommandDomain,
    route_reason: domainMatch
      ? `${contract.display_name} est l'employé IA actif pour le domaine "${classified.domain}".`
      : `${contract.display_name} est assigné par préférence explicite.`,
    is_available: contract.status === "active" || contract.status === "beta",
    readiness_status: readinessStatus,
    hard_required_technologies: hardRequired,
    soft_required_technologies: softRequired,
    missing_required_technologies: missingRequired,
    confidence: domainMatch ? 0.9 : 0.6,
    route_warnings: warnings,
  };
}

/**
 * Retourne le meilleur itinéraire de routage pour une commande.
 * Sélectionne le premier employé disponible par ordre de confiance.
 */
export function getBestEmployeeRoute(
  classified: CloneOSClassifiedCommand,
): CloneOSEmployeeRoute {
  const available = listAvailableEmployeesForCommand(classified);

  if (available.length === 0) {
    return buildNoEmployeeAvailableRoute(classified);
  }

  // Prioriser l'employé préféré si déclaré et disponible
  // (transmitted via candidate_employee_slugs par le classifier)
  const best = available[0];
  return buildEmployeeRoute(best, classified);
}

/**
 * Route une commande vers l'employé approprié.
 */
export function routeCloneOSCommand(
  classified: CloneOSClassifiedCommand,
): CloneOSEmployeeRoute {
  return getBestEmployeeRoute(classified);
}

/**
 * Valide un itinéraire de routage.
 */
export function validateEmployeeRoute(
  route: CloneOSEmployeeRoute,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!route.is_available && route.employee_slug !== "") {
    issues.push(`Employé ${route.employee_slug} n'est pas disponible.`);
  }

  if (route.employee_slug !== "" && !getEmployeeRuntimeContract(route.employee_slug)) {
    issues.push(`Employé "${route.employee_slug}" non trouvé dans le registry.`);
  }

  // Ne jamais router vers un employé non déclaré
  if (route.employee_slug !== "" &&
    !["pierre"].includes(route.employee_slug) &&
    !getEmployeeRuntimeContract(route.employee_slug)) {
    issues.push(`Routage impossible : "${route.employee_slug}" n'est pas dans le registry.`);
  }

  return { valid: issues.length === 0, issues };
}
