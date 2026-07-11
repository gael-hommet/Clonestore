// src/lib/clonechat/intelligence/c1-1/parrain-grounding.ts
// C1.1 — Grounding : construit le prompt système Parrain BORNÉ à partir de l'index de
// connaissance unifié. Le modèle ne voit QUE des chunks visibles pour le viewer (la porte
// de visibilité s'applique dans l'index, AVANT la récupération). Les règles d'honnêteté
// sont absolues : « préparé » ≠ « envoyé », « chemin manuel » ≠ « intégration live »,
// « architecture prête » ≠ « opérationnel », « correctif candidat » ≠ « résolu ».

import { searchKnowledgeIndex } from "./parrain-knowledge-index";
import type { RetrievalOptions } from "./parrain-retrieval";
import { buildParrainSystemPrompt } from "./parrain-system-prompt";
import type { ParrainCodeSymbol } from "./parrain-code-index";
import type { ParrainKnowledgeChunk, ParrainRetrievalResult, ParrainViewerContext } from "./parrain-types";

export interface ParrainGroundedPrompt {
  readonly system: string;
  readonly contextChunks: readonly ParrainKnowledgeChunk[];
  readonly retrieval: ParrainRetrievalResult;
}

export interface GroundingInput {
  readonly question: string;
  readonly viewer: ParrainViewerContext;
  /** Chunks de session (compte, pièces jointes, lineage, image) déjà tenant-scopés. */
  readonly sessionChunks?: readonly ParrainKnowledgeChunk[];
  /** Symboles de code — ignorés hors mode fondateur (l'index les filtre à la source). */
  readonly codeSymbols?: readonly ParrainCodeSymbol[];
  readonly retrieval?: RetrievalOptions;
}

/** Point d'entrée grounding : index (visibilité) → récupération bornée → prompt. */
export function buildParrainGroundedPrompt(input: GroundingInput): ParrainGroundedPrompt {
  const { retrieval } = searchKnowledgeIndex(
    {
      question: input.question,
      viewer: input.viewer,
      sessionChunks: input.sessionChunks,
      codeSymbols: input.codeSymbols,
    },
    input.retrieval,
  );
  const contextChunks = retrieval.selected.map((s) => s.chunk);
  const system = buildParrainSystemPrompt({
    viewer: input.viewer,
    contextChunks,
    staleSourceIds: retrieval.staleSourceIds,
    conflicts: retrieval.conflicts,
  });
  return Object.freeze({ system, contextChunks, retrieval });
}
