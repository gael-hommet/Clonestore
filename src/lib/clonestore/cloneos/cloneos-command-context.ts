// TECH-08 — CloneOS Command Center — Command Context Builder
// Construit le contexte d'exécution en agrégeant TECH-02 à TECH-07.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSClassifiedCommand,
  CloneOSEmployeeRoute,
  CloneOSCommandContext,
  CloneOSTechnologyContext,
  CloneOSEnterpriseMemoryContext,
  CloneOSGuardContext,
} from "./cloneos-command-types";

// TECH-02 — Employee Registry
import { getEmployeeRuntimeContract } from "../employees/employee-registry";

// TECH-05 — CloneADN
import {
  buildEmptyGlobalEnterpriseMemory,
  buildPierreEnterpriseContextDirect,
  extractActiveRulesForPierre,
} from "../adn/index";

// TECH-06 — CloneGuard
import {
  ABSOLUTE_BLOCKED_ACTION_TYPES,
  ALWAYS_VALIDATION_REQUIRED_ACTIONS,
  DEFAULT_GLOBAL_POLICY_RULES,
} from "../guard/index";

// TECH-07 — CloneTrace
import {
  getOrCreateGlobalTraceTimeline,
} from "../trace/index";

// ── Technology Context ────────────────────────────────────────────────────────

/**
 * Construit le contexte technologique pour la commande.
 * Utilise l'Employee Runtime Contract (TECH-02).
 */
export function buildTechnologyContextForCommand(
  route: CloneOSEmployeeRoute,
): CloneOSTechnologyContext {
  const contract = route.employee_slug
    ? getEmployeeRuntimeContract(route.employee_slug)
    : undefined;

  if (!contract) {
    return {
      required_tech_slugs: [],
      available_tech_slugs: [],
      missing_required: [],
      tech_readiness_summary: {},
    };
  }

  const requiredTechs = contract.required_technologies
    .filter((t) => t.required)
    .map((t) => t.slug);

  const allTechs = contract.required_technologies.map((t) => t.slug);

  // En V1, on assume que les techs requises sont disponibles (pas de readiness check live)
  const readinessSummary: Record<string, number> = {};
  for (const tech of contract.required_technologies) {
    readinessSummary[tech.slug] = tech.minimum_readiness ?? 60;
  }

  return {
    required_tech_slugs: requiredTechs,
    available_tech_slugs: allTechs,
    missing_required: route.missing_required_technologies,
    tech_readiness_summary: readinessSummary,
  };
}

// ── Enterprise Memory Context ─────────────────────────────────────────────────

/**
 * Construit le contexte de mémoire entreprise.
 * Utilise CloneADN (TECH-05).
 * Si aucune vraie mémoire, retourne un contexte minimal.
 */
export function buildEnterpriseMemoryContextForCommand(
  companyId: string,
  employeeSlug?: string,
): CloneOSEnterpriseMemoryContext {
  // V1 : construction d'une mémoire vide par défaut (pas de Supabase)
  const memory = buildEmptyGlobalEnterpriseMemory(companyId);

  let activeRules: string[] = [];
  let companyName = memory.identity.company_name ?? companyId;
  let language = memory.identity.language ?? "fr";
  let timezone = memory.identity.timezone ?? "Europe/Paris";
  let defaultTone = "professionnel";

  // Si Pierre est l'employé sélectionné, utiliser le bridge Pierre → ADN
  if (employeeSlug === "pierre") {
    try {
      const pierreCtx = buildPierreEnterpriseContextDirect(memory);
      companyName = pierreCtx.company_name ?? companyId;
      language = pierreCtx.language;
      timezone = pierreCtx.timezone;
      defaultTone = pierreCtx.default_tone;
      activeRules = extractActiveRulesForPierre(memory);
    } catch {
      // Fallback silencieux — mémoire vide acceptable
    }
  }

  return {
    company_name: companyName,
    language,
    timezone,
    default_tone: defaultTone,
    active_rules: activeRules,
    has_enterprise_memory: false, // V1 : pas de vraie mémoire Supabase
  };
}

// ── Guard Context ─────────────────────────────────────────────────────────────

/**
 * Construit le contexte Guard pour la commande.
 * Utilise CloneGuard (TECH-06).
 */
export function buildGuardContextForCommand(
  _classified: CloneOSClassifiedCommand,
  _route: CloneOSEmployeeRoute,
): CloneOSGuardContext {
  return {
    guard_available: true,
    absolute_blocked_actions: [...ABSOLUTE_BLOCKED_ACTION_TYPES],
    always_validation_required: [...ALWAYS_VALIDATION_REQUIRED_ACTIONS],
    policy_rules_count: DEFAULT_GLOBAL_POLICY_RULES.length,
  };
}

// ── Trace Context ─────────────────────────────────────────────────────────────

/**
 * Construit ou récupère la timeline de trace pour la commande.
 * Utilise CloneTrace (TECH-07).
 */
export function buildTraceContextForCommand(companyId: string): {
  timeline_id: string;
} {
  const timeline = getOrCreateGlobalTraceTimeline(companyId);
  return { timeline_id: timeline.timeline_id };
}

// ── Context Builder principal ─────────────────────────────────────────────────

/**
 * Construit le contexte complet d'une commande CloneOS.
 * Agrège TECH-02 + TECH-05 + TECH-06 + TECH-07.
 */
export function buildCloneOSCommandContext(
  input: CloneOSCommandInput,
  classified: CloneOSClassifiedCommand,
  route: CloneOSEmployeeRoute,
): CloneOSCommandContext {
  const warnings: string[] = [];

  const employeeContract = route.employee_slug
    ? getEmployeeRuntimeContract(route.employee_slug) ?? undefined
    : undefined;

  if (!employeeContract && route.is_available) {
    warnings.push(`Contrat employé non trouvé pour "${route.employee_slug}".`);
  }

  const technologyContext = buildTechnologyContextForCommand(route);
  if (technologyContext.missing_required.length > 0) {
    warnings.push(
      `Technologies manquantes : ${technologyContext.missing_required.join(", ")}`,
    );
  }

  const enterpriseMemoryContext = buildEnterpriseMemoryContextForCommand(
    input.company_id,
    route.employee_slug || undefined,
  );

  const guardContext = buildGuardContextForCommand(classified, route);
  const traceContext = buildTraceContextForCommand(input.company_id);

  if (classified.risk_level === "critical") {
    warnings.push("Risque critique — CloneGuard refusera les actions absolues.");
  }

  return {
    command_id: classified.command_id,
    company_id: input.company_id,
    selected_employee_slug: route.employee_slug || undefined,
    employee_contract: employeeContract,
    technology_context: technologyContext,
    enterprise_memory_context: enterpriseMemoryContext,
    guard_context: guardContext,
    trace_timeline_id: traceContext.timeline_id,
    context_warnings: warnings,
  };
}

/**
 * Retourne les avertissements du contexte.
 */
export function getCommandContextWarnings(context: CloneOSCommandContext): string[] {
  return context.context_warnings;
}
