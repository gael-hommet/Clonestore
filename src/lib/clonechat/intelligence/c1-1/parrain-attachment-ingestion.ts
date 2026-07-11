// src/lib/clonechat/intelligence/c1-1/parrain-attachment-ingestion.ts
// C1.1 — Ingestion de pièces jointes : politique fail-closed → parseur réel → chunks
// avec provenance (page/feuille/section), le tout TENANT-SCOPÉ. Le sha256 identifie le
// fichier ; l'échec de parsing reste honnête ; le contenu envoyé au modèle est borné
// (résumé au-delà, lignes exactes récupérables via les chunks).

import { contentHash } from "../../knowledge/types";
import { ATTACHMENT_LIMITS, evaluateAttachmentPolicy, redactedAttachmentError } from "./parrain-attachment-policy";
import { parseByFormat } from "./parrain-file-parsers";
import { ATTACHMENT_SUPPORT_MATRIX, type AttachmentIngestionInput, type AttachmentIngestionResult, type ParrainAttachment, type ParrainAttachmentChunk } from "./parrain-attachment-types";
import { derivedChunkId, makeParrainChunk } from "./parrain-knowledge-chunk";
import type { ParrainKnowledgeChunk } from "./parrain-types";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    return "sha256_unavailable";
  }
}

/** Ingestion complète d'UNE pièce jointe (le companyId vient du serveur). */
export async function ingestAttachment(input: AttachmentIngestionInput): Promise<AttachmentIngestionResult> {
  const decision = evaluateAttachmentPolicy(input.filename, input.declaredMime, input.bytes);
  const sha256 = await sha256Hex(input.bytes);
  const attachmentId = `att_${sha256.slice(0, 16)}`;

  const base: Omit<ParrainAttachment, "supportStatus" | "pageCount" | "sheetCount" | "extractedTextLength" | "parserVersion" | "warnings"> = {
    attachmentId,
    companyId: input.companyId,
    conversationId: input.conversationId,
    uploadedBy: input.uploadedBy,
    filename: input.filename.slice(0, 180),
    declaredMime: input.declaredMime,
    detectedMime: decision.detectedMime,
    sizeBytes: input.bytes.length,
    sha256,
    format: decision.format,
    sanitized: true,
    createdAt: input.at,
  };

  if (!decision.accepted) {
    const status = decision.quarantined ? "manual_review_required" : ATTACHMENT_SUPPORT_MATRIX[decision.format]?.expected === "unsupported" || decision.format === "unknown" || decision.format === "pptx" ? "unsupported" : "parse_failed";
    return Object.freeze({
      attachment: Object.freeze({ ...base, supportStatus: status, pageCount: null, sheetCount: null, extractedTextLength: 0, parserVersion: "none", warnings: [decision.reason ?? "Refusé par la politique."] }),
      chunks: [],
      honestSummary: redactedAttachmentError(decision.reason ?? "fichier refusé."),
    });
  }

  const outcome = await parseByFormat(decision.format, input.bytes);
  const chunks: ParrainAttachmentChunk[] = outcome.chunks.slice(0, ATTACHMENT_LIMITS.maxChunksPerAttachment).map((c) => ({
    attachmentId,
    ref: c.ref,
    text: c.text,
    table: c.table,
    contentHash: contentHash(c.text),
    citationLabel: `votre fichier « ${base.filename} » (${c.ref})`,
    visibility: "COMPANY_SCOPED" as const,
    extractionConfidence: c.confidence,
  }));
  const extractedTextLength = chunks.reduce((acc, c) => acc + c.text.length, 0);

  const attachment: ParrainAttachment = Object.freeze({
    ...base,
    supportStatus: outcome.supportStatus,
    pageCount: outcome.pageCount,
    sheetCount: outcome.sheetCount,
    extractedTextLength,
    parserVersion: outcome.parserVersion,
    warnings: outcome.warnings,
  });

  const honestSummary =
    outcome.supportStatus === "parse_failed"
      ? redactedAttachmentError(outcome.warnings[0] ?? "extraction impossible.")
      : outcome.supportStatus === "unsupported"
        ? redactedAttachmentError("format non pris en charge.")
        : outcome.supportStatus === "image_only"
          ? `« ${base.filename} » : contenu visuel — analysé par le pipeline d'images sanitisé (jamais de texte invisible prétendu lu).`
          : `« ${base.filename} » : ${chunks.length} extrait(s) avec provenance (${outcome.supportStatus === "structured_partial" ? `${outcome.sheetCount ?? 0} feuille(s), valeurs affichées uniquement` : outcome.pageCount ? `${outcome.pageCount} page(s)` : "texte"}).${outcome.warnings.length ? ` Notes : ${outcome.warnings.join(" ")}` : ""}`;

  return Object.freeze({ attachment, chunks, honestSummary });
}

/** Convertit les chunks d'attachement en chunks de grounding (BORNÉS avant modèle). */
export function attachmentGroundingChunks(result: AttachmentIngestionResult): readonly ParrainKnowledgeChunk[] {
  let budget = ATTACHMENT_LIMITS.maxModelCharsPerAttachment;
  const out: ParrainKnowledgeChunk[] = [];
  for (const c of result.chunks) {
    if (budget <= 0) break;
    const text = c.text.slice(0, Math.min(c.text.length, budget));
    budget -= text.length;
    out.push(
      makeParrainChunk({
        id: derivedChunkId("att", `${result.attachment.companyId}|${c.attachmentId}|${c.ref}`),
        sourceId: "src.uploaded_documents",
        title: `${result.attachment.filename} — ${c.ref}`,
        text: `[${c.ref}] ${text}`,
        sourceType: "uploaded_document",
        authority: "uploaded_user_content",
        visibility: "COMPANY_SCOPED",
        tenantCompanyId: result.attachment.companyId,
        citationLabel: c.citationLabel,
        freshness: "CURRENT",
      }),
    );
  }
  if (result.chunks.length > out.length) {
    out.push(
      makeParrainChunk({
        id: derivedChunkId("att", `${result.attachment.companyId}|${result.attachment.attachmentId}|overflow`),
        sourceId: "src.uploaded_documents",
        title: `${result.attachment.filename} — au-delà du budget`,
        text: `Le fichier contient ${result.chunks.length} extraits ; seuls les premiers sont fournis ici (budget). Les extraits restants sont référencés (${result.chunks.slice(out.length).map((c) => c.ref).slice(0, 6).join(", ")}…) et peuvent être demandés précisément.`,
        sourceType: "uploaded_document",
        authority: "uploaded_user_content",
        visibility: "COMPANY_SCOPED",
        tenantCompanyId: result.attachment.companyId,
        citationLabel: `votre fichier « ${result.attachment.filename} »`,
      }),
    );
  }
  return out;
}
