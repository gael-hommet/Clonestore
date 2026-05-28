// B46 — Technologies B46 Registry
// Builds B46TechnologyItem for each of the 6 visible CloneStore technologies.
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type {
  CloneStoreTechnologyId,
  B46TechnologyItem,
  B46TechnologyStatus,
  B46TechnologyGuardrails,
  B46TechnologyCapabilityId,
  B46TechnologyDependency,
  B46TechnologyDisplay,
  B46TechnologyRuntimeMode,
  B46TechnologyVisibility,
  B46ReadinessContext,
} from "./technology-b46-types";
import {
  B46_TECHNOLOGY_IDS,
  B46_LAUNCH_CRITICAL,
  B46_PIERRE_REQUIRED,
} from "./technology-b46-types";
import { computeTechnologyReadiness, computeGlobalTechnologiesReadiness, buildTechnologyNextActions } from "./technology-readiness";
import { getRuntimeModeForTechnology } from "./technology-runtime-modes";
import type {
  TechnologiesSnapshot,
  PierreTechnologyStatus,
  GlobalTechnologiesReadiness,
} from "./technology-b46-types";

// ── Static display definitions ────────────────────────────────────────────────

const DISPLAYS: Record<CloneStoreTechnologyId, B46TechnologyDisplay> = {
  cloneos: {
    name: "CloneOS",
    short_label: "OS",
    description: "Système d'exploitation des employés IA — orchestration missions et tâches.",
    customer_description: "Le moteur central qui planifie et exécute toutes les missions de vos employés IA.",
    icon_key: "cpu",
    accent: "#1A56DB",
    order: 1,
  },
  cloneadn: {
    name: "CloneADN",
    short_label: "ADN",
    description: "Mémoire génétique de l'entreprise — contexte, style, règles, préférences.",
    customer_description: "La mémoire persistante qui permet à vos employés IA de connaître votre entreprise.",
    icon_key: "dna",
    accent: "#7E3AF2",
    order: 2,
  },
  cloneguard: {
    name: "CloneGuard",
    short_label: "Guard",
    description: "Gouvernance et protection — validation, risque, refus, garde-fous.",
    customer_description: "Le système de sécurité qui protège chaque action sensible de vos employés IA.",
    icon_key: "shield",
    accent: "#DC2626",
    order: 3,
  },
  clonetrace: {
    name: "CloneTrace",
    short_label: "Trace",
    description: "Traçabilité et audit trail — historique complet de toutes les actions IA.",
    customer_description: "La piste d'audit qui enregistre et prouve chaque action de vos employés IA.",
    icon_key: "activity",
    accent: "#059669",
    order: 4,
  },
  clonevoice: {
    name: "CloneVoice",
    short_label: "Voice",
    description: "Interface vocale — dictée de missions, retours oraux, notifications audio.",
    customer_description: "L'interface vocale premium pour interagir avec vos employés IA à la voix.",
    icon_key: "mic",
    accent: "#D97706",
    order: 5,
  },
  clonechat: {
    name: "CloneChat",
    short_label: "Chat",
    description: "Interface conversationnelle — messagerie multimodale avec tous les employés IA.",
    customer_description: "L'interface de chat pour dialoguer avec vos employés IA en temps réel.",
    icon_key: "message-circle",
    accent: "#0891B2",
    order: 6,
  },
};

// ── Static guardrails ─────────────────────────────────────────────────────────

