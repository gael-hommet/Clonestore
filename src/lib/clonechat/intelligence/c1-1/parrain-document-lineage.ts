// src/lib/clonechat/intelligence/c1-1/parrain-document-lineage.ts
// C1.1 — Lineage documentaire : expliquer un document généré par Pierre avec ses
// PREUVES RÉELLES (mission, tâche, instruction, gabarit, règles, décisions de garde,
// validations, trace). Règle dure : si l'origine exacte d'une phrase ne peut pas être
// prouvée, on dit ce qui existe, ce qui manque, et que l'origine ne peut pas être
// confirmée. JAMAIS de provenance fabriquée.

import { c1TokenSimilarity } from "../c1/clonechat-knowledge-types";
import { derivedChunkId, makeParrainChunk } from "./parrain-knowledge-chunk";
import type { ParrainKnowledgeChunk, ParrainViewerContext } from "./parrain-types";
import { assertOwnEntity } from "./parrain-account-context";

export interface ParrainDocumentLineage {
  readonly artifactId: string;
  readonly companyId: string;
  readonly documentType: string;
  readonly version: number | null;
  readonly generatedAt: string | null;
  readonly missionId: string | null;
  readonly taskId: string | null;
  readonly originatingInstruction: string | null;
  readonly capabilityIds: readonly string[];
  readonly templateRefs: readonly string[];
  readonly sourceDocumentRefs: readonly string[];
  readonly companyRuleRefs: readonly string[];
  readonly employeeDataRefs: readonly string[];
  readonly guardDecisionRefs: readonly string[];
  readonly validationRefs: readonly string[];
  readonly traceRefs: readonly string[];
  readonly knownTransformations: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly explanationConfidence: "high" | "medium" | "low";
}

/** Port lecture-seule vers les preuves réelles (V1/trace) — tenant obligatoire. */
export interface ParrainLineagePort {
  readArtifact(companyId: string, artifactId: string): Promise<{
    readonly artifactId: string;
    readonly companyId: string;
    readonly documentType: string;
    readonly version: number | null;
    readonly generatedAt: string | null;
    readonly missionId: string | null;
    readonly taskId: string | null;
    readonly content: string | null;
  } | null>;
  readMissionInstruction(companyId: string, missionId: string): Promise<string | null>;
  listTraceRefs(companyId: string, artifactId: string): Promise<readonly string[]>;
  listValidationRefs(companyId: string, missionId: string): Promise<readonly string[]>;
  listSourcePassages(companyId: string, artifactId: string): Promise<readonly { readonly ref: string; readonly text: string; readonly kind: "template" | "source_document" | "company_rule" | "employee_data" }[]>;
}

const EVIDENCE_FIELDS: readonly (keyof Pick<
  ParrainDocumentLineage,
  "missionId" | "originatingInstruction" | "templateRefs" | "sourceDocumentRefs" | "validationRefs" | "traceRefs"
>)[] = ["missionId", "originatingInstruction", "templateRefs", "sourceDocumentRefs", "validationRefs", "traceRefs"];

/** Assemble le lineage RÉEL — chaque preuve absente est déclarée manquante. */
export async function buildDocumentLineage(
  port: ParrainLineagePort,
  viewer: ParrainViewerContext,
  artifactId: string,
): Promise<ParrainDocumentLineage | null> {
  const companyId = viewer.companyId;
  if (!companyId) return null;
  const artifact = await port.readArtifact(companyId, artifactId).catch(() => null);
  if (!artifact) return null;
  if (!assertOwnEntity(artifact.companyId, viewer)) return null; // ID étranger → refus

  const missionId = artifact.missionId;
  const [instruction, traceRefs, validationRefs, passages] = await Promise.all([
    missionId ? port.readMissionInstruction(companyId, missionId).catch(() => null) : Promise.resolve(null),
    port.listTraceRefs(companyId, artifactId).catch(() => [] as readonly string[]),
    missionId ? port.listValidationRefs(companyId, missionId).catch(() => [] as readonly string[]) : Promise.resolve([] as readonly string[]),
    port.listSourcePassages(companyId, artifactId).catch(() => [] as readonly { ref: string; text: string; kind: "template" | "source_document" | "company_rule" | "employee_data" }[]),
  ]);

  const templateRefs = passages.filter((p) => p.kind === "template").map((p) => p.ref);
  const sourceDocumentRefs = passages.filter((p) => p.kind === "source_document").map((p) => p.ref);
  const companyRuleRefs = passages.filter((p) => p.kind === "company_rule").map((p) => p.ref);
  const employeeDataRefs = passages.filter((p) => p.kind === "employee_data").map((p) => p.ref);

  const lineage: ParrainDocumentLineage = {
    artifactId: artifact.artifactId,
    companyId,
    documentType: artifact.documentType,
    version: artifact.version,
    generatedAt: artifact.generatedAt,
    missionId,
    taskId: artifact.taskId,
    originatingInstruction: instruction,
    capabilityIds: [],
    templateRefs,
    sourceDocumentRefs,
    companyRuleRefs,
    employeeDataRefs,
    guardDecisionRefs: [],
    validationRefs,
    traceRefs,
    knownTransformations: [],
    missingEvidence: [],
    explanationConfidence: "low",
  };

  const missing: string[] = [];
  if (!missionId) missing.push("mission d'origine");
  if (!instruction) missing.push("instruction utilisateur d'origine");
  if (templateRefs.length === 0) missing.push("gabarit source");
  if (sourceDocumentRefs.length === 0 && employeeDataRefs.length === 0) missing.push("passages sources (documents/données salarié)");
  if (validationRefs.length === 0) missing.push("références de validation");
  if (traceRefs.length === 0) missing.push("événements de trace");

  const present = EVIDENCE_FIELDS.filter((f) => {
    const v = lineage[f];
    return Array.isArray(v) ? v.length > 0 : v !== null;
  }).length;
  const confidence: ParrainDocumentLineage["explanationConfidence"] = present >= 5 ? "high" : present >= 3 ? "medium" : "low";

  return Object.freeze({ ...lineage, missingEvidence: Object.freeze(missing), explanationConfidence: confidence });
}

