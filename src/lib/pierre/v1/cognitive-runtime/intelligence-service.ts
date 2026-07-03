// src/lib/pierre/v1/cognitive-runtime/intelligence-service.ts
// PHASE 8.14 — the authoritative server-side intelligence service behind the /api/pierre/v1/intelligence
// routes. Composes interpret → clarify → plan-preview into the stable P9 IntelligenceResponse. Execution
// is delegated to the EXISTING createMission path (already cognitive) — this service never opens a second
// runtime. Unit-testable via injected proposer/interpret (no OpenAI in normal tests).

import { interpretRequest, type InterpretOptions } from "./request-interpreter";
import { computeClarifications } from "./clarification-engine";
import { generateCognitivePlan } from "./plan-generator";
import { createDeterministicProposer, createLlmProposer } from "./proposers";
import { isCognitivePlannerEnabled } from "./config";
import { toIntelligenceResponse, toAnalysisResponse, type IntelligenceResponse } from "./p9-contract";
import { runOptimizationAnalysis, runMonitoringSnapshot } from "./analytics-engine";
import type { PlanProposer, PierreMissingInformation } from "./types";

export type IntelligenceRequestArgs = {
  readonly requestId: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly instruction: string;
  readonly nowIso: string;
};

type AnalyticsDb = { query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }> };
export type IntelligenceServiceOptions = InterpretOptions & { readonly proposer?: PlanProposer; readonly db?: AnalyticsDb };

/** Interpret a request and route it: OPTIMIZATION/MONITORING → real analytics engines; else → compiled
 *  plan preview. No writes. */
export async function runIntelligenceRequest(
  args: IntelligenceRequestArgs,
  opts?: Partial<IntelligenceServiceOptions>,
): Promise<IntelligenceResponse> {
  const nowIso = opts?.nowIso ?? args.nowIso;
  const interpretation = await interpretRequest(
    { requestId: args.requestId, companyId: args.companyId, actorId: args.actorId, instruction: args.instruction },
    { nowIso, enabled: opts?.enabled, interpret: opts?.interpret, subjects: opts?.subjects },
  );

  // Dispatch OPTIMIZATION / MONITORING to the real analytics engines (grounded findings, not a plan).
  if (opts?.db && (interpretation.requestKind === "OPTIMIZATION" || interpretation.requestKind === "MONITORING")) {
    if (interpretation.requestKind === "OPTIMIZATION") {
      const r = await runOptimizationAnalysis(opts.db, { company_id: args.companyId });
      return toAnalysisResponse({ interpretation, analysis: { kind: "optimization", findings: r.findings, watch: [] } });
    }
    const r = await runMonitoringSnapshot(opts.db, { company_id: args.companyId });
    return toAnalysisResponse({ interpretation, analysis: { kind: "monitoring", findings: r.findings, watch: r.watch } });
  }

  const missingInformation: PierreMissingInformation[] = [...interpretation.missingInformation];
  const clar = computeClarifications({
    entities: [...interpretation.subjects.employees, ...interpretation.subjects.managers, ...interpretation.subjects.teams, ...interpretation.subjects.sites, ...interpretation.subjects.contracts, ...interpretation.subjects.documents, ...interpretation.subjects.missions, ...interpretation.subjects.cases],
    dates: interpretation.dates, amounts: interpretation.amounts, ambiguities: [], missingInformation,
  });

  // Blocked by clarification → return questions, no plan (owner §8: resolve before acting).
  if (clar.blocksExecution) {
    return toIntelligenceResponse({ interpretation, clarifications: clar.questions, plan: null });
  }

  // Produce a compiled plan preview. Proposer: LLM in production, deterministic safe fallback otherwise.
  const proposer: PlanProposer = opts?.proposer ?? ((opts?.enabled ?? isCognitivePlannerEnabled()) ? createLlmProposer() : createDeterministicProposer());
  let plan = null;
  try {
    plan = await generateCognitivePlan({ instruction: args.instruction, companyId: args.companyId, actorId: args.actorId, nowIso, proposer });
  } catch {
    plan = null; // proposer/compile failure → interpreted-only response (no fabricated plan)
  }
  return toIntelligenceResponse({ interpretation, clarifications: clar.questions, plan });
}