const GUARDRAILS: Record<CloneStoreTechnologyId, B46TechnologyGuardrails> = {
  cloneos: {
    requires_paid_customer: true,
    requires_human_validation: false,
    requires_security_guard: true,
    requires_audit: true,
    requires_cost_shield: true,
    blocks_sensitive_actions: true,
    blocks_unverified_channels: true,
    no_public_demo_live: true,
    no_unpaid_live: true,
    allowed_runtime_modes: ["mock", "dry_run", "sandbox", "production"],
    locked: false,
  },
  cloneadn: {
    requires_paid_customer: true,
    requires_human_validation: false,
    requires_security_guard: false,
    requires_audit: false,
    requires_cost_shield: false,
    blocks_sensitive_actions: false,
    blocks_unverified_channels: false,
    no_public_demo_live: true,
    no_unpaid_live: true,
    allowed_runtime_modes: ["mock", "dry_run", "production"],
    locked: false,
  },
  cloneguard: {
    requires_paid_customer: true,
    requires_human_validation: false,
    requires_security_guard: false,   // IS the security guard
    requires_audit: true,
    requires_cost_shield: false,
    blocks_sensitive_actions: true,
    blocks_unverified_channels: true,
    no_public_demo_live: true,
    no_unpaid_live: true,
    allowed_runtime_modes: ["production"],  // always production — pure evaluation
    locked: true,                          // cannot be disabled client-side
  },
  clonetrace: {
    requires_paid_customer: true,
    requires_human_validation: false,
    requires_security_guard: true,
    requires_audit: false,              // IS the audit system
    requires_cost_shield: false,
    blocks_sensitive_actions: false,
    blocks_unverified_channels: false,
    no_public_demo_live: true,
    no_unpaid_live: true,
    allowed_runtime_modes: ["production"],  // always production — always logging
    locked: true,                           // critical audit cannot be disabled
  },
  clonevoice: {
    requires_paid_customer: true,
    requires_human_validation: false,
    requires_security_guard: false,
    requires_audit: false,
    requires_cost_shield: false,
    blocks_sensitive_actions: false,
    blocks_unverified_channels: false,
    no_public_demo_live: true,
    no_unpaid_live: true,
    allowed_runtime_modes: ["disabled", "sandbox", "production"],
    locked: false,
  },
  clonechat: {
    requires_paid_customer: false,  // limited mode available without payment
    requires_human_validation: false,
    requires_security_guard: false,
    requires_audit: false,
    requires_cost_shield: false,
    blocks_sensitive_actions: false,
    blocks_unverified_channels: false,
    no_public_demo_live: false,
    no_unpaid_live: false,
    allowed_runtime_modes: ["dry_run", "sandbox", "production"],
    locked: false,
  },
};

// ── Static capabilities ───────────────────────────────────────────────────────

const CAPABILITIES: Record<CloneStoreTechnologyId, B46TechnologyCapabilityId[]> = {
  cloneos:    ["mission_orchestration", "workflow_continuity"],
  cloneadn:   ["memory_context"],
  cloneguard: ["risk_validation"],
  clonetrace: ["traceability", "audit", "diagnostics"],
  clonevoice: ["voice_input"],
  clonechat:  ["chat_interface"],
};

// ── Static dependencies ───────────────────────────────────────────────────────

function buildDependencies(
  id: CloneStoreTechnologyId,
  items: Map<CloneStoreTechnologyId, B46TechnologyStatus>,
): B46TechnologyDependency[] {
  const deps: Array<{ technology_id: CloneStoreTechnologyId; required: boolean; reason: string }> = [];

  if (id === "cloneos") {
    deps.push(
      { technology_id: "cloneguard", required: true, reason: "CloneOS nécessite CloneGuard pour valider chaque action." },
      { technology_id: "clonetrace", required: true, reason: "CloneOS nécessite CloneTrace pour journaliser les exécutions." },
    );
  }
  if (id === "cloneadn") {
    deps.push(
      { technology_id: "clonetrace", required: false, reason: "CloneADN peut logguer les accès mémoire via CloneTrace." },
    );
  }

  return deps.map(({ technology_id, required, reason }) => {
    const depStatus = items.get(technology_id) ?? "active";
    let status: "ok" | "degraded" | "missing" = "ok";
    if (depStatus === "disabled" || depStatus === "archived") status = "missing";
    else if (depStatus === "degraded" || depStatus === "needs_configuration") status = "degraded";
    return { technology_id, required, status, reason };
  });
}

// ── Build single B46TechnologyItem ────────────────────────────────────────────

export function buildB46TechnologyItem(
  id: CloneStoreTechnologyId,
  context: B46ReadinessContext,
  statusOverride?: B46TechnologyStatus,
  statusMap?: Map<CloneStoreTechnologyId, B46TechnologyStatus>,
): B46TechnologyItem {
  const defaultStatus = ((): B46TechnologyStatus => {
    switch (id) {
      case "cloneos":    return "active";
      case "cloneadn":   return "active";
      case "cloneguard": return "active";
      case "clonetrace": return "active";
      case "clonevoice": return "disabled";
      case "clonechat":  return "needs_configuration";
    }
  })();

  const status = statusOverride ?? defaultStatus;
  const readiness = computeTechnologyReadiness(id, status, context);
  const runtime_mode: B46TechnologyRuntimeMode = status === "disabled" ? "disabled" : getRuntimeModeForTechnology(id);
  const locked = GUARDRAILS[id].locked;

  const visibility: B46TechnologyVisibility = "visible_to_customer";

  const deps = buildDependencies(id, statusMap ?? new Map());

  return {
    id,
    display: DISPLAYS[id],
    status,
    runtime_mode,
    visibility,
    enabled: status !== "disabled" && status !== "archived" && status !== "blocked",
    locked,
    capabilities: CAPABILITIES[id],
    guardrails: GUARDRAILS[id],
    readiness,
    launch_critical: B46_LAUNCH_CRITICAL.includes(id),
    pierre_required: B46_PIERRE_REQUIRED.includes(id),
    dependencies: deps,
  };
}

