// src/lib/pierre/context/context-pack.ts
// B35 — Assemble all signals into a PierreContextPack.

import type { PierreContextPack, PierreContextSignal } from "./types";
import { rankContextSignals } from "./scoring";
import { summarizeContextPack } from "./context-summary";

let _packCounter = 0;

function makePackId(companyId: string): string {
  _packCounter = (_packCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36);
  const counter = _packCounter.toString(36).padStart(4, "0");
  const cid = companyId.slice(-6).replace(/[^a-z0-9]/gi, "x");
  return `ctx_${cid}_${ts}${counter}`;
}

export function assemblePierreContextPack(params: {
  company_id: string;
  built_for: string;
  employee_id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  file_id?: string | null;
  channel_identity_id?: string | null;
  signals: PierreContextSignal[];
  metadata?: Record<string, unknown>;
}): PierreContextPack {
  const ranked = rankContextSignals(params.signals);

  const stub: PierreContextPack = {
    id: makePackId(params.company_id),
    company_id: params.company_id,
    agent_slug: "pierre",
    built_for: params.built_for,
    employee_id: params.employee_id ?? null,
    mission_id: params.mission_id ?? null,
    task_id: params.task_id ?? null,
    file_id: params.file_id ?? null,
    channel_identity_id: params.channel_identity_id ?? null,
    signals: ranked,
    top_rules: [],
    top_preferences: [],
    top_warnings: [],
    missing_info: [],
    risk_summary: "",
    validation_summary: "",
    employee_summary: null,
    mission_summary: null,
    file_summary: null,
    channel_summary: null,
    recommended_next_action: null,
    should_require_validation: false,
    created_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
  };

  const summary = summarizeContextPack(stub);

  return {
    ...stub,
    top_rules: summary.top_rules,
    top_preferences: summary.top_preferences,
    top_warnings: summary.top_warnings,
    missing_info: summary.missing_info,
    risk_summary: summary.risk_summary,
    validation_summary: summary.validation_summary,
    employee_summary: summary.employee_summary,
    mission_summary: summary.mission_summary,
    file_summary: summary.file_summary,
    channel_summary: summary.channel_summary,
    recommended_next_action: summary.recommended_next_action,
    should_require_validation: summary.should_require_validation,
  };
}
