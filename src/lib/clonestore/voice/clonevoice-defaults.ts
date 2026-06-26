// TECH-10 — CloneVoice Readiness Layer — Defaults
// CloneVoice est la couche d'entrée vocale de CloneStore.
// CloneVoice n'est PAS actif en production. TECH-10 = readiness layer uniquement.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceStatus,
  CloneVoiceRuntimeStatus,
  CloneVoiceReadinessLevel,
  CloneVoiceInputMode,
  CloneVoiceProviderStatus,
  CloneVoiceReadinessReport,
  CloneVoiceCapability,
  CloneVoiceLimitation,
  CloneVoiceGuardrail,
  CloneVoicePrerequisite,
  CloneVoiceFeatureFlag,
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceSnapshot,
} from "./clonevoice-types";

// ── Constantes par défaut ─────────────────────────────────────────────────────

export const DEFAULT_CLONEVOICE_STATUS: CloneVoiceStatus = "preparation";
export const DEFAULT_CLONEVOICE_RUNTIME_STATUS: CloneVoiceRuntimeStatus = "not_implemented";
export const DEFAULT_CLONEVOICE_READINESS_LEVEL: CloneVoiceReadinessLevel = "partial_ready";
export const DEFAULT_CLONEVOICE_PROVIDER_STATUS: CloneVoiceProviderStatus = "not_configured";

// V1 : seul le mode text_transcript est disponible
export const DEFAULT_CLONEVOICE_AVAILABLE_INPUT_MODES: CloneVoiceInputMode[] = [
  "text_transcript",
];

// ── Capacités V1 ──────────────────────────────────────────────────────────────

export const DEFAULT_CLONEVOICE_CAPABILITIES: CloneVoiceCapability[] = [
  {
    capability_id: "cap_text_transcript",
    label: "Transcript texte",
    available: true,
    available_in_v1: true,
    input_mode: "text_transcript",
    description: "Entrée texte directe simulant un transcript vocal. Seul mode disponible en V1.",
  },
  {
    capability_id: "cap_uploaded_audio",
    label: "Audio uploadé",
    available: false,
    available_in_v1: false,
    input_mode: "uploaded_audio",
    description: "Upload d'un fichier audio — non disponible en V1. Nécessite provider configuré.",
  },
  {
    capability_id: "cap_microphone",
    label: "Microphone temps réel",
    available: false,
    available_in_v1: false,
    input_mode: "microphone",
    description: "Capture microphone en temps réel — non disponible en V1. Nécessite revue sécurité/RGPD.",
  },
  {
    capability_id: "cap_phone_call",
    label: "Appel téléphonique",
    available: false,
    available_in_v1: false,
    input_mode: "phone_call",
    description: "Intégration appel téléphonique — hors périmètre V1.",
  },
  {
    capability_id: "cap_meeting_recording",
    label: "Enregistrement réunion",
    available: false,
    available_in_v1: false,
    input_mode: "meeting_recording",
    description: "Transcription de réunion enregistrée — hors périmètre V1.",
  },
];

// ── Limitations V1 ────────────────────────────────────────────────────────────

export const DEFAULT_CLONEVOICE_LIMITATIONS: CloneVoiceLimitation[] = [
  {
    limitation_id: "lim_no_real_audio",
    label: "Pas d'audio réel",
    description:
      "CloneVoice ne capture pas d'audio réel en V1. Entrée texte uniquement.",
    is_permanent: false,
    workaround: "Fournir le transcript textuel directement.",
  },
  {
    limitation_id: "lim_no_provider",
    label: "Aucun fournisseur de transcription",
    description:
      "Aucun provider Whisper/Google/Azure n'est configuré. La transcription automatique n'est pas disponible.",
    is_permanent: false,
    workaround: "Configurer un provider après revue sécurité et légale.",
  },
  {
    limitation_id: "lim_no_audio_storage",
    label: "Pas de stockage audio",
    description:
      "CloneVoice ne stocke aucun fichier audio en V1. Aucun enregistrement n'est conservé.",
    is_permanent: false,
    workaround: "Non applicable en V1.",
  },
  {
    limitation_id: "lim_text_transcript_only",
    label: "Transcript texte uniquement",
    description:
      "Seul le mode text_transcript est disponible en V1. Les modes audio requièrent validation.",
    is_permanent: false,
    workaround: "Utiliser text_transcript comme entrée.",
  },
  {
    limitation_id: "lim_no_production",
    label: "Non actif en production",
    description:
      "CloneVoice n'est pas actif en production en V1. TECH-10 = couche readiness uniquement.",
    is_permanent: false,
    workaround: "Validation complète des prérequis avant activation production.",
  },
];

// ── Garde-fous ────────────────────────────────────────────────────────────────

