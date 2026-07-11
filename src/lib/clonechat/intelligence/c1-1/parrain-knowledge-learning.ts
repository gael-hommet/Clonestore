// src/lib/clonechat/intelligence/c1-1/parrain-knowledge-learning.ts
// C1.1 — Apprentissage de connaissance : CloneChat s'améliore SANS réécrire sa vérité.
// Chaque candidat porte preuves, sources, portée, confiance, contrôle de contradiction
// et exigence d'approbation. Mutation globale = approbation fondateur/admin obligatoire ;
// l'apprentissage de compte reste dans le compte ; le canonique n'est remplacé que par
// du canonique plus récent.

import { checkAnswerTextSafety } from "../c1/clonechat-claims-policy";
import { createLearningLoop, type LearningLoop, type ProposeLearningInput } from "../c1/clonechat-learning-loop";
import type { LearningCandidate } from "../c1/clonechat-knowledge-types";
import { parrainNormalize } from "./parrain-types";

export const PARRAIN_LEARNING_OUTPUT_TYPES = [
  "faq_candidate",
  "product_explanation_candidate",
  "sales_response_candidate",
  "objection_candidate",
  "support_resolution_candidate",
  "bug_memory_candidate",
  "route_alias_candidate",
  "parser_improvement_candidate",
  "knowledge_source_candidate",
  "deprecation_candidate",
] as const;
export type ParrainLearningOutputType = (typeof PARRAIN_LEARNING_OUTPUT_TYPES)[number];

export interface ContradictionCheck {
  readonly contradicts: boolean;
  readonly reasons: readonly string[];
}

/**
 * Contrôle de contradiction : un candidat qui affirme un claim interdit (voix/paiement/
 * production live, garantie légale…) ou qui contredit un statut canonique bloqué est
 * signalé — il ne pourra pas être approuvé sans correction.
 */
export function checkContradiction(candidateText: string, canonicalBlockedTopics: readonly string[] = DEFAULT_BLOCKED_TOPICS): ContradictionCheck {
  const reasons: string[] = [];
  const safety = checkAnswerTextSafety(candidateText);
  if (!safety.safe) reasons.push(`Claim interdit détecté : ${safety.violations.map((v) => v.ruleId).join(", ")}`);
  const q = parrainNormalize(candidateText);
  for (const topic of canonicalBlockedTopics) {
    if (q.includes(parrainNormalize(topic)) && /disponible|ouvert|actif|opérationnel|live/.test(q)) {
      reasons.push(`Contredit le statut canonique bloqué : « ${topic} »`);
    }
  }
  return Object.freeze({ contradicts: reasons.length > 0, reasons });
}

const DEFAULT_BLOCKED_TOPICS: readonly string[] = Object.freeze([
  "paiement en ligne",
  "voix",
  "téléphonie",
  "signature automatique",
  "envoi automatique",
  "production",
]);

export interface ParrainLearningCandidate extends LearningCandidate {
  readonly outputType: ParrainLearningOutputType;
  readonly contradiction: ContradictionCheck;
}

export interface ParrainLearningLoop {
  propose(input: ProposeLearningInput & { readonly outputType: ParrainLearningOutputType }): ParrainLearningCandidate;
  approve(id: string, opts: { readonly validatedBy: string; readonly at: string }): LearningCandidate | null;
  reject(id: string, opts: { readonly validatedBy: string; readonly at: string }): LearningCandidate | null;
  deprecate(id: string, opts: { readonly validatedBy: string; readonly at: string }): LearningCandidate | null;
  approvedGlobalKnowledge(): readonly LearningCandidate[];
  approvedAccountKnowledge(accountId: string): readonly LearningCandidate[];
  list(): readonly LearningCandidate[];
}

/** Boucle Parrain : réutilise la boucle C1 (proposal-only vérifiée) + contradiction + refus d'approbation contradictoire. */
export function createParrainLearningLoop(): ParrainLearningLoop {
  const base: LearningLoop = createLearningLoop();
  const meta = new Map<string, { outputType: ParrainLearningOutputType; contradiction: ContradictionCheck }>();
  return {
    propose(input) {
      const contradiction = checkContradiction(`${input.summary} ${input.suggestedAnswer}`);
      const candidate = base.propose(input);
      meta.set(candidate.id, { outputType: input.outputType, contradiction });
      return Object.freeze({ ...candidate, outputType: input.outputType, contradiction });
    },
    approve(id, opts) {
      const m = meta.get(id);
      if (m?.contradiction.contradicts) return null; // jamais approuvé tant que la contradiction n'est pas levée
      return base.approve(id, opts);
    },
    reject: (id, opts) => base.reject(id, opts),
    deprecate: (id, opts) => base.deprecate(id, opts),
    approvedGlobalKnowledge: () => base.approvedGlobalKnowledge(),
    approvedAccountKnowledge: (accountId) => base.approvedAccountKnowledge(accountId),
    list: () => base.list(),
  };
}

/** Le canonique gagne : une explication approuvée plus ancienne est SUPPLANTÉE quand la
 *  source canonique change (le chunk canonique porte l'autorité supérieure au runtime). */
export const CANONICAL_SUPERSEDES_APPROVED = true as const;