// ── Explication au niveau de la PHRASE ────────────────────────────────────────
export interface SentenceExplanation {
  readonly sentence: string;
  readonly matches: readonly { readonly ref: string; readonly kind: string; readonly excerpt: string; readonly similarity: number }[];
  readonly confidence: "high" | "medium" | "low" | "none";
  readonly honestNote: string;
}

/**
 * Rapproche une phrase sélectionnée des passages sources RÉELS. Sans correspondance
 * probante : on le dit — l'origine exacte ne peut pas être confirmée.
 */
export function explainSentence(
  sentence: string,
  passages: readonly { readonly ref: string; readonly text: string; readonly kind: string }[],
): SentenceExplanation {
  const scored = passages
    .map((p) => ({ ref: p.ref, kind: p.kind, excerpt: p.text.slice(0, 200), similarity: c1TokenSimilarity(sentence, p.text) }))
    .filter((m) => m.similarity >= 0.25)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
  const best = scored[0]?.similarity ?? 0;
  const confidence: SentenceExplanation["confidence"] = best >= 0.6 ? "high" : best >= 0.4 ? "medium" : best > 0 ? "low" : "none";
  return Object.freeze({
    sentence,
    matches: Object.freeze(scored),
    confidence,
    honestNote:
      scored.length === 0
        ? "Aucun passage source ne correspond suffisamment : l'origine exacte de cette phrase ne peut pas être confirmée avec les preuves disponibles."
        : confidence === "low"
          ? "Correspondance faible : origine probable mais non confirmée."
          : "Correspondance appuyée sur les passages sources listés.",
  });
}

/** Chunk lineage (COMPANY_SCOPED) pour le grounding d'une explication documentaire. */
export function lineageChunk(lineage: ParrainDocumentLineage): ParrainKnowledgeChunk {
  const facts = [
    `Document ${lineage.documentType}${lineage.version ? ` v${lineage.version}` : ""}`,
    lineage.missionId ? `issu de la mission ${lineage.missionId}` : "mission d'origine inconnue",
    lineage.originatingInstruction ? `instruction d'origine : « ${lineage.originatingInstruction.slice(0, 140)} »` : null,
    lineage.validationRefs.length ? `${lineage.validationRefs.length} validation(s) tracée(s)` : null,
    lineage.traceRefs.length ? `${lineage.traceRefs.length} événement(s) de trace` : null,
    lineage.missingEvidence.length ? `PREUVES MANQUANTES : ${lineage.missingEvidence.join(", ")}` : "preuves complètes",
    `confiance d'explication : ${lineage.explanationConfidence}`,
  ].filter(Boolean);
  return makeParrainChunk({
    id: derivedChunkId("lineage", `${lineage.companyId}|${lineage.artifactId}`),
    sourceId: "src.generated_documents",
    title: `Provenance du document ${lineage.artifactId}`,
    text: facts.join(". ") + ".",
    sourceType: "generated_document",
    authority: "tenant_data",
    visibility: "COMPANY_SCOPED",
    tenantCompanyId: lineage.companyId,
    citationLabel: "le document de Pierre",
  });
}
