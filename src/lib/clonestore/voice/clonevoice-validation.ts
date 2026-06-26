// TECH-10 — CloneVoice Readiness Layer — Validation
// 20 règles de validation pour CloneVoice.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceReadinessReport,
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceSnapshot,
  CloneVoiceValidationIssue,
  CloneVoiceValidationReport,
} from "./clonevoice-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function issue(
  code: string,
  field: string,
  message: string,
  severity: "error" | "warning" | "info" = "error",
): CloneVoiceValidationIssue {
  return { code, field, message, severity };
}

// ── Règles ReadinessReport ────────────────────────────────────────────────────

/**
 * CV01 — production_enabled doit être false (invariant absolu)
 */
export function ruleCV01_productionEnabledFalse(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.production_enabled !== false) {
    return issue(
      "CV01",
      "production_enabled",
      "VIOLATION INVARIANT : production_enabled doit être false. CloneVoice n'est pas actif en production.",
      "error",
    );
  }
  return null;
}

/**
 * CV02 — live_audio_ready doit être false
 */
export function ruleCV02_liveAudioFalse(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.live_audio_ready !== false) {
    return issue(
      "CV02",
      "live_audio_ready",
      "live_audio_ready doit être false en V1. Aucun audio live n'est disponible.",
      "error",
    );
  }
  return null;
}

/**
 * CV03 — microphone_ready doit être false
 */
export function ruleCV03_microphoneFalse(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.microphone_ready !== false) {
    return issue(
      "CV03",
      "microphone_ready",
      "microphone_ready doit être false en V1. Aucun accès microphone n'est disponible.",
      "error",
    );
  }
  return null;
}

/**
 * CV04 — audio_storage_enabled doit être false
 */
export function ruleCV04_audioStorageFalse(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.audio_storage_enabled !== false) {
    return issue(
      "CV04",
      "audio_storage_enabled",
      "audio_storage_enabled doit être false en V1. Aucun stockage audio n'est disponible.",
      "error",
    );
  }
  return null;
}

/**
 * CV05 — privacy_review_required doit être true
 */
export function ruleCV05_privacyReviewRequired(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.privacy_review_required !== true) {
    return issue(
      "CV05",
      "privacy_review_required",
      "privacy_review_required doit être true. La revue RGPD est obligatoire.",
      "error",
    );
  }
  return null;
}

/**
 * CV06 — security_review_required doit être true
 */
export function ruleCV06_securityReviewRequired(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.security_review_required !== true) {
    return issue(
      "CV06",
      "security_review_required",
      "security_review_required doit être true. La revue sécurité est obligatoire.",
      "error",
    );
  }
  return null;
}

/**
 * CV07 — readiness_score dans les bornes [0, 100]
 */
export function ruleCV07_readinessScoreRange(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (report.readiness_score < 0 || report.readiness_score > 100) {
    return issue(
      "CV07",
      "readiness_score",
      `readiness_score (${report.readiness_score}) doit être entre 0 et 100.`,
      "error",
    );
  }
  return null;
}

/**
 * CV08 — verdict non vide
 */
export function ruleCV08_verdictNotEmpty(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (!report.verdict || report.verdict.trim().length === 0) {
    return issue("CV08", "verdict", "Le verdict ne peut pas être vide.", "error");
  }
  return null;
}

/**
 * CV09 — Le verdict ne doit pas prétendre à une disponibilité production
 */
export function ruleCV09_verdictNoProductionClaim(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  const forbiddenPhrases = [
    "voix disponible maintenant",
    "pipeline vocal complet",
    "production active",
    "actif en production",
  ];
  const lowerVerdict = report.verdict.toLowerCase();
  const found = forbiddenPhrases.find((p) => lowerVerdict.includes(p));
  if (found) {
    return issue(
      "CV09",
      "verdict",
      `Le verdict contient une affirmation interdite : "${found}". CloneVoice n'est pas actif en production.`,
      "error",
    );
  }
  return null;
}

