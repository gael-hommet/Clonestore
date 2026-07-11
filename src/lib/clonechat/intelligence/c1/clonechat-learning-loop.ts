// src/lib/clonechat/intelligence/c1/clonechat-learning-loop.ts
// C1 — Boucle d'apprentissage PROPOSITIONS-UNIQUEMENT : CloneChat s'améliore, mais
// jamais par mutation silencieuse. Toute connaissance candidate exige une validation
// admin/fondateur avant réutilisation globale ; les mémoires de compte restent
// isolées ; l'obsolète est DÉPRÉCIÉ, jamais supprimé silencieusement ; chaque
// candidat porte une confiance et des preuves.

import {
  c1Fingerprint,
  type LearningCandidate,
  type LearningKnowledgeType,
  type LearningScope,
  type LearningSourceType,
} from "./clonechat-knowledge-types";

export interface ProposeLearningInput {
  readonly sourceType: LearningSourceType;
  readonly proposedKnowledgeType: LearningKnowledgeType;
  readonly summary: string;
  readonly suggestedAnswer: string;
  readonly confidence: number;
  readonly scope?: LearningScope;
  readonly accountId?: string | null;
  readonly evidence: readonly string[];
  readonly at: string;
}

/** Construit un candidat PUR (sans le stocker) — requiresValidation est TOUJOURS true. */
export function proposeLearningCandidate(input: ProposeLearningInput): LearningCandidate {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("LearningCandidate: confidence must be in [0,1].");
  }
  if (!input.evidence || input.evidence.length === 0) {
    throw new Error("LearningCandidate: evidence is required.");
  }
  const scope: LearningScope = input.scope ?? "global";
  return Object.freeze({
    id: c1Fingerprint("learn", `${input.sourceType}|${input.summary}|${input.accountId ?? ""}`),
    sourceType: input.sourceType,
    proposedKnowledgeType: input.proposedKnowledgeType,
    summary: input.summary,
    suggestedAnswer: input.suggestedAnswer,
    confidence: input.confidence,
    scope,
    accountId: scope === "account" ? (input.accountId ?? null) : null,
    requiresValidation: true,
    evidence: [...input.evidence],
    status: "candidate",
    validatedBy: null,
    createdAt: input.at,
    updatedAt: input.at,
  });
}

export interface LearningLoop {
  propose(input: ProposeLearningInput): LearningCandidate;
  approve(id: string, opts: { readonly validatedBy: string; readonly at: string }): LearningCandidate | null;
  reject(id: string, opts: { readonly validatedBy: string; readonly at: string }): LearningCandidate | null;
  deprecate(id: string, opts: { readonly validatedBy: string; readonly at: string }): LearningCandidate | null;
  get(id: string): LearningCandidate | null;
  list(): readonly LearningCandidate[];
  listByStatus(status: LearningCandidate["status"]): readonly LearningCandidate[];
  /** Seule connaissance réutilisable globalement : APPROUVÉE et de scope global. */
  approvedGlobalKnowledge(): readonly LearningCandidate[];
  /** Connaissance de compte approuvée — visible UNIQUEMENT pour ce compte. */
  approvedAccountKnowledge(accountId: string): readonly LearningCandidate[];
}

export function createLearningLoop(): LearningLoop {
  const store = new Map<string, LearningCandidate>();

  const transition = (
    id: string,
    status: LearningCandidate["status"],
    validatedBy: string,
    at: string,
  ): LearningCandidate | null => {
    const current = store.get(id);
    if (!current) return null;
    if (!validatedBy || validatedBy.trim().length === 0) return null; // validation humaine identifiée obligatoire
    const next: LearningCandidate = Object.freeze({ ...current, status, validatedBy, updatedAt: at });
    store.set(id, next);
    return next;
  };

  return {
    propose(input) {
      const candidate = proposeLearningCandidate(input);
      const existing = store.get(candidate.id);
      if (existing) return existing; // idempotent — ne réécrit jamais un statut existant
      store.set(candidate.id, candidate);
      return candidate;
    },
    approve: (id, o) => transition(id, "approved", o.validatedBy, o.at),
    reject: (id, o) => transition(id, "rejected", o.validatedBy, o.at),
    deprecate: (id, o) => transition(id, "deprecated", o.validatedBy, o.at),
    get: (id) => store.get(id) ?? null,
    list: () => [...store.values()],
    listByStatus: (status) => [...store.values()].filter((c) => c.status === status),
    approvedGlobalKnowledge: () =>
      [...store.values()].filter((c) => c.status === "approved" && c.scope === "global"),
    approvedAccountKnowledge: (accountId) =>
      [...store.values()].filter(
        (c) => c.status === "approved" && c.scope === "account" && c.accountId === accountId && accountId.length > 0,
      ),
  };
}

/** Sources d'apprentissage documentées (audit/inspection). */
export const LEARNING_DOCTRINE: readonly string[] = Object.freeze([
  "L'apprentissage est proposition-uniquement par défaut.",
  "Aucune mutation globale silencieuse.",
  "Validation admin/fondateur requise pour la connaissance globale.",
  "La mémoire de compte reste isolée par entreprise.",
  "La connaissance obsolète est dépréciée, jamais supprimée silencieusement.",
  "Confiance et preuves requises sur chaque candidat.",
]);
