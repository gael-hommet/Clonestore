// src/lib/pierre/files/build-file-context.ts
// B34 — Builds Pierre-ready file context for downstream use. Pure, no async.

import type { CloneFileRecord, FileExtractionResult, FileClassificationResult, FileAttachDecision, HrFileCategory } from "../../cloneos/files/types";
import type { PierreFileContext } from "./types";

const HR_TAGS_BY_CATEGORY: Record<HrFileCategory, string[]> = {
  cv:                   ["recrutement", "candidat", "cv"],
  contract:             ["contrat", "juridique", "embauche"],
  amendment:            ["avenant", "modification-contrat"],
  absence_proof:        ["absence", "justificatif"],
  sick_leave:           ["arret-maladie", "santé", "rgpd-sensible"],
  identity_document:    ["identité", "rgpd-sensible"],
  certificate:          ["attestation", "justificatif"],
  policy:               ["politique-rh", "règlement"],
  procedure:            ["procédure", "process-rh"],
  job_description:      ["fiche-poste", "recrutement"],
  interview_report:     ["entretien", "évaluation"],
  training_document:    ["formation", "habilitation"],
  payroll_export:       ["paie", "confidentiel"],
  payroll_variable:     ["paie", "variables", "confidentiel"],
  onboarding_document:  ["onboarding", "intégration"],
  offboarding_document: ["départ", "offboarding"],
  employee_file:        ["dossier-salarié", "confidentiel"],
  legal_sensitive:      ["juridique", "disciplinaire", "rgpd-sensible"],
  other:                ["document-rh"],
};

function buildHrTags(category: HrFileCategory, riskLevel: string): string[] {
  const base = HR_TAGS_BY_CATEGORY[category] ?? ["document-rh"];
  if (riskLevel === "sensitive" || riskLevel === "blocked") return [...base, "validation-requise"];
  return base;
}

function buildSummary(file: CloneFileRecord, classification: FileClassificationResult | null): string {
  const category = classification?.category ?? file.category;
  const risk = classification?.risk_level ?? file.risk_level;
  const sizeKb = Math.round(file.size_bytes / 1024);
  const confidence = classification ? `(confiance: ${Math.round(classification.confidence * 100)}%)` : "";
  return `${file.kind.toUpperCase()} — "${file.safe_filename}" (${sizeKb} Ko) — catégorie: ${category} ${confidence} — risque: ${risk}`;
}

function buildRiskSummary(classification: FileClassificationResult | null, riskLevel: string): string {
  if (riskLevel === "sensitive") return "SENSIBLE — validation humaine obligatoire avant tout traitement.";
  if (riskLevel === "blocked") return "BLOQUÉ — document interdit ou dangereux.";
  if (riskLevel === "high") return "RISQUE ÉLEVÉ — vérification recommandée.";
  if (riskLevel === "medium") return "Risque modéré — traitement normal autorisé.";
  return "Risque faible — traitement automatique possible.";
}

export function buildPierreFileContext(
  fileRecord: CloneFileRecord,
  extractionResult: FileExtractionResult | null,
  classification: FileClassificationResult | null = null,
  attachDecision: FileAttachDecision | null = null,
): PierreFileContext {
  const riskLevel = classification?.risk_level ?? fileRecord.risk_level;
  const requires_validation =
    riskLevel === "sensitive" ||
    riskLevel === "blocked" ||
    (attachDecision?.approval_required ?? false);

  return {
    file: fileRecord,
    extraction: extractionResult,
    classification,
    attach_decision: attachDecision,
    summary: buildSummary(fileRecord, classification),
    hr_tags: buildHrTags(classification?.category ?? fileRecord.category, riskLevel),
    requires_validation,
    risk_summary: buildRiskSummary(classification, riskLevel),
  };
}
