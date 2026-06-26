// TECH-10 — CloneVoice Readiness Layer — Tests
// 50 tests couvrant les 10 modules CloneVoice.
// CloneVoice n'est PAS actif en production. TECH-10 = readiness layer uniquement.

import { describe, it, expect, beforeEach } from "vitest";

import * as VoiceIndexNS from "../index";
import * as DefaultsNS from "../clonevoice-defaults";
import * as ReadinessNS from "../clonevoice-readiness";
import * as NormalizerNS from "../clonevoice-transcript-normalizer";
import * as AdapterNS from "../clonevoice-command-adapter";
import * as GuardrailsNS from "../clonevoice-guardrails";
import * as ValidationNS from "../clonevoice-validation";
import * as SnapshotNS from "../clonevoice-snapshot";
import * as StorageNS from "../clonevoice-storage";
import * as BridgeNS from "../pierre-voice-bridge";

const COMPANY_ID = "test_company_001";

// ─────────────────────────────────────────────────────────────────────────────
// T01 — EXPORTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

describe("T01 — Index exports", () => {
  it("T01.1 — index exporte les fonctions principales", () => {
    const indexModule = VoiceIndexNS as Record<string, unknown>;
    expect(typeof indexModule["buildDefaultCloneVoiceReadinessReport"]).toBe("function");
    expect(typeof indexModule["evaluateCloneVoiceReadiness"]).toBe("function");
    expect(typeof indexModule["normalizeTranscript"]).toBe("function");
    expect(typeof indexModule["adaptTranscriptToCommandDraft"]).toBe("function");
    expect(typeof indexModule["validateCloneVoiceReadinessReport"]).toBe("function");
    expect(typeof indexModule["clearCloneVoiceStore"]).toBe("function");
    expect(typeof indexModule["processPierreVoiceInput"]).toBe("function");
  });

  it("T01.2 — index exporte les constantes par défaut", () => {
    const indexModule = VoiceIndexNS as Record<string, unknown>;
    expect(indexModule["DEFAULT_CLONEVOICE_STATUS"]).toBe("preparation");
    expect(indexModule["DEFAULT_CLONEVOICE_RUNTIME_STATUS"]).toBe("not_implemented");
    expect(indexModule["DEFAULT_CLONEVOICE_READINESS_LEVEL"]).toBe("partial_ready");
    expect(indexModule["DEFAULT_CLONEVOICE_PROVIDER_STATUS"]).toBe("not_configured");
  });

  it("T01.3 — index exporte les guardrails par défaut", () => {
    const guardrails = VoiceIndexNS.DEFAULT_CLONEVOICE_GUARDRAILS;
    expect(Array.isArray(guardrails)).toBe(true);
    expect(guardrails.length).toBeGreaterThan(0);
    expect(guardrails.every((g) => g.always_active)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T02 — DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

describe("T02 — Defaults", () => {
  it("T02.1 — buildDefaultCloneVoiceReadinessReport retourne production_enabled=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.production_enabled).toBe(false);
  });

  it("T02.2 — buildDefaultCloneVoiceReadinessReport retourne live_audio_ready=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.live_audio_ready).toBe(false);
  });

  it("T02.3 — buildDefaultCloneVoiceReadinessReport retourne microphone_ready=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.microphone_ready).toBe(false);
  });

  it("T02.4 — buildDefaultCloneVoiceReadinessReport retourne audio_storage_enabled=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.audio_storage_enabled).toBe(false);
  });

  it("T02.5 — buildDefaultCloneVoiceReadinessReport retourne privacy_review_required=true", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.privacy_review_required).toBe(true);
  });

  it("T02.6 — buildDefaultCloneVoiceReadinessReport retourne security_review_required=true", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.security_review_required).toBe(true);
  });

  it("T02.7 — buildDemoCloneVoiceTranscriptDraft est un démo valide", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    expect(demo.is_demo).toBe(true);
    expect(demo.company_id).toBe(COMPANY_ID);
    expect(demo.is_sanitized).toBe(true);
    expect(demo.input_mode).toBe("text_transcript");
  });

  it("T02.8 — buildEmptyCloneVoiceSnapshot est cohérent", () => {
    const snapshot = DefaultsNS.buildEmptyCloneVoiceSnapshot();
    expect(snapshot.production_enabled).toBe(false);
    expect(snapshot.live_audio_ready).toBe(false);
    expect(snapshot.capabilities_available).toBeGreaterThan(0); // text_transcript disponible
    expect(snapshot.capabilities_total).toBeGreaterThan(snapshot.capabilities_available);
  });

  it("T02.9 — DEFAULT_CLONEVOICE_CAPABILITIES a text_transcript disponible", () => {
    const caps = DefaultsNS.DEFAULT_CLONEVOICE_CAPABILITIES;
    const textTranscript = caps.find((c) => c.input_mode === "text_transcript");
    expect(textTranscript).toBeDefined();
    expect(textTranscript?.available).toBe(true);
    expect(textTranscript?.available_in_v1).toBe(true);
  });

  it("T02.10 — DEFAULT_CLONEVOICE_CAPABILITIES n'a pas d'audio disponible en V1", () => {
    const caps = DefaultsNS.DEFAULT_CLONEVOICE_CAPABILITIES;
    const audioModes = caps.filter(
      (c) => c.input_mode !== "text_transcript" && c.available,
    );
    expect(audioModes.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T03 — READINESS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

describe("T03 — Readiness Engine", () => {
  it("T03.1 — evaluateCloneVoiceReadiness retourne ok=true par défaut", () => {
    const result = ReadinessNS.evaluateCloneVoiceReadiness();
    expect(result.ok).toBe(true);
  });

  it("T03.2 — evaluateCloneVoiceReadiness retourne production_enabled=false TOUJOURS", () => {
    const result = ReadinessNS.evaluateCloneVoiceReadiness({
      security_review_done: true,
      privacy_review_done: true,
      legal_review_done: true,
      provider_status: "configured_live",
    });
    expect(result.report.production_enabled).toBe(false);
    expect(result.can_production).toBe(false);
  });

  it("T03.3 — evaluateCloneVoiceReadiness avec aucun prérequis → blockers non vides", () => {
    const result = ReadinessNS.evaluateCloneVoiceReadiness();
    expect(result.blockers_count).toBeGreaterThan(0);
    expect(result.report.blockers.length).toBeGreaterThan(0);
  });

  it("T03.4 — evaluateCloneVoiceReadiness avec tous prérequis → moins de blocages", () => {
    const result = ReadinessNS.evaluateCloneVoiceReadiness({
      provider_status: "configured_live",
      security_review_done: true,
      privacy_review_done: true,
      legal_review_done: true,
      product_validation_done: true,
    });
    expect(result.blockers_count).toBe(0);
    expect(result.can_sandbox).toBe(true);
  });

  it("T03.5 — isCloneVoiceProductionEnabled retourne false", () => {
    expect(ReadinessNS.isCloneVoiceProductionEnabled()).toBe(false);
  });

  it("T03.6 — isLiveAudioReady retourne false", () => {
    expect(ReadinessNS.isLiveAudioReady()).toBe(false);
  });

  it("T03.7 — isMicrophoneReady retourne false", () => {
    expect(ReadinessNS.isMicrophoneReady()).toBe(false);
  });

  it("T03.8 — isTextTranscriptAvailable retourne true", () => {
    expect(ReadinessNS.isTextTranscriptAvailable()).toBe(true);
  });

  it("T03.9 — calculateReadinessScore avec tous prérequis bloquants validés = 100", () => {
    const allMet = DefaultsNS.DEFAULT_CLONEVOICE_PREREQUISITES.map((p) => ({
      ...p,
      is_met: true,
    }));
    const score = ReadinessNS.calculateReadinessScore(allMet);
    expect(score).toBe(100);
  });

  it("T03.10 — calculateReadinessScore avec aucun prérequis validé < 50", () => {
    const noneMet = DefaultsNS.DEFAULT_CLONEVOICE_PREREQUISITES.map((p) => ({
      ...p,
      is_met: false,
    }));
    const score = ReadinessNS.calculateReadinessScore(noneMet);
    expect(score).toBeLessThan(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T04 — TRANSCRIPT NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────

describe("T04 — Transcript Normalizer", () => {
  it("T04.1 — normalizeTranscript retourne ok=true pour un texte valide", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Préparer un contrat pour le nouveau collaborateur.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft).toBeDefined();
  });

  it("T04.2 — normalizeTranscript détecte la langue française", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Je voudrais créer un contrat de travail pour Pierre.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.language).toBe("fr");
  });

  it("T04.3 — normalizeTranscript détecte l'intention hr_request", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Préparer un contrat d'embauche pour la nouvelle recrue.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.detected_intent).toBe("hr_request");
  });

  it("T04.4 — normalizeTranscript marque input_mode=text_transcript", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Envoyer une attestation de travail.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.input_mode).toBe("text_transcript");
  });

  it("T04.5 — normalizeTranscript rejette un texte vide", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(false);
    expect(result.rejection_reason).toBeTruthy();
  });

  it("T04.6 — normalizeTranscript redacte les emails", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Envoyer le contrat à pierre@test.com pour validation.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.normalized_text).not.toContain("pierre@test.com");
    expect(result.draft?.redacted_keys).toContain("EMAIL");
  });

  it("T04.7 — normalizeTranscript marque is_sanitized=true", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Créer une fiche de paie pour le collaborateur.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.is_sanitized).toBe(true);
  });

  it("T04.8 — normalizeTranscript détecte l'intention document_request", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Préparer un rapport mensuel des activités.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.detected_intent).toBe("document_request");
  });

  it("T04.9 — normalizeTranscript détecte risque critical pour actions de masse", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "Supprimer tous les employés du système.",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.draft?.risk_level).toBe("critical");
    expect(result.draft?.requires_human_review).toBe(true);
  });

  it("T04.10 — normalizeTranscript rejette contenu potentiellement dangereux", () => {
    const result = NormalizerNS.normalizeTranscript({
      raw_text: "<script>alert('xss')</script>",
      company_id: COMPANY_ID,
    });
    expect(result.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T05 — COMMAND ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

describe("T05 — Command Adapter", () => {
  it("T05.1 — adaptTranscriptToCommandDraft retourne ok=true pour transcript valide", () => {
    const normResult = NormalizerNS.normalizeTranscript({
      raw_text: "Préparer un contrat pour Pierre.",
      company_id: COMPANY_ID,
    });
    expect(normResult.ok).toBe(true);
    const adaptResult = AdapterNS.adaptTranscriptToCommandDraft(normResult.draft!);
    expect(adaptResult.ok).toBe(true);
    expect(adaptResult.command_draft).toBeDefined();
  });

  it("T05.2 — command draft a cloneos_source='clonechat' (pas 'clonevoice')", () => {
    const normResult = NormalizerNS.normalizeTranscript({
      raw_text: "Envoyer une attestation de travail.",
      company_id: COMPANY_ID,
    });
    const adaptResult = AdapterNS.adaptTranscriptToCommandDraft(normResult.draft!);
    expect(adaptResult.ok).toBe(true);
    expect(adaptResult.command_draft?.voice_metadata.cloneos_source).toBe("clonechat");
  });

  it("T05.3 — command draft a voice_origin=true", () => {
    const normResult = NormalizerNS.normalizeTranscript({
      raw_text: "Créer un dossier RH pour le nouveau collaborateur.",
      company_id: COMPANY_ID,
    });
    const adaptResult = AdapterNS.adaptTranscriptToCommandDraft(normResult.draft!);
    expect(adaptResult.ok).toBe(true);
    expect(adaptResult.command_draft?.voice_metadata.voice_origin).toBe(true);
  });

  it("T05.4 — hr_request mappe vers pierre", () => {
    const slug = AdapterNS.mapIntentToEmployeeSlug("hr_request");
    expect(slug).toBe("pierre");
  });

  it("T05.5 — critical_action bloque can_proceed_to_cloneos", () => {
    const normResult = NormalizerNS.normalizeTranscript({
      raw_text: "Supprimer tous les employés du système.",
      company_id: COMPANY_ID,
    });
    expect(normResult.ok).toBe(true);
    // Le transcript critique aura risk_level=critical → blocked
    const adaptResult = AdapterNS.adaptTranscriptToCommandDraft(normResult.draft!);
    expect(adaptResult.ok).toBe(false);
    expect(adaptResult.blocked_reasons.length).toBeGreaterThan(0);
  });

  it("T05.6 — transcript rejeté bloque l'adaptation", () => {
    const rejected = NormalizerNS.rejectTranscript(
      "texte invalide",
      COMPANY_ID,
      "Test de rejet",
      "test_draft_rejected",
    );
    const adaptResult = AdapterNS.adaptTranscriptToCommandDraft(rejected);
    expect(adaptResult.ok).toBe(false);
    expect(adaptResult.blocked_reasons.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T06 — GUARDRAILS
// ─────────────────────────────────────────────────────────────────────────────

describe("T06 — Guardrails", () => {
  it("T06.1 — checkProductionEnabledGuardrail retourne true pour production_enabled=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(GuardrailsNS.checkProductionEnabledGuardrail(report)).toBe(true);
  });

  it("T06.2 — checkReadinessReportGuardrails retourne ok=true pour report par défaut", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    const result = GuardrailsNS.checkReadinessReportGuardrails(report);
    expect(result.ok).toBe(true);
    expect(result.violated_guardrails.length).toBe(0);
  });

  it("T06.3 — checkTranscriptGuardrails retourne ok=true pour transcript valide", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    const result = GuardrailsNS.checkTranscriptGuardrails(demo);
    expect(result.ok).toBe(true);
  });

  it("T06.4 — checkTranscriptGuardrails détecte transcript non sanitizé", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    const unsanitized = { ...demo, is_sanitized: false };
    const result = GuardrailsNS.checkTranscriptGuardrails(unsanitized);
    expect(result.ok).toBe(false);
    expect(result.violated_guardrails).toContain("guard_pii_redaction");
  });

  it("T06.5 — isActionBlockedByGuardrails bloque audio_capture", () => {
    expect(GuardrailsNS.isActionBlockedByGuardrails("audio_capture")).toBe(true);
  });

  it("T06.6 — isActionBlockedByGuardrails bloque openai_api_call", () => {
    expect(GuardrailsNS.isActionBlockedByGuardrails("openai_api_call")).toBe(true);
  });

  it("T06.7 — isActionBlockedByGuardrails bloque whisper_api_call", () => {
    expect(GuardrailsNS.isActionBlockedByGuardrails("whisper_api_call")).toBe(true);
  });

  it("T06.8 — getActiveGuardrails retourne tous les guardrails always_active", () => {
    const active = GuardrailsNS.getActiveGuardrails();
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((g) => g.always_active)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T07 — VALIDATION (20 règles CV01–CV20)
// ─────────────────────────────────────────────────────────────────────────────

describe("T07 — Validation Rules CV01–CV20", () => {
  it("T07.1 — CV01 passe pour production_enabled=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV01_productionEnabledFalse(report)).toBeNull();
  });

  it("T07.2 — CV02 passe pour live_audio_ready=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV02_liveAudioFalse(report)).toBeNull();
  });

  it("T07.3 — CV03 passe pour microphone_ready=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV03_microphoneFalse(report)).toBeNull();
  });

  it("T07.4 — CV04 passe pour audio_storage_enabled=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV04_audioStorageFalse(report)).toBeNull();
  });

  it("T07.5 — CV05 passe pour privacy_review_required=true", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV05_privacyReviewRequired(report)).toBeNull();
  });

  it("T07.6 — CV06 passe pour security_review_required=true", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV06_securityReviewRequired(report)).toBeNull();
  });

  it("T07.7 — CV07 passe pour readiness_score dans [0, 100]", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    expect(ValidationNS.ruleCV07_readinessScoreRange(report)).toBeNull();
  });

  it("T07.8 — CV09 détecte un verdict avec affirmation interdite", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    const badReport = {
      ...report,
      verdict: "La voix est actif en production et disponible maintenant.",
    };
    const issue = ValidationNS.ruleCV09_verdictNoProductionClaim(badReport);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("CV09");
  });

  it("T07.9 — CV11 détecte un input_mode non-text_transcript", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    const invalid = { ...demo, input_mode: "microphone" as const };
    const issue = ValidationNS.ruleCV11_inputModeTextTranscript(invalid);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("CV11");
  });

  it("T07.10 — CV12 détecte transcript non sanitizé", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    const unsanitized = { ...demo, is_sanitized: false };
    const issue = ValidationNS.ruleCV12_transcriptSanitized(unsanitized);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("CV12");
  });

  it("T07.11 — validateCloneVoiceReadinessReport retourne ok=true pour report par défaut", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    const validation = ValidationNS.validateCloneVoiceReadinessReport(report);
    expect(validation.ok).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it("T07.12 — validateCloneVoiceTranscriptDraft retourne ok=true pour démo", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    const validation = ValidationNS.validateCloneVoiceTranscriptDraft(demo);
    expect(validation.ok).toBe(true);
  });

  it("T07.13 — CV16 détecte inconsistance blocked_reasons/can_proceed", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceCommandDraft(COMPANY_ID);
    const inconsistent = {
      ...demo,
      blocked_reasons: ["Une raison de blocage"],
      can_proceed_to_cloneos: true, // Incohérent avec blocked_reasons non vide
    };
    const issue = ValidationNS.ruleCV16_blockedReasonConsistency(inconsistent);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("CV16");
  });

  it("T07.14 — CV18 avertit si cloneos_source n'est pas clonechat", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceCommandDraft(COMPANY_ID);
    const wrongSource = {
      ...demo,
      voice_metadata: { ...demo.voice_metadata, cloneos_source: "clonevoice" },
    };
    const issue = ValidationNS.ruleCV18_cloneosSourceIsCloneChat(wrongSource);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("CV18");
    expect(issue?.severity).toBe("warning");
  });

  it("T07.15 — CV19 détecte production_enabled=true dans snapshot", () => {
    const snapshot = DefaultsNS.buildEmptyCloneVoiceSnapshot();
    // On force la valeur pour tester
    const badSnapshot = { ...snapshot, production_enabled: true as unknown as false };
    const issue = ValidationNS.ruleCV19_snapshotProductionFalse(badSnapshot);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("CV19");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T08 — SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

describe("T08 — Snapshot", () => {
  it("T08.1 — buildCloneVoiceSnapshot depuis report produit production_enabled=false", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    const snapshot = SnapshotNS.buildCloneVoiceSnapshot(report);
    expect(snapshot.production_enabled).toBe(false);
    expect(snapshot.live_audio_ready).toBe(false);
  });

  it("T08.2 — buildCloneVoiceSnapshot est cohérent avec le report", () => {
    const report = DefaultsNS.buildDefaultCloneVoiceReadinessReport();
    const snapshot = SnapshotNS.buildCloneVoiceSnapshot(report);
    expect(snapshot.status).toBe(report.status);
    expect(snapshot.readiness_score).toBe(report.readiness_score);
    expect(snapshot.sandbox_possible).toBe(report.sandbox_possible);
  });

  it("T08.3 — diffCloneVoiceSnapshots détecte un changement de score", () => {
    const s1 = DefaultsNS.buildEmptyCloneVoiceSnapshot();
    const s2 = { ...s1, readiness_score: s1.readiness_score + 10 };
    const diff = SnapshotNS.diffCloneVoiceSnapshots(s1, s2);
    expect(diff.has_changes).toBe(true);
    expect(diff.readiness_score_changed).toBe(true);
    expect(diff.score_delta).toBe(10);
  });

  it("T08.4 — summarizeSnapshot retourne une chaîne non vide", () => {
    const snapshot = DefaultsNS.buildEmptyCloneVoiceSnapshot();
    const summary = SnapshotNS.summarizeSnapshot(snapshot);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain("Production");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T09 — STORAGE
// ─────────────────────────────────────────────────────────────────────────────

describe("T09 — Storage", () => {
  beforeEach(() => {
    StorageNS.clearCloneVoiceStore();
  });

  it("T09.1 — saveTranscriptDraft et getTranscriptDraft fonctionnent", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    StorageNS.saveTranscriptDraft(demo);
    const retrieved = StorageNS.getTranscriptDraft(demo.draft_id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.draft_id).toBe(demo.draft_id);
  });

  it("T09.2 — listTranscriptDrafts filtre par company_id", () => {
    const demo1 = DefaultsNS.buildDemoCloneVoiceTranscriptDraft("company_A");
    const demo2 = {
      ...DefaultsNS.buildDemoCloneVoiceTranscriptDraft("company_B"),
      draft_id: "demo_B_001",
    };
    StorageNS.saveTranscriptDraft(demo1);
    StorageNS.saveTranscriptDraft(demo2);
    const companyADrafts = StorageNS.listTranscriptDrafts("company_A");
    expect(companyADrafts.length).toBe(1);
    expect(companyADrafts[0].company_id).toBe("company_A");
  });

  it("T09.3 — clearCloneVoiceStore vide tout", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    StorageNS.saveTranscriptDraft(demo);
    StorageNS.clearCloneVoiceStore();
    expect(StorageNS.getTranscriptDraft(demo.draft_id)).toBeUndefined();
  });

  it("T09.4 — serializeTranscriptDraft redacte les tokens sensibles", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    const demoWithSecret = {
      ...demo,
      processing_notes: [...demo.processing_notes, "Token: sk_live_abc123xyz"],
    };
    const serialized = StorageNS.serializeTranscriptDraft(demoWithSecret);
    expect(serialized).not.toContain("sk_live_abc123xyz");
    expect(serialized).toContain("[REDACTED]");
  });

  it("T09.5 — getCloneVoiceStoreStats retourne des statistiques cohérentes", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceTranscriptDraft(COMPANY_ID);
    StorageNS.saveTranscriptDraft(demo);
    const stats = StorageNS.getCloneVoiceStoreStats();
    expect(stats.transcripts_count).toBe(1);
    expect(stats.commands_count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T10 — PIERRE BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

describe("T10 — Pierre Voice Bridge", () => {
  it("T10.1 — processPierreVoiceInput retourne ok=true pour texte valide", () => {
    const result = BridgeNS.processPierreVoiceInput({
      company_id: COMPANY_ID,
      text_input: "Préparer un contrat d'embauche pour le nouveau collaborateur.",
    });
    expect(result.ok).toBe(true);
    expect(result.transcript_draft).toBeDefined();
    expect(result.command_draft).toBeDefined();
  });

  it("T10.2 — processPierreVoiceInput retourne ok=false pour texte vide", () => {
    const result = BridgeNS.processPierreVoiceInput({
      company_id: COMPANY_ID,
      text_input: "",
    });
    expect(result.ok).toBe(false);
    expect(result.blocked_reasons.length).toBeGreaterThan(0);
  });

  it("T10.3 — command draft a cloneos_source='clonechat'", () => {
    const result = BridgeNS.processPierreVoiceInput({
      company_id: COMPANY_ID,
      text_input: "Envoyer une attestation de travail à l'employé.",
    });
    expect(result.ok).toBe(true);
    expect(result.command_draft?.voice_metadata.cloneos_source).toBe("clonechat");
  });

  it("T10.4 — buildPierreVoiceCommandSummary retourne voice_origin=true", () => {
    const demo = DefaultsNS.buildDemoCloneVoiceCommandDraft(COMPANY_ID);
    const summary = BridgeNS.buildPierreVoiceCommandSummary(demo);
    expect(summary.voice_origin).toBe(true);
    expect(summary.cloneos_source).toBe("clonechat");
  });

  it("T10.5 — canPierreUseCloneVoiceForIntent retourne true pour hr_request", () => {
    expect(BridgeNS.canPierreUseCloneVoiceForIntent("hr_request")).toBe(true);
  });

  it("T10.6 — canPierreUseCloneVoiceForIntent retourne false pour critical_action", () => {
    expect(BridgeNS.canPierreUseCloneVoiceForIntent("critical_action")).toBe(false);
  });

  it("T10.7 — getPierreSupportedVoiceIntents inclut hr_request et document_request", () => {
    const intents = BridgeNS.getPierreSupportedVoiceIntents();
    expect(intents).toContain("hr_request");
    expect(intents).toContain("document_request");
    expect(intents).not.toContain("critical_action");
  });

  it("T10.8 — buildPierreDemoVoiceTranscript retourne un transcript de démo valide", () => {
    const demo = BridgeNS.buildPierreDemoVoiceTranscript(COMPANY_ID);
    expect(demo.is_demo).toBe(true);
    expect(demo.company_id).toBe(COMPANY_ID);
    expect(demo.input_mode).toBe("text_transcript");
  });

  it("T10.9 — processPierreVoiceInput avec mission_id injecte la mission", () => {
    const result = BridgeNS.processPierreVoiceInput({
      company_id: COMPANY_ID,
      text_input: "Préparer le dossier d'intégration pour la nouvelle recrue.",
      mission_id: "mission_onboarding_001",
    });
    expect(result.ok).toBe(true);
    expect(result.command_draft?.voice_metadata.mission_id).toBe("mission_onboarding_001");
  });

  it("T10.10 — processPierreVoiceInput avec is_demo=true marque les drafts comme démo", () => {
    const result = BridgeNS.processPierreVoiceInput({
      company_id: COMPANY_ID,
      text_input: "Créer un contrat de démonstration.",
      is_demo: true,
    });
    expect(result.ok).toBe(true);
    expect(result.transcript_draft?.is_demo).toBe(true);
    expect(result.command_draft?.voice_metadata.is_demo).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T11 — INVARIANTS ABSOLUS
// ─────────────────────────────────────────────────────────────────────────────

describe("T11 — Invariants absolus CloneVoice", () => {
  it("T11.1 — production_enabled est toujours false dans le report par défaut", () => {
    const report = VoiceIndexNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.production_enabled).toBe(false);
  });

  it("T11.2 — production_enabled est toujours false dans l'évaluation", () => {
    const result = VoiceIndexNS.evaluateCloneVoiceReadiness({
      provider_status: "configured_live",
      security_review_done: true,
      privacy_review_done: true,
      legal_review_done: true,
    });
    expect(result.report.production_enabled).toBe(false);
    expect(result.can_production).toBe(false);
  });

  it("T11.3 — live_audio_ready est toujours false", () => {
    const report = VoiceIndexNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.live_audio_ready).toBe(false);
    expect(VoiceIndexNS.isLiveAudioReady()).toBe(false);
  });

  it("T11.4 — microphone_ready est toujours false", () => {
    const report = VoiceIndexNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.microphone_ready).toBe(false);
    expect(VoiceIndexNS.isMicrophoneReady()).toBe(false);
  });

  it("T11.5 — audio_storage_enabled est toujours false", () => {
    const report = VoiceIndexNS.buildDefaultCloneVoiceReadinessReport();
    expect(report.audio_storage_enabled).toBe(false);
  });

  it("T11.6 — validation du report par défaut passe toutes les règles CV01-CV10", () => {
    const report = VoiceIndexNS.buildDefaultCloneVoiceReadinessReport();
    const validation = VoiceIndexNS.validateCloneVoiceReadinessReport(report);
    expect(validation.ok).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it("T11.7 — audio_capture est bloqué par les guardrails", () => {
    expect(VoiceIndexNS.isActionBlockedByGuardrails("audio_capture")).toBe(true);
  });

  it("T11.8 — openai_api_call est bloqué par les guardrails", () => {
    expect(VoiceIndexNS.isActionBlockedByGuardrails("openai_api_call")).toBe(true);
  });

  it("T11.9 — anthropic_api_call est bloqué par les guardrails", () => {
    expect(VoiceIndexNS.isActionBlockedByGuardrails("anthropic_api_call")).toBe(true);
  });

  it("T11.10 — snapshot par défaut a production_enabled=false", () => {
    const snapshot = VoiceIndexNS.buildEmptyCloneVoiceSnapshot();
    expect(snapshot.production_enabled).toBe(false);
    expect(snapshot.live_audio_ready).toBe(false);
  });
});
