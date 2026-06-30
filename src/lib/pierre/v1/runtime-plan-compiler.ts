// src/lib/pierre/v1/runtime-plan-compiler.ts
// PHASE 8.5 §10 — compile a server-validated mission plan into a canonical, fingerprinted DAG of typed
// steps. The compiler REFUSES: a cycle, an unknown/obsolete action, an unknown dependency, a duplicate
// step id, a sensitive action with no approval gate, an unbounded timeout/retry, an invalid date, a
// free (untyped) condition, an empty/over-limit plan. Once compiled + run, a plan version is IMMUTABLE
// (its fingerprint pins it); any change is a NEW version, never a silent mutation.

import { createHash } from "crypto";
import { sha256 } from "./renderers";
import { getRuntimeActionDefinition, validateRuntimeActionInput } from "./runtime-action-registry";
import { runtimeLimits, planDepth } from "./runtime-limits";

export type RuntimePlanStepInput = {
  step_key: string;
  action_key: string;
  action_version?: string;
  input?: Record<string, unknown>;
  depends_on?: string[];
};
export type RuntimePlanInput = {
  schema_version?: string;
  steps: RuntimePlanStepInput[];
};

export type CompiledStep = {
  step_key: string;
  action_key: string;
  action_version: string;
  step_ordinal: number;
  input: Record<string, unknown>;
  input_hash: string;
  depends_on: string[];
  dependency_count: number;
};
export type CompiledPlan = {
  ok: boolean;
  schema_version: string;
  plan_fingerprint: string;
  steps: CompiledStep[];
  blockers: string[];
};

export const RUNTIME_PLAN_LIMITS = {
  maxSteps: Number(process.env.PIERRE_RUNTIME_MAX_STEPS ?? 200),
  maxDeps: Number(process.env.PIERRE_RUNTIME_MAX_DEPS_PER_STEP ?? 25),
  maxDepth: Number(process.env.PIERRE_RUNTIME_MAX_DEPTH ?? 100),
};

function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}
const isIsoInstant = (v: unknown): boolean => typeof v === "string" && !Number.isNaN(Date.parse(v));

