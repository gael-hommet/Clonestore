// src/lib/pierre/v1/runtime-step-refs.ts
// PHASE 8.5 / P22 Reprise 12 — GENERIC step output→input threading for the authoritative runtime.
//
// A plan step's input may reference an UPSTREAM step's OUTPUT instead of a literal value:
//     input: { campaign_id: { "$ref": { "step": "campaign", "output": "campaign_id" } } }
// The value is resolved AT EXECUTION TIME from the referenced step's persisted output_json. This is the
// single, general mechanism that lets a mission-pack chain flow a runtime-generated id (campaign_id,
// interview_id, enrollment_id, …) from one authoritative action to the next — WITHOUT hardcoded ids and
// WITHOUT per-action wrappers. The compiler validates references structurally + enforces that every
// referenced step is an upstream dependency; the runtime substitutes the real value before the handler
// runs (a missing/typeless output is a governed failure, never a silent pass).

export type StepRef = { step: string; output: string };

/** A value is a step reference iff it is `{ "$ref": { step, output } }` (both non-empty strings). */
export function asStepRef(v: unknown): StepRef | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = (v as { $ref?: unknown }).$ref;
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const step = (r as { step?: unknown }).step;
  const output = (r as { output?: unknown }).output;
  if (typeof step !== "string" || !step.trim() || typeof output !== "string" || !output.trim()) return null;
  return { step, output };
}

/** All step references anywhere in an input object (recurses objects + arrays). */
export function collectStepRefs(input: unknown): StepRef[] {
  const out: StepRef[] = [];
  const walk = (v: unknown): void => {
    const ref = asStepRef(v);
    if (ref) { out.push(ref); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object") { for (const val of Object.values(v as Record<string, unknown>)) walk(val); }
  };
  walk(input);
  return out;
}

export function hasStepRefs(input: unknown): boolean {
  return collectStepRefs(input).length > 0;
}

/** Structural validation copy: replace every `$ref` with a placeholder that satisfies BOTH uuid and
 *  string input checks, so the compiler can validate the non-reference fields without knowing which
 *  fields a given action expects. (The real value is substituted at runtime.) */
const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";
export function inputForValidation(input: unknown): unknown {
  const ref = asStepRef(input);
  if (ref) return PLACEHOLDER_UUID;
  if (Array.isArray(input)) return input.map(inputForValidation);
  if (input && typeof input === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) o[k] = inputForValidation(v);
    return o;
  }
  return input;
}

/** Resolve every `$ref` against the provided upstream outputs. Throws a descriptive Error when a
 *  referenced step has no persisted output, or the named field is absent (never a silent undefined). */
export function resolveStepRefs(input: unknown, outputsByStep: Map<string, Record<string, unknown> | null>): unknown {
  const ref = asStepRef(input);
  if (ref) {
    if (!outputsByStep.has(ref.step)) throw new Error(`unresolved_step_ref: step '${ref.step}' has no completed output in this run`);
    const out = outputsByStep.get(ref.step);
    if (!out || !(ref.output in out)) throw new Error(`unresolved_step_ref: step '${ref.step}' output has no field '${ref.output}'`);
    const value = out[ref.output];
    if (value === null || value === undefined) throw new Error(`unresolved_step_ref: step '${ref.step}' field '${ref.output}' is null`);
    return value;
  }
  if (Array.isArray(input)) return input.map((v) => resolveStepRefs(v, outputsByStep));
  if (input && typeof input === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) o[k] = resolveStepRefs(v, outputsByStep);
    return o;
  }
  return input;
}
