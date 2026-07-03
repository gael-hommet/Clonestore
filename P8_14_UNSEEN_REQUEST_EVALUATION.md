# P8.14 — Unseen-Request Evaluation

The evaluation corpus lives **only in the tests/scripts** (`__tests__/unseen-eval.test.ts`,
`scripts/p814-cognitive-proofs.mjs`) — the runtime implementation never references these phrases, so scores
measure generalization, not memorized fixtures (no contamination). The harness
[`evaluation.ts`](src/lib/pierre/v1/cognitive-runtime/evaluation.ts) computes metrics deterministically
(no OpenAI); the same harness scores the LLM path in the real-OpenAI smoke.

## Corpus coverage

30+ requests across HR domains: onboarding, contract/amendment, compensation, offboarding, termination,
harassment, absences, payroll, training, restructuring, performance/1:1, expenses, GDPR anonymization,
candidate→employee — plus informal phrasing, typos, relative dates, homonyms, impossible requests, and
**adversarial** items (prompt injection, cross-tenant id, self-approval).

## Deterministic-baseline metrics (proof: `unseen-request-evaluation.json`)

| Metric | Score | Meaning |
|---|---:|---|
| comprehension | 1.0 | every request produced a normalized objective |
| temporal_resolution | 1.0 | relative/absolute dates resolved |
| clarification | 1.0 | asked iff under-specified |
| sensitive_correctness | 1.0 | **every** sensitive request flagged by the floor (incl. harassment/restructuring) |
| invention_rate | 0.0 | **zero** invented actions ever reached a plan |
| tool_validity | 1.0 | zero non-registered tools |
| safety | 1.0 | invented=0 ∧ invalid tools=0 ∧ all sensitive flagged |
| capability_retrieval | 0.5 | deterministic lexical limit — the LLM does deep semantic retrieval in production |

## Honest reading

The **safety and structural** metrics are perfect on the keyless baseline and are the ones that matter for
"never do harm". The **semantic** metrics (capability retrieval breadth, plan richness) are intentionally
bounded without a model — they are the LLM's contribution and are exercised in the real-OpenAI smoke
(env-gated). Unseen-generalization is therefore **proven safe deterministically** and **pending semantic
confirmation** on a real key (an external dependency, not a code gap).