/**
 * CV10 — generated_at non vide
 */
export function ruleCV10_generatedAtNotEmpty(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationIssue | null {
  if (!report.generated_at || report.generated_at.trim().length === 0) {
    return issue(
      "CV10",
      "generated_at",
      "generated_at ne peut pas être vide.",
      "error",
    );
  }
  return null;
}

// ── Règles Transcript ─────────────────────────────────────────────────────────

/**
 * CV11 — input_mode doit être text_transcript en V1
 */
export function ruleCV11_inputModeTextTranscript(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceValidationIssue | null {
  if (transcript.input_mode !== "text_transcript") {
    return issue(
      "CV11",
      "input_mode",
      `input_mode '${transcript.input_mode}' non autorisé en V1. Seul text_transcript est disponible.`,
      "error",
    );
  }
  return null;
}

/**
 * CV12 — is_sanitized doit être true
 */
export function ruleCV12_transcriptSanitized(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceValidationIssue | null {
  if (!transcript.is_sanitized) {
    return issue(
      "CV12",
      "is_sanitized",
      "Le transcript doit être sanitizé avant traitement.",
      "error",
    );
  }
  return null;
}

/**
 * CV13 — draft_id non vide
 */
export function ruleCV13_transcriptDraftId(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceValidationIssue | null {
  if (!transcript.draft_id || transcript.draft_id.trim().length === 0) {
    return issue(
      "CV13",
      "draft_id",
      "draft_id ne peut pas être vide.",
      "error",
    );
  }
  return null;
}

/**
 * CV14 — company_id non vide
 */
export function ruleCV14_transcriptCompanyId(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceValidationIssue | null {
  if (!transcript.company_id || transcript.company_id.trim().length === 0) {
    return issue(
      "CV14",
      "company_id",
      "company_id ne peut pas être vide.",
      "error",
    );
  }
  return null;
}

/**
 * CV15 — Transcript rejeté si risque critical sans requires_human_review
 */
export function ruleCV15_criticalRiskReview(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceValidationIssue | null {
  if (
    transcript.risk_level === "critical" &&
    !transcript.requires_human_review &&
    transcript.status !== "rejected"
  ) {
    return issue(
      "CV15",
      "requires_human_review",
      "Un transcript de risque critical doit avoir requires_human_review=true.",
      "error",
    );
  }
  return null;
}

// ── Règles CommandDraft ───────────────────────────────────────────────────────

/**
 * CV16 — can_proceed_to_cloneos doit être false si blocked_reasons non vide
 */
export function ruleCV16_blockedReasonConsistency(
  commandDraft: CloneVoiceCommandDraft,
): CloneVoiceValidationIssue | null {
  if (commandDraft.blocked_reasons.length > 0 && commandDraft.can_proceed_to_cloneos) {
    return issue(
      "CV16",
      "can_proceed_to_cloneos",
      "can_proceed_to_cloneos doit être false si blocked_reasons est non vide.",
      "error",
    );
  }
  return null;
}

/**
 * CV17 — command_draft_id non vide
 */
export function ruleCV17_commandDraftId(
  commandDraft: CloneVoiceCommandDraft,
): CloneVoiceValidationIssue | null {
  if (!commandDraft.command_draft_id || commandDraft.command_draft_id.trim().length === 0) {
    return issue(
      "CV17",
      "command_draft_id",
      "command_draft_id ne peut pas être vide.",
      "error",
    );
  }
  return null;
}

/**
 * CV18 — cloneos_source doit être 'clonechat' (pas 'clonevoice')
 */
export function ruleCV18_cloneosSourceIsCloneChat(
  commandDraft: CloneVoiceCommandDraft,
): CloneVoiceValidationIssue | null {
  const source = commandDraft.voice_metadata.cloneos_source;
  if (source !== "clonechat") {
    return issue(
      "CV18",
      "voice_metadata.cloneos_source",
      `cloneos_source doit être 'clonechat'. 'clonevoice' n'existe pas dans CloneOSCommandSource. Actuel: '${source}'.`,
      "warning",
    );
  }
  return null;
}

// ── Règles Snapshot ───────────────────────────────────────────────────────────

/**
 * CV19 — production_enabled doit être false dans le snapshot
 */
export function ruleCV19_snapshotProductionFalse(
  snapshot: CloneVoiceSnapshot,
): CloneVoiceValidationIssue | null {
  if (snapshot.production_enabled !== false) {
    return issue(
      "CV19",
      "production_enabled",
      "VIOLATION INVARIANT snapshot : production_enabled doit être false.",
      "error",
    );
  }
  return null;
}

/**
 * CV20 — capabilities_available ne peut pas dépasser capabilities_total
 */
export function ruleCV20_capabilitiesConsistency(
  snapshot: CloneVoiceSnapshot,
): CloneVoiceValidationIssue | null {
  if (snapshot.capabilities_available > snapshot.capabilities_total) {
    return issue(
      "CV20",
      "capabilities_available",
      `capabilities_available (${snapshot.capabilities_available}) ne peut pas dépasser capabilities_total (${snapshot.capabilities_total}).`,
      "error",
    );
  }
  return null;
}

// ── Validateur ReadinessReport ────────────────────────────────────────────────

export function validateCloneVoiceReadinessReport(
  report: CloneVoiceReadinessReport,
): CloneVoiceValidationReport {
  const allIssues: Array<CloneVoiceValidationIssue | null> = [
    ruleCV01_productionEnabledFalse(report),
    ruleCV02_liveAudioFalse(report),
    ruleCV03_microphoneFalse(report),
    ruleCV04_audioStorageFalse(report),
    ruleCV05_privacyReviewRequired(report),
    ruleCV06_securityReviewRequired(report),
    ruleCV07_readinessScoreRange(report),
    ruleCV08_verdictNotEmpty(report),
    ruleCV09_verdictNoProductionClaim(report),
    ruleCV10_generatedAtNotEmpty(report),
  ];

  const issues = allIssues.filter((i): i is CloneVoiceValidationIssue => i !== null);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

// ── Validateur TranscriptDraft ────────────────────────────────────────────────

export function validateCloneVoiceTranscriptDraft(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceValidationReport {
  const allIssues: Array<CloneVoiceValidationIssue | null> = [
    ruleCV11_inputModeTextTranscript(transcript),
    ruleCV12_transcriptSanitized(transcript),
    ruleCV13_transcriptDraftId(transcript),
    ruleCV14_transcriptCompanyId(transcript),
    ruleCV15_criticalRiskReview(transcript),
  ];

  const issues = allIssues.filter((i): i is CloneVoiceValidationIssue => i !== null);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

// ── Validateur CommandDraft ───────────────────────────────────────────────────

export function validateCloneVoiceCommandDraft(
  commandDraft: CloneVoiceCommandDraft,
): CloneVoiceValidationReport {
  const allIssues: Array<CloneVoiceValidationIssue | null> = [
    ruleCV16_blockedReasonConsistency(commandDraft),
    ruleCV17_commandDraftId(commandDraft),
    ruleCV18_cloneosSourceIsCloneChat(commandDraft),
  ];

  const issues = allIssues.filter((i): i is CloneVoiceValidationIssue => i !== null);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

// ── Validateur Snapshot ───────────────────────────────────────────────────────

export function validateCloneVoiceSnapshot(
  snapshot: CloneVoiceSnapshot,
): CloneVoiceValidationReport {
  const allIssues: Array<CloneVoiceValidationIssue | null> = [
    ruleCV19_snapshotProductionFalse(snapshot),
    ruleCV20_capabilitiesConsistency(snapshot),
  ];

  const issues = allIssues.filter((i): i is CloneVoiceValidationIssue => i !== null);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}
