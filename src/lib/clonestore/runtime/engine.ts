// CloneStore Runtime — Engine (Bloc 19)
// Pure module: no Supabase, no Next, no async, no side effects.
// Evaluates runtime capabilities and action policies for any AI employee.
// Works for any employeeSlug — no Pierre hardcoding.

import type {
  TechnologySlug,
  TechnologyAutonomyLevel,
  TechnologyRiskMode,
  TechnologyRegistry,
} from "../technologies/contracts";
import {
  isTechnologyEnabledForEmployee,
} from "../technologies/registry";
import {
  buildTechnologyGovernanceSnapshot,
} from "../technologies/configuration";
import type {
  CloneRuntimeContext,
  CloneRuntimeSnapshot,
  CloneRuntimeCapability,
  CloneRuntimeActionEvaluation,
  CloneRuntimeDecision,
  CloneRuntimeGovernance,
} from "./contracts";

// ── Internal helpers ─────────────────────────────────────────────────────────

const AUTONOMY_RANK: Record<TechnologyAutonomyLevel, number> = {
  off: 0,
  suggest_only: 1,
  supervised: 2,
  semi_autonomous: 3,
  autonomous: 4,
};

const RISK_RANK: Record<TechnologyRiskMode, number> = {
  normal: 0,
  guarded: 1,
  strict: 2,
  locked: 3,
};

// ── Normalizers ───────────────────────────────────────────────────────────────

export function normalizeRuntimeEmployeeSlug(slug: unknown): string {
  if (typeof slug === "string") {
    const t = slug.trim();
    if (t.length > 0) return t.toLowerCase();
  }
  return "pierre";
}

export function normalizeRuntimeActionType(action: unknown): string {
  if (typeof action === "string") {
    const t = action.trim();
    if (t.length > 0) return t.toLowerCase();
  }
  return "";
}

export function normalizeRuntimeRiskLevel(
  level: unknown,
): "normal" | "guarded" | "strict" | "locked" | "red" | "black" | null {
  if (typeof level !== "string") return null;
  const l = level.trim().toLowerCase();
  switch (l) {
    case "normal": return "normal";
    case "guarded": return "guarded";
    case "strict": return "strict";
    case "locked": return "locked";
    case "red": return "red";
    case "black": return "black";
    default: return null;
  }
}

function isTechSlug(v: unknown): v is TechnologySlug {
  return typeof v === "string" && [
    "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonecontinuum",
    "clonetrust", "clonereview", "clonesignals", "clonelearn",
    "clonevoice", "clonechat", "clonebrief",
  ].includes(v);
}

// ── buildRuntimeGovernance ────────────────────────────────────────────────────
// Maps TechnologyGovernanceSnapshot.governance_health to CloneRuntimeGovernance.

export function buildRuntimeGovernance(registry: TechnologyRegistry): CloneRuntimeGovernance {
  try {
    const snap = buildTechnologyGovernanceSnapshot(registry);
    const global_risk_mode = snap.global_risk_mode;

    let governance_health: CloneRuntimeGovernance["governance_health"] = "healthy";
    if (snap.governance_health === "critical" || global_risk_mode === "locked") {
      governance_health = "locked";
    } else if (snap.governance_health === "attention") {
      governance_health = "degraded";
    }

    return {
      global_autonomy: snap.global_autonomy,
      global_risk_mode,
      governance_health,
    };
  } catch {
    return {
      global_autonomy: "supervised",
      global_risk_mode: "guarded",
      governance_health: "degraded",
    };
  }
}

// ── buildRuntimeCapabilities ─────────────────────────────────────────────────
// Returns one CloneRuntimeCapability per technology for the given employee.

