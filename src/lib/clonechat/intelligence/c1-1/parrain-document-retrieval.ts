// src/lib/clonechat/intelligence/c1-1/parrain-document-retrieval.ts
// C1.1 — Récupération documentaire : localise les extraits pertinents parmi les pièces
// jointes ingérées et les documents générés (lineage), avec provenance exacte. Le
// fichier/artefact explicitement référencé est TOUJOURS prioritaire (referencedIds).

import { parrainNormalize, type ParrainKnowledgeChunk } from "./parrain-types";
import type { AttachmentIngestionResult, ParrainAttachmentChunk } from "./parrain-attachment-types";

export interface DocumentRetrievalHit {
  readonly attachmentId: string;
  readonly ref: string;
  readonly excerpt: string;
  readonly score: number;
}

/** Recherche bornée dans les extraits d'une pièce jointe (lignes/pages exactes). */
export function searchAttachmentChunks(
  question: string,
  chunks: readonly ParrainAttachmentChunk[],
  limit = 4,
): readonly DocumentRetrievalHit[] {
  const q = parrainNormalize(question);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return chunks
    .map((c) => {
      const hay = parrainNormalize(c.text);
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      return { attachmentId: c.attachmentId, ref: c.ref, excerpt: c.text.slice(0, 240), score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Ids référencés pour le boost de récupération (fichier cité par nom, artefact par id). */
export function resolveReferencedIds(
  question: string,
  attachments: readonly AttachmentIngestionResult[],
): readonly string[] {
  const q = parrainNormalize(question);
  const ids: string[] = [];
  for (const a of attachments) {
    const name = parrainNormalize(a.attachment.filename.replace(/\.[a-z0-9]+$/i, ""));
    if (name.length > 2 && q.includes(name)) ids.push(a.attachment.attachmentId);
  }
  const artifactRef = question.match(/\b(art|doc|artifact)[-_][a-z0-9-]{4,}\b/i);
  if (artifactRef) ids.push(artifactRef[0]);
  return ids;
}

/** Sélectionne les chunks de session documentaires pertinents (bornés). */
export function pickDocumentSessionChunks(
  question: string,
  candidates: readonly ParrainKnowledgeChunk[],
  limit = 6,
): readonly ParrainKnowledgeChunk[] {
  const q = parrainNormalize(question);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return candidates
    .map((c) => {
      const hay = parrainNormalize(`${c.title} ${c.text}`);
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