export const DEFAULT_CLONEVOICE_GUARDRAILS: CloneVoiceGuardrail[] = [
  {
    guardrail_id: "guard_no_real_audio_capture",
    label: "Pas de capture audio réelle",
    description:
      "Interdit toute capture audio réelle sans revue sécurité/RGPD complète.",
    action_types_blocked: ["audio_capture", "microphone_access", "recording"],
    requires_human_review: true,
    always_active: true,
  },
  {
    guardrail_id: "guard_no_external_api",
    label: "Pas d'API externe",
    description:
      "Interdit tout appel à Whisper, OpenAI, Anthropic ou API tiers non validée.",
    action_types_blocked: ["whisper_api_call", "openai_api_call", "anthropic_api_call", "external_transcription"],
    requires_human_review: true,
    always_active: true,
  },
  {
    guardrail_id: "guard_critical_action_review",
    label: "Revue obligatoire — actions critiques",
    description:
      "Toute commande vocale de risque critical ou high nécessite validation humaine avant transmission à CloneOS.",
    action_types_blocked: ["critical_action_auto_execute"],
    requires_human_review: true,
    always_active: true,
  },
  {
    guardrail_id: "guard_no_audio_storage",
    label: "Pas de stockage audio",
    description:
      "Interdit le stockage de fichiers audio sans validation légale et RGPD complète.",
    action_types_blocked: ["audio_storage", "audio_persistence"],
    requires_human_review: true,
    always_active: true,
  },
  {
    guardrail_id: "guard_pii_redaction",
    label: "Redaction PII obligatoire",
    description:
      "Les données personnelles sensibles doivent être redactées avant traitement.",
    action_types_blocked: ["pii_transmission_unredacted"],
    requires_human_review: false,
    always_active: true,
  },
];

// ── Prérequis ────────────────────────────────────────────────────────────────

export const DEFAULT_CLONEVOICE_PREREQUISITES: CloneVoicePrerequisite[] = [
  {
    prerequisite_id: "prereq_provider_config",
    label: "Provider de transcription configuré",
    description:
      "Un fournisseur de transcription (Whisper, Google Speech, Azure, etc.) doit être configuré et testé.",
    is_met: false,
    is_blocking: true,
    category: "provider",
  },
  {
    prerequisite_id: "prereq_security_review",
    label: "Revue sécurité complète",
    description:
      "Une revue sécurité complète de la pipeline vocale doit être effectuée avant activation.",
    is_met: false,
    is_blocking: true,
    category: "security",
  },
  {
    prerequisite_id: "prereq_privacy_review",
    label: "Revue vie privée / RGPD",
    description:
      "Une analyse RGPD et vie privée doit valider le traitement des données vocales.",
    is_met: false,
    is_blocking: true,
    category: "privacy",
  },
  {
    prerequisite_id: "prereq_legal_review",
    label: "Validation légale",
    description:
      "Validation juridique du traitement audio et du consentement utilisateur.",
    is_met: false,
    is_blocking: true,
    category: "legal",
  },
  {
    prerequisite_id: "prereq_text_transcript_ready",
    label: "Transcript texte disponible (V1)",
    description:
      "Le mode text_transcript est disponible pour tests et sandbox internes.",
    is_met: true,
    is_blocking: false,
    category: "technical",
  },
  {
    prerequisite_id: "prereq_product_validation",
    label: "Validation produit fonctionnalité vocale",
    description:
      "L'équipe produit doit valider la conception UX et le périmètre de la fonctionnalité vocale.",
    is_met: false,
    is_blocking: false,
    category: "product",
  },
];

// ── Feature flags ─────────────────────────────────────────────────────────────

export const DEFAULT_CLONEVOICE_FEATURE_FLAGS: CloneVoiceFeatureFlag[] = [
  {
    key: "clonevoice_text_transcript",
    enabled: true,
    requires_production_ready: false,
    description: "Mode transcript texte — disponible en V1 pour tests internes.",
    available_in_v1: true,
  },
  {
    key: "clonevoice_audio_upload",
    enabled: false,
    requires_production_ready: true,
    description: "Mode upload audio — désactivé. Nécessite provider + revue sécurité.",
    available_in_v1: false,
  },
  {
    key: "clonevoice_microphone",
    enabled: false,
    requires_production_ready: true,
    description: "Mode microphone temps réel — désactivé. Nécessite revue RGPD complète.",
    available_in_v1: false,
  },
  {
    key: "clonevoice_production",
    enabled: false,
    requires_production_ready: true,
    description: "Activation production CloneVoice — désactivé. Tous prérequis bloquants requis.",
    available_in_v1: false,
  },
];

// ── Readiness report par défaut ───────────────────────────────────────────────