export function buildRuntimeCapabilities(
  registry: TechnologyRegistry,
  employeeSlug: string,
): CloneRuntimeCapability[] {
  if (!registry || !Array.isArray(registry.definitions)) return [];

  const traceEnabled = isTechnologyEnabledForEmployee(registry, "clonetrace", employeeSlug);
  const reviewEnabled = isTechnologyEnabledForEmployee(registry, "clonereview", employeeSlug);

  const capabilities: CloneRuntimeCapability[] = [];

  for (const def of registry.definitions) {
    if (!isTechSlug(def.slug)) continue;
    const setting = registry.settings.find((s) => s.technology_slug === def.slug);
    const enabled = isTechnologyEnabledForEmployee(registry, def.slug, employeeSlug);
    const autonomy_level = setting?.autonomy_level ?? def.default_autonomy;
    const risk_mode = setting?.risk_mode ?? def.default_risk_mode;

    // can_auto_execute: must be enabled, autonomy >= supervised, risk != locked
    const can_auto_execute =
      enabled &&
      AUTONOMY_RANK[autonomy_level] >= AUTONOMY_RANK["supervised"] &&
      RISK_RANK[risk_mode] < RISK_RANK["locked"];

    capabilities.push({
      technology_slug: def.slug,
      enabled,
      autonomy_level,
      risk_mode,
      can_auto_execute,
      requires_observation: enabled && traceEnabled,
      requires_review: enabled && reviewEnabled,
    });
  }

  return capabilities;
}

// ── buildRuntimeContext ───────────────────────────────────────────────────────
// Builds a thin, flat CloneRuntimeContext from the registry for one employee.

export function buildRuntimeContext(
  registry: TechnologyRegistry,
  employeeSlug: string,
  now?: string,
): CloneRuntimeContext {
  if (!registry || !employeeSlug) {
    return {
      employee_slug: employeeSlug ?? "",
      built_at: now ?? new Date().toISOString(),
      active_technologies: [],
      guard_mode: "guarded",
      autonomy_level: "supervised",
      trace_enabled: false,
      review_enabled: false,
      continuity_enabled: false,
      chat_enabled: false,
      learn_enabled: false,
      signals_enabled: false,
      voice_enabled: false,
      brief_enabled: false,
    };
  }

  const active_technologies: TechnologySlug[] = registry.definitions
    .filter((def) => isTechSlug(def.slug) && isTechnologyEnabledForEmployee(registry, def.slug, employeeSlug))
    .map((def) => def.slug as TechnologySlug);

  const guardSetting = registry.settings.find((s) => s.technology_slug === "cloneguard");
  const guardDef = registry.definitions.find((d) => d.slug === "cloneguard");
  const guard_mode: TechnologyRiskMode = guardSetting?.risk_mode ?? guardDef?.default_risk_mode ?? "guarded";

  const trustSetting = registry.settings.find((s) => s.technology_slug === "clonetrust");
  const trustDef = registry.definitions.find((d) => d.slug === "clonetrust");
  const autonomy_level: TechnologyAutonomyLevel = trustSetting?.autonomy_level ?? trustDef?.default_autonomy ?? "supervised";

  return {
    employee_slug: employeeSlug,
    built_at: now ?? new Date().toISOString(),
    active_technologies,
    guard_mode,
    autonomy_level,
    trace_enabled: isTechnologyEnabledForEmployee(registry, "clonetrace", employeeSlug),
    review_enabled: isTechnologyEnabledForEmployee(registry, "clonereview", employeeSlug),
    continuity_enabled: isTechnologyEnabledForEmployee(registry, "clonecontinuum", employeeSlug),
    chat_enabled: isTechnologyEnabledForEmployee(registry, "clonechat", employeeSlug),
    learn_enabled: isTechnologyEnabledForEmployee(registry, "clonelearn", employeeSlug),
    signals_enabled: isTechnologyEnabledForEmployee(registry, "clonesignals", employeeSlug),
    voice_enabled: isTechnologyEnabledForEmployee(registry, "clonevoice", employeeSlug),
    brief_enabled: isTechnologyEnabledForEmployee(registry, "clonebrief", employeeSlug),
  };
}

// ── evaluateRuntimeAction ─────────────────────────────────────────────────────
// Evaluates whether an action type can be executed given the runtime context.
// This is evaluation only — it never executes the action.

export type EvaluateRuntimeActionOptions = {
  approval_required?: boolean;
  technology_hint?: TechnologySlug;
  risk_level?: string | null;
  contains_sensitive_keywords?: boolean | null;
};

