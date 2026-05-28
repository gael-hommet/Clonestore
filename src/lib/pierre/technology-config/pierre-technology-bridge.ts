// B46 — Pierre Technology Bridge
// Translates B46 technology configurations into Pierre runtime context.
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type {
  B46TechnologyItem,
  CloneStoreTechnologyId,
} from "../../clonestore/technologies/technology-b46-types";
import { PIERRE_TECHNOLOGY_MAP, canPierreRunWithout } from "./pierre-technology-map";

// ── Pierre Technology Runtime Context ────────────────────────────────────────

export type PierreTechnologyRuntimeContext = {
  active_capabilities: string[];
  blocked_features: string[];
  degraded_features: string[];
  guardrails: {
    cloneguard_active: boolean;
    clonetrace_active: boolean;
    safe_to_run: boolean;
    requires_human_validation: boolean;
  };
  memory: {
    cloneadn_active: boolean;
    empreinte_loaded: boolean;
  };
  ai_mode: string;
  email_mode: string;
  document_generation_available: boolean;
  voice_available: boolean;
  chat_available: boolean;
};

export type PierreWorkflowGuardrails = {
  block_all_missions: boolean;
  block_sensitive_actions: boolean;
  block_document_generation: boolean;
  require_human_validation_always: boolean;
  degraded_audit_trail: boolean;
  blocked_reasons: string[];
};

// ── Build Pierre Technology Runtime Context ───────────────────────────────────

export function buildPierreTechnologyRuntimeContext(
  items: B46TechnologyItem[],
): PierreTechnologyRuntimeContext {
  const findItem = (id: CloneStoreTechnologyId) => items.find((t) => t.id === id);
  const isActive = (id: CloneStoreTechnologyId) => {
    const t = findItem(id);
    return t ? t.enabled && t.readiness.score >= 60 : false;
  };

  const active_capabilities: string[] = [];
  const blocked_features: string[] = [];
  const degraded_features: string[] = [];

  for (const effect of PIERRE_TECHNOLOGY_MAP) {
    const t = findItem(effect.technology_id);
    const active = isActive(effect.technology_id);

    if (active) {
      active_capabilities.push(effect.pierre_feature);
    } else if (!canPierreRunWithout(effect.technology_id)) {
      blocked_features.push(effect.pierre_feature);
    } else if (t && t.status === "degraded") {
      degraded_features.push(effect.pierre_feature);
    } else if (!active) {
      blocked_features.push(effect.pierre_feature);
    }
  }

  const cloneguardActive = isActive("cloneguard");
  const clonetraceActive = isActive("clonetrace");
  const cloneosActive = isActive("cloneos");
  const cloneadnActive = isActive("cloneadn");
  const clonevoiceActive = isActive("clonevoice");
  const clonechatItem = findItem("clonechat");

  // Voice blocked if clonevoice not active
  if (!clonevoiceActive) blocked_features.push("voice_input");

  // Email/AI modes come from environment
  const emailMode = typeof process !== "undefined" ? (process.env.EMAIL_RUNTIME_MODE ?? "mock") : "mock";
  const aiMode = typeof process !== "undefined" ? (process.env.AI_RUNTIME_MODE ?? "mock") : "mock";

  if (emailMode === "mock") blocked_features.push("email_live_send");
  if (aiMode === "mock") blocked_features.push("ai_live_generation");

  return {
    active_capabilities: [...new Set(active_capabilities)],
    blocked_features: [...new Set(blocked_features)],
    degraded_features: [...new Set(degraded_features)],
    guardrails: {
      cloneguard_active: cloneguardActive,
      clonetrace_active: clonetraceActive,
      safe_to_run: cloneguardActive && clonetraceActive && cloneosActive,
      requires_human_validation: !cloneguardActive,
    },
    memory: {
      cloneadn_active: cloneadnActive,
      empreinte_loaded: cloneadnActive,
    },
    ai_mode: aiMode,
    email_mode: emailMode,
    document_generation_available: cloneosActive && cloneguardActive,
    voice_available: clonevoiceActive,
    chat_available: !!(clonechatItem && clonechatItem.status !== "disabled"),
  };
}

// ── Apply technology config to Pierre workflow ────────────────────────────────

export function applyTechnologyConfigToPierreWorkflow(
  items: B46TechnologyItem[],
): PierreWorkflowGuardrails {
  const findItem = (id: CloneStoreTechnologyId) => items.find((t) => t.id === id);
  const isActive = (id: CloneStoreTechnologyId) => {
    const t = findItem(id);
    return t ? t.enabled && t.readiness.score >= 60 : false;
  };

  const cloneguardActive = isActive("cloneguard");
  const cloneosActive = isActive("cloneos");
  const clonetraceActive = isActive("clonetrace");

  const blocked_reasons: string[] = [];

  const block_all_missions = !cloneosActive;
  if (block_all_missions) blocked_reasons.push("CloneOS inactif — orchestration impossible.");

  const block_sensitive_actions = !cloneguardActive;
  if (block_sensitive_actions) blocked_reasons.push("CloneGuard inactif — actions sensibles bloquées.");

  const cloneguardItem = findItem("cloneguard");
  const block_document_generation =
    !cloneosActive || cloneguardItem?.status === "degraded";
  if (block_document_generation && !cloneosActive) blocked_reasons.push("CloneOS requis pour génération documents.");

  const require_human_validation_always = !cloneguardActive;
  if (require_human_validation_always) blocked_reasons.push("Validation humaine requise (CloneGuard dégradé).");

  const degraded_audit_trail = !clonetraceActive || findItem("clonetrace")?.status === "degraded";
  if (degraded_audit_trail && !clonetraceActive) blocked_reasons.push("CloneTrace inactif — audit trail dégradé.");

  return {
    block_all_missions,
    block_sensitive_actions,
    block_document_generation,
    require_human_validation_always,
    degraded_audit_trail,
    blocked_reasons,
  };
}

// ── Get blocked features list ─────────────────────────────────────────────────

export function getPierreBlockedFeaturesFromTechnologyConfig(
  items: B46TechnologyItem[],
): string[] {
  const ctx = buildPierreTechnologyRuntimeContext(items);
  return ctx.blocked_features;
}