// ── Build all 6 technology items ──────────────────────────────────────────────

export function buildAllB46TechnologyItems(
  context: B46ReadinessContext,
  statusOverrides?: Partial<Record<CloneStoreTechnologyId, B46TechnologyStatus>>,
): B46TechnologyItem[] {
  const statusMap = new Map<CloneStoreTechnologyId, B46TechnologyStatus>();
  for (const id of B46_TECHNOLOGY_IDS) {
    const defaultStatus: B46TechnologyStatus = ((): B46TechnologyStatus => {
      switch (id) {
        case "cloneos":    return "active";
        case "cloneadn":   return "active";
        case "cloneguard": return "active";
        case "clonetrace": return "active";
        case "clonevoice": return "disabled";
        case "clonechat":  return "needs_configuration";
      }
    })();
    statusMap.set(id, statusOverrides?.[id] ?? defaultStatus);
  }

  return B46_TECHNOLOGY_IDS.map((id) =>
    buildB46TechnologyItem(id, context, statusMap.get(id), statusMap),
  );
}

// ── Registry accessors ────────────────────────────────────────────────────────

export function getTechnologyById(
  id: CloneStoreTechnologyId,
): { display: B46TechnologyDisplay; guardrails: B46TechnologyGuardrails; capabilities: B46TechnologyCapabilityId[] } {
  return { display: DISPLAYS[id], guardrails: GUARDRAILS[id], capabilities: CAPABILITIES[id] };
}

export function listLaunchCriticalTechnologies(): CloneStoreTechnologyId[] {
  return [...B46_LAUNCH_CRITICAL];
}

export function listPierreRequiredTechnologies(): CloneStoreTechnologyId[] {
  return [...B46_PIERRE_REQUIRED];
}

export function listCustomerVisibleTechnologies(): CloneStoreTechnologyId[] {
  return [...B46_TECHNOLOGY_IDS];
}

// ── Build full TechnologiesSnapshot ──────────────────────────────────────────

export function buildTechnologiesSnapshot(params: {
  userId: string;
  context: B46ReadinessContext;
  statusOverrides?: Partial<Record<CloneStoreTechnologyId, B46TechnologyStatus>>;
  now?: Date;
}): TechnologiesSnapshot {
  const { userId, context, statusOverrides, now = new Date() } = params;
  const technologies = buildAllB46TechnologyItems(context, statusOverrides);
  const global_readiness: GlobalTechnologiesReadiness = computeGlobalTechnologiesReadiness(technologies, context);

  const isActive = (id: CloneStoreTechnologyId) => {
    const t = technologies.find((x) => x.id === id);
    return t ? t.enabled && t.readiness.score >= 60 : false;
  };

  const blockedFeatures: string[] = [];
  if (!isActive("clonevoice")) blockedFeatures.push("voice_input");
  if (!isActive("clonechat")) blockedFeatures.push("chat_full_support");
  if (context.email_runtime_mode === "mock") blockedFeatures.push("email_live_send");
  if (context.ai_runtime_mode === "mock") blockedFeatures.push("ai_live_generation");

  const pierre_technology_status: PierreTechnologyStatus = {
    cloneos_active: isActive("cloneos"),
    cloneadn_active: isActive("cloneadn"),
    cloneguard_active: isActive("cloneguard"),
    clonetrace_active: isActive("clonetrace"),
    clonevoice_available: isActive("clonevoice"),
    clonechat_limited: technologies.find((t) => t.id === "clonechat")?.status === "needs_configuration",
    safe_to_run_pierre:
      isActive("cloneos") && isActive("cloneguard") && isActive("clonetrace"),
    blocked_features: blockedFeatures,
  };

  const warnings = [...new Set(global_readiness.warnings)];
  const blockers = [...new Set(global_readiness.blockers)];
  const next_actions = buildTechnologyNextActions(technologies, context);

  const ts = now.toISOString();
  return {
    tenant: { user_id: userId, generated_at: ts },
    technologies,
    global_readiness,
    pierre_technology_status,
    warnings,
    blockers,
    next_actions,
    generated_at: ts,
  };
}
