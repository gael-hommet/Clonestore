// src/lib/clonechat/intelligence/c1-1/parrain-knowledge-index.ts
// C1.1 — Index de connaissance UNIFIÉ et BORNÉ. Combine : site vivant · capacités Pierre
// dérivées de HR_CAPABILITIES · registres T1/T2 · pricing canonique · vérité produit ·
// roadmap/readiness · chunks de session tenant (compte/documents/pièces jointes) ·
// symboles de code (fondateur seul).
//
// Invariants durs :
//  - la VISIBILITÉ est appliquée AVANT toute récupération (fail-closed) ;
//  - autorité et fraîcheur sont portées par chaque chunk et pilotent le classement ;
//  - JAMAIS toutes les capacités ni toute l'entreprise vers le modèle (top-k + budget) ;
//  - readiness interne et code : uniquement en mode fondateur.

import { filterVisibleChunks } from "./parrain-visibility";
import { retrieveParrainChunks, type RetrievalOptions } from "./parrain-retrieval";
import { collectCandidateChunks } from "./parrain-source-adapters";
import { readinessFounderChunk } from "./parrain-roadmap-index";
import { canonicalCapabilityCount, retrieveCapabilities } from "./parrain-pierre-index";
import { technologyCounts } from "./parrain-technology-index";
import { codeSymbolChunks, type ParrainCodeSymbol } from "./parrain-code-index";
import type {
  ParrainKnowledgeChunk,
  ParrainRetrievalResult,
  ParrainViewerContext,
} from "./parrain-types";

/** Bornes DURES du corpus envoyé au modèle (jamais de dump). */
export const KNOWLEDGE_INDEX_BOUNDS = Object.freeze({
  maxChunks: 10,
  maxChars: 3400,
  maxCapabilitiesRetrieved: 5,
  maxCodeSymbols: 5,
});

export interface KnowledgeIndexInput {
  readonly question: string;
  readonly viewer: ParrainViewerContext;
  /** Chunks de session déjà tenant-scopés (compte, documents, pièces jointes, image). */
  readonly sessionChunks?: readonly ParrainKnowledgeChunk[];
  /** Symboles de code — ignorés hors mode fondateur (défense en profondeur). */
  readonly codeSymbols?: readonly ParrainCodeSymbol[];
}

export interface KnowledgeIndexStats {
  readonly candidateCount: number;
  readonly visibleCount: number;
  readonly capabilityCount: number;
  readonly t1Count: number;
  readonly t2Count: number;
  readonly founderChunksIncluded: number;
  readonly sessionChunksIncluded: number;
}

export interface KnowledgeIndexBuild {
  readonly candidates: readonly ParrainKnowledgeChunk[];
  readonly visible: readonly ParrainKnowledgeChunk[];
  readonly stats: KnowledgeIndexStats;
}

/**
 * Construit le corpus candidat pour un tour, PUIS applique la visibilité.
 * Le corpus « visible » est le seul qui puisse atteindre la récupération/le modèle.
 */
export function buildKnowledgeIndex(input: KnowledgeIndexInput): KnowledgeIndexBuild {
  const isFounder = input.viewer.mode === "founder";

  // Chunks de session : jamais en mode public (défense en profondeur — la visibilité
  // les rejetterait de toute façon, mais on ne les collecte même pas).
  // C1.7 — En mode PUBLIC, le contexte de session était intégralement jeté : c'était la dernière
  // porte qui empêchait un visiteur d'analyser SON PROPRE fichier. On l'ouvre — mais STRICTEMENT
  // aux extraits ÉPHÉMÈRES SANS TENANT. Tout ce qui porte une entreprise reste exclu du public
  // (fail-closed), et la garde de visibilité en aval reste l'autorité finale.
  const sessionChunks =
    input.viewer.mode === "public"
      ? (input.sessionChunks ?? []).filter(
          (c) => c.parrainVisibility === "SESSION_EPHEMERAL" && c.tenantCompanyId === null,
        )
      : (input.sessionChunks ?? []);

  // Readiness brute + symboles de code : FONDATEUR uniquement, à la source.
  const founderChunks: ParrainKnowledgeChunk[] = [];
  if (isFounder) {
    founderChunks.push(readinessFounderChunk());
    if (input.codeSymbols && input.codeSymbols.length > 0) {
      founderChunks.push(...codeSymbolChunks(input.codeSymbols.slice(0, KNOWLEDGE_INDEX_BOUNDS.maxCodeSymbols)));
    }
  }

  const candidates = [
    ...collectCandidateChunks({ question: input.question, sessionChunks }),
    ...founderChunks,
  ];

  // ── PORTE DE VISIBILITÉ — avant tout scoring, toute récupération, tout modèle ──
  const visible = filterVisibleChunks(candidates, input.viewer);

  const counts = technologyCounts();
  return Object.freeze({
    candidates: Object.freeze(candidates),
    visible: Object.freeze(visible),
    stats: Object.freeze({
      candidateCount: candidates.length,
      visibleCount: visible.length,
      capabilityCount: canonicalCapabilityCount(),
      t1Count: counts.t1,
      t2Count: counts.t2,
      founderChunksIncluded: founderChunks.length,
      sessionChunksIncluded: sessionChunks.length,
    }),
  });
}

/**
 * Recherche BORNÉE dans l'index : visibilité → pertinence pondérée par l'autorité →
 * budget caractères. C'est l'API utilisée par le grounding / le turn runtime.
 */
export function searchKnowledgeIndex(
  input: KnowledgeIndexInput,
  opts?: RetrievalOptions,
): { readonly build: KnowledgeIndexBuild; readonly retrieval: ParrainRetrievalResult } {
  const build = buildKnowledgeIndex(input);
  const retrieval = retrieveParrainChunks(input.question, build.candidates, input.viewer, {
    limit: Math.min(opts?.limit ?? KNOWLEDGE_INDEX_BOUNDS.maxChunks, KNOWLEDGE_INDEX_BOUNDS.maxChunks),
    maxChars: Math.min(opts?.maxChars ?? KNOWLEDGE_INDEX_BOUNDS.maxChars, KNOWLEDGE_INDEX_BOUNDS.maxChars),
    referencedIds: opts?.referencedIds,
  });
  return { build, retrieval };
}

/** Capacités pertinentes (top-k borné) — jamais le canon entier. */
export function boundedCapabilitiesFor(question: string) {
  return retrieveCapabilities(question, { limit: KNOWLEDGE_INDEX_BOUNDS.maxCapabilitiesRetrieved });
}

/** Le corpus visible contient-il une source d'un type interdit pour ce viewer ? (test de garde) */
export function indexLeaksForbiddenSources(build: KnowledgeIndexBuild, viewer: ParrainViewerContext): boolean {
  return build.visible.some((c) => {
    if (c.parrainVisibility === "RESTRICTED_SECRET") return true;
    // Une pièce jointe éphémère vit dans le CONTEXTE DE SESSION, jamais dans l'index canonique :
    // l'y trouver signifierait une contamination de l'index — fail-closed.
    if (c.parrainVisibility === "SESSION_EPHEMERAL") return true;
    if (viewer.mode === "public" && c.parrainVisibility !== "PUBLIC") return true;
    if (viewer.mode === "client" && c.parrainVisibility === "FOUNDER_INTERNAL") return true;
    if (c.tenantCompanyId !== null && c.tenantCompanyId !== viewer.companyId) return true;
    return false;
  });
}
