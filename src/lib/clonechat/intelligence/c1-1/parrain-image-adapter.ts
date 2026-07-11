// src/lib/clonechat/intelligence/c1-1/parrain-image-adapter.ts
// C1.1 — Adaptateur images : RÉUTILISE le pipeline multimodal P9.4.2 existant
// (sanitizeImages → prepareImagesForModel/sharp → analyzeScreenshotReal). AUCUNE
// seconde pile OpenAI. Ce module ne fait que relier une analyse visuelle honnête au
// tour Parrain (chunk de session + trace d'attachement image_only, tenant-scopé).

import type { ParrainKnowledgeChunk } from "./parrain-types";
import { derivedChunkId, makeParrainChunk } from "./parrain-knowledge-chunk";

/** Forme de l'analyse structurée du pipeline visuel existant (P9.4). */
export interface ExistingScreenshotAnalysis {
  readonly summary: string;
  readonly visibly_proven: readonly string[];
  readonly inference: readonly string[];
  readonly unknown: readonly string[];
  readonly known_issue: string | null;
  readonly next_action: string | null;
}

/** Convertit une analyse visuelle réelle en chunk de session (jamais de texte inventé). */
export function imageAnalysisChunk(
  analysis: ExistingScreenshotAnalysis,
  companyId: string,
  filename: string | null,
): ParrainKnowledgeChunk {
  const text =
    `Analyse visuelle de ${filename ?? "la capture"} — ce qui est VISIBLE : ${analysis.visibly_proven.join(" ; ") || "rien de probant"}. ` +
    (analysis.inference.length ? `Hypothèses (non prouvées) : ${analysis.inference.join(" ; ")}. ` : "") +
    (analysis.unknown.length ? `Non déterminable depuis l'image : ${analysis.unknown.join(" ; ")}. ` : "") +
    "Aucun texte invisible n'a été lu ; l'analyse porte uniquement sur ce que montre l'image.";
  return makeParrainChunk({
    id: derivedChunkId("img", `${companyId}|${analysis.summary.slice(0, 60)}`),
    sourceId: "src.uploaded_documents",
    title: filename ? `Image « ${filename} »` : "Capture d'écran",
    text,
    sourceType: "uploaded_document",
    authority: "uploaded_user_content",
    visibility: "COMPANY_SCOPED",
    tenantCompanyId: companyId,
    citationLabel: filename ? `votre image « ${filename} »` : "votre capture d'écran",
  });
}

/** Rappel de doctrine (testé) : le chemin image reste l'existant, avec ses gardes. */
export const IMAGE_PIPELINE_DOCTRINE = Object.freeze({
  reusesExistingPipeline: true,
  entrypoints: ["sanitizeImages", "prepareImagesForModel", "analyzeScreenshotReal"],
  guarantees: [
    "authentification + flag avant tout traitement",
    "validation MIME + limites de taille",
    "transformation pixel OBLIGATOIRE (sharp) — jamais l'originale vers le modèle",
    "métadonnées EXIF retirées",
    "budget réservé avant l'appel modèle",
    "aucun secret loggé",
  ],
});