export function buildDefaultCloneVoiceReadinessReport(): CloneVoiceReadinessReport {
  const missingPrereqs = DEFAULT_CLONEVOICE_PREREQUISITES.filter((p) => !p.is_met);
  const blockingMissing = missingPrereqs.filter((p) => p.is_blocking);

  return {
    status: DEFAULT_CLONEVOICE_STATUS,
    runtime_status: DEFAULT_CLONEVOICE_RUNTIME_STATUS,
    readiness_level: DEFAULT_CLONEVOICE_READINESS_LEVEL,
    readiness_score: 15, // text_transcript disponible, mais prérequis critiques manquants
    production_enabled: false,
    sandbox_possible: true, // text_transcript disponible
    live_audio_ready: false,
    microphone_ready: false,
    audio_storage_enabled: false,
    provider_status: DEFAULT_CLONEVOICE_PROVIDER_STATUS,
    provider_configured: false,
    privacy_review_required: true,
    security_review_required: true,
    missing_prerequisites: missingPrereqs,
    blockers: blockingMissing.map((p) => p.label),
    capabilities: DEFAULT_CLONEVOICE_CAPABILITIES,
    limitations: DEFAULT_CLONEVOICE_LIMITATIONS,
    guardrails: DEFAULT_CLONEVOICE_GUARDRAILS,
    available_input_modes: DEFAULT_CLONEVOICE_AVAILABLE_INPUT_MODES,
    verdict:
      "CloneVoice n'est pas prêt pour la production. Prérequis bloquants manquants : " +
      blockingMissing.map((p) => p.label).join(", ") +
      ". Seul le mode text_transcript est disponible pour tests internes.",
    generated_at: new Date().toISOString(),
  };
}

// ── Transcript draft demo ─────────────────────────────────────────────────────

export function buildDemoCloneVoiceTranscriptDraft(
  companyId: string = "demo_company",
): CloneVoiceTranscriptDraft {
  return {
    draft_id: "demo_transcript_001",
    company_id: companyId,
    raw_text: "Préparer un contrat pour Pierre Dupont, nouvelle recrue développeur senior.",
    normalized_text: "préparer un contrat pour [NOM_REDACTED], nouvelle recrue développeur senior.",
    status: "command_ready",
    language: "fr",
    detected_intent: "hr_request",
    risk_level: "medium",
    input_mode: "text_transcript",
    is_sanitized: true,
    redacted_keys: ["NOM"],
    requires_human_review: false,
    created_at: new Date().toISOString(),
    is_demo: true,
    processing_notes: [
      "Mode text_transcript — aucun audio réel traité.",
      "Démo uniquement — ne pas utiliser en production.",
      "Nom redacté pour protection données personnelles.",
    ],
  };
}

// ── Command draft demo ────────────────────────────────────────────────────────

export function buildDemoCloneVoiceCommandDraft(
  companyId: string = "demo_company",
): CloneVoiceCommandDraft {
  return {
    command_draft_id: "demo_command_001",
    transcript_draft_id: "demo_transcript_001",
    company_id: companyId,
    raw_request: "préparer un contrat pour [NOM_REDACTED], nouvelle recrue développeur senior.",
    detected_intent: "hr_request",
    risk_level: "medium",
    candidate_employee_slug: "pierre",
    requires_validation: false,
    can_proceed_to_cloneos: true,
    blocked_reasons: [],
    warnings: [
      "Démo uniquement — ne pas utiliser en production.",
      "Nom employé redacté — validation humaine recommandée avant exécution réelle.",
    ],
    voice_metadata: {
      input_mode: "text_transcript",
      is_demo: true,
      provider_status: "not_configured",
      language_detected: "fr",
    },
    created_at: new Date().toISOString(),
  };
}

// ── Snapshot vide ─────────────────────────────────────────────────────────────

export function buildEmptyCloneVoiceSnapshot(): CloneVoiceSnapshot {
  return {
    status: DEFAULT_CLONEVOICE_STATUS,
    runtime_status: DEFAULT_CLONEVOICE_RUNTIME_STATUS,
    readiness_level: DEFAULT_CLONEVOICE_READINESS_LEVEL,
    readiness_score: 15,
    production_enabled: false,
    sandbox_possible: true,
    live_audio_ready: false,
    missing_prerequisites: DEFAULT_CLONEVOICE_PREREQUISITES
      .filter((p) => !p.is_met)
      .map((p) => p.label),
    blockers: DEFAULT_CLONEVOICE_PREREQUISITES
      .filter((p) => !p.is_met && p.is_blocking)
      .map((p) => p.label),
    capabilities_available: DEFAULT_CLONEVOICE_CAPABILITIES.filter((c) => c.available).length,
    capabilities_total: DEFAULT_CLONEVOICE_CAPABILITIES.length,
    limitations_count: DEFAULT_CLONEVOICE_LIMITATIONS.length,
    guardrails_count: DEFAULT_CLONEVOICE_GUARDRAILS.length,
    generated_at: new Date().toISOString(),
  };
}
