// src/lib/cloneos/ai/model-presets.ts
// B32 — Named model presets. One central registry for CloneStore AI model selection.
// Doctrine:
//   Claude Opus 4.7  = livrables visibles client / haute qualité
//   GPT (fort)       = mission planning, orchestration, risque standard
//   GPT (mini/nano)  = micro-tâches, classification, extraction, statuts

import type {
  AiModelPreset,
  AiModelPresetKey,
  CloneAIProviderId,
  CloneAIModelProfile,
} from "./types";

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

const PRESETS: Record<AiModelPresetKey, Omit<AiModelPreset, "key">> = {
  // ── Deliverables premium → Claude Opus 4.7 ────────────────────────────────
  deliverable_premium: {
    label: "Livrable premium (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  document_generation: {
    label: "Génération de document RH (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  pdf_content_generation: {
    label: "Contenu PDF (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  spreadsheet_content_generation: {
    label: "Contenu tableur/Excel (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  client_fiche_generation: {
    label: "Fiche client (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  final_report_generation: {
    label: "Rapport RH final dirigeant (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  contract_draft_generation: {
    label: "Rédaction contrat (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  hr_letter_generation: {
    label: "Courrier RH important (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  premium_delivery_review: {
    label: "Revue qualité livrable premium (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },
  risk_analysis_sensitive: {
    label: "Analyse risque sensible/juridique (Claude Opus 4.7)",
    provider: "anthropic",
    model_profile: "premium_generation",
    model_env_key: "AI_ANTHROPIC_OPUS_MODEL",
    default_model_id: "claude-opus-4-7",
    is_premium: true,
  },

  // ── Organisation / orchestration → GPT fort ───────────────────────────────
  mission_planning: {
    label: "Planification mission (GPT fort)",
    provider: "openai",
    model_profile: "orchestration",
    model_env_key: "AI_OPENAI_STRONG_MODEL",
    default_model_id: "gpt-4.1",
    is_premium: false,
  },
  task_orchestration: {
    label: "Orchestration tâches (GPT fort)",
    provider: "openai",
    model_profile: "orchestration",
    model_env_key: "AI_OPENAI_STRONG_MODEL",
    default_model_id: "gpt-4.1",
    is_premium: false,
  },
  risk_analysis_standard: {
    label: "Analyse risque standard (GPT fort)",
    provider: "openai",
    model_profile: "orchestration",
    model_env_key: "AI_OPENAI_STRONG_MODEL",
    default_model_id: "gpt-4.1",
    is_premium: false,
  },

  // ── Micro-tâches → GPT mini/nano ─────────────────────────────────────────
  status_update: {
    label: "Mise à jour statut (GPT mini)",
    provider: "openai",
    model_profile: "micro_task",
    model_env_key: "AI_OPENAI_FAST_MODEL",
    default_model_id: "gpt-4.1-mini",
    is_premium: false,
  },
  intent_detection: {
    label: "Détection d'intention (GPT mini)",
    provider: "openai",
    model_profile: "micro_task",
    model_env_key: "AI_OPENAI_FAST_MODEL",
    default_model_id: "gpt-4.1-mini",
    is_premium: false,
  },
  field_extraction: {
    label: "Extraction de champs (GPT mini)",
    provider: "openai",
    model_profile: "micro_task",
    model_env_key: "AI_OPENAI_FAST_MODEL",
    default_model_id: "gpt-4.1-mini",
    is_premium: false,
  },

  // ── Embeddings ────────────────────────────────────────────────────────────
  embeddings_quality: {
    label: "Embeddings haute qualité",
    provider: "openai",
    model_profile: "fast_classification",
    model_env_key: "AI_EMBEDDINGS_QUALITY_MODEL",
    default_model_id: "text-embedding-3-large",
    is_premium: false,
  },
  embeddings_cost: {
    label: "Embeddings économiques",
    provider: "openai",
    model_profile: "fast_classification",
    model_env_key: "AI_EMBEDDINGS_COST_MODEL",
    default_model_id: "text-embedding-3-small",
    is_premium: false,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getModelPreset(key: AiModelPresetKey): AiModelPreset {
  const preset = PRESETS[key];
  return { key, ...preset };
}

export function getModelId(key: AiModelPresetKey): string {
  const preset = PRESETS[key];
  return getEnvSafe(preset.model_env_key) ?? preset.default_model_id;
}

export function getPresetProvider(key: AiModelPresetKey): CloneAIProviderId {
  return PRESETS[key].provider;
}

export function getPresetProfile(key: AiModelPresetKey): CloneAIModelProfile {
  return PRESETS[key].model_profile;
}

export function listAllPresets(): AiModelPreset[] {
  return (Object.keys(PRESETS) as AiModelPresetKey[]).map((k) => getModelPreset(k));
}

export function listPremiumPresets(): AiModelPreset[] {
  return listAllPresets().filter((p) => p.is_premium);
}

export function isPremiumPreset(key: AiModelPresetKey): boolean {
  return PRESETS[key]?.is_premium ?? false;
}