export function evaluateRuntimeAction(
  context: CloneRuntimeContext,
  actionType: string,
  options?: EvaluateRuntimeActionOptions,
  now?: string,
): CloneRuntimeActionEvaluation {
  const evaluated_at = now ?? new Date().toISOString();
  const safeActionType = typeof actionType === "string" ? actionType.trim() : "";
  const safeContext: CloneRuntimeContext = context ?? {
    employee_slug: "",
    built_at: evaluated_at,
    active_technologies: [],
    guard_mode: "guarded",
    autonomy_level: "supervised",
    trace_enabled: false,
    review_enabled: false,
    continuity_enabled: false,
    chat_enabled: false,
    learn_enabled: false,
    signals_enabled: false,
    voice_enabled: false,
    brief_enabled: false,
  };

  // Invariant: empty action type is always blocked
  if (!safeActionType) {
    return {
      action_type: "",
      decision: "blocked_by_policy",
      technology_source: null,
      requires_observation: safeContext.trace_enabled,
      requires_review: false,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "Type d'action inconnu ou vide. Action bloquée par politique plateforme.",
      evaluated_at,
    };
  }

  // Invariant: email.send is never auto-executed (absolute platform policy)
  const isEmailSend =
    safeActionType === "email.send" ||
    safeActionType === "send_email";

  if (isEmailSend) {
    return {
      action_type: safeActionType,
      decision: "blocked_by_policy",
      technology_source: "cloneguard",
      requires_observation: safeContext.trace_enabled,
      requires_review: false,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "Envoi d'email non auto-exécutable. Validation humaine obligatoire (politique plateforme).",
      evaluated_at,
    };
  }

  // risk_level = black → absolute block (platform policy)
  const normalizedRisk = normalizeRuntimeRiskLevel(options?.risk_level);
  if (normalizedRisk === "black") {
    return {
      action_type: safeActionType,
      decision: "blocked_by_policy",
      technology_source: "cloneguard",
      requires_observation: safeContext.trace_enabled,
      requires_review: false,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "Niveau de risque critique (black). Action bloquée par politique plateforme.",
      evaluated_at,
    };
  }

  // Invariant: approval_required tasks are never auto-executed
  if (options?.approval_required === true) {
    return {
      action_type: safeActionType,
      decision: "requires_validation",
      technology_source: "cloneguard",
      requires_observation: safeContext.trace_enabled,
      requires_review: safeContext.review_enabled,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "Tâche marquée approval_required. Validation humaine obligatoire.",
      evaluated_at,
    };
  }

  // risk_level = red → human validation required
  if (normalizedRisk === "red") {
    return {
      action_type: safeActionType,
      decision: "requires_validation",
      technology_source: "cloneguard",
      requires_observation: safeContext.trace_enabled,
      requires_review: safeContext.review_enabled,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "Niveau de risque élevé (red). Validation humaine requise.",
      evaluated_at,
    };
  }

  // CloneGuard locked → platform is in lockdown, all actions require validation
  if (safeContext.guard_mode === "locked") {
    return {
      action_type: safeActionType,
      decision: "blocked_by_technology",
      technology_source: "cloneguard",
      requires_observation: safeContext.trace_enabled,
      requires_review: safeContext.review_enabled,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "CloneGuard en mode verrouillé. Toutes les actions nécessitent une validation humaine.",
      evaluated_at,
    };
  }

  // autonomy_level = off → no automation at all
  if (safeContext.autonomy_level === "off") {
    return {
      action_type: safeActionType,
      decision: "requires_validation",
      technology_source: "clonetrust",
      requires_observation: safeContext.trace_enabled,
      requires_review: safeContext.review_enabled,
      requires_human_validation: true,
      can_auto_execute: false,
      explanation: "Niveau d'autonomie désactivé (off). Toutes les actions nécessitent une validation humaine.",
      evaluated_at,
    };
  }

  // autonomy_level = suggest_only → suggestions only, human decides
  if (safeContext.autonomy_level === "suggest_only") {
    return {
      action_type: safeActionType,
      decision: "requires_review",
      technology_source: "clonetrust",
      requires_observation: safeContext.trace_enabled,
      requires_review: true,
      requires_human_validation: false,
      can_auto_execute: false,
      explanation: "Mode suggestion uniquement. Relecture humaine requise avant toute exécution.",
      evaluated_at,
    };
  }

  // document.generate / pdf.generate / email.draft always require review
  const isReviewRequiredAction =
    safeActionType === "document.generate" ||
    safeActionType === "pdf.generate" ||
    safeActionType === "email.draft";

  if (isReviewRequiredAction || options?.contains_sensitive_keywords === true) {
    return {
      action_type: safeActionType,
      decision: "requires_review",
      technology_source: "clonereview",
      requires_observation: safeContext.trace_enabled,
      requires_review: true,
      requires_human_validation: false,
      can_auto_execute: false,
      explanation: isReviewRequiredAction
        ? "Action de génération de document ou brouillon. Relecture humaine requise."
        : "Action contenant des données sensibles. Relecture humaine requise.",
      evaluated_at,
    };
  }

  // guard_mode = strict → require review even for allowed actions
  if (safeContext.guard_mode === "strict") {
    return {
      action_type: safeActionType,
      decision: "requires_review",
      technology_source: "cloneguard",
      requires_observation: safeContext.trace_enabled,
      requires_review: true,
      requires_human_validation: false,
      can_auto_execute: false,
      explanation: "CloneGuard en mode strict. Relecture requise pour chaque action.",
      evaluated_at,
    };
  }

  // autonomy_level = supervised → execute with observation
  if (safeContext.autonomy_level === "supervised") {
    return {
      action_type: safeActionType,
      decision: "allowed_with_observation",
      technology_source: "clonetrust",
      requires_observation: true,
      requires_review: safeContext.review_enabled,
      requires_human_validation: false,
      can_auto_execute: true,
      explanation: "Exécution supervisée autorisée. CloneTrace actif pour cette action.",
      evaluated_at,
    };
  }

  // autonomy_level = semi_autonomous → execute, trace if available
  if (safeContext.autonomy_level === "semi_autonomous") {
    return {
      action_type: safeActionType,
      decision: "allowed_with_observation",
      technology_source: "clonetrust",
      requires_observation: safeContext.trace_enabled,
      requires_review: false,
      requires_human_validation: false,
      can_auto_execute: true,
      explanation: "Exécution semi-autonome autorisée. Observabilité activée si CloneTrace est actif.",
      evaluated_at,
    };
  }

  // autonomy_level = autonomous → full auto
  if (safeContext.autonomy_level === "autonomous") {
    return {
      action_type: safeActionType,
      decision: "allowed",
      technology_source: "clonetrust",
      requires_observation: safeContext.trace_enabled,
      requires_review: false,
      requires_human_validation: false,
      can_auto_execute: true,
      explanation: "Exécution autonome autorisée.",
      evaluated_at,
    };
  }

  // Fallback: unknown autonomy → supervised behavior
  return {
    action_type: safeActionType,
    decision: "allowed_with_observation",
    technology_source: "clonetrust",
    requires_observation: safeContext.trace_enabled,
    requires_review: safeContext.review_enabled,
    requires_human_validation: false,
    can_auto_execute: true,
    explanation: "Niveau d'autonomie non reconnu — comportement supervisé appliqué par défaut.",
    evaluated_at,
  };
}

