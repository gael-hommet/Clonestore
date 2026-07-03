# P8.14 — Memory & Learning

## Operational memory (owner §15)

[`operational-memory.ts`](src/lib/pierre/v1/cognitive-runtime/operational-memory.ts) persists **the work**:
request summary, resolved entities, confirmed facts, rejected assumptions, plan version, terminal state,
next expected event. It **never** stores hidden chain-of-thought, raw prompts, or secrets —
`assertNoHiddenReasoning` throws on any `chain_of_thought/reasoning/raw_prompt/system_prompt/api_key/
secret/token` field. The store is **tenant-safe**: `get(companyId, id)` returns null across tenants (proof:
`cognitive-orchestration.test.ts` operational-memory suite).

**Honest scope:** the `CognitiveMemoryStore` interface + an in-memory implementation are built and tested.
A **durable Postgres implementation** satisfying the same interface (a dedicated cognitive-state table on
the existing `pierre_rt_*` connection, additive migration) is the remaining increment for cross-restart
cognitive memory beyond what the mission run already persists (mission summary/next_action/version + task
results are already durable today).

## Learning from corrections (owner §16)

[`learning-policy.ts`](src/lib/pierre/v1/cognitive-runtime/learning-policy.ts) classifies a human correction
into scope and enforces the invariants:

- `temporary_instruction` (one-off) → applies to this operation only.
- `company_preference` (recurring) → reusable for THIS company; **promotion to policy requires approval**.
- `company_policy` (approved + recurring) → governed.
- `canonical_knowledge` / `legal_rule` → **NEVER writable from a correction** (legal content is sourced
  from the country-rule system, never learned).

`neutralizeCorrection` strips uuids/emails so a stored preference cannot carry another company's data, and
every record is company-scoped by key ⇒ **no cross-tenant learning**. Proof: `cognitive-orchestration.test.ts`
learning-policy suite.

**Honest scope:** the classification + neutralization + no-cross-tenant invariants are proven; wiring the
correction-capture UI/feedback loop into the cockpit is a P9-lane increment on top of this policy.