export function compileMissionPlan(plan: RuntimePlanInput): CompiledPlan {
  const blockers: string[] = [];
  const schema_version = plan.schema_version ?? "1";
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const LIM = runtimeLimits(); // R4.7 — live, fail-closed, hard-capped resource limits

  if (steps.length === 0) blockers.push("empty_plan");
  if (steps.length > LIM.maxSteps) blockers.push(`too_many_steps:${steps.length}>${LIM.maxSteps}`);
  // R4.7 — per-step input size is bounded (no oversized payload smuggled into a plan)
  for (const s of steps) {
    const bytes = Buffer.byteLength(JSON.stringify(s.input ?? {}), "utf8");
    if (bytes > LIM.maxInputBytes) blockers.push(`input_too_large:${s.step_key}:${bytes}>${LIM.maxInputBytes}`);
  }

  const seen = new Set<string>();
  for (const s of steps) {
    if (!s.step_key || typeof s.step_key !== "string") { blockers.push("step_without_key"); continue; }
    if (seen.has(s.step_key)) { blockers.push(`duplicate_step:${s.step_key}`); continue; }
    seen.add(s.step_key);
    const dfn = getRuntimeActionDefinition(s.action_key, s.action_version);
    if (!dfn) { blockers.push(`unknown_or_obsolete_action:${s.step_key}:${s.action_key}@${s.action_version ?? "1"}`); continue; }
    // sensitive action MUST be policy-gated (never plain automatic)
    if (dfn.risk === "sensitive" && dfn.executionMode === "automatic") blockers.push(`sensitive_action_without_gate:${s.step_key}`);
    if (dfn.risk === "prohibited") blockers.push(`prohibited_action:${s.step_key}`);
    if (dfn.timeoutSeconds <= 0 || dfn.timeoutSeconds > 7 * 24 * 3600) blockers.push(`unbounded_timeout:${s.step_key}`);
    if (dfn.maxAttempts <= 0 || dfn.maxAttempts > 50) blockers.push(`unbounded_retry:${s.step_key}`);
    const inputErrors = validateRuntimeActionInput(s.action_key, s.input ?? {});
    if (!inputErrors.ok) blockers.push(`invalid_input:${s.step_key}:${inputErrors.errors.join("|")}`);
    if (s.action_key === "wait.until_time" && !isIsoInstant((s.input ?? {}).wake_at)) blockers.push(`invalid_date:${s.step_key}`);
    if (s.action_key === "follow_up.schedule" && (s.input ?? {}).due_at !== undefined && !isIsoInstant((s.input ?? {}).due_at)) blockers.push(`invalid_date:${s.step_key}`);
    const deps = Array.isArray(s.depends_on) ? s.depends_on : [];
    if (deps.length > LIM.maxDepsPerStep) blockers.push(`too_many_deps:${s.step_key}`);
    if (deps.includes(s.step_key)) blockers.push(`self_dependency:${s.step_key}`);
  }
  // dependency references must exist
  for (const s of steps) {
    for (const d of (s.depends_on ?? [])) if (!seen.has(d)) blockers.push(`unknown_dependency:${s.step_key}->${d}`);
  }
  // R4.7 — the DAG depth (longest dependency chain) is bounded
  if (blockers.length === 0) {
    const depth = planDepth(steps.map((s) => ({ step_key: s.step_key, depends_on: s.depends_on ?? [] })));
    if (depth > LIM.maxDepth) blockers.push(`too_deep:${depth}>${LIM.maxDepth}`);
  }

  // R1.7 — a SENSITIVE action must declare an approval gate (input.approval_gate) that is a real
  // approval step located UPSTREAM in the DAG (the sensitive step transitively depends on it). The
  // dependency edge is the runtime enforcement: the gate's approval resolves before the sensitive step
  // can run; a plan with a sensitive action reachable WITHOUT passing its gate is refused.
  if (blockers.length === 0) {
    const byKey = new Map(steps.map((s) => [s.step_key, s] as const));
    const dependsOn = (from: string, target: string): boolean => {
      const visited = new Set<string>(); const stack = [...(byKey.get(from)?.depends_on ?? [])];
      while (stack.length) { const k = stack.pop()!; if (k === target) return true; if (visited.has(k)) continue; visited.add(k); stack.push(...(byKey.get(k)?.depends_on ?? [])); }
      return false;
    };
    for (const s of steps) {
      const dfn = getRuntimeActionDefinition(s.action_key, s.action_version);
      if (!dfn || dfn.risk !== "sensitive") continue;
      const gate = (s.input ?? {}).approval_gate;
      if (typeof gate !== "string" || !gate) { blockers.push(`sensitive_action_without_approval_gate:${s.step_key}`); continue; }
      const gateStep = byKey.get(gate);
      if (!gateStep) { blockers.push(`approval_gate_not_found:${s.step_key}->${gate}`); continue; }
      const gateDfn = getRuntimeActionDefinition(gateStep.action_key, gateStep.action_version);
      if (!gateDfn || gateDfn.category !== "approval") blockers.push(`approval_gate_not_approval:${s.step_key}`);
      else if (!dependsOn(s.step_key, gate)) blockers.push(`approval_gate_not_upstream:${s.step_key}`);
    }
  }

  // topological order (Kahn) — detects cycles
  const order: string[] = [];
  if (blockers.length === 0) {
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const s of steps) { indeg.set(s.step_key, 0); adj.set(s.step_key, []); }
    for (const s of steps) for (const d of (s.depends_on ?? [])) { indeg.set(s.step_key, (indeg.get(s.step_key) ?? 0) + 1); adj.get(d)!.push(s.step_key); }
    const queue = steps.filter((s) => (indeg.get(s.step_key) ?? 0) === 0).map((s) => s.step_key).sort();
    while (queue.length) {
      const k = queue.shift()!;
      order.push(k);
      for (const n of (adj.get(k) ?? [])) { const v = (indeg.get(n) ?? 0) - 1; indeg.set(n, v); if (v === 0) queue.push(n); }
      queue.sort();
    }
    if (order.length !== steps.length) blockers.push("cycle_detected");
  }

  if (blockers.length > 0) return { ok: false, schema_version, plan_fingerprint: "", steps: [], blockers };

  const ordinalOf = new Map(order.map((k, i) => [k, i] as const));
  const compiled: CompiledStep[] = steps
    .map((s) => {
      const input = s.input ?? {};
      return {
        step_key: s.step_key,
        action_key: s.action_key,
        action_version: getRuntimeActionDefinition(s.action_key, s.action_version)!.version,
        step_ordinal: ordinalOf.get(s.step_key) ?? 0,
        input,
        input_hash: sha256(Buffer.from(canonicalJson(input))),
        depends_on: [...(s.depends_on ?? [])].sort(),
        dependency_count: (s.depends_on ?? []).length,
      };
    })
    .sort((a, b) => a.step_ordinal - b.step_ordinal);

  const fingerprintSource = canonicalJson({ schema_version, steps: compiled.map((c) => ({ k: c.step_key, a: c.action_key, v: c.action_version, i: c.input_hash, d: c.depends_on })) });
  const plan_fingerprint = sha256(Buffer.from(fingerprintSource));
  return { ok: true, schema_version, plan_fingerprint, steps: compiled, blockers: [] };
}

// R4.5 — the CANONICAL, DB-reproducible plan content. Built ONLY from already-normalized primitive
// fields (no JSON ordering subtlety, collation-free: ordered by the integer step_ordinal), so the SQL
// function `pierre_rt_canonical_plan_content` produces the BYTE-IDENTICAL string. The DB hashes this
// itself (md5) and pins it to the plan fingerprint — the (fingerprint → content) binding becomes
// DB-authoritative and immutable, so a forged fingerprint reused over different steps is refused.
export type CanonicalStep = { step_ordinal: number; step_key: string; action_key: string; action_version: string; input_hash: string; dependency_count: number };
export function canonicalPlanContent(schemaVersion: string, steps: CanonicalStep[]): string {
  const lines = [...steps]
    .sort((a, b) => a.step_ordinal - b.step_ordinal)
    .map((s) => `${s.step_ordinal}|${s.step_key}|${s.action_key}|${s.action_version}|${s.input_hash}|${s.dependency_count}`);
  return `v=${schemaVersion ?? "1"}\n${lines.join("\n")}`;
}
export function planContentMd5(schemaVersion: string, steps: CanonicalStep[]): string {
  return createHash("md5").update(Buffer.from(canonicalPlanContent(schemaVersion, steps), "utf8")).digest("hex");
}
