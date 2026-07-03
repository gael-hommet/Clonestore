// src/lib/pierre/v1/cognitive-runtime/capability-retrieval.ts
// PHASE 8.14 — bounded, relevance-ranked capability retrieval over the REAL canon (HR_CAPABILITIES).
// Replaces "exact-id lookup only" with a deterministic lexical relevance ranking so the planner can be
// handed only the most relevant, AUTHORIZED, BOUNDED set of capabilities (never the whole canon). Pure
// and fully testable. The LLM may then only reference ids from this retrieved set; unknown ids are
// rejected downstream by the plan-validator (the closed action registry + compiler).

import { HR_CAPABILITIES } from "../hr-canon/capability-registry";
import type { HrCapabilityDefinition } from "../hr-canon/types";
import { COGNITIVE_LIMITS } from "./config";

export type RetrievedCapability = {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  readonly score: number;
  readonly autonomy: string;
  readonly implementation: string;
};

function strip(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// The canon is authored in English; the product speaks French. This bilingual seed lets deterministic
// lexical retrieval bridge common FR HR terms → EN canon vocabulary. Deep semantic mapping remains the
// LLM's job in production; this is a bounded, honest pre-filter (never the whole canon to the model).
const SYNONYMS: Record<string, string[]> = {
  contrat: ["contract", "employment"], embauche: ["hire", "recruitment", "hiring"], embaucher: ["hire", "recruitment"],
  salaire: ["compensation", "salary", "pay"], remuneration: ["compensation", "salary"], augmentation: ["compensation", "raise"],
  licenciement: ["termination", "dismissal"], licencier: ["termination", "dismissal"], depart: ["offboarding", "termination"],
  onboarding: ["onboarding", "hire"], arrivee: ["onboarding", "hire"], integration: ["onboarding"],
  conge: ["leave", "absence"], absence: ["absence", "leave"], maladie: ["sick", "medical", "absence"],
  formation: ["training", "skill"], competence: ["skill", "competency"], carriere: ["career", "mobility"],
  paie: ["payroll", "compensation"], prime: ["bonus", "compensation"], note: ["expense"], frais: ["expense"],
  document: ["document"], contrat_travail: ["contract"], travail: ["work", "employment"], poste: ["position", "role", "job"],
  site: ["site", "establishment"], equipe: ["team"], manager: ["manager"], salarie: ["employee"], candidat: ["candidate"],
  entretien: ["interview", "one_to_one", "review"], performance: ["performance", "objective"], sanction: ["sanction", "disciplinary"],
  avenant: ["amendment", "contract"], mutation: ["mobility", "transfer"], reorganisation: ["restructuring", "org"],
  harcelement: ["harassment", "employee_relations"], plainte: ["complaint", "employee_relations"], creer: ["create"], gerer: ["manage"],
};

function tokens(s: string): string[] {
  const base = strip(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const expanded = new Set(base);
  for (const w of base) for (const syn of SYNONYMS[w] ?? []) expanded.add(syn);
  return [...expanded];
}

function scoreCapability(cap: HrCapabilityDefinition, queryTokens: readonly string[], queryText: string): number {
  const hay = `${cap.id} ${cap.domain} ${cap.label} ${cap.description}`;
  const hayStrip = strip(hay);
  let score = 0;
  for (const q of queryTokens) {
    if (hayStrip.includes(q)) score += 2;
    if (strip(cap.id).includes(q)) score += 3;       // id match is strong signal
    if (strip(cap.domain).includes(q)) score += 2;
    if (strip(cap.label).includes(q)) score += 2;
  }
  // whole-phrase domain hint
  if (queryText && hayStrip.includes(strip(queryText).slice(0, 24))) score += 1;
  return score;
}

/** Retrieve up to `limit` most-relevant capabilities for a free-text request. Deterministic. */
export function retrieveCapabilities(
  request: string,
  opts?: { limit?: number; domains?: readonly string[] },
): RetrievedCapability[] {
  const limit = opts?.limit ?? COGNITIVE_LIMITS.maxCandidateCapabilities;
  const qTokens = tokens(request);
  const pool = opts?.domains && opts.domains.length > 0
    ? HR_CAPABILITIES.filter((c) => opts.domains!.includes(c.domain))
    : HR_CAPABILITIES;
  const scored = pool
    .map((c) => ({ cap: c, score: scoreCapability(c, qTokens, request) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.cap.id.localeCompare(b.cap.id))
    .slice(0, limit);
  return scored.map((x) => ({
    id: x.cap.id, domain: x.cap.domain, label: x.cap.label, score: x.score,
    autonomy: x.cap.autonomy, implementation: x.cap.implementation,
  }));
}

/** True iff `capabilityId` is a real canonical capability (used to reject invented ids). */
export function isKnownCapability(capabilityId: string): boolean {
  return HR_CAPABILITIES.some((c) => c.id === capabilityId);
}
