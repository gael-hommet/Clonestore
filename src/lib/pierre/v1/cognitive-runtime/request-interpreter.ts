// src/lib/pierre/v1/cognitive-runtime/request-interpreter.ts
// PHASE 8.14 — the orchestrator that ties the cognitive runtime into ONE PierreRequestInterpretation
// (owner §6). It composes the already-built pieces: the authoritative cognitive analysis (LLM + safety
// floor), bounded capability retrieval, deterministic date/amount resolution, and the clarification
// engine. Entity resolution needs tenant-scoped DB candidates, so resolved subjects are INJECTED by the
// caller (the API route, using the real permission-filtered repos) — this keeps the interpreter pure and
// unit-testable while never guessing across tenants.

import { cognitiveAnalyze, type CognitiveInterpret } from "./cognitive-analyzer";
import { retrieveCapabilities } from "./capability-retrieval";
import { resolveTemporal } from "./temporal-resolution";
import { resolveAmount } from "./amount-resolution";
import { computeClarifications } from "./clarification-engine";
import type {
  PierreRequestInterpretation, PierreRequestKind, ResolvedReference,
  ResolvedTemporalReference, ResolvedAmountReference, PierreMissingInformation,
} from "./types";

// Candidate date/amount substrings worth resolving (bounded, deterministic).
const DATE_RE = /\b(aujourd'?hui|demain|apr[eè]s-demain|hier|(?:la\s+)?semaine\s+prochaine|(?:le\s+)?mois\s+prochain|(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+prochain)?|dans\s+\d{1,3}\s+(?:jours?|semaines?|mois)|in\s+\d{1,3}\s+(?:days?|weeks?|months?)|\d{1,2}(?:er)?\s+(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)|\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/gi;
const AMOUNT_RE = /(?:€|chf\s*)?\d[\d\s.,]*\d\s*(?:€|eur(?:os?)?|chf)?/gi;

function extractDates(text: string, nowIso: string): ResolvedTemporalReference[] {
  const out: ResolvedTemporalReference[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const r = resolveTemporal(m[0], nowIso);
    if (r.status !== "unresolved" || out.length < 3) out.push(r);
    if (out.length >= 5) break;
  }
  return out;
}
function extractAmounts(text: string): ResolvedAmountReference[] {
  const out: ResolvedAmountReference[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const tok = m[0].trim();
    if (!/\d/.test(tok)) continue;
    const r = resolveAmount(tok);
    if (r.status === "resolved" || r.status === "ambiguous") out.push(r);
    if (out.length >= 5) break;
  }
  return out;
}

function deriveKind(intent: string, instruction: string, hasTasks: boolean, missing: number): PierreRequestKind {
  const t = `${intent} ${instruction}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Text cues take precedence over "has tasks" — an optimization/analysis ask may still yield tasks.
  if (/optim|ameliore|ameliorer|perdre.*temps|gagner.*temps|reduire.*cout|bottleneck|goulot|efficac|faire.*econom/.test(t)) return "OPTIMIZATION";
  if (/surveil|monitor|watch|previens-moi|alerte|garde un oeil|suis cette/.test(t)) return "MONITORING";
  if (/pourquoi|why|explique|explain|analyse|analys|comprendre|understand|qu'est-ce qui/.test(t)) return "ANALYSIS";
  if (hasTasks) return "OPERATION";
  return missing > 0 ? "INFORMATION" : "ANALYSIS";
}

export type InterpretOptions = {
  readonly nowIso: string;
  readonly enabled?: boolean;               // cognitive planner override (tests)
  readonly interpret?: CognitiveInterpret;  // inject deterministic interpreter (tests)
  readonly subjects?: Partial<PierreRequestInterpretation["subjects"]>; // caller-resolved entities
};

const EMPTY_SUBJECTS = { employees: [] as ResolvedReference[], managers: [], teams: [], sites: [], contracts: [], documents: [], missions: [], cases: [] };

/** Produce the authoritative interpretation of a natural-language HR request. */
export async function interpretRequest(
  args: { requestId: string; companyId: string; actorId: string; instruction: string },
  opts: InterpretOptions,
): Promise<PierreRequestInterpretation> {
  const analysis = await cognitiveAnalyze(args.instruction, { enabled: opts.enabled, interpret: opts.interpret });
  const retrieved = retrieveCapabilities(args.instruction);
  const dates = extractDates(args.instruction, opts.nowIso);
  const amounts = extractAmounts(args.instruction);

  const subjects = { ...EMPTY_SUBJECTS, ...(opts.subjects ?? {}) };
  const missingInformation: PierreMissingInformation[] = analysis.missing_info.map((m) => ({ field: m.id, question: m.question, blocksExecution: m.priority === "high" }));

  const clar = computeClarifications({
    entities: [...subjects.employees, ...subjects.managers, ...subjects.teams, ...subjects.sites, ...subjects.contracts, ...subjects.documents, ...subjects.missions, ...subjects.cases],
    dates, amounts, ambiguities: [], missingInformation,
  });

  const hasTasks = analysis.proposed_tasks.length > 0;
  return {
    requestId: args.requestId,
    companyId: args.companyId,
    actorId: args.actorId,
    originalRequest: args.instruction,
    normalizedObjective: analysis.summary,
    desiredOutcomes: analysis.proposed_tasks.map((t) => t.expected_output).filter(Boolean).slice(0, 8),
    subjects,
    dates,
    amounts,
    constraints: [],
    assumptions: [],
    relevantDomains: [...new Set(retrieved.map((c) => c.domain))].slice(0, 8),
    candidateCapabilityIds: retrieved.map((c) => c.id),
    ambiguities: [],
    missingInformation,
    requestKind: deriveKind(analysis.intent, args.instruction, hasTasks, missingInformation.length),
    confidence: analysis.confidence,
    nextStep: clar.nextStep,
  };
}
