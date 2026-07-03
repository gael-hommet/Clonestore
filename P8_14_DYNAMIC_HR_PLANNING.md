# P8.14 — Dynamic HR Planning

Pierre composes real capabilities/runtime actions dynamically from a natural-language request — the
opposite of selecting a pre-authored mission pack. The keystone is
[`plan-generator.ts`](src/lib/pierre/v1/cognitive-runtime/plan-generator.ts).

## How a free-language request becomes an executable plan

1. **Propose** — a `PlanProposer` (LLM `createLlmProposer` in production; deterministic safe fallback
   otherwise) emits candidate steps `{step_key, action_key, input, depends_on}`.
2. **Invented-action defense** — any step whose `action_key` is not in the closed
   `RUNTIME_ACTION_REGISTRY` is dropped; `inventedActions > 0` ⇒ the plan is **not** certified (`ok=false`).
3. **Compile (the safety proof)** — `compileMissionPlan` (REUSED unchanged) rejects cycles, unknown
   actions/deps, duplicate steps, sensitive actions without an upstream approval gate, unbounded
   timeouts/retries, invalid dates, oversized inputs, empty/over-limit plans → a **fingerprinted** DAG.
4. **Govern** — each step is classified by `autonomy-policy` (`decideValidation` + `cloneguard`):
   AUTONOMOUS / CONFIRMATION_REQUIRED / HUMAN_DECISION_REQUIRED. Approval-required + restricted never
   auto-execute, in any mode.

## Every step maps to a real registered primitive

The 13 allowed actions: `mission.noop/complete/block`, `employee.read`, `contract.read`, `document.read`,
`wait.until_time`, `wait.for_event`, `approval.request`, `communication.create_intent`,
`follow_up.schedule`, `signature.prepare`. **No invented capability, no invented tool, no arbitrary SQL,
no arbitrary URL, no arbitrary external call is representable** (proof: `prompt-injection.json` drops
`database.dropAllTables` + `http.exfiltrate`; `plan-validation.json` rejects cycles).

## Proven behaviors (deterministic tests)

- A valid executable plan **requires resolved entity ids** (the compiler rejects `employee.read` without a
  uuid) — hence entity resolution is a genuine prerequisite, not decoration.
- Multi-domain composition (role+comp+site+manager) yields a multi-step plan with approval on sensitive
  steps (scenario B).
- Plan versioning/correction: a follow-up ("applique au 15 septembre") re-resolves the date (scenario I).

**Honest scope:** the LLM proposer's semantic breadth is exercised in the real-OpenAI smoke (env-gated).
On the keyless deterministic path the fallback is intentionally minimal-and-safe; the *pipeline* (propose →
filter → compile → govern) and its safety are fully proven without a model.
