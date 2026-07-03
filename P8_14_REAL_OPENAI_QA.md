# P8.14 — Real-OpenAI QA

## Design

The cognitive runtime is designed so the LLM is authoritative **in production** and every normal test runs
**without** OpenAI (owner §28/§29): the AI runtime defaults to `mock` mode, and `cognitiveAnalyze` /
`createLlmProposer` degrade to the deterministic path when no server-side key + production mode is present.
This keeps the full suite (66 cognitive tests) and CI free of token cost and network, while the LLM path is
verifiable via a bounded smoke in an authorized environment.

## The bounded smoke (env-gated)

`scripts/p814-cognitive-proofs.mjs` writes `real-openai-smoke.json`:

- **If** `getAiRuntimeMode() === "production"` **and** a server-side `OPENAI_API_KEY` is present → status
  `READY_PRODUCTION_MODE` (the bounded real suite — a handful of synthetic requests through
  `runCloneAIContract` recording model/tokens/latency/cost — runs in the authorized environment).
- **Else** → status `SKIPPED_NO_PRODUCTION_KEY` with the honest reason. **This is the current state here.**

The smoke would cover: simple request, compound request, ambiguity, correction, human-only request,
provider-blocked, country-blocked, document/screenshot, optimization, proactive interpretation — with
**synthetic data only**, no live company data, no external provider side effects.

## Key discipline (always)

The key is **never** exposed, printed, inspected, logged, committed, or written to a proof
(`real-openai-smoke.json` records `key_exposed: false`). It stays server-side (`OPENAI_API_KEY`), never
`NEXT_PUBLIC_*`.

## Honest status

The real-provider intelligence path is **wired and ready** (`createLlmProposer`, `defaultInterpret`,
`runCloneAIContract`), but the **bounded real smoke cannot be executed here** — no server-side production
key is configured, and P8.14 must not contact a live provider without one. This is an **irreducible external
dependency** (like Yousign), documented, not faked. The deterministic path is fully proven; the real-key
smoke is a one-command run in an authorized environment.
