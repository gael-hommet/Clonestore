// src/lib/pierre/v1/cognitive-runtime/clarification-engine.ts
// PHASE 8.14 — turns unresolved ambiguity + missing information into the SMALLEST set of precise
// questions (owner §8: never ask for what can be retrieved; never ask generic when precise is possible),
// and decides the next step. Pure + testable. The durable clarify→wait→resume loop is executed by the
// continuation controller using the existing pierre_rt_runtime_waits primitive; this module computes WHAT
// to ask and WHETHER execution must pause.

import type { PierreAmbiguity, PierreMissingInformation, ResolvedReference, ResolvedTemporalReference, ResolvedAmountReference, PierreNextStep } from "./types";

export type ClarificationQuestion = { readonly field: string; readonly question: string; readonly options: readonly string[]; readonly blocksExecution: boolean };

export type ClarificationResult = {
  readonly questions: readonly ClarificationQuestion[];
  readonly blocksExecution: boolean;
  readonly nextStep: PierreNextStep;
};

/** Build a precise ambiguity question from an ambiguous entity reference (uses the distinguishers). */
export function ambiguityQuestionFor(ref: ResolvedReference): ClarificationQuestion | null {
  if (ref.status !== "ambiguous" || ref.candidates.length === 0) return null;
  const opts = ref.candidates.map((c) => `${c.label} (${c.distinguisher})`);
  return {
    field: `${ref.kind}:${ref.label}`,
    question: `Plusieurs correspondances pour « ${ref.label} » : ${opts.join(" ou ")} ?`,
    options: opts,
    blocksExecution: true, // acting on the wrong entity is unsafe → must resolve first
  };
}

export function computeClarifications(input: {
  entities: readonly ResolvedReference[];
  dates: readonly ResolvedTemporalReference[];
  amounts: readonly ResolvedAmountReference[];
  ambiguities: readonly PierreAmbiguity[];
  missingInformation: readonly PierreMissingInformation[];
}): ClarificationResult {
  const questions: ClarificationQuestion[] = [];

  // Ambiguous entities → precise disambiguation question (blocks execution).
  for (const e of input.entities) {
    const q = ambiguityQuestionFor(e);
    if (q) questions.push(q);
  }
  // Unresolved dates/amounts that were referenced → ask the exact question (blocks execution).
  for (const d of input.dates) {
    if (d.status === "unresolved" || d.status === "ambiguous") {
      questions.push({ field: `date:${d.original}`, question: `À quelle date exacte correspond « ${d.original} » ?`, options: [], blocksExecution: true });
    }
  }
  for (const a of input.amounts) {
    if (a.status === "ambiguous" || a.status === "unresolved") {
      questions.push({ field: `amount:${a.original}`, question: `Quel est le montant exact pour « ${a.original} » (devise incluse) ?`, options: [], blocksExecution: true });
    }
  }
  // Model-declared ambiguities + missing info.
  for (const a of input.ambiguities) questions.push({ field: a.field, question: a.question, options: a.options, blocksExecution: true });
  for (const m of input.missingInformation) questions.push({ field: m.field, question: m.question, options: [], blocksExecution: m.blocksExecution });

  const blocksExecution = questions.some((q) => q.blocksExecution);
  const nextStep: PierreNextStep = questions.length > 0 && blocksExecution ? "ASK_CLARIFICATION" : "PREPARE_PLAN";
  return { questions, blocksExecution, nextStep };
}
