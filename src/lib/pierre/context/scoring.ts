// src/lib/pierre/context/scoring.ts
// B35 — Signal scoring: relevance, freshness, priority.
// Pure functions — no async, no DB, no AI.

import type {
  PierreContextSignal,
  PierreContextPriority,
  PierreContextRisk,
  PierreContextScope,
} from "./types";

// ── Freshness scoring ─────────────────────────────────────────────────────────

const FRESHNESS_DECAY_HOURS: Record<string, number> = {
  company: 168,   // 7 days
  employee: 72,   // 3 days
  mission: 48,    // 2 days
  task: 24,       // 1 day
  file: 48,       // 2 days
  channel: 72,    // 3 days
  history: 168,   // 7 days
  rules: 720,     // 30 days
  validation: 24, // 1 day
  risk: 24,       // 1 day
  preference: 336, // 14 days
  adn: 720,       // 30 days
};

export function scoreContextFreshness(
  updatedAt: string,
  scope: PierreContextScope,
  now = new Date(),
): number {
  const decayHours = FRESHNESS_DECAY_HOURS[scope] ?? 168;
  const updatedMs = new Date(updatedAt).getTime();
  if (isNaN(updatedMs)) return 0.3;

  const ageHours = (now.getTime() - updatedMs) / (1000 * 60 * 60);
  if (ageHours <= 0) return 1.0;

  const raw = Math.exp(-ageHours / decayHours);
  return Math.max(0.05, Math.min(1.0, raw));
}

// ── Relevance scoring ─────────────────────────────────────────────────────────

const SCOPE_BASE_RELEVANCE: Record<PierreContextScope, number> = {
  company: 0.6,
  employee: 0.85,
  mission: 0.9,
  task: 0.8,
  file: 0.75,
  channel: 0.65,
  history: 0.55,
  rules: 0.7,
  validation: 0.8,
  risk: 0.85,
  preference: 0.65,
  adn: 0.7,
};

const RISK_RELEVANCE_BOOST: Record<PierreContextRisk, number> = {
  blocked: 0.2,
  sensitive: 0.15,
  high: 0.1,
  medium: 0.05,
  low: 0.0,
  none: -0.05,
};

export function scoreContextRelevance(params: {
  scope: PierreContextScope;
  risk: PierreContextRisk;
  confidence: number;
  taskType?: string | null;
  domain?: string | null;
  currentTaskType?: string | null;
  currentDomain?: string | null;
}): number {
  const base = SCOPE_BASE_RELEVANCE[params.scope] ?? 0.5;
  const riskBoost = RISK_RELEVANCE_BOOST[params.risk] ?? 0;

  let domainBoost = 0;
  if (
    params.domain &&
    params.currentDomain &&
    params.domain === params.currentDomain
  ) {
    domainBoost = 0.1;
  }

  let taskTypeBoost = 0;
  if (
    params.taskType &&
    params.currentTaskType &&
    params.taskType === params.currentTaskType
  ) {
    taskTypeBoost = 0.08;
  }

  const confidenceModifier = (params.confidence - 0.5) * 0.2;
  const raw = base + riskBoost + domainBoost + taskTypeBoost + confidenceModifier;
  return Math.max(0.0, Math.min(1.0, raw));
}

// ── Priority scoring ──────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<PierreContextPriority, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

export function scoreContextPriority(priority: PierreContextPriority): number {
  return PRIORITY_ORDER[priority] ?? 1;
}

// ── Composite sort key ────────────────────────────────────────────────────────

export function computeSignalSortKey(signal: PierreContextSignal): number {
  const priority = scoreContextPriority(signal.priority);
  const relevance = signal.relevance_score;
  const freshness = signal.freshness_score;
  return priority * 0.5 + relevance * 0.35 + freshness * 0.15;
}

// ── Rank signals ──────────────────────────────────────────────────────────────

export function rankContextSignals(
  signals: PierreContextSignal[],
  limit?: number,
): PierreContextSignal[] {
  const sorted = [...signals].sort(
    (a, b) => computeSignalSortKey(b) - computeSignalSortKey(a),
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

// ── Filter by scope ───────────────────────────────────────────────────────────

export function filterSignalsByScope(
  signals: PierreContextSignal[],
  scope: PierreContextScope,
): PierreContextSignal[] {
  return signals.filter((s) => s.scope === scope);
}

// ── Filter high-risk signals ──────────────────────────────────────────────────

export function filterRiskSignals(
  signals: PierreContextSignal[],
): PierreContextSignal[] {
  return signals.filter(
    (s) => s.risk === "sensitive" || s.risk === "high" || s.risk === "blocked",
  );
}

// ── Derive overall risk from signals ──────────────────────────────────────────

export function deriveOverallRisk(signals: PierreContextSignal[]): PierreContextRisk {
  if (signals.some((s) => s.risk === "blocked")) return "blocked";
  if (signals.some((s) => s.risk === "sensitive")) return "sensitive";
  if (signals.some((s) => s.risk === "high")) return "high";
  if (signals.some((s) => s.risk === "medium")) return "medium";
  if (signals.some((s) => s.risk === "low")) return "low";
  return "none";
}

// ── Derive validation requirement from signals ────────────────────────────────

export function deriveValidationRequired(signals: PierreContextSignal[]): boolean {
  return signals.some(
    (s) =>
      s.type === "validation_gate" ||
      s.risk === "sensitive" ||
      s.risk === "blocked",
  );
}
