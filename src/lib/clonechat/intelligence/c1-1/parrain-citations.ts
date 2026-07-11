// src/lib/clonechat/intelligence/c1-1/parrain-citations.ts
// C1.1 — Citations : ÉTEND le pipeline P9.4.1 (validateCitations) sans le remplacer.
// Une citation ne peut référencer QUE les chunks réellement fournis au modèle ; toute
// citation inconnue est supprimée côté serveur. Les étiquettes restent discrètes
// (jamais de chemin de fichier / table / hash pour un client normal).

import { validateCitations } from "../../knowledge";
import type { KnowledgeChunk } from "../../knowledge/types";
import { stripInternalPathsForViewer } from "./parrain-visibility";
import type { ParrainKnowledgeChunk, ParrainViewerMode } from "./parrain-types";

export interface ParrainCitationResult {
  readonly valid: readonly string[];
  readonly labels: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Valide les citations contre le contexte RÉELLEMENT fourni (P9.4.1 + chunks Parrain).
 * validateCitations ne connaît que les chunks legacy pour les labels — on complète
 * les labels des chunks Parrain ici, avec la même règle stricte d'appartenance.
 */
export function validateParrainCitations(
  ids: readonly string[],
  contextChunks: readonly ParrainKnowledgeChunk[],
  viewerMode: ParrainViewerMode,
): ParrainCitationResult {
  const asLegacy: readonly KnowledgeChunk[] = contextChunks; // superset structurel
  const base = validateCitations(ids, asLegacy);
  const byId = new Map(contextChunks.map((c) => [c.id, c]));
  const labels: string[] = [];
  for (const id of base.valid) {
    const chunk = byId.get(id);
    const label = chunk ? stripInternalPathsForViewer(chunk.citationLabel, viewerMode) : null;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return Object.freeze({
    valid: Object.freeze(base.valid),
    labels: Object.freeze(labels.slice(0, 5)),
    removed: Object.freeze(base.malformed),
  });
}

/** Une affirmation importante sans source doit être omise ou qualifiée — aide serveur. */
export function qualifyUnsupported(answer: string, hasCitations: boolean, staleSources: readonly string[]): string {
  let out = answer;
  if (!hasCitations) {
    out += " (Réponse d'orientation générale — pour un point précis, je peux citer la page ou le document exact.)";
  }
  if (staleSources.length > 0) {
    out += " (Certaines informations proviennent d'un index en cours de rafraîchissement — je préfère le signaler.)";
  }
  return out;
}