// ── buildRuntimeSnapshot ──────────────────────────────────────────────────────
// Full snapshot: context + governance + capabilities.

export function buildRuntimeSnapshot(
  registry: TechnologyRegistry,
  employeeSlug: string,
  now?: string,
): CloneRuntimeSnapshot {
  const builtAt = now ?? new Date().toISOString();

  if (!registry || !employeeSlug) {
    const fallbackContext = buildRuntimeContext(registry, employeeSlug ?? "", builtAt);
    return {
      employee_slug: employeeSlug ?? "",
      built_at: builtAt,
      active_technology_count: 0,
      context: fallbackContext,
      governance: { global_autonomy: "supervised", global_risk_mode: "guarded", governance_health: "degraded" },
      capabilities: [],
      summary: "Snapshot runtime non disponible — paramètres manquants.",
    };
  }

  const context = buildRuntimeContext(registry, employeeSlug, builtAt);
  const governance = buildRuntimeGovernance(registry);
  const capabilities = buildRuntimeCapabilities(registry, employeeSlug);
  const active_technology_count = context.active_technologies.length;

  const healthLabel: Record<CloneRuntimeGovernance["governance_health"], string> = {
    healthy: "opérationnel",
    degraded: "dégradé",
    locked: "verrouillé",
  };

  const summary = [
    `${employeeSlug} — ${active_technology_count} technologie${active_technology_count !== 1 ? "s" : ""} active${active_technology_count !== 1 ? "s" : ""}.`,
    `Autonomie: ${context.autonomy_level}.`,
    `Garde: ${context.guard_mode}.`,
    `Gouvernance: ${healthLabel[governance.governance_health]}.`,
  ].join(" ");

  return {
    employee_slug: employeeSlug,
    built_at: builtAt,
    active_technology_count,
    context,
    governance,
    capabilities,
    summary,
  };
}
