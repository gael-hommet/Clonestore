// src/lib/pierre/context/context-signals.ts
// B35 — Base signal builder. All context builders use this.

import type {
  PierreContextSignal,
  PierreContextScope,
  PierreContextSource,
  PierreContextSignalType,
  PierreContextPriority,
  PierreContextRisk,
} from "./types";
import { scoreContextFreshness, scoreContextRelevance } from "./scoring";

let _signalCounter = 0;

function makeSignalId(scope: PierreContextScope, company_id: string): string {
  _signalCounter = (_signalCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36);
  const counter = _signalCounter.toString(36).padStart(4, "0");
  const cid = company_id.slice(-6).replace(/[^a-z0-9]/gi, "x");
  return `sig_${scope.slice(0, 4)}_${cid}_${ts}${counter}`;
}

export type BuildSignalParams = {
  company_id: string;
  scope: PierreContextScope;
  source: PierreContextSource;
  type: PierreContextSignalType;
  priority: PierreContextPriority;
  risk: PierreContextRisk;
  title: string;
  content: string;
  confidence?: number;
  updated_at?: string;
  expires_at?: string | null;
  related_employee_id?: string | null;
  related_mission_id?: string | null;
  related_task_id?: string | null;
  related_file_id?: string | null;
  related_channel_id?: string | null;
  related_document_id?: string | null;
  metadata?: Record<string, unknown>;
  // Scoring modifiers
  currentTaskType?: string | null;
  currentDomain?: string | null;
  taskType?: string | null;
  domain?: string | null;
};

export function buildContextSignal(params: BuildSignalParams): PierreContextSignal {
  const now = new Date().toISOString();
  const updatedAt = params.updated_at || now;
  const confidence = typeof params.confidence === "number"
    ? Math.max(0, Math.min(1, params.confidence))
    : 0.8;

  const freshness = scoreContextFreshness(updatedAt, params.scope);
  const relevance = scoreContextRelevance({
    scope: params.scope,
    risk: params.risk,
    confidence,
    taskType: params.taskType,
    domain: params.domain,
    currentTaskType: params.currentTaskType,
    currentDomain: params.currentDomain,
  });

  return {
    id: makeSignalId(params.scope, params.company_id),
    company_id: params.company_id,
    agent_slug: "pierre",
    scope: params.scope,
    source: params.source,
    type: params.type,
    priority: params.priority,
    risk: params.risk,
    title: params.title,
    content: params.content,
    confidence,
    relevance_score: relevance,
    freshness_score: freshness,
    created_at: now,
    updated_at: updatedAt,
    expires_at: params.expires_at ?? null,
    related_employee_id: params.related_employee_id ?? null,
    related_mission_id: params.related_mission_id ?? null,
    related_task_id: params.related_task_id ?? null,
    related_file_id: params.related_file_id ?? null,
    related_channel_id: params.related_channel_id ?? null,
    related_document_id: params.related_document_id ?? null,
    metadata: params.metadata ?? {},
  };
}
